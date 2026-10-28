//! Seats at the table.

use std::fmt;

pub const PLAYERS: usize = 2;

/// A seat at the table, `0` or `1`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Player(u8);

impl Player {
    pub const P0: Player = Player(0);
    pub const P1: Player = Player(1);
    pub const ALL: [Player; PLAYERS] = [Player::P0, Player::P1];

    pub fn index(self) -> usize {
        usize::from(self.0)
    }

    /// The player `offset` seats after this one, in turn order.
    pub fn after(self, offset: usize) -> Player {
        Player(((self.index() + offset) % PLAYERS) as u8)
    }

    pub fn next(self) -> Player {
        self.after(1)
    }
}

impl fmt::Display for Player {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "P{}", self.0)
    }
}
