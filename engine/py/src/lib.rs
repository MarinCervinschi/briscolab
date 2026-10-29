//! The engine as the Python module `briscolab_engine`: bots chosen by name and duplicate deals.

use briscolab_core::{Bot, EndgameBot, GreedyBot, HardBot, IsmctsBot, PimcBot, RandomBot};
use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;
use rayon::prelude::*;

const BOT_NAMES: [&str; 6] = ["random", "greedy", "hard", "endgame", "pimc", "ismcts"];
const PIMC_DETERMINISATIONS: usize = 100;
const ISMCTS_ITERATIONS: usize = 1000;

/// A bot by name. `pimc:<n>` is PIMC with `n` determinisations and `ismcts:<n>` is ISMCTS with `n` iterations;
/// `pimc` alone has 100, `ismcts` alone 1000.
fn make_bot(name: &str, seed: u64) -> Result<Box<dyn Bot>, String> {
    if let Some((search, n)) = name.split_once(':') {
        let n = n
            .parse()
            .ok()
            .filter(|&n| n > 0)
            .ok_or_else(|| format!("bad bot {name:?}: {search}:<n> needs n > 0"))?;
        return match search {
            "pimc" => Ok(Box::new(PimcBot::new(n, seed))),
            "ismcts" => Ok(Box::new(IsmctsBot::new(n, seed))),
            _ => Err(format!(
                "bad bot {name:?}: only pimc and ismcts take a number"
            )),
        };
    }
    match name {
        "random" => Ok(Box::new(RandomBot::new(seed))),
        "greedy" => Ok(Box::new(GreedyBot)),
        "hard" => Ok(Box::new(HardBot)),
        "endgame" => Ok(Box::new(EndgameBot)),
        "pimc" => Ok(Box::new(PimcBot::new(PIMC_DETERMINISATIONS, seed))),
        "ismcts" => Ok(Box::new(IsmctsBot::new(ISMCTS_ITERATIONS, seed))),
        _ => Err(format!(
            "unknown bot {name:?}, expected one of {BOT_NAMES:?}, pimc:<n> or ismcts:<n>"
        )),
    }
}

fn duplicate(seed: u64, a: &str, b: &str) -> Result<(u8, u8), String> {
    // Distinct seeds, so that two random bots do not draw the same numbers.
    let mut a = make_bot(a, seed)?;
    let mut b = make_bot(b, !seed)?;
    let [first, second] =
        briscolab_core::play_duplicate(seed, a.as_mut(), b.as_mut()).map_err(|e| e.to_string())?;
    Ok((first, second))
}

/// The names `play_duplicates` accepts, besides `pimc:<n>` and `ismcts:<n>`.
#[pyfunction]
fn bot_names() -> Vec<&'static str> {
    BOT_NAMES.to_vec()
}

/// Plays the deal of each seed twice, `a` in seat 0 then in seat 1, on every core; returns the points `a` took in
/// each game, in the order of the seeds.
#[pyfunction]
fn play_duplicates(py: Python<'_>, seeds: Vec<u64>, a: &str, b: &str) -> PyResult<Vec<(u8, u8)>> {
    make_bot(a, 0).map_err(PyValueError::new_err)?;
    make_bot(b, 0).map_err(PyValueError::new_err)?;
    py.detach(|| {
        seeds
            .par_iter()
            .map(|&seed| duplicate(seed, a, b))
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
