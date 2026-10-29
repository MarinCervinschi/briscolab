//! Determinisation, the exact endgame solver, and the search bots built on them.

use briscolab_core::*;

fn c(s: &str) -> Card {
    s.parse().unwrap()
}

/// Plays a seeded random game, calling `check` before every card with the game and the player to move.
fn random_game(seed: u64, mut check: impl FnMut(&Game, Player)) -> Game {
    let mut game = Game::new(seed);
    let mut bots = [RandomBot::new(seed), RandomBot::new(!seed)];
    while let Some(player) = game.to_play() {
        check(&game, player);
        let card = bots[player.index()].act(&game.observation(player));
        game.play(card).unwrap();
    }
    game
}

#[test]
fn a_determinised_game_shows_the_player_exactly_what_they_know() {
    for seed in 0..300 {
        random_game(seed, |game, _| {
            for player in Player::ALL {
                let obs = game.observation(player);
                let det = Game::determinise(&obs, &mut Rng::new(seed));
                assert_eq!(det.observation(player), obs, "seed {seed}");
            }
        });
    }
}

#[test]
fn a_determinised_game_holds_every_card_once_and_plays_to_the_end() {
    for seed in 0..300 {
        random_game(seed, |game, player| {
            let mut det = Game::determinise(&game.observation(player), &mut Rng::new(!seed));
            let places = [
                det.hand(Player::P0),
                det.hand(Player::P1),
                det.taken(Player::P0),
                det.taken(Player::P1),
                det.table().iter().copied().collect(),
                det.stock().iter().copied().collect(),
            ];
            assert_eq!(places.iter().map(|s| s.len()).sum::<usize>(), DECK_SIZE);
            let all = places.iter().fold(CardSet::EMPTY, |acc, &s| acc.union(s));
            assert_eq!(all, CardSet::FULL);
            play_out(
                &mut det,
                &mut [&mut RandomBot::new(1), &mut RandomBot::new(2)],
            )
            .unwrap();
        });
    }
}

#[test]
fn different_seeds_deal_the_hidden_cards_differently() {
    let game = Game::new(5);
    let obs = game.observation(Player::P0);
    let a = Game::determinise(&obs, &mut Rng::new(1));
    let b = Game::determinise(&obs, &mut Rng::new(2));
    assert_ne!(a.hand(Player::P1), b.hand(Player::P1));
}

#[test]
fn with_the_deck_empty_the_determinisation_is_the_real_game() {
    for seed in 0..300 {
        random_game(seed, |game, player| {
            if game.deck_len() > 0 {
                return;
            }
            let det = Game::determinise(&game.observation(player), &mut Rng::new(seed));
            for p in Player::ALL {
                assert_eq!(det.hand(p), game.hand(p), "seed {seed}");
            }
        });
    }
}

/// Plays the lowest card in hand, in index order.
struct LowestBot;

impl Bot for LowestBot {
    fn act(&mut self, obs: &Observation) -> Card {
        obs.legal_moves().nth(0).unwrap()
    }
}

/// Traced by hand: the reference game of `tests/rules.rs` after trick 17.
#[test]
fn the_solver_finds_the_best_line_of_a_reference_endgame() {
    let mut game = Game::from_deck(Card::all(), Player::P1).unwrap();
    while game.tricks().len() < 17 {
        let player = game.to_play().unwrap();
        let card = LowestBot.act(&game.observation(player));
        game.play(card).unwrap();
    }
    // Briscola coppe. P0 holds 7s 9s 10s with 56 points and leads; P1 holds 6s 8s 7c with 55. 9 points are left,
    // and P1's 7c takes one trick whatever happens. Leading the 9s gives P0 3 more; the 7s or the 10s give 4.
    assert_eq!(game.points(), [56, 55]);
    assert_eq!(solve(&game), Some((c("7s"), 60)));
}

#[test]
fn the_solver_guarantees_its_value_against_any_opponent() {
    for seed in 0..200 {
        let mut endgames = Vec::new();
        random_game(seed, |game, _| {
            if game.deck_len() == 0 {
                endgames.push(game.clone());
            }
        });
        for endgame in endgames {
            let player = endgame.to_play().unwrap();
            let (_, value) = solve(&endgame).unwrap();
            // The solver against any bot ends with at least its value; any bot against the solver, at most.
            for other in [
                &mut HardBot as &mut dyn Bot,
                &mut GreedyBot,
                &mut RandomBot::new(seed),
            ] {
                let mut game = endgame.clone();
                while let Some(p) = game.to_play() {
                    let card = if p == player {
                        solve(&game).unwrap().0
                    } else {
                        other.act(&game.observation(p))
                    };
                    game.play(card).unwrap();
                }
                assert!(game.points()[player.index()] >= value, "seed {seed}");

                let mut game = endgame.clone();
                while let Some(p) = game.to_play() {
                    let card = if p == player {
                        other.act(&game.observation(p))
                    } else {
                        solve(&game).unwrap().0
                    };
                    game.play(card).unwrap();
                }
                assert!(game.points()[player.index()] <= value, "seed {seed}");
            }
        }
    }
}

#[test]
fn the_solver_has_nothing_to_say_once_the_game_is_over() {
    let game = random_game(3, |_, _| {});
    assert_eq!(solve(&game), None);
}

#[test]
fn pimc_plays_exactly_once_the_deck_is_empty() {
    for seed in 0..100 {
        random_game(seed, |game, player| {
            if game.deck_len() > 0 {
                return;
            }
            let obs = game.observation(player);
            assert_eq!(
                PimcBot::new(5, seed).act(&obs),
                EndgameBot.act(&obs),
                "seed {seed}"
            );
        });
    }
}

#[test]
fn pimc_is_reproducible_from_its_seed() {
    let obs = Game::new(11).observation(Player::P0);
    let picks = |seed| PimcBot::new(20, seed).act(&obs);
    assert_eq!(picks(7), picks(7));
}

#[test]
fn ismcts_plays_exactly_once_the_deck_is_empty() {
    for seed in 0..100 {
        random_game(seed, |game, player| {
            if game.deck_len() > 0 {
                return;
            }
            let obs = game.observation(player);
            assert_eq!(
                IsmctsBot::new(5, seed).act(&obs),
                EndgameBot.act(&obs),
                "seed {seed}"
            );
        });
    }
}

#[test]
fn ismcts_is_reproducible_from_its_seed() {
    let obs = Game::new(11).observation(Player::P0);
    let picks = |seed| IsmctsBot::new(200, seed).act(&obs);
    assert_eq!(picks(7), picks(7));
}
