//! The engine for the site, compiled to WebAssembly and run in a Web Worker: a game, what a seat sees of it, and
//! the bots with their reasoning. Translation only; values cross to JavaScript as JSON.

use briscolab_core::{
    Bot, Card, CardSet, EndgameBot, EndgameReason, Game, GreedyBot, GreedyRule, HardBot, HardRule,
    IsmctsSearch, Outcome, Player, RandomBot, Rng, Trick, PLAYERS,
};
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

const ISMCTS_ITERATIONS: usize = 1000;

/// One game: the full state stays here, and JavaScript only reads what a seat can see. Each seat may have a bot,
/// kept for the whole game as in the arena, so a seeded game plays the same cards here as in the engine's tests.
#[wasm_bindgen]
pub struct Session {
    game: Game,
    bots: [Option<SeatBot>; PLAYERS],
    thinking: Option<Thinking>,
}

/// A seat's bot. ISMCTS keeps only its generator between cards: its search is built afresh for each one.
#[derive(Clone)]
enum SeatBot {
    Random(RandomBot),
    Greedy,
    Hard,
    Endgame,
    Ismcts { iterations: usize, rng: Rng },
}

/// The card being chosen: decided at once, or an ISMCTS search that runs in steps.
enum Thinking {
    Chosen(Card, Value),
    Search { search: IsmctsSearch, budget: usize },
}

#[wasm_bindgen]
impl Session {
    /// A new game dealt from `seed`; seat 0 leads.
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32) -> Session {
        Session {
            game: Game::new(u64::from(seed)),
            bots: [None, None],
            thinking: None,
        }
    }

    /// Seats a bot: `random`, `greedy`, `hard`, `endgame`, `ismcts` (1000 iterations) or `ismcts:<n>`.
    #[wasm_bindgen(js_name = seatBot)]
    pub fn seat_bot(&mut self, seat: u8, bot: &str, seed: u32) -> Result<(), JsError> {
        let player = seat_player(seat)?;
        self.bots[player.index()] = Some(make_bot(bot, u64::from(seed))?);
        Ok(())
    }

    /// What the player in `seat` knows, as JSON.
    pub fn view(&self, seat: u8) -> Result<String, JsError> {
        let player = seat_player(seat)?;
        let obs = self.game.observation(player);
        let outcome = self.game.outcome().map(|o| match o {
            Outcome::Win(p) => json!({ "winner": p.index() }),
            Outcome::Draw => json!({ "winner": null }),
        });
        let view = json!({
            "seat": seat,
            "hand": cards(obs.hand),
            "table": obs.table.iter().map(|&c| card(c)).collect::<Vec<_>>(),
            "briscola": card(obs.briscola),
            "briscolaDrawnBy": obs.briscola_drawn_by.map(Player::index),
            "deckLen": obs.deck_len,
            "handLens": obs.hand_lens,
            "leader": obs.leader.index(),
            "toPlay": obs.to_play.map(Player::index),
            "tricks": obs.tricks.iter().map(trick).collect::<Vec<_>>(),
            "points": self.game.points(),
            "outcome": outcome,
        });
        Ok(view.to_string())
    }

    /// Plays `card` (an index from 0 to 39) for the player to move.
    pub fn play(&mut self, card: u8) -> Result<(), JsError> {
        let card = Card::from_index(card).ok_or_else(|| JsError::new("no such card"))?;
        self.game
            .play(card)
            .map_err(|e| JsError::new(&e.to_string()))?;
        self.thinking = None;
        Ok(())
    }

    /// Starts the bot of the player to move on its card, from that player's observation.
    pub fn think(&mut self) -> Result<(), JsError> {
        let player = self
            .game
            .to_play()
            .ok_or_else(|| JsError::new("the game is over"))?;
        let bot = self.bots[player.index()]
            .as_mut()
            .ok_or_else(|| JsError::new("no bot in this seat"))?;
        let obs = self.game.observation(player);
        let chosen = |(card, reasoning)| Thinking::Chosen(card, reasoning);
        self.thinking = Some(match bot {
            SeatBot::Random(random) => chosen((random.act(&obs), json!({ "kind": "random" }))),
            SeatBot::Greedy => {
                let (card, rule) = GreedyBot::choose(&obs);
                chosen((
                    card,
                    json!({ "kind": "rule", "bot": "greedy", "rule": greedy_rule(rule) }),
                ))
            }
            SeatBot::Hard => {
                let (card, rule) = HardBot::choose(&obs);
                chosen((
                    card,
                    json!({ "kind": "rule", "bot": "hard", "rule": hard_rule(rule) }),
                ))
            }
            // With the deck empty ISMCTS plays exactly, as Endgame does.
            SeatBot::Endgame | SeatBot::Ismcts { .. } if obs.deck_len == 0 => {
                let (card, reason) = EndgameBot::choose(&obs);
                chosen((card, endgame_reasoning(&reason)))
            }
            SeatBot::Endgame => {
                let (card, reason) = EndgameBot::choose(&obs);
                chosen((card, endgame_reasoning(&reason)))
            }
            SeatBot::Ismcts { iterations, rng } => Thinking::Search {
                search: IsmctsSearch::new(obs, rng.clone()),
                budget: *iterations,
            },
        });
        Ok(())
    }

    /// Runs up to `iterations` more iterations of a search, never past its budget; returns whether the bot has
    /// its card.
    pub fn step(&mut self, iterations: u32) -> bool {
        if let Some(Thinking::Search { search, budget }) = &mut self.thinking {
            let left = budget.saturating_sub(search.iterations());
            search.run(left.min(iterations as usize));
        }
        self.done()
    }

    /// Whether the bot has its card: at once for the instant bots, at the end of its budget for ISMCTS.
    pub fn done(&self) -> bool {
        match &self.thinking {
            Some(Thinking::Search { search, budget }) => search.iterations() >= *budget,
            _ => true,
        }
    }

    /// The reasoning so far, as JSON.
    pub fn reasoning(&self) -> Result<String, JsError> {
        match &self.thinking {
            Some(Thinking::Chosen(_, reasoning)) => Ok(reasoning.to_string()),
            Some(Thinking::Search { search, budget }) => {
                Ok(search_reasoning(search, *budget).to_string())
            }
            None => Err(JsError::new("no bot is thinking")),
        }
    }

    /// Plays the bot's card, or its best so far when the search is stopped early, and returns it.
    #[wasm_bindgen(js_name = playThought)]
    pub fn play_thought(&mut self) -> Result<u8, JsError> {
        let player = self
            .game
            .to_play()
            .ok_or_else(|| JsError::new("the game is over"))?;
        let card = match self.thinking.take() {
            Some(Thinking::Chosen(card, _)) => card,
            Some(Thinking::Search { search, .. }) => {
                if search.iterations() == 0 {
                    return Err(JsError::new("the search has not started"));
                }
                // The generator moves on as it would in the arena's bot.
                if let Some(SeatBot::Ismcts { rng, .. }) = &mut self.bots[player.index()] {
                    *rng = search.rng().clone();
                }
                search.best()
            }
            None => return Err(JsError::new("no bot is thinking")),
        };
        self.play(card.index())?;
        Ok(card.index())
    }
}

