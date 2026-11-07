//! The game a network trains in: waiting seats choose only while the deck lasts.

use briscolab_core::*;

fn first_legal(obs: &Observation) -> Card {
    obs.legal_moves().nth(0).unwrap()
}

#[test]
fn a_waiting_seat_is_asked_only_while_the_deck_lasts() {
    for seed in 0..200 {
        let mut game = TrainingGame::new(seed, [None, Some(Box::new(HardBot))]);
        let mut asked = 0;
        while let Some(obs) = game.observation() {
            assert_eq!(obs.player, Player::P0, "seed {seed}");
            assert!(obs.deck_len > 0, "seed {seed}");
            asked += 1;
            game.play(first_legal(&obs)).unwrap();
        }
        assert!(game.outcome().is_some());
        // One card a trick for the 17 tricks played while the deck lasts.
        assert_eq!(asked, 17, "seed {seed}");
    }
}

#[test]
fn two_waiting_seats_take_turns() {
    let mut game = TrainingGame::new(3, [None, None]);
    let mut seats = Vec::new();
    while let Some(obs) = game.observation() {
        seats.push(obs.player);
        game.play(first_legal(&obs)).unwrap();
    }
    assert_eq!(seats.len(), 34);
    assert_eq!(game.game().tricks().len(), TRICKS);
}

#[test]
fn a_game_of_bots_alone_is_over_at_once() {
    let game = TrainingGame::new(5, [Some(Box::new(GreedyBot)), Some(Box::new(HardBot))]);
    assert_eq!(game.to_act(), None);
    assert!(game.outcome().is_some());
}

#[test]
fn a_waiting_seat_ends_the_game_exactly() {
    // Playing first-legal through the deck and then exactly matches EndgameBot's choices once the deck is empty.
    for seed in 0..50 {
        let mut training = TrainingGame::new(seed, [None, Some(Box::new(HardBot))]);
        let mut reference = Game::new(seed);
        while let Some(obs) = training.observation() {
            let card = first_legal(&obs);
            training.play(card).unwrap();
        }
        while let Some(player) = reference.to_play() {
            let obs = reference.observation(player);
            let card = if player == Player::P1 {
                HardBot.act(&obs)
            } else if obs.deck_len > 0 {
                first_legal(&obs)
            } else {
                EndgameBot::choose(&obs).0
            };
            reference.play(card).unwrap();
        }
        assert_eq!(training.game(), &reference, "seed {seed}");
    }
}

#[test]
fn an_illegal_card_is_refused_and_the_game_is_unchanged() {
    let mut game = TrainingGame::new(1, [None, Some(Box::new(HardBot))]);
    let obs = game.observation().unwrap();
    let illegal = obs.hand.complement().nth(0).unwrap();
    assert!(game.play(illegal).is_err());
    assert_eq!(game.observation(), Some(obs));
}

#[test]
fn the_hidden_encoding_holds_the_opponents_hand_and_the_stocks_order() {
    let mut game = Game::new(11);
    let mut out = [0.0; HIDDEN_LEN];
    for _ in 0..10 {
        let player = game.to_play().unwrap();
        game.encode_hidden(player, &mut out);
        let hand: CardSet = (0..DECK_SIZE as u8)
            .filter(|&i| out[usize::from(i)] == 1.0)
            .map(|i| Card::from_index(i).unwrap())
            .collect();
        assert_eq!(hand, game.hand(player.next()));
        let mut stock: Vec<(f32, Card)> = (0..DECK_SIZE as u8)
            .filter(|&i| out[DECK_SIZE + usize::from(i)] > 0.0)
            .map(|i| {
                (
                    out[DECK_SIZE + usize::from(i)],
                    Card::from_index(i).unwrap(),
                )
            })
            .collect();
        stock.sort_by(|a, b| b.0.total_cmp(&a.0));
        let order: Vec<Card> = stock.into_iter().map(|(_, card)| card).collect();
        assert_eq!(order, game.stock());
        game.play(game.legal_moves().nth(0).unwrap()).unwrap();
    }
}
