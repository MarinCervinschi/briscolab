//! The engine as the Python module `briscolab_engine`: bots chosen by name and duplicate deals.

use std::sync::Arc;

use briscolab_core::{
    Bot, Card, Encoding, EndgameBot, GreedyBot, HardBot, IsmctsBot, Network, Outcome, PimcBot,
    PpoBot, RandomBot, TrainingGame, DECK_SIZE, HIDDEN_LEN, MAX_ENCODING_LEN,
};
use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;
use pyo3::types::PyBytes;
use rayon::prelude::*;

const BOT_NAMES: [&str; 7] = [
    "random", "greedy", "hard", "endgame", "pimc", "ismcts", "ppo",
];
/// The champion network: the best weights of the run night-1, chosen by the arena (lab/results/ppo.json).
const PPO_WEIGHTS: &[u8] = include_bytes!("../../../lab/models/ppo.brnn");
const PIMC_DETERMINISATIONS: usize = 100;
const ISMCTS_ITERATIONS: usize = 1000;

/// A bot read from its name once, so a weights file is read once for a whole batch of deals.
enum BotSpec {
    Random,
    Greedy,
    Hard,
    Endgame,
    Pimc(usize),
    Ismcts(usize),
    Ppo(Arc<Network>),
}

/// A bot by name. `pimc:<n>` is PIMC with `n` determinisations and `ismcts:<n>` is ISMCTS with `n` iterations;
/// `pimc` alone has 100, `ismcts` alone 1000. `ppo` is the champion network, `ppo:<file>` the network whose weights
/// are in `file`.
fn parse_bot(name: &str) -> Result<BotSpec, String> {
    if let Some(path) = name.strip_prefix("ppo:") {
        let bytes = std::fs::read(path).map_err(|e| format!("bad bot {name:?}: {e}"))?;
        let network = Network::from_bytes(&bytes).map_err(|e| format!("bad bot {name:?}: {e}"))?;
        let network = Arc::new(network);
        PpoBot::new(network.clone()).map_err(|e| format!("bad bot {name:?}: {e}"))?;
        return Ok(BotSpec::Ppo(network));
    }
    if let Some((search, n)) = name.split_once(':') {
        let n = n
            .parse()
            .ok()
            .filter(|&n| n > 0)
            .ok_or_else(|| format!("bad bot {name:?}: {search}:<n> needs n > 0"))?;
        return match search {
            "pimc" => Ok(BotSpec::Pimc(n)),
            "ismcts" => Ok(BotSpec::Ismcts(n)),
            _ => Err(format!(
                "bad bot {name:?}: only pimc and ismcts take a number"
            )),
        };
    }
    match name {
        "random" => Ok(BotSpec::Random),
        "greedy" => Ok(BotSpec::Greedy),
        "hard" => Ok(BotSpec::Hard),
        "endgame" => Ok(BotSpec::Endgame),
        "pimc" => Ok(BotSpec::Pimc(PIMC_DETERMINISATIONS)),
        "ismcts" => Ok(BotSpec::Ismcts(ISMCTS_ITERATIONS)),
        "ppo" => Network::from_bytes(PPO_WEIGHTS)
            .map(|network| BotSpec::Ppo(Arc::new(network)))
            .map_err(|e| format!("the champion's weights: {e}")),
        _ => Err(format!(
            "unknown bot {name:?}, expected one of {BOT_NAMES:?}, pimc:<n>, ismcts:<n> or ppo:<file>"
        )),
    }
}

fn make_bot(spec: &BotSpec, seed: u64) -> Box<dyn Bot + Send> {
    match spec {
        BotSpec::Random => Box::new(RandomBot::new(seed)),
        BotSpec::Greedy => Box::new(GreedyBot),
        BotSpec::Hard => Box::new(HardBot),
        BotSpec::Endgame => Box::new(EndgameBot),
        BotSpec::Pimc(n) => Box::new(PimcBot::new(*n, seed)),
        BotSpec::Ismcts(n) => Box::new(IsmctsBot::new(*n, seed)),
        BotSpec::Ppo(network) => {
            Box::new(PpoBot::new(network.clone()).expect("checked by parse_bot"))
        }
    }
}

fn duplicate(seed: u64, a: &BotSpec, b: &BotSpec) -> Result<(u8, u8), String> {
    // Distinct seeds, so that two random bots do not draw the same numbers.
    let mut a = make_bot(a, seed);
    let mut b = make_bot(b, !seed);
    let [first, second] =
        briscolab_core::play_duplicate(seed, a.as_mut(), b.as_mut()).map_err(|e| e.to_string())?;
    Ok((first, second))
}

/// The names `play_duplicates` accepts, besides `pimc:<n>`, `ismcts:<n>` and `ppo:<file>`.
#[pyfunction]
fn bot_names() -> Vec<&'static str> {
    BOT_NAMES.to_vec()
}

