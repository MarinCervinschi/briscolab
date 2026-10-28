//! The contract every bot honours, and the choices of the deterministic bots.

use briscolab_core::*;

fn c(s: &str) -> Card {
    s.parse().unwrap()
}

fn set(cards: &str) -> CardSet {
    cards.split_whitespace().map(c).collect()
}

type MakeBot = fn(u64) -> Box<dyn Bot>;

/// The bots under contract, each built from a seed.
fn bots() -> Vec<(&'static str, MakeBot)> {
    vec![
        ("random", |seed| Box::new(RandomBot::new(seed))),
        ("greedy", |_| Box::new(GreedyBot)),
        ("hard", |_| Box::new(HardBot)),
        ("endgame", |_| Box::new(EndgameBot)),
    ]
}

/// Plays `seed`'s deal between two bots; `play_out` rejects any illegal card.
fn play(make_a: MakeBot, make_b: MakeBot, seed: u64) -> Game {
    let mut game = Game::new(seed);
    let (mut a, mut b) = (make_a(seed), make_b(!seed));
    play_out(&mut game, &mut [a.as_mut(), b.as_mut()]).unwrap();
    game
}

#[test]
fn every_bot_plays_only_legal_cards() {
    for (name_a, a) in bots() {
        for (name_b, b) in bots() {
            for seed in 0..300 {
                let game = play(a, b, seed);
                assert!(game.is_over(), "{name_a} vs {name_b}, seed {seed}");
            }
        }
    }
}

#[test]
fn every_bot_is_reproducible_from_its_seed() {
    for (name, bot) in bots() {
        for seed in 0..100 {
            assert_eq!(
                play(bot, bot, seed),
                play(bot, bot, seed),
                "{name}, seed {seed}"
            );
        }
    }
}

/// An observation with only what the deterministic bots look at: the hand, the table and the briscola.
fn obs(hand: &str, table: &str, briscola: &str) -> Observation {
    let table: Vec<Card> = table.split_whitespace().map(c).collect();
    let me = if table.is_empty() {
        Player::P0
    } else {
        Player::P1
    };
    Observation {
        player: me,
        hand: set(hand),
        table,
        played: CardSet::EMPTY,
        taken: [CardSet::EMPTY; PLAYERS],
        briscola: c(briscola),
        briscola_drawn_by: None,
        deck_len: 20,
        hand_lens: [3, 3],
        leader: Player::P0,
        to_play: Some(me),
        tricks: Vec::new(),
    }
}

#[test]
fn greedy_leads_its_cheapest_card() {
    // Briscola is spade.
    assert_eq!(GreedyBot.act(&obs("1c 4d 2s", "", "7s")), c("4d"));
    assert_eq!(GreedyBot.act(&obs("1c 10d 2s", "", "7s")), c("10d"));
    // A briscola only when every card is one.
    assert_eq!(GreedyBot.act(&obs("1s 3s 5s", "", "7s")), c("5s"));
}

#[test]
fn greedy_takes_the_most_points_it_can() {
    // An Asso led: the Tre di briscola takes 21 points, the 2 di briscola only 11.
    assert_eq!(GreedyBot.act(&obs("2s 3s 4c", "1c", "7s")), c("3s"));
    // The Tre of the suit led wins and adds its own 10 points.
    assert_eq!(GreedyBot.act(&obs("3d 2s 4c", "10d", "7s")), c("3d"));
}

#[test]
fn greedy_does_not_spend_a_briscola_on_an_empty_trick() {
    // 4d and 2s both win the 2d for 0 points; the 4d is cheaper.
    assert_eq!(GreedyBot.act(&obs("4d 2s 1c", "2d", "7s")), c("4d"));
}

#[test]
fn greedy_gives_away_the_fewest_points_when_it_cannot_win() {
    // Nothing beats the Asso di briscola: lose the 0-point card.
    assert_eq!(GreedyBot.act(&obs("1c 10d 4b", "1s", "7s")), c("4b"));
}

#[test]
fn hard_takes_a_tre_di_briscola_with_the_asso() {
    assert_eq!(HardBot.act(&obs("1s 4c 2d", "3s", "7s")), c("1s"));
}

#[test]
fn hard_spares_its_weakest_card_on_a_briscola() {
    assert_eq!(HardBot.act(&obs("1s 4c 3d", "2s", "7s")), c("4c"));
    // Its weakest card that is not a briscola is a Tre: it gives the lowest briscola instead.
    assert_eq!(HardBot.act(&obs("1c 3d 2s", "5s", "7s")), c("2s"));
}

#[test]
fn hard_takes_a_carico_with_the_asso_or_a_briscola() {
    assert_eq!(HardBot.act(&obs("1c 2s 4d", "3c", "7s")), c("1c"));
    assert_eq!(HardBot.act(&obs("3c 2s 4d", "1c", "7s")), c("2s"));
    // No briscola: the weakest card goes.
    assert_eq!(HardBot.act(&obs("3c 4d 5b", "1c", "7s")), c("4d"));
}

#[test]
fn hard_answers_with_its_strongest_card_of_the_suit_led() {
    assert_eq!(HardBot.act(&obs("3c 2c 4b", "7c", "7s")), c("3c"));
    // Even when that card cannot win, as in the Java bot.
    assert_eq!(HardBot.act(&obs("2c 3d 4b", "7c", "7s")), c("2c"));
    // No card of the suit led: spare, and a Tre is swapped for the lowest briscola.
    assert_eq!(HardBot.act(&obs("1d 2s 3b", "7c", "7s")), c("2s"));
}

#[test]
fn hard_leads_its_weakest_card() {
    assert_eq!(HardBot.act(&obs("1c 4d 2s", "", "7s")), c("4d"));
    assert_eq!(HardBot.act(&obs("1c 3d 2s", "", "7s")), c("2s"));
}

#[test]
fn a_duplicate_deal_plays_the_same_shuffle_with_seats_swapped() {
    for seed in 0..50 {
        let [as_p0, as_p1] = play_duplicate(seed, &mut HardBot, &mut GreedyBot).unwrap();

        let mut game = Game::new(seed);
        play_out(&mut game, &mut [&mut HardBot, &mut GreedyBot]).unwrap();
        assert_eq!(as_p0, game.points()[0]);

        let mut game = Game::new(seed);
        play_out(&mut game, &mut [&mut GreedyBot, &mut HardBot]).unwrap();
        assert_eq!(as_p1, game.points()[1]);
    }
}

#[test]
fn a_bot_against_itself_splits_a_duplicate_deal_evenly() {
    // Both games are the same game, so the bot takes in one seat what it gives away in the other.
    for seed in 0..50 {
        let [as_p0, as_p1] = play_duplicate(seed, &mut GreedyBot, &mut GreedyBot).unwrap();
        assert_eq!(u16::from(as_p0) + u16::from(as_p1), u16::from(TOTAL_POINTS));
    }
}
