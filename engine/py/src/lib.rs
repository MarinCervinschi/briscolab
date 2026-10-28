//! The engine as the Python module `briscolab_engine`: bots chosen by name and duplicate deals.

use briscolab_core::{Bot, GreedyBot, HardBot, RandomBot};
use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;

const BOT_NAMES: [&str; 3] = ["random", "greedy", "hard"];

fn make_bot(name: &str, seed: u64) -> PyResult<Box<dyn Bot>> {
    match name {
        "random" => Ok(Box::new(RandomBot::new(seed))),
        "greedy" => Ok(Box::new(GreedyBot)),
        "hard" => Ok(Box::new(HardBot)),
        _ => Err(PyValueError::new_err(format!(
            "unknown bot {name:?}, expected one of {BOT_NAMES:?}"
        ))),
    }
}

/// The names `play_duplicate` accepts.
#[pyfunction]
fn bot_names() -> Vec<&'static str> {
    BOT_NAMES.to_vec()
}

/// Plays the deal of `seed` twice, `a` in seat 0 then in seat 1; returns the points `a` took in each game.
#[pyfunction]
fn play_duplicate(seed: u64, a: &str, b: &str) -> PyResult<(u8, u8)> {
    // Distinct seeds, so that two random bots do not draw the same numbers.
    let mut a = make_bot(a, seed)?;
    let mut b = make_bot(b, !seed)?;
    let [first, second] = briscolab_core::play_duplicate(seed, a.as_mut(), b.as_mut())
        .map_err(|e| PyRuntimeError::new_err(e.to_string()))?;
    Ok((first, second))
}

#[pymodule]
fn briscolab_engine(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("__version__", env!("CARGO_PKG_VERSION"))?;
    m.add_function(wrap_pyfunction!(bot_names, m)?)?;
    m.add_function(wrap_pyfunction!(play_duplicate, m)?)?;
    Ok(())
}
