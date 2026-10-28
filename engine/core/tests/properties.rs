//! Invariants over many seeded random games, and reproducibility.

use briscolab_core::*;

const GAMES: u64 = 5_000;

/// Plays a seeded random game, checking the invariants after every card.
fn checked_game(seed: u64) -> Game {
    let mut game = Game::new(seed);
    let mut bots = [RandomBot::new(seed ^ 0xa5a5), RandomBot::new(seed ^ 0x5a5a)];
    check_invariants(&game);
    while let Some(player) = game.to_play() {
        let obs = game.observation(player);
        assert_eq!(obs.legal_moves(), game.legal_moves());
        let card = bots[player.index()].act(&obs);
        assert!(game.legal_moves().contains(card));
        game.play(card).unwrap();
        check_invariants(&game);
    }
    game
}

fn check_invariants(game: &Game) {
    let hands = Player::ALL.map(|p| game.hand(p));
    let taken = Player::ALL.map(|p| game.taken(p));
    let table: CardSet = game.table().iter().copied().collect();
    let stock: CardSet = game.stock().iter().copied().collect();
    assert_eq!(
        stock.len(),
        game.stock().len(),
        "duplicate card in the stock"
    );
    assert_eq!(
        table.len(),
        game.table().len(),
        "duplicate card on the table"
    );

    // Every card is in exactly one place.
    let places = [hands[0], hands[1], taken[0], taken[1], table, stock];
    let total: usize = places.iter().map(|s| s.len()).sum();
    assert_eq!(total, DECK_SIZE, "a card is missing or duplicated");
    let all = places.iter().fold(CardSet::EMPTY, |acc, &s| acc.union(s));
    assert_eq!(all, CardSet::FULL, "a card is missing");
    assert_eq!(all.points(), TOTAL_POINTS);

    assert_eq!(game.deck_len(), game.stock().len());
    assert_eq!(game.deck_len() % PLAYERS, 0);
    if game.deck_len() > 0 {
        assert_eq!(game.stock().last(), Some(&game.briscola()));
        assert_eq!(game.briscola_drawn_by(), None);
    } else {
        assert!(game.briscola_drawn_by().is_some());
    }

    // Hands hold three cards while the deck lasts, then shrink by one a trick.
    let tricks = game.tricks().len();
    let full = if game.deck_len() > 0 {
        HAND_SIZE
    } else {
        TRICKS - tricks
    };
    for p in Player::ALL {
        let on_table = game.table().len() > (p.index() + PLAYERS - game.leader().index()) % PLAYERS;
        assert_eq!(hands[p.index()].len() + usize::from(on_table), full);
    }

    // Points taken are the points of the tricks won.
    for p in Player::ALL {
        let won: u8 = game
            .tricks()
            .iter()
            .filter(|t| t.winner == p)
            .map(Trick::points)
            .sum();
        assert_eq!(won, game.points()[p.index()]);
    }
}

#[test]
fn random_games_keep_every_invariant() {
    for seed in 0..GAMES {
        let game = checked_game(seed);
        assert!(game.is_over());
        assert_eq!(game.tricks().len(), TRICKS);
        assert_eq!(game.points().iter().sum::<u8>(), TOTAL_POINTS);
        let played: CardSet = game.tricks().iter().flat_map(|t| t.cards).collect();
        assert_eq!(played, CardSet::FULL);
        let outcome = game.outcome().unwrap();
        let [a, b] = game.points();
        match outcome {
            Outcome::Win(p) => assert!(game.points()[p.index()] > 60),
            Outcome::Draw => assert_eq!((a, b), (60, 60)),
        }
    }
}

#[test]
fn every_trick_follows_the_winner_rules() {
    for seed in 0..GAMES {
        let game = checked_game(seed);
        let briscola = game.briscola_suit();
        let mut leader = Player::P1.next();
        for trick in game.tricks() {
            assert_eq!(trick.leader, leader, "the winner of a trick leads the next");
            let [led, answer] = trick.cards;
            let answer_wins = if led.suit() == answer.suit() {
                answer.strength() > led.strength()
            } else {
                answer.suit() == briscola
            };
            let expected = if answer_wins {
                trick.leader.next()
            } else {
                trick.leader
            };
            assert_eq!(
                trick.winner, expected,
                "{led} then {answer}, briscola {briscola:?}"
            );
            leader = trick.winner;
        }
    }
}

