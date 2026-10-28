//! The rules of `docs/rules.md`, checked on hand-built positions.

use briscolab_core::*;

fn c(s: &str) -> Card {
    s.parse().unwrap()
}

fn set(cards: &str) -> CardSet {
    cards.split_whitespace().map(c).collect()
}

/// The deck in index order: coppe 1–10, denari, bastoni, spade.
fn sorted_deck() -> [Card; DECK_SIZE] {
    Card::all()
}

#[test]
fn the_deck_has_40_distinct_cards_and_120_points() {
    let all = Card::all();
    assert_eq!(all.iter().copied().collect::<CardSet>(), CardSet::FULL);
    assert_eq!(CardSet::FULL.len(), DECK_SIZE);
    assert_eq!(CardSet::FULL.points(), TOTAL_POINTS);
    for suit in Suit::ALL {
        assert_eq!(CardSet::suit(suit).points(), 30);
    }
}

#[test]
fn points_and_strength_follow_the_table() {
    let points: Vec<u8> = Rank::ALL.iter().map(|r| r.points()).collect();
    assert_eq!(points, [11, 0, 10, 0, 0, 0, 0, 2, 3, 4]);
    // Strongest first: Asso, Tre, Re, Cavallo, Fante, 7, 6, 5, 4, 2.
    let mut by_strength = Rank::ALL;
    by_strength.sort_by_key(|r| std::cmp::Reverse(r.strength()));
    let values: Vec<u8> = by_strength.iter().map(|r| r.value()).collect();
    assert_eq!(values, [1, 3, 10, 9, 8, 7, 6, 5, 4, 2]);
}

#[test]
fn cards_print_and_parse() {
    for card in Card::all() {
        assert_eq!(card.to_string().parse::<Card>(), Ok(card));
    }
    assert_eq!(c("1c"), Card::new(Suit::Coppe, Rank::Asso));
    assert_eq!(c("10s"), Card::new(Suit::Spade, Rank::Re));
    assert_eq!(c("8b"), Card::new(Suit::Bastoni, Rank::Fante));
    for bad in ["", "c", "0c", "11d", "3x", "1"] {
        assert!(bad.parse::<Card>().is_err(), "{bad:?} parsed");
    }
}

#[test]
fn card_sets_behave_like_sets() {
    let mut s = set("1c 3d 10s");
    assert_eq!(s.len(), 3);
    assert!(s.contains(c("3d")));
    assert!(!s.insert(c("3d")));
    assert!(s.insert(c("2b")));
    assert!(s.remove(c("1c")));
    assert!(!s.remove(c("1c")));
    assert_eq!(s, set("2b 3d 10s"));
    assert_eq!(s.points(), 14);
    assert_eq!(s.iter().collect::<Vec<_>>(), [c("3d"), c("2b"), c("10s")]);
    assert_eq!(s.complement().len(), 37);
    assert!(s.is_disjoint(s.complement()));
    assert_eq!(s.to_string(), "[3d 2b 10s]");
}

#[test]
fn the_higher_card_of_the_suit_led_wins_without_briscole() {
    let b = Suit::Spade;
    assert_eq!(trick_winner(&[c("3c"), c("1c")], b), 1);
    assert_eq!(trick_winner(&[c("1c"), c("3c")], b), 0);
    assert_eq!(trick_winner(&[c("10d"), c("9d")], b), 0);
    assert_eq!(trick_winner(&[c("2d"), c("4d")], b), 1);
    assert_eq!(trick_winner(&[c("7b"), c("8b")], b), 1);
}

#[test]
fn a_card_of_another_suit_never_wins() {
    let b = Suit::Spade;
    assert_eq!(trick_winner(&[c("2c"), c("1d")], b), 0);
    assert_eq!(trick_winner(&[c("2c"), c("3b")], b), 0);
}

#[test]
fn a_briscola_beats_any_other_suit() {
    let b = Suit::Spade;
    assert_eq!(trick_winner(&[c("1c"), c("2s")], b), 1);
    assert_eq!(trick_winner(&[c("2s"), c("1c")], b), 0);
}

#[test]
fn the_higher_briscola_wins() {
    let b = Suit::Spade;
    assert_eq!(trick_winner(&[c("3s"), c("1s")], b), 1);
    assert_eq!(trick_winner(&[c("10s"), c("2s")], b), 0);
}

