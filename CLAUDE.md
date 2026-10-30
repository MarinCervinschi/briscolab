# Briscolab

A lab for two-player Briscola bots, with a site to play against them. Product and decisions: `SPEC.md`; the site's design: `DESIGN.md`.
The rules the engine implements: `docs/rules.md`.

**Status (2026-10-30): milestone 4, the site, tracked in epic #1 and its sub-issues.** The engine (`engine/core`), its Python binding (`engine/py`),
the arena (`lab/`, logging to MLflow) and the search bots exist; PIMC is the champion, ISMCTS ties it. `web/` has its
scaffold (static, bilingual, offline); the game is not wired yet. `infra/` is a placeholder.

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

## Web

- `web/` is a TanStack Start app prerendered to static files in `dist/client`: every route exists as HTML, the game
  route (`/gioca`) renders on the client only (`ssr: false`). Its design is `DESIGN.md`; the tokens are in
  `src/styles/globals.css`.
- Strings come from Paraglide: `messages/it.json` and `messages/en.json`, compiled to `src/paraglide/` (generated,
  ignored). Italian is at the root, English under `/en`; the locale lives only in the URL. A new string goes into
  both files with the same key.
- PWA: vite-plugin-pwa writes the manifest and `registerSW.js`; it cannot write the service worker inside a Start
  build, so `scripts/sw.mjs` runs Workbox after `vite build` and precaches every prerendered page. `pnpm icons`
  redraws the icons in `public/`.
- The cards in `public/cards/` are the Naples deck from Wikimedia Commons at 480 px, with `credits.json`;
  `scripts/clean-cards.mjs` takes the 960 px thumbnails and paints out the printer's marks first.
- The built-in browser of the desktop app does not register service workers: check offline play in Chrome.

```bash
cd web
pnpm install
pnpm dev
pnpm test && pnpm typecheck && pnpm format:check
pnpm build
```

## Rules that hold everywhere

- The engine is the only place that knows the rules. The lab and the site call it; they never reimplement it.
- Bots see `observation(player)`, never the full state.
- Every game is reproducible from a seed.
- A bot becomes the champion only through the arena (duplicate deals, 95% intervals), never by eye.
- Repo, docs and code in English; the site's strings in Italian and English message files.
- Every push runs `scripts/check-public.sh --pushed` from `.githooks/pre-push` (enable it once per clone:
  `git config core.hooksPath .githooks`). It blocks secrets, addresses and private names in the lines the push
  adds, and stops with exit code 2 unless `CLAUDE_KIT_DENYLIST` points at the private deny list. Its settings are
  in `.check-public`; the script is a copy of the one in `claude-kit`, and changes go there first.

## How code is written

Stack: rust-py-lab 0.1 (the `stack-rust-py-lab` plugin, a base stack). The general rules come from the `method`
plugin; the lines below are what Briscolab adds to them.

- Structure: `method:design-principles`. YAGNI first: build what the current milestone needs, nothing for cases
  that do not exist yet. New bots, experiments and screens are new code, never a branch in the engine; a trait or
  Protocol needs two implementations or a language boundary; tests go where they pay off.
- The layers: `core` owns the rules, the observation and the bots; `py` and `wasm` translate only; `lab/` calls
  `py` and `web/` calls `wasm`. A `match` on game state, a legality check or a point count anywhere but `core` is
  a bug: move it into `core` and call it. `core` also stays free of the filesystem and of global state.
- The bot contract: on its turn, given the observation, a bot returns a card from `legal_moves()`, the same card
  for the same seed. A bot that needs more than the observation (the real deal, a clock) breaks it. Bots on the
  Python side satisfy a `Protocol` that mirrors `Bot.act`.
- A field joins `Observation` only if a player at the table knows it (`docs/rules.md`, "What a player knows").
  Derived knowledge is a method (`unknown()`), not a field.
- A bot is chosen by name in one registry per edge (`make_bot` in `engine/py`, later the wasm adapter), never in
  a `match` spread across the code. `PLAYERS` stays a constant so four players stays possible; nothing more
  general than two-player Briscola gets built.
- Search and other hot paths do not allocate per move: bitsets and fixed arrays over `Vec` and `HashMap`. Measure
  before optimising anything else.
- Randomness comes in as a seed or an `Rng`. Iteration that feeds an `Rng` follows bitset order, never `HashMap`
  order. A run records its seeds, the engine version and its config.
- In `web/`, the bot runs in a Web Worker and the worker messages are a discriminated union typed on both sides.
  Game state comes from the engine through one hook or store, never recomputed in a component.
- Notebooks and `lab/experiments/` are scratch. Anything the arena, the environment or training imports lives in
  the package.
- Tests: a bot's strength is measured in the arena, never in a unit test. Test names state the behaviour
  (`the_winner_draws_first_and_leads`). A test that uses only the public API goes in `tests/`, one that needs
  private items in a `#[cfg(test)]` module.
- Comments: `method:code-comments`. Few, and only for what the signature cannot say; the why goes next to the
  line, never in a doc comment. Always worth a line: whether a value is hidden from a player. A rule of the game
  lives in `docs/rules.md`; the code may quote it, never extend it. Italian appears only in names from the game
  (`briscola`, `Asso`, `coppe`) and in the site's message files.
- Prose (docs, commits, reports, site strings): `method:plain-writing`. A bot "beats" another only with a 95%
  interval over duplicate deals (`54.1% ± 1.2 against Greedy over 20 000 duplicate deals`). On the site each
  object has one name per language (`briscola`, never alternated with "trump"), and a confirmation button carries
  the verb (`Abbandona`, `Abandon`).

## Skill routing

Skills come from plugins and are called as `plugin:skill`.

- Adding a module, crate, package, trait, bot, or asking "where does this go?" / "is this over-engineered?" →
  `method:design-principles`, with the rules above
- Writing or changing any comment or doc comment → `method:code-comments`
- Writing text someone else reads (docs, commit messages, reports, UI strings) → `method:plain-writing`
- Deciding a milestone or a large feature before building it → `method:spec-interview`
- How the engine, the binding, the lab and the site fit together → `stack-rust-py-lab:overview`
- A change that is finished and about to be committed → `method:pre-pr-checklist`