/// Plays the deal of each seed twice, `a` in seat 0 then in seat 1, on every core; returns the points `a` took in
/// each game, in the order of the seeds.
#[pyfunction]
fn play_duplicates(py: Python<'_>, seeds: Vec<u64>, a: &str, b: &str) -> PyResult<Vec<(u8, u8)>> {
    let a = parse_bot(a).map_err(PyValueError::new_err)?;
    let b = parse_bot(b).map_err(PyValueError::new_err)?;
    py.detach(|| {
        seeds
            .par_iter()
            .map(|&seed| duplicate(seed, &a, &b))
            .collect::<Result<Vec<_>, _>>()
    })
    .map_err(PyRuntimeError::new_err)
}

/// The outputs of the network in `weights` (a weights file's bytes) for each input in `inputs`, both as little-endian
/// `float32` rows: the check that the engine computes what PyTorch does.
#[pyfunction]
fn network_forward<'py>(
    py: Python<'py>,
    weights: &[u8],
    inputs: &[u8],
) -> PyResult<Bound<'py, PyBytes>> {
    let network = Network::from_bytes(weights).map_err(|e| PyValueError::new_err(e.to_string()))?;
    let row = network.inputs() * 4;
    if !inputs.len().is_multiple_of(row) {
        return Err(PyValueError::new_err(format!(
            "inputs of {} bytes are not rows of {} numbers",
            inputs.len(),
            network.inputs()
        )));
    }
    let (mut a, mut b) = (vec![0.0; network.width()], vec![0.0; network.width()]);
    let mut out = Vec::new();
    for chunk in inputs.chunks_exact(row) {
        let input: Vec<f32> = chunk
            .as_chunks::<4>()
            .0
            .iter()
            .map(|&x| f32::from_le_bytes(x))
            .collect();
        for y in network.forward(&input, &mut a, &mut b) {
            out.extend_from_slice(&y.to_le_bytes());
        }
    }
    Ok(PyBytes::new(py, &out))
}

/// One game of the batch: what plays it and the game itself.
struct Slot {
    /// `None` for self-play: both seats wait for their cards.
    opponent: Option<BotSpec>,
    played: u64,
    game: TrainingGame,
}

/// Many training games stepped together, so Python crosses into Rust once per batch of cards. Every slot always
/// waits for one card: a finished game is replaced at once by the next deal. The numbers come back as raw bytes,
/// little-endian, for `numpy.frombuffer`.
// Used from one Python thread, so the bots need not be `Sync`.
#[pyclass(module = "briscolab_engine", unsendable)]
struct VecEnv {
    slots: Vec<Slot>,
    encoding: Encoding,
    next_seed: u64,
}

/// The arrays of one step: the encoded observation, the legal cards, the seat to play and what that seat cannot see
/// of every slot.
type Observed<'py> = (
    Bound<'py, PyBytes>,
    Bound<'py, PyBytes>,
    Bound<'py, PyBytes>,
    Bound<'py, PyBytes>,
);

impl VecEnv {
    /// The next deal for a slot. Against a bot the waiting seat alternates from one game to the next.
    fn deal(&mut self, opponent: Option<&BotSpec>, played: u64) -> TrainingGame {
        let seed = self.next_seed;
        self.next_seed += 1;
        let bots: [Option<Box<dyn Bot + Send>>; 2] = match opponent {
            None => [None, None],
            Some(spec) if played.is_multiple_of(2) => [None, Some(make_bot(spec, !seed))],
            Some(spec) => [Some(make_bot(spec, !seed)), None],
        };
        TrainingGame::new(seed, bots)
    }

    fn observed<'py>(&self, py: Python<'py>) -> Observed<'py> {
        let n = self.slots.len();
        let len = self.encoding.inputs();
        let mut input = [0.0; MAX_ENCODING_LEN];
        let mut obs = Vec::with_capacity(n * len * 4);
        let mut masks = vec![0u8; n * DECK_SIZE];
        let mut seats = Vec::with_capacity(n);
        let mut hidden = [0.0; HIDDEN_LEN];
        let mut hiddens = Vec::with_capacity(n * HIDDEN_LEN * 4);
        for (i, slot) in self.slots.iter().enumerate() {
            let o = slot
                .game
                .observation()
                .expect("every slot waits for a card");
            o.encode(self.encoding, &mut input[..len]);
            for x in &input[..len] {
                obs.extend_from_slice(&x.to_le_bytes());
            }
            for card in o.legal_moves() {
                masks[i * DECK_SIZE + usize::from(card.index())] = 1;
            }
            seats.push(o.player.index() as u8);
            slot.game.game().encode_hidden(o.player, &mut hidden);
            for x in hidden {
                hiddens.extend_from_slice(&x.to_le_bytes());
            }
        }
        (
            PyBytes::new(py, &obs),
            PyBytes::new(py, &masks),
            PyBytes::new(py, &seats),
            PyBytes::new(py, &hiddens),
        )
    }
}

