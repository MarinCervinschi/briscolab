# Briscolab — Specification v1

A lab for Briscola bots, with a site to play against them. The core is the research: one rules engine, an arena
that pits bots against each other with honest statistics, search bots and then reinforcement learning. The site
is the showcase: play the best bots on your phone, and see how they think.

Decided on 2026-10-28 in an interview, starting from the university project
[MarinCervinschi/Briscola](https://github.com/MarinCervinschi/Briscola) (JavaFX), which stays as it is.

## Decisions

| #   | Topic              | Decision                                                                                                                                                                                                                               | Why                                                                                                                                                                       |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Purpose            | **Research + showcase**: bots and arena first, a polished playable site second                                                                                                                                                        | Portfolio and write-ups come from the lab's results; the site makes them playable                                                                                         |
| 2   | Engine             | **Rust**, one crate of rules shared by everything: compiled to WebAssembly for the site, bound to Python (PyO3) for the lab                                                                                                             | One engine means bots are trained on exactly the rules people play; fast enough for ISMCTS and millions of games                                                         |
| 3   | Repository         | **Monorepo** `MarinCervinschi/briscolab`, public, MIT: `engine/` (Cargo workspace), `lab/` (Python, uv), `web/` (pnpm), `infra/` (Terraform), `docs/`                                                                                  | A rules change lands everywhere in one commit                                                                                                                             |
| 4   | Game               | **Two-player Briscola only**, standard rules ([docs/rules.md](docs/rules.md)), one game to 120 points. The engine is not hard-wired to two players, but four players and Briscola chiamata are out of v1                              | The smallest game that is still interesting; four players doubles search and RL complexity                                                                                |
| 5   | Information        | The engine exposes `observation(player)`: own hand, table, cards played, briscola, cards left. Bots never see the full state                                                                                                         | No bot cheats by accident, and determinisation (PIMC, ISMCTS) samples from exactly what a player knows                                                                   |
| 6   | Bots in v1         | Random, Greedy, **Hard** (ported from the Java project), exact **endgame solver** (last three tricks), **PIMC**, **ISMCTS**. All behind one interface, `act(observation) -> card`                                                    | Strong baselines before learning: in RL-InventorySystem a classical rule beat DQN and PPO, so learning has to earn its place                                               |
| 7   | Reinforcement      | v1.1: **PPO in self-play**, PyTorch written CleanRL-style (one readable file), opponent pool, action masking, on a **PettingZoo** (AEC) environment over the Rust engine. It ships only if it beats ISMCTS in the arena                | More control than Stable-Baselines3 over self-play and masking                                                                                                            |
| 8   | Arena              | **Duplicate deals** (same shuffle, seats swapped), fixed seeds; per pair win rate and point difference with 95% intervals; **Bradley-Terry/Elo** rating from a round robin. A bot replaces the champion only if the interval excludes 50% | Luck weighs a lot in Briscola; duplicates cut the variance, intervals keep us honest                                                                                     |
| 9   | Experiments        | **MLflow** on savvy, tailnet only, shared in `cervinschi-infra`: Postgres for runs, a private Garage bucket for artifacts (backed up to R2), Model Registry with `champion` / `candidate` aliases. Git holds code, configs and the champion models (ONNX) | Runs and checkpoints never live only on one laptop, which is how RL-InventorySystem lost its models                                                                      |
| 10  | Compute            | The Mac (M4): CPU for arena and search, MPS for the networks. A rented VM on the tailnet only if an experiment outgrows it. Nothing heavy on savvy                                                                                    | Briscola is small; savvy serves TriviaMore and Zuppapp                                                                                                                   |
| 11  | Site               | **Vite + React 19 + TanStack Router**, Tailwind 4, `motion`, TanStack Query where useful, Vitest. Static SPA, PWA (installable, offline). Mobile first, portrait                                                                    | No server is needed: the house libraries without Nitro                                                                                                                   |
| 12  | Bots on the site   | They run **in the browser**: the engine in WebAssembly inside a **Web Worker**, networks via ONNX. A time budget per move (e.g. 300 ms), not a fixed number of iterations                                                              | Zero inference servers; on a slow phone a bot gets a little weaker, not slower; the UI stays smooth                                                                       |
| 13  | Data               | **Nothing stored by us.** At the end of a game, one anonymous Umami event (bot, bot version, difficulty, winner, point difference). No moves, no cookies, no database                                                                  | Win rate against real people for free, with no backend and no personal data                                                                                               |
| 14  | Hosting            | **Coolify on savvy**, a static container built from `main`, at `briscolab.cervinschi.site` (the wildcard exists). Terraform in `infra/` as in Zuppapp. Production and local only                                                       | Same infra as the other apps                                                                                                                                              |
| 15  | Cards              | Traditional **Neapolitan** designs from a freely licensed set (Wikimedia Commons, CC or public domain), optimised SVG, attribution in the credits                                                                                       | Commercial decks (e.g. Modiano) are protected; Neapolitan cards are what most players expect                                                                              |
| 16  | Languages          | Site in **Italian** by default and **English**, strings in message files from day one. Repo, docs and code in **English**                                                                                                              | The game is Italian, the research audience is not                                                                                                                         |

## Architecture

```
engine/      Cargo workspace
  core/      rules, state as bitsets (40 cards fit a u64), seeded RNG, observation, bots (search)
  wasm/      wasm-bindgen wrapper for the site
  py/        PyO3 module for the lab
lab/         Python (uv): arena, PettingZoo env, PPO, MLflow logging, notebooks
web/         Vite SPA: game UI, bot worker, PWA
infra/       Terraform: Coolify app (static), DNS is the existing wildcard
docs/        rules, and later the arena protocol and bot write-ups
```

The engine is the only place that knows the rules. The lab and the site never reimplement them.

## Milestones

1. **Engine**: rules from [docs/rules.md](docs/rules.md), tests (120 points per game, no duplicate cards, only legal
   moves, recorded reference games), seeded and reproducible.
2. **Arena**: Random, Greedy, Hard; duplicate deals, intervals, rating; runs logged to MLflow.
3. **Search**: endgame solver, PIMC, ISMCTS, tuned in the arena.
4. **Site v1**: play the search bots at three or four difficulty levels, PWA, Umami events. Online.
5. **RL (v1.1)**: PettingZoo env, PPO self-play, evaluation against ISMCTS, ONNX export; on the site only if it wins.

## Screens (site v1)

1. **Home**: choose a bot / difficulty, start a game.
2. **Game**: portrait table, your three cards at the thumb, the bot's hand face down, briscola under the deck,
   points at the end. Tap to play.
3. **Result**: score, a replay of the tricks.
4. **Lab**: the arena leaderboard and a short "how the bots think" for each one.
5. **Credits / privacy**: card attribution, the Umami note.

## Open questions

- Which bots map to which difficulty levels, and the time budget per level.
- Showing a bot's "thoughts" during a game (win probability per card), and whether it belongs in v1.
- Sound and haptics: which events, and an off switch.
- The design direction (as Zuppapp has `DESIGN.md`).
- CI: GitHub Actions for `cargo test`, `pytest`, `pnpm test` and the WebAssembly build.
- MLflow's place in `cervinschi-infra` (Postgres instance, bucket, port on the tailnet).
