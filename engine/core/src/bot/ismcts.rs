use crate::bot::{playout, Bot, EndgameBot};
use crate::card::{Card, TOTAL_POINTS};
use crate::card_set::CardSet;
use crate::game::Game;
use crate::observation::Observation;
use crate::player::Player;
use crate::rng::Rng;

/// The UCB1 exploration constant, for rewards between 0 and 1.
// Tuned against PIMC in the arena: the cards' mean rewards differ by a few hundredths, and the usual 0.7 explored
// so much that 1000 iterations lost 45% to 55%.
const EXPLORATION: f64 = 0.1;

/// Information-set Monte Carlo tree search with a single observer (Cowling, Powley and Whitehouse, 2012): one tree
/// of the cards both sides play from the bot's point of view, searched on a new deal consistent with what the bot
/// knows at every iteration.
///
/// An iteration goes down the tree through the cards legal on its deal, choosing by UCB1 over how often each was
/// available, adds one card, and finishes the deal as [`PimcBot`](crate::PimcBot) does: Hard for both sides while
/// the deck lasts, then exactly. The reward is the share of the 120 points the side that chose the card ends with.
/// The bot plays its most visited card. With the deck empty it plays exactly, like [`EndgameBot`]. Reproducible from
/// its seed.
#[derive(Clone, Debug)]
pub struct IsmctsBot {
    iterations: usize,
    rng: Rng,
}

impl IsmctsBot {
    /// Panics if `iterations` is 0.
    pub fn new(iterations: usize, seed: u64) -> IsmctsBot {
        assert!(iterations > 0, "ISMCTS needs at least one iteration");
        IsmctsBot {
            iterations,
            rng: Rng::new(seed),
        }
    }
}

#[derive(Clone, Debug)]
struct Node {
    card: Card,
    mover: Player,
    children: Vec<usize>,
    visits: u32,
    available: u32,
    reward: f64,
}

impl Node {
    fn new(card: Card, mover: Player) -> Node {
        Node {
            card,
            mover,
            children: Vec::new(),
            visits: 0,
            available: 0,
            reward: 0.0,
        }
    }

    fn ucb(&self) -> f64 {
        let visits = f64::from(self.visits);
        self.reward / visits + EXPLORATION * (f64::from(self.available).ln() / visits).sqrt()
    }
}

impl Bot for IsmctsBot {
    fn act(&mut self, obs: &Observation) -> Card {
        if obs.deck_len == 0 {
            return EndgameBot.act(obs);
        }
        let mut search = IsmctsSearch::new(obs.clone(), self.rng.clone());
        search.run(self.iterations);
        let card = search.best();
        self.rng = search.rng;
        card
    }
}

/// What the search has learnt about one of the bot's cards.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CardStats {
    pub card: Card,
    /// How many iterations went through this card.
    pub visits: u32,
    /// The points out of 120 the bot ended with, on average, after playing it.
    pub expected_points: f64,
}

/// One deal the search imagined: the opponent's hand in it and the points the bot ended that iteration with.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Hypothesis {
    pub iteration: usize,
    pub opponent_hand: CardSet,
    pub points: u8,
}

/// How many of the latest hypotheses the search keeps.
const HYPOTHESES: usize = 8;

/// The search of [`IsmctsBot`] run in steps, so a caller can stop it on a clock of its own and read what it has
/// found so far. [`IsmctsBot::act`] runs the same search, so a step-by-step run plays the same card.
#[derive(Clone, Debug)]
pub struct IsmctsSearch {
    obs: Observation,
    rng: Rng,
    tree: Vec<Node>,
    iterations: usize,
    hypotheses: Vec<Hypothesis>,
}