#[test]
fn the_dealer_deals_one_at_a_time_starting_with_the_opponent() {
    let game = Game::from_deck(sorted_deck(), Player::P1).unwrap();
    assert_eq!(game.hand(Player::P0), set("1c 3c 5c"));
    assert_eq!(game.hand(Player::P1), set("2c 4c 6c"));
    assert_eq!(game.briscola(), c("7c"));
    assert_eq!(game.leader(), Player::P0);
    assert_eq!(game.to_play(), Some(Player::P0));
    assert_eq!(game.deck_len(), 34);
    assert_eq!(game.stock().first(), Some(&c("8c")));
    assert_eq!(game.stock().last(), Some(&c("7c")));

    let game = Game::from_deck(sorted_deck(), Player::P0).unwrap();
    assert_eq!(game.hand(Player::P1), set("1c 3c 5c"));
    assert_eq!(game.hand(Player::P0), set("2c 4c 6c"));
    assert_eq!(game.to_play(), Some(Player::P1));
}

#[test]
fn a_deck_must_be_a_permutation() {
    let mut deck = sorted_deck();
    deck[5] = deck[4];
    assert_eq!(Game::from_deck(deck, Player::P1), Err(DeckError));
}

#[test]
fn only_cards_in_hand_can_be_played() {
    let mut game = Game::from_deck(sorted_deck(), Player::P1).unwrap();
    let before = game.clone();
    // P1's card, and a card in the deck.
    for card in [c("2c"), c("8c"), c("7c")] {
        assert_eq!(
            game.play(card),
            Err(PlayError::NotInHand {
                player: Player::P0,
                card
            })
        );
        assert_eq!(game, before);
    }
    assert_eq!(game.legal_moves(), set("1c 3c 5c"));
    assert_eq!(game.play(c("1c")), Ok(None));
    // P0 cannot play twice in a row, and the card just played is gone.
    assert_eq!(game.legal_moves(), set("2c 4c 6c"));
    assert!(game.play(c("3c")).is_err());
    assert!(game.play(c("1c")).is_err());
}

#[test]
fn there_is_no_obligation_to_follow_suit_or_to_trump() {
    // P0: 1d 1b 1s, P1: 2d 2b 2s, briscola 7c: P1 may answer 1d with anything.
    let mut deck = sorted_deck();
    let order = ["1d", "2d", "1b", "2b", "1s", "2s", "7c"];
    for (i, card) in order.iter().enumerate() {
        let j = deck.iter().position(|&d| d == c(card)).unwrap();
        deck.swap(i, j);
    }
    for answer in ["2d", "2b", "2s"] {
        let mut game = Game::from_deck(deck, Player::P1).unwrap();
        game.play(c("1d")).unwrap();
        let trick = game.play(c(answer)).unwrap().unwrap();
        assert_eq!(trick.winner, Player::P0);
    }
}

#[test]
fn the_winner_draws_first_and_leads() {
    let mut game = Game::from_deck(sorted_deck(), Player::P1).unwrap();
    game.play(c("5c")).unwrap();
    let trick = game.play(c("6c")).unwrap().unwrap();
    assert_eq!(trick.winner, Player::P1);
    assert_eq!(trick.card_of(Player::P0), c("5c"));
    assert_eq!(trick.card_of(Player::P1), c("6c"));
    // The stock starts 8c 9c: the winner, P1, takes 8c.
    assert_eq!(game.hand(Player::P1), set("2c 4c 8c"));
    assert_eq!(game.hand(Player::P0), set("1c 3c 9c"));
    assert_eq!(game.leader(), Player::P1);
    assert_eq!(game.to_play(), Some(Player::P1));
    assert_eq!(game.deck_len(), 32);
}

#[test]
fn the_game_is_over_after_20_tricks() {
    let mut game = Game::new(7);
    play_out(
        &mut game,
        &mut [&mut RandomBot::new(1), &mut RandomBot::new(2)],
    )
    .unwrap();
    assert!(game.is_over());
    assert_eq!(game.to_play(), None);
    assert_eq!(game.legal_moves(), CardSet::EMPTY);
    assert_eq!(game.play(c("1c")), Err(PlayError::GameOver));
}

/// Plays the lowest card in hand, in index order.
struct LowestBot;

impl Bot for LowestBot {
    fn act(&mut self, obs: &Observation) -> Card {
        obs.legal_moves().nth(0).unwrap()
    }
}