#[test]
fn the_briscola_is_drawn_last_by_the_loser_of_trick_17() {
    for seed in 0..GAMES {
        let game = checked_game(seed);
        let trick = game.tricks()[TRICKS - HAND_SIZE - 1];
        assert_eq!(game.briscola_drawn_by(), Some(trick.winner.next()));
        let drawer = game.briscola_drawn_by().unwrap();
        let played_by_drawer = game.tricks()[TRICKS - HAND_SIZE..]
            .iter()
            .map(|t| t.card_of(drawer));
        assert!(played_by_drawer
            .into_iter()
            .any(|card| card == game.briscola()));
    }
}

#[test]
fn a_game_is_reproducible_from_its_seed() {
    for seed in [0, 1, 42, u64::MAX] {
        assert_eq!(checked_game(seed), checked_game(seed));
    }
    assert_ne!(Game::new(1), Game::new(2));
}

#[test]
fn the_dealer_is_the_only_difference_between_seats() {
    let a = Game::with_dealer(9, Player::P1);
    let b = Game::with_dealer(9, Player::P0);
    assert_eq!(a.hand(Player::P0), b.hand(Player::P1));
    assert_eq!(a.hand(Player::P1), b.hand(Player::P0));
    assert_eq!(a.stock(), b.stock());
    assert_eq!(b.to_play(), Some(Player::P1));
}

#[test]
fn an_observation_does_not_depend_on_hidden_cards() {
    for seed in 0..200u64 {
        let mut deck = Card::all();
        Rng::new(seed).shuffle(&mut deck);
        // P1 deals: P0 holds deck[0], deck[2], deck[4]; P1 holds deck[1]. Swap that card with one deep in the deck.
        let mut other = deck;
        other.swap(1, 30);
        let a = Game::from_deck(deck, Player::P1).unwrap();
        let b = Game::from_deck(other, Player::P1).unwrap();
        assert_ne!(a, b);
        assert_eq!(a.observation(Player::P0), b.observation(Player::P0));
    }
}

#[test]
fn the_rng_is_uniform_enough() {
    let mut rng = Rng::new(3);
    let mut counts = [0u32; 6];
    for _ in 0..60_000 {
        counts[rng.below(6) as usize] += 1;
    }
    for n in counts {
        assert!((9_500..10_500).contains(&n), "{counts:?}");
    }
}

/// Pins the generator, so a seed means the same game natively, in WebAssembly and from Python.
#[test]
fn the_rng_gives_the_recorded_numbers() {
    let mut rng = Rng::new(0);
    assert_eq!(rng.next_u64(), 0x99ec_5f36_cb75_f2b4);
    assert_eq!(rng.next_u64(), 0xbf6e_1f78_4956_452a);
    assert_eq!(rng.next_u64(), 0x1a5f_849d_4933_e6e0);
}

/// A recorded game: seed 2026, random bots seeded 1 and 2. Any change to the deal, the rules or the generator
/// shows up here.
#[test]
fn recorded_game_seed_2026() {
    let mut game = Game::new(2026);
    play_out(
        &mut game,
        &mut [&mut RandomBot::new(1), &mut RandomBot::new(2)],
    )
    .unwrap();
    let tricks: Vec<String> = game
        .tricks()
        .iter()
        .map(|t| format!("{} {} {}", t.cards[0], t.cards[1], t.winner))
        .collect();
    let expected = "1b 2b P0, 1d 9s P0, 7c 3c P1, 8s 4d P0, 4b 6s P0, 1c 4c P0, 5d 2s P0, 8d 9c P0, \
                    6b 7b P1, 10s 7d P0, 9d 10d P1, 6c 3d P0, 7s 5b P0, 3s 5s P0, 10c 8b P0, 10b 5c P0, \
                    2c 4s P0, 9b 6d P1, 8c 3b P1, 2d 1s P1";
    assert_eq!(game.briscola(), "6d".parse().unwrap());
    assert_eq!(tricks.join(", "), expected);
    assert_eq!(game.points(), [77, 43]);
    assert_eq!(game.outcome(), Some(Outcome::Win(Player::P0)));
    assert_eq!(game.briscola_drawn_by(), Some(Player::P1));
}
