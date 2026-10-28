//! Duplicate deals: the same shuffle played twice, the bots swapping seats.

use crate::bot::{play_out, Bot};
use crate::game::{Game, PlayError};
use crate::player::{Player, PLAYERS};

/// Plays the deal of `seed` twice, first with `a` in seat `P0`, then with `a` in seat `P1`, so each bot plays both
/// hands of the same shuffle.
///
/// Returns the points `a` took in each game, in that order; `b` took the rest of the 120. A bot with state, such as
/// a random bot, carries it from the first game into the second.
pub fn play_duplicate(
    seed: u64,
    a: &mut dyn Bot,
    b: &mut dyn Bot,
) -> Result<[u8; PLAYERS], PlayError> {
    let mut first = Game::new(seed);
    play_out(&mut first, &mut [&mut *a, &mut *b])?;
    let mut second = Game::new(seed);
    play_out(&mut second, &mut [b, a])?;
    Ok([
        first.points()[Player::P0.index()],
        second.points()[Player::P1.index()],
    ])
}
