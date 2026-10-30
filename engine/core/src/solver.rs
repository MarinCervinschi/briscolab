//! Exact play of a game whose cards are all known.

use crate::card::Card;
use crate::game::Game;
use crate::player::Player;

/// The best card for the player to move and the points that player ends the game with, if both sides play
/// perfectly. `None` once the game is over.
///
/// It reads the whole state, hidden cards included, so a bot calls it on a determinised game, or on the real one
/// once the deck is empty and nothing is hidden. It tries every line of play: meant for the last three tricks,
/// where there are at most 36. Ties go to the lowest card in index order.
pub fn solve(game: &Game) -> Option<(Card, u8)> {
    let mut best: Option<(Card, u8)> = None;
    for (card, points) in solve_each(game) {
        if best.is_none_or(|(_, b)| points > b) {
            best = Some((card, points));
        }
    }
    best
}

/// Every legal card in index order, with the points the player to move ends with after it when both sides then
/// play perfectly. Empty once the game is over.
pub fn solve_each(game: &Game) -> Vec<(Card, u8)> {
    let Some(player) = game.to_play() else {
        return Vec::new();
    };
    game.legal_moves()
        .iter()
        .map(|card| (card, points_after(game, card, player)))
        .collect()
}

/// The points `player` ends with after `card` is played and both sides then play perfectly.
fn points_after(game: &Game, card: Card, player: Player) -> u8 {
    let mut next = game.clone();
    next.play(card).expect("a legal move");
    let Some(mover) = next.to_play() else {
        return next.points()[player.index()];
    };
    let outcomes = next
        .legal_moves()
        .iter()
        .map(|c| points_after(&next, c, player));
    let points = if mover == player {
        outcomes.max()
    } else {
        outcomes.min()
    };
    points.expect("a player to move holds a card")
}
