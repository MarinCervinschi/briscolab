//! The network's input, its weights file, its forward pass, and the bot that plays it.

use std::sync::Arc;

use briscolab_core::*;

fn c(s: &str) -> Card {
    s.parse().unwrap()
}

fn set(cards: &str) -> CardSet {
    cards.split_whitespace().map(c).collect()
}

/// The cards an encoding marks in its `n`-th set of 40.
fn marked(input: &[f32], n: usize) -> CardSet {
    (0..DECK_SIZE as u8)
        .filter(|&i| input[n * DECK_SIZE + usize::from(i)] == 1.0)
        .map(|i| Card::from_index(i).unwrap())
        .collect()
}

/// P1 answers a trick late in the game; P0 drew the face-up briscola and still holds it.
fn late_observation() -> Observation {
    Observation {
        player: Player::P1,
        hand: set("2s 5d"),
        table: vec![c("3b")],
        played: set("1c 4c 6d 7d"),
        taken: [set("1c 4c"), set("6d 7d")],
        briscola: c("7c"),
        briscola_drawn_by: Some(Player::P0),
        deck_len: 0,
        hand_lens: [1, 2],
        leader: Player::P0,
        to_play: Some(Player::P1),
        tricks: Vec::new(),
    }
}

#[test]
fn the_encoding_marks_each_set_of_cards_from_the_players_side() {
    let input = late_observation().encode();
    assert_eq!(input.len(), ENCODING_LEN);
    assert_eq!(marked(&input, 0), set("2s 5d"));
    assert_eq!(marked(&input, 1), set("3b"));
    assert_eq!(marked(&input, 2), set("1c 4c 6d 7d"));
    assert_eq!(marked(&input, 3), set("7c"));
    assert_eq!(marked(&input, 4), set("7c"));
    let numbers = &input[5 * DECK_SIZE..];
    // P1's points first: 0 for the 6 and 7 of denari, then P0's 11 for the Asso.
    assert_eq!(numbers, [0.0, 11.0 / 120.0, 0.0, 0.0]);
}

#[test]
fn the_encoding_of_a_fresh_deal_shows_only_the_hand_and_the_briscola() {
    let game = Game::new(7);
    let obs = game.observation(Player::P0);
    let input = obs.encode();
    assert_eq!(marked(&input, 0), obs.hand);
    assert_eq!(marked(&input, 1), CardSet::EMPTY);
    assert_eq!(marked(&input, 2), CardSet::EMPTY);
    assert_eq!(marked(&input, 3), CardSet::EMPTY);
    assert_eq!(marked(&input, 4), [obs.briscola].into_iter().collect());
    assert_eq!(&input[5 * DECK_SIZE..], [0.0, 0.0, 1.0, 1.0]);
}

#[test]
fn the_forward_pass_applies_relu_between_layers_only() {
    // 2 inputs → 2 hidden → 1 output.
    let network = Network::new(vec![
        (vec![vec![1.0, -1.0], vec![-1.0, 1.0]], vec![0.0, 0.5]),
        (vec![vec![2.0, -3.0]], vec![-10.0]),
    ]);
    let (mut a, mut b) = (vec![0.0; network.width()], vec![0.0; network.width()]);
    // Hidden: relu(3 - 1) = 2 and relu(-3 + 1 + 0.5) = 0; output: 2·2 - 3·0 - 10, no ReLU.
    assert_eq!(network.forward(&[3.0, 1.0], &mut a, &mut b), [-6.0]);
    assert_eq!(
        network.activations(&[3.0, 1.0]),
        [vec![2.0, 0.0], vec![-6.0]]
    );
}

fn random_network(seed: u64) -> Network {
    Network::random(&[ENCODING_LEN, 16, 16, DECK_SIZE], &mut Rng::new(seed))
}

#[test]
fn weights_survive_the_file_unchanged() {
    let network = random_network(3);
    assert_eq!(Network::from_bytes(&network.to_bytes()), Ok(network));
}

#[test]
fn a_damaged_weights_file_is_rejected() {
    let bytes = random_network(3).to_bytes();
    assert_eq!(Network::from_bytes(b"PNG!"), Err(WeightsError::NotWeights));
    assert_eq!(
        Network::from_bytes(&bytes[..bytes.len() - 1]),
        Err(WeightsError::Truncated)
    );
    let mut longer = bytes.clone();
    longer.push(0);
    assert_eq!(
        Network::from_bytes(&longer),
        Err(WeightsError::TrailingBytes)
    );
    let mut newer = bytes.clone();
    newer[4] = 2;
    assert_eq!(Network::from_bytes(&newer), Err(WeightsError::Version(2)));
}

#[test]
fn the_bot_needs_one_input_per_encoded_number_and_one_output_per_card() {
    let small = Network::new(vec![(vec![vec![1.0; 3]; DECK_SIZE], vec![0.0; DECK_SIZE])]);
    assert_eq!(PpoBot::new(Arc::new(small)).err(), Some(ShapeError));
    assert!(PpoBot::new(Arc::new(random_network(1))).is_ok());
}

#[test]
fn the_bot_plays_its_highest_scored_legal_card_while_the_deck_lasts() {
    let mut bot = PpoBot::new(Arc::new(random_network(5))).unwrap();
    for seed in 0..50 {
        let game = Game::new(seed);
        let obs = game.observation(Player::P0);
        let card = bot.act(&obs);
        let scores = bot.scores(&obs).to_vec();
        let best = obs
            .legal_moves()
            .into_iter()
            .map(|card| scores[usize::from(card.index())])
            .fold(f32::MIN, f32::max);
        assert_eq!(scores[usize::from(card.index())], best, "seed {seed}");
    }
}

#[test]
fn the_bot_plays_exactly_once_the_deck_is_empty() {
    let mut bot = PpoBot::new(Arc::new(random_network(5))).unwrap();
    for seed in 0..20 {
        let mut game = Game::new(seed);
        while game.deck_len() > 0 {
            let player = game.to_play().unwrap();
            game.play(HardBot.act(&game.observation(player))).unwrap();
        }
        let obs = game.observation(game.to_play().unwrap());
        assert_eq!(bot.act(&obs), EndgameBot::choose(&obs).0, "seed {seed}");
    }
}

#[test]
fn the_last_activations_are_the_forward_pass() {
    let network = random_network(9);
    let input = Game::new(4).observation(Player::P0).encode();
    let (mut a, mut b) = (vec![0.0; network.width()], vec![0.0; network.width()]);
    let layers = network.activations(&input);
    assert_eq!(
        layers.iter().map(Vec::len).collect::<Vec<_>>(),
        [16, 16, DECK_SIZE]
    );
    assert_eq!(layers[2], network.forward(&input, &mut a, &mut b));
}
