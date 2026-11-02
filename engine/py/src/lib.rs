//! The engine as the Python module `briscolab_engine`: bots chosen by name and duplicate deals.

use std::sync::Arc;

use briscolab_core::{
    Bot, EndgameBot, GreedyBot, HardBot, IsmctsBot, Network, PimcBot, PpoBot, RandomBot,
};
use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;
use rayon::prelude::*;

const BOT_NAMES: [&str; 6] = ["random", "greedy", "hard", "endgame", "pimc", "ismcts"];
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
/// `pimc` alone has 100, `ismcts` alone 1000. `ppo:<file>` plays the network whose weights are in `file`.
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
        _ => Err(format!(
            "unknown bot {name:?}, expected one of {BOT_NAMES:?}, pimc:<n>, ismcts:<n> or ppo:<file>"
        )),
    }
}

fn make_bot(spec: &BotSpec, seed: u64) -> Box<dyn Bot> {
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

#[pymodule]
fn briscolab_engine(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("__version__", env!("CARGO_PKG_VERSION"))?;
    m.add_function(wrap_pyfunction!(bot_names, m)?)?;
    m.add_function(wrap_pyfunction!(play_duplicates, m)?)?;
    Ok(())
}
