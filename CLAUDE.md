# Briscolab

A lab for two-player Briscola bots, with a site to play against them. Product and decisions: `SPEC.md`.
The rules the engine implements: `docs/rules.md`.

**Status (2026-10-28): milestone 1, the rules engine (`engine/core`).** `lab/`, `web/` and `infra/` are still
placeholders.

## Layout

- `engine/` — Rust Cargo workspace: `core` (rules, bots); later `wasm` (site) and `py` (lab, PyO3).
- `lab/` — Python with uv: arena, PettingZoo environment, PPO, MLflow logging.
- `web/` — Vite + React 19 + TanStack Router SPA, pnpm, PWA. Same house style as TriviaMore and Zuppapp: tabs +
  semicolons (Prettier), `@/` for `src/`.
- `infra/` — Terraform for the Coolify static app, as in Zuppapp.

## Engine

- `engine/core` (crate `briscolab-core`, no dependencies), one concept per module: `card.rs` (`Card`, `Suit`,
  `Rank`), `card_set.rs` (`CardSet`, a bitset over a `u64`), `player.rs`, `trick.rs` (`Trick`, `trick_winner`),
  `game.rs` (`Game`: deal, drawing, scoring, end), `observation.rs` (what one player knows), `rng.rs`
  (xoshiro256** seeded by SplitMix64, same numbers on every platform), `bot.rs` (`Bot::act`, `RandomBot`,
  `play_out`).
- Seats are `Player::P0` and `P1`; `Game::new(seed)` has `P1` deal, so `P0` leads. `Game::from_deck` deals a
  given order, for hand-built tests.
- `core` stays free of threads, clocks and OS randomness, so it builds for wasm32 and PyO3 unchanged.
- Tests: `tests/rules.rs` (hand-checked positions and a hand-traced full game), `tests/properties.rs` (invariants
  over thousands of seeded games, plus a recorded game that pins the generator).
- Rust comes from Homebrew's keg-only `rustup`: put `/opt/homebrew/opt/rustup/bin` on `PATH`.

```bash
cd engine
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt
cargo build -p briscolab-core --target wasm32-unknown-unknown
```

## Rules that hold everywhere

- The engine is the only place that knows the rules. The lab and the site call it; they never reimplement it.
- Bots see `observation(player)`, never the full state.
- Every game is reproducible from a seed.
- A bot becomes the champion only through the arena (duplicate deals, 95% intervals), never by eye.
- Repo, docs and code in English; the site's strings in Italian and English message files.

## How code is written

- Structure (boundaries, SOLID, patterns, tests): the `design-principles` skill. YAGNI first: build what the
  current milestone needs, nothing for cases that do not exist yet. New bots, experiments and screens are new
  code, never a branch in the engine; a trait or Protocol needs two implementations or a language boundary;
  tests go where they pay off.
- Comments: the `code-comments` skill. Few, and only for what the signature cannot say; the why goes next to the
  line, never in a doc comment.
- Prose (docs, commits, reports, site strings): the `plain-writing` skill.

## Skill routing

- Adding a module, crate, package, trait, bot, or asking "where does this go?" / "is this over-engineered?" →
  `design-principles`
- Writing or changing any comment or doc comment → `code-comments`
- Writing text someone else reads (docs, commit messages, reports, UI strings) → `plain-writing`