/// A full game traced by hand: the sorted deck, P1 deals, both play their lowest card. Briscola is coppe.
#[test]
fn reference_game_sorted_deck_lowest_cards() {
    use Player as P;
    let mut game = Game::from_deck(sorted_deck(), P::P1).unwrap();
    play_out(&mut game, &mut [&mut LowestBot, &mut LowestBot]).unwrap();

    let expected: [(&str, &str, Player); TRICKS] = [
        ("1c", "2c", P::P0), // both briscole, Asso wins
        ("3c", "4c", P::P0),
        ("5c", "6c", P::P1),  // 6 beats 5
        ("9c", "8c", P::P1),  // Cavallo beats Fante
        ("1d", "10c", P::P0), // a briscola beats the Asso led
        ("3d", "2d", P::P0),
        ("5d", "4d", P::P0),
        ("6d", "7d", P::P1),
        ("9d", "8d", P::P1),
        ("1b", "10d", P::P1), // off suit, not briscola: the led card wins
        ("2b", "3b", P::P0),
        ("5b", "4b", P::P0),
        ("7b", "6b", P::P0),
        ("8b", "9b", P::P1),
        ("1s", "10b", P::P1),
        ("3s", "2s", P::P1),
        ("4s", "5s", P::P0), // last draw: P0 takes 10s, P1 the briscola 7c
        ("7s", "7c", P::P1),
        ("6s", "9s", P::P0),
        ("10s", "8s", P::P0),
    ];
    let tricks: Vec<(String, String, Player)> = game
        .tricks()
        .iter()
        .map(|t| (t.cards[0].to_string(), t.cards[1].to_string(), t.winner))
        .collect();
    let expected: Vec<(String, String, Player)> = expected
        .iter()
        .map(|&(a, b, w)| (a.to_string(), b.to_string(), w))
        .collect();
    assert_eq!(tricks, expected);
    assert_eq!(game.briscola_drawn_by(), Some(P::P1));
    assert_eq!(game.points(), [65, 55]);
    assert_eq!(game.outcome(), Some(Outcome::Win(P::P0)));
}

#[test]
fn the_last_draw_gives_the_briscola_to_the_loser() {
    use Player as P;
    let mut game = Game::from_deck(sorted_deck(), P::P1).unwrap();
    // The reference game, stopped after trick 17.
    for _ in 0..17 {
        let p = game.to_play().unwrap();
        let card = LowestBot.act(&game.observation(p));
        game.play(card).unwrap();
        let p = game.to_play().unwrap();
        let card = LowestBot.act(&game.observation(p));
        let trick = game.play(card).unwrap().unwrap();
        if game.tricks().len() < 17 {
            assert_eq!(game.briscola_drawn_by(), None);
            assert!(game.deck_len() > 0);
        } else {
            assert_eq!(trick.winner, P::P0);
        }
    }
    assert_eq!(game.deck_len(), 0);
    assert_eq!(game.briscola_drawn_by(), Some(P::P1));
    assert_eq!(game.hand(P::P0), set("7s 9s 10s"));
    assert_eq!(game.hand(P::P1), set("6s 8s 7c"));

    let obs = game.observation(P::P0);
    assert_eq!(obs.briscola_drawn_by, Some(P::P1));
    assert_eq!(obs.known_opponent_cards(), set("7c"));
    // With the deck empty, P0 knows P1's hand exactly.
    assert_eq!(
        obs.unknown().union(obs.known_opponent_cards()),
        set("6s 8s 7c")
    );

    // The last three tricks are played without drawing.
    for n in [2, 1, 0] {
        let p = game.to_play().unwrap();
        let card = LowestBot.act(&game.observation(p));
        game.play(card).unwrap();
        let p = game.to_play().unwrap();
        let card = LowestBot.act(&game.observation(p));
        game.play(card).unwrap();
        assert_eq!(game.hand(P::P0).len(), n);
        assert_eq!(game.hand(P::P1).len(), n);
    }
}

#[test]
fn sixty_all_is_a_draw() {
    // Search seeded random games until a 60–60 shows up; there are many in a few thousand games.
    let draw = (0..10_000u64).find_map(|seed| {
        let mut game = Game::new(seed);
        play_out(
            &mut game,
            &mut [&mut RandomBot::new(seed), &mut RandomBot::new(!seed)],
        )
        .unwrap();
        (game.points() == [60, 60]).then_some(game)
    });
    let game = draw.expect("a 60–60 game in 10 000 seeds");
    assert_eq!(game.outcome(), Some(Outcome::Draw));
}

#[test]
fn the_observation_shows_what_the_player_knows() {
    use Player as P;
    let mut game = Game::from_deck(sorted_deck(), P::P1).unwrap();
    game.play(c("3c")).unwrap();
    let obs = game.observation(P::P1);
    assert_eq!(obs.player, P::P1);
    assert_eq!(obs.hand, set("2c 4c 6c"));
    assert_eq!(obs.table, [c("3c")]);
    assert_eq!(obs.played, CardSet::EMPTY);
    assert_eq!(obs.briscola, c("7c"));
    assert_eq!(obs.briscola_drawn_by, None);
    assert_eq!(obs.deck_len, 34);
    assert_eq!(obs.hand_lens, [2, 3]);
    assert_eq!(obs.to_play, Some(P::P1));
    assert_eq!(obs.legal_moves(), set("2c 4c 6c"));
    assert_eq!(game.observation(P::P0).legal_moves(), CardSet::EMPTY);
    // Unknown to P1: P0's two cards and the 33 deck cards under the briscola.
    assert_eq!(obs.unknown().len(), 35);
    assert!(obs.unknown().contains(c("1c")));
    assert!(!obs.unknown().contains(c("7c")));
}