impl IsmctsSearch {
    /// Panics if the deck is empty: from there [`EndgameBot`] plays exactly.
    pub fn new(obs: Observation, rng: Rng) -> IsmctsSearch {
        assert!(
            obs.deck_len > 0,
            "ISMCTS searches only while the deck lasts"
        );
        // The root's card and mover are never read.
        let root = Node::new(obs.hand.nth(0).expect("a card in hand"), obs.player);
        IsmctsSearch {
            obs,
            rng,
            tree: vec![root],
            iterations: 0,
            hypotheses: Vec::new(),
        }
    }

    /// Runs `iterations` more iterations.
    pub fn run(&mut self, iterations: usize) {
        for _ in 0..iterations {
            self.iterate();
        }
    }

    pub fn iterations(&self) -> usize {
        self.iterations
    }

    /// The generator as the search left it: [`IsmctsBot`] carries it on to its next card.
    pub fn rng(&self) -> &Rng {
        &self.rng
    }

    /// The most visited card; ties go to the lowest index. Panics before the first iteration.
    pub fn best(&self) -> Card {
        let most_visited = self.tree[0]
            .children
            .iter()
            .max_by_key(|&&c| {
                (
                    self.tree[c].visits,
                    std::cmp::Reverse(self.tree[c].card.index()),
                )
            })
            .expect("a card tried");
        self.tree[*most_visited].card
    }

    /// Each of the bot's cards tried so far, in index order.
    pub fn stats(&self) -> Vec<CardStats> {
        let mut stats: Vec<CardStats> = self.tree[0]
            .children
            .iter()
            .map(|&c| {
                let node = &self.tree[c];
                CardStats {
                    card: node.card,
                    visits: node.visits,
                    expected_points: node.reward / f64::from(node.visits) * f64::from(TOTAL_POINTS),
                }
            })
            .collect();
        stats.sort_by_key(|s| s.card.index());
        stats
    }

    /// The latest hypotheses, newest first.
    pub fn hypotheses(&self) -> impl Iterator<Item = &Hypothesis> {
        self.hypotheses.iter().rev()
    }

    fn iterate(&mut self) {
        let obs = &self.obs;
        let tree = &mut self.tree;
        let mut game = Game::determinise(obs, &mut self.rng);
        // The bot's own view of this deal: the hand it imagines for the opponent.
        let opponent_hand = game.hand(obs.player.next());
        let mut path = Vec::new();
        let mut node = 0;
        // Below an empty deck the playout is already exact, so the tree stops there.
        while game.deck_len() > 0 {
            let mover = game
                .to_play()
                .expect("the game goes on while the deck lasts");
            let legal = game.legal_moves();
            let tried: CardSet = tree[node].children.iter().map(|&c| tree[c].card).collect();
            let untried = legal.difference(tried);
            if !untried.is_empty() {
                let card = untried
                    .nth(self.rng.below(untried.len() as u64) as usize)
                    .expect("an untried card");
                tree.push(Node::new(card, mover));
                let child = tree.len() - 1;
                tree[node].children.push(child);
                game.play(card).expect("a legal move");
                path.push(child);
                break;
            }
            let mut best: Option<(usize, f64)> = None;
            for i in 0..tree[node].children.len() {
                let child = tree[node].children[i];
                if !legal.contains(tree[child].card) {
                    continue;
                }
                tree[child].available += 1;
                let ucb = tree[child].ucb();
                if best.is_none_or(|(_, b)| ucb > b) {
                    best = Some((child, ucb));
                }
            }
            node = best.expect("a legal child").0;
            game.play(tree[node].card).expect("a legal move");
            path.push(node);
        }
        let points = playout(game, obs.player);
        for &n in &path {
            let node = &mut tree[n];
            let mine = if node.mover == obs.player {
                points
            } else {
                TOTAL_POINTS - points
            };
            node.visits += 1;
            node.reward += f64::from(mine) / f64::from(TOTAL_POINTS);
        }
        self.iterations += 1;
        if self.hypotheses.len() == HYPOTHESES {
            self.hypotheses.remove(0);
        }
        self.hypotheses.push(Hypothesis {
            iteration: self.iterations,
            opponent_hand,
            points,
        });
    }
}