#[pymethods]
impl VecEnv {
    /// One slot per opponent: `self` for self-play, or any bot name `play_duplicates` takes. Deals come from `seed`,
    /// `seed + 1` and so on, in slot order and then in the order the games end. `encoding` is `pooled` or `by-seat`.
    #[new]
    #[pyo3(signature = (opponents, seed, encoding = "pooled"))]
    fn new(opponents: Vec<String>, seed: u64, encoding: &str) -> PyResult<VecEnv> {
        let encoding = match encoding {
            "pooled" => Encoding::Pooled,
            "by-seat" => Encoding::BySeat,
            _ => {
                return Err(PyValueError::new_err(format!(
                    "no encoding {encoding:?}: pooled or by-seat"
                )))
            }
        };
        let specs = opponents
            .iter()
            .map(|name| match name.as_str() {
                "self" => Ok(None),
                name => parse_bot(name).map(Some),
            })
            .collect::<Result<Vec<_>, _>>()
            .map_err(PyValueError::new_err)?;
        let mut env = VecEnv {
            slots: Vec::new(),
            encoding,
            next_seed: seed,
        };
        for opponent in specs {
            let game = env.deal(opponent.as_ref(), 0);
            env.slots.push(Slot {
                opponent,
                played: 0,
                game,
            });
        }
        Ok(env)
    }

    fn __len__(&self) -> usize {
        self.slots.len()
    }

    /// The seed the next deal will use: with the first seed it names every deal played so far.
    #[getter]
    fn next_seed(&self) -> u64 {
        self.next_seed
    }

    /// The numbers in one encoded observation.
    #[getter]
    fn inputs(&self) -> usize {
        self.encoding.inputs()
    }

    /// `(observations, masks, seats, hidden)`: `float32[n, inputs]`, `uint8[n, 40]`, `uint8[n]` and
    /// `float32[n, 80]`, what the seat to play cannot see (`Game::encode_hidden`), for a critic in training only.
    fn observe<'py>(&self, py: Python<'py>) -> Observed<'py> {
        self.observed(py)
    }

    /// Plays one card per slot, given as card indices, and returns what `observe` does plus `done` (`uint8[n]`),
    /// `rewards` (`float32[n, 2]`, +1, 0 or −1 per seat for the game that just ended, 0 otherwise) and `points`
    /// (`uint8[n, 2]`, each seat's points in that game, 0 otherwise).
    #[allow(clippy::type_complexity)]
    fn step<'py>(
        &mut self,
        py: Python<'py>,
        cards: Vec<u8>,
    ) -> PyResult<(
        Bound<'py, PyBytes>,
        Bound<'py, PyBytes>,
        Bound<'py, PyBytes>,
        Bound<'py, PyBytes>,
        Bound<'py, PyBytes>,
        Bound<'py, PyBytes>,
        Bound<'py, PyBytes>,
    )> {
        if cards.len() != self.slots.len() {
            return Err(PyValueError::new_err(format!(
                "{} cards for {} games",
                cards.len(),
                self.slots.len()
            )));
        }
        let mut done = vec![0u8; self.slots.len()];
        let mut rewards = Vec::with_capacity(self.slots.len() * 2 * 4);
        let mut points = vec![0u8; self.slots.len() * 2];
        for (i, &index) in cards.iter().enumerate() {
            let card = Card::from_index(index)
                .ok_or_else(|| PyValueError::new_err(format!("game {i}: no card {index}")))?;
            self.slots[i]
                .game
                .play(card)
                .map_err(|e| PyValueError::new_err(format!("game {i}: {e}")))?;
            let mut reward = [0.0f32; 2];
            if let Some(outcome) = self.slots[i].game.outcome() {
                points[i * 2..i * 2 + 2].copy_from_slice(&self.slots[i].game.game().points());
                if let Outcome::Win(winner) = outcome {
                    reward[winner.index()] = 1.0;
                    reward[winner.next().index()] = -1.0;
                }
                done[i] = 1;
                let played = self.slots[i].played + 1;
                let opponent = self.slots[i].opponent.take();
                let game = self.deal(opponent.as_ref(), played);
                self.slots[i] = Slot {
                    opponent,
                    played,
                    game,
                };
            }
            for r in reward {
                rewards.extend_from_slice(&r.to_le_bytes());
            }
        }
        let (obs, masks, seats, hidden) = self.observed(py);
        Ok((
            obs,
            masks,
            seats,
            hidden,
            PyBytes::new(py, &done),
            PyBytes::new(py, &rewards),
            PyBytes::new(py, &points),
        ))
    }
}

#[pymodule]
fn briscolab_engine(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("__version__", env!("CARGO_PKG_VERSION"))?;
    m.add_function(wrap_pyfunction!(bot_names, m)?)?;
    m.add_function(wrap_pyfunction!(play_duplicates, m)?)?;
    m.add_function(wrap_pyfunction!(network_forward, m)?)?;
    m.add_class::<VecEnv>()?;
    Ok(())
}
