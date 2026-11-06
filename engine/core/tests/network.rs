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

fn encode(obs: &Observation, encoding: Encoding) -> Vec<f32> {
    let mut input = vec![0.0; encoding.inputs()];
    obs.encode(encoding, &mut input);
    input
}

/// P1 answers a trick late in the game; P0 drew the face-up briscola and still holds it. P1 led both finished
/// tricks: the 7 of denari, taken over P0's 6, then the 4 of coppe, taken by P0's Asso.
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
        tricks: vec![
            Trick {
                leader: Player::P1,
                cards: [c("7d"), c("6d")],
                winner: Player::P1,
            },
            Trick {
                leader: Player::P1,
                cards: [c("4c"), c("1c")],
                winner: Player::P0,
            },
        ],
    }
}

#[test]
fn the_encoding_marks_each_set_of_cards_from_the_players_side() {
    let input = encode(&late_observation(), Encoding::Pooled);
    assert_eq!(input.len(), 204);
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
fn the_by_seat_encoding_splits_the_played_cards_by_who_played_them() {
    let obs = late_observation();
    let input = encode(&obs, Encoding::BySeat);
    assert_eq!(input.len(), 244);
    assert_eq!(marked(&input, 0), set("2s 5d"));
    assert_eq!(marked(&input, 1), set("3b"));
    assert_eq!(marked(&input, 2), set("7d 4c"));
    assert_eq!(marked(&input, 3), set("6d 1c"));
    assert_eq!(marked(&input, 4), set("7c"));
    assert_eq!(marked(&input, 5), set("7c"));
    assert_eq!(
        &input[6 * DECK_SIZE..],
        &encode(&obs, Encoding::Pooled)[5 * DECK_SIZE..]
    );
}

#[test]
fn a_networks_inputs_name_its_encoding() {
    assert_eq!(Encoding::from_inputs(204), Some(Encoding::Pooled));
    assert_eq!(Encoding::from_inputs(244), Some(Encoding::BySeat));
    assert_eq!(Encoding::from_inputs(100), None);
    assert_eq!(MAX_ENCODING_LEN, 244);
}

#[test]
fn the_encoding_of_a_fresh_deal_shows_only_the_hand_and_the_briscola() {
    let game = Game::new(7);
    let obs = game.observation(Player::P0);
    let input = encode(&obs, Encoding::Pooled);
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
    network_for(Encoding::Pooled, seed)
}

fn network_for(encoding: Encoding, seed: u64) -> Network {
    Network::random(&[encoding.inputs(), 16, 16, DECK_SIZE], &mut Rng::new(seed))
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
    for encoding in [Encoding::Pooled, Encoding::BySeat] {
        let bot = PpoBot::new(Arc::new(network_for(encoding, 1))).unwrap();
        assert_eq!(bot.encoding(), encoding);
    }
}

#[test]
fn the_bot_plays_its_highest_scored_legal_card_while_the_deck_lasts() {
    for encoding in [Encoding::Pooled, Encoding::BySeat] {
        let mut bot = PpoBot::new(Arc::new(network_for(encoding, 5))).unwrap();
        plays_highest_scored(&mut bot);
    }
}

fn plays_highest_scored(bot: &mut PpoBot) {
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
    let input = encode(&Game::new(4).observation(Player::P0), Encoding::Pooled);
    let (mut a, mut b) = (vec![0.0; network.width()], vec![0.0; network.width()]);
    let layers = network.activations(&input);
    assert_eq!(
        layers.iter().map(Vec::len).collect::<Vec<_>>(),
        [16, 16, DECK_SIZE]
    );
    assert_eq!(layers[2], network.forward(&input, &mut a, &mut b));
}

#[test]
fn the_two_played_sets_split_the_played_cards_in_real_games() {
    for seed in 0..200 {
        let mut game = Game::new(seed);
        while let Some(player) = game.to_play() {
            let obs = game.observation(player);
            let pooled = encode(&obs, Encoding::Pooled);
            let by_seat = encode(&obs, Encoding::BySeat);
            let (mine, theirs) = (marked(&by_seat, 2), marked(&by_seat, 3));
            assert_eq!(mine.intersection(theirs), CardSet::EMPTY, "seed {seed}");
            assert_eq!(mine.union(theirs), marked(&pooled, 2), "seed {seed}");
            game.play(HardBot.act(&obs)).unwrap();
        }
    }
}
