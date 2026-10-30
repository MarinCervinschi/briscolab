# Briscolab

A lab for two-player Briscola bots, with a site to play against them. Product and decisions: `SPEC.md`.
The rules the engine implements: `docs/rules.md`.

**Status (2026-10-30): milestone 4, the site.** The engine (`engine/core`), its Python binding (`engine/py`),
the arena (`lab/`, logging to MLflow) and the search bots exist; PIMC is the champion, ISMCTS ties it. `web/` and
`infra/` are placeholders.

## Layout

- `engine/` — Rust Cargo workspace: `core` (rules, bots), `py` (PyO3 binding for the lab); later `wasm` (site).
- `lab/` — Python with uv: arena, PettingZoo environment, PPO, MLflow logging.
- `web/` — TanStack Start (Vite, React 19, TanStack Router) built as static files, pnpm, PWA; the Lab pages
  (results, bot articles) with Fumadocs under `/lab`. Same house style as TriviaMore and Zuppapp: tabs +
  semicolons (Prettier), `@/` for `src/`.
- `infra/` — Terraform for the Coolify static app, as in Zuppapp.

## Engine

- `engine/core` (crate `briscolab-core`, no dependencies), one concept per module: `card.rs` (`Card`, `Suit`,
  `Rank`), `card_set.rs` (`CardSet`, a bitset over a `u64`), `player.rs`, `trick.rs` (`Trick`, `trick_winner`),
  `game.rs` (`Game`: deal, drawing, scoring, end), `observation.rs` (what one player knows), `rng.rs`
  (xoshiro256** seeded by SplitMix64, same numbers on every platform), `bot/` (`Bot::act` and `play_out` in
  `mod.rs`, one file per bot: `random.rs`, `greedy.rs`, `hard.rs`, `endgame.rs`, `pimc.rs`, `ismcts.rs`; `playout`
  in `mod.rs` is the search bots' rollout: Hard while the deck lasts, then the solver), `duplicate.rs`
  (`play_duplicate`: one shuffle, seats swapped), `solver.rs` (`solve`: exact play once every card is known).
- `Game::determinise(obs, rng)` builds a full game consistent with an observation, dealing the cards the player
  cannot place at random; with the deck empty it is the real game. Search bots work on these, never on the real
  `Game`.
- `engine/py` (crate `briscolab-py`, Python module `briscolab_engine`, built by maturin): translation only.
  It chooses bots by name in `make_bot` (`pimc:<n>` sets PIMC's determinisations and `ismcts:<n>` ISMCTS's
  iterations; alone they are 100 and 1000); a new bot goes there and in `BOT_NAMES`. `play_duplicates` plays a
  batch of deals on every core with rayon, the only threads in the engine: `core` stays single-threaded.
- Seats are `Player::P0` and `P1`; `Game::new(seed)` has `P1` deal, so `P0` leads. `Game::from_deck` deals a
  given order, for hand-built tests.
- `core` stays free of threads, clocks and OS randomness, so it builds for wasm32 and PyO3 unchanged.
- Tests: `tests/rules.rs` (hand-checked positions and a hand-traced full game), `tests/properties.rs` (invariants
  over thousands of seeded games, plus a recorded game that pins the generator), `tests/bots.rs` (the contract
  every bot honours, legal moves and reproducibility, plus each deterministic bot's choices; a new bot goes into
  the list in `bots()` there), `tests/search.rs` (determinisation shows the player exactly their observation; the
  solver on a hand-traced endgame and its guarantee against any opponent; PIMC and ISMCTS play exactly once the
  deck is empty).
- Tests build with `opt-level = 2` (`[profile.test]` in `engine/Cargo.toml`) because the search bots are slow
  unoptimised; overflow checks stay on.
- Rust comes from Homebrew's keg-only `rustup`: put `/opt/homebrew/opt/rustup/bin` on `PATH`.

```bash
cd engine
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt
cargo build -p briscolab-core --target wasm32-unknown-unknown
```

## Lab

- `lab/` is a uv project on Python 3.13 that depends on `engine/py` by path; `uv sync` rebuilds the binding when
  the Rust sources change. Dev tools: pytest, ruff (lint and format, 100 columns), pyright in strict mode.
- `stats.py` (score per duplicate deal, 95% intervals, Bradley-Terry ratings), `arena.py` (`Config`, `run`, the
  report and the JSON results), `tracking.py` (one MLflow run per round robin, experiment `briscolab-arena`),
  `__main__.py` (the `briscolab-arena` command).
- MLflow runs on savvy, set up in `cervinschi-infra`, at `http://100.89.8.106:5000`: tailnet only, so Tailscale
  must be on. The client (`mlflow-skinny`) stays on the server's minor version, 3.17. Artifacts go through the
  server, so the lab needs only `MLFLOW_TRACKING_URI`, no keys. Logging is opt-in with `--mlflow`.
- The unit of the arena is the duplicate deal: a bot's score is the mean of its two games (a draw counts half),
  and a pair is decisive when the score's interval excludes 50%. Every pair plays the same seeds.
- Published results go to `lab/results/` as JSON, written from a clean tree so `git_commit` has no `-dirty`.

```bash
cd lab
uv sync
uv run pytest
uv run ruff check . && uv run ruff format --check .
uv run pyright
uv run briscolab-arena --deals 10000 --out results/<name>.json
MLFLOW_TRACKING_URI=http://100.89.8.106:5000 uv run briscolab-arena --deals 10000 --mlflow --run-name <name>
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