fn make_bot(bot: &str, seed: u64) -> Result<SeatBot, JsError> {
    if let Some(n) = bot.strip_prefix("ismcts:") {
        let iterations = n
            .parse()
            .ok()
            .filter(|&n| n > 0)
            .ok_or_else(|| JsError::new("ismcts:<n> needs n > 0"))?;
        return Ok(SeatBot::Ismcts {
            iterations,
            rng: Rng::new(seed),
        });
    }
    match bot {
        "random" => Ok(SeatBot::Random(RandomBot::new(seed))),
        "greedy" => Ok(SeatBot::Greedy),
        "hard" => Ok(SeatBot::Hard),
        "endgame" => Ok(SeatBot::Endgame),
        "ismcts" => Ok(SeatBot::Ismcts {
            iterations: ISMCTS_ITERATIONS,
            rng: Rng::new(seed),
        }),
        _ => Err(JsError::new(&format!("unknown bot {bot:?}"))),
    }
}

fn seat_player(seat: u8) -> Result<Player, JsError> {
    Player::ALL
        .get(usize::from(seat))
        .copied()
        .ok_or_else(|| JsError::new("no such seat"))
}

fn card(c: Card) -> Value {
    json!({
        "index": c.index(),
        "name": c.to_string(),
        "suit": format!("{:?}", c.suit()).to_lowercase(),
        "rank": c.rank().value(),
        "points": c.points(),
    })
}

fn cards(set: CardSet) -> Vec<Value> {
    set.iter().map(card).collect()
}

fn trick(t: &Trick) -> Value {
    json!({
        "leader": t.leader.index(),
        "cards": t.cards.map(card),
        "winner": t.winner.index(),
        "points": t.points(),
    })
}

fn greedy_rule(rule: GreedyRule) -> &'static str {
    match rule {
        GreedyRule::Lead => "lead",
        GreedyRule::Take => "take",
        GreedyRule::GiveAway => "giveAway",
    }
}

fn hard_rule(rule: HardRule) -> &'static str {
    match rule {
        HardRule::Lead => "lead",
        HardRule::AssoOnTreOfBriscola => "assoOnTreOfBriscola",
        HardRule::SpareOnBriscola => "spareOnBriscola",
        HardRule::AssoOnCarico => "assoOnCarico",
        HardRule::BriscolaOnCarico => "briscolaOnCarico",
        HardRule::StrongestOfSuit => "strongestOfSuit",
        HardRule::Spare => "spare",
    }
}

fn endgame_reasoning(reason: &EndgameReason) -> Value {
    match reason {
        EndgameReason::Hard(rule) => {
            json!({ "kind": "rule", "bot": "hard", "rule": hard_rule(*rule) })
        }
        EndgameReason::Exact(results) => json!({
            "kind": "exact",
            "results": results
                .iter()
                .map(|&(c, points)| json!({ "card": card(c), "points": points }))
                .collect::<Vec<_>>(),
        }),
    }
}

fn search_reasoning(search: &IsmctsSearch, budget: usize) -> Value {
    json!({
        "kind": "search",
        "iterations": search.iterations(),
        "budget": budget,
        "cards": search
            .stats()
            .iter()
            .map(|s| json!({ "card": card(s.card), "visits": s.visits, "expectedPoints": s.expected_points }))
            .collect::<Vec<_>>(),
        "hypotheses": search
            .hypotheses()
            .map(|h| json!({ "iteration": h.iteration, "hand": cards(h.opponent_hand), "points": h.points }))
            .collect::<Vec<_>>(),
    })
}
