---
name: design-principles
description: >
  How code is structured in Briscolab: module boundaries, SOLID applied to Rust, Python and TypeScript, which
  design patterns fit and which do not, error handling, determinism, and when a test pays off. Use it before
  adding a module, crate, package, trait, Protocol or bot; when deciding whether something deserves an
  abstraction; when a file or function grows; and when reviewing a change for structure. Requests that sound like
  "where does this go?", "should this be a trait?", "how do I add a bot?", "is this over-engineered?" or "refactor
  this" all land here.
---

# Design principles

A lab still gets read, rerun and extended months later. The bar: a new bot, a new experiment or a new screen is
added by **writing new code**, not by editing the engine. The rules below say how to keep it that way without
building abstractions nobody uses.

## 0. YAGNI comes first

Every rule below is applied to the code that exists **today**, not to the code the milestones might need.
When a principle and YAGNI disagree, YAGNI wins and the principle waits for the change that needs it.

- Build what the current milestone needs. A later milestone in `SPEC.md` is a reason to keep a door open
  (no global state, `PLAYERS` as a constant), not a reason to build the room.
- No trait, generic, config option, feature flag, plugin point or folder for a single case.
- No public API "in case": `pub` only what a caller uses now; a new caller can widen it.
- Prefer the boring version: a function over a type, a type over a trait, a `match` over a registry until there
  are enough cases to need one.
- Refactor when the second case arrives, with the second case in hand. The tests make that cheap.
- A review comment of the form "this is over-engineered" is a valid reason to delete code, even if the code
  follows a pattern from this skill.

## 1. The boundaries

```
engine/core     rules, observation, bots        knows nothing about wasm, Python, the site
engine/wasm     wasm-bindgen adapter            translation only
engine/py       PyO3 adapter                    translation only
lab/            arena, env, training, reports   calls engine/py
web/            UI, bot worker                  calls engine/wasm
```

- Dependencies point inward: `wasm` and `py` depend on `core`, never the reverse. `core` has no feature flags
  for its callers.
- An adapter converts types and errors and does nothing else. A `match` on game state, a legality check or a
  point count in `wasm`, `py`, `lab` or `web` is a bug: move it into `core` and call it.
- `core` stays buildable for wasm32 and PyO3: no threads, no clock, no filesystem, no OS randomness, no global
  state.

## 2. SOLID, as it applies here

**Single responsibility.** One concept per module: cards, sets, tricks, the game, the observation, the RNG, each
bot. A module whose doc line needs "and" is two modules. A file past ~400 lines or a function past ~50 is a
signal to look, not an automatic split.

**Open/closed.** The engine is closed; bots, experiments and screens are open.
- A new bot is a new type implementing `Bot` in its own module. Nothing in `game.rs` or `observation.rs`
  changes for it.
- Choosing a bot by name (`"ismcts"`, difficulty levels) happens in **one** registry at the edge (arena CLI, wasm
  adapter), never in a `match` spread across the codebase.

**Liskov.** Every `Bot` honours the same contract: given an observation on its turn, it returns a card from
`legal_moves()`, deterministically for a given seed. The arena relies on it, so once there are several bots a
shared contract test runs each one through a few hundred seeded games. A bot that needs more than the observation (the real deal, a
clock) breaks the contract.

**Interface segregation.** Bots get `Observation`; the harness gets `Game`. Do not add a field to `Observation`
because one bot finds it handy: add it only if a player at the table knows it (`docs/rules.md`, "What a player
knows"). Derived knowledge goes in a method (`unknown()`), not a new field.

**Dependency inversion.** Depend on a trait only where there is a real seam:
- two or more implementations exist or are planned in the spec (bots, rollout policies, evaluators), or
- the boundary crosses a language or process (wasm worker messages, the PettingZoo env).
A trait with one implementation "for testing" or "for the future" is not a seam. Randomness is always injected
as a seed or an `Rng`, never reached for.

## 3. Patterns that fit

| Pattern | Where | Shape |
|---|---|---|
| Strategy | `Bot`, rollout and evaluation policies inside search | trait + one type per strategy |
| Adapter | `engine/wasm`, `engine/py`, the PettingZoo env | thin layer, types in, types out |
| Registry / factory | bot by name in the arena and on the site | one table at the edge |
| Value object / newtype | `Card`, `Player`, `CardSet`, seeds | invalid states unrepresentable |
| Event log | `Trick` history, arena results | append-only records, replayable |
| Immutable snapshot | `Observation`, arena configs | built once, never mutated |

Patterns that do **not** fit, and what to do instead:

- Singleton, global or `static mut` state → pass it in.
- Inheritance hierarchies, base classes for bots → traits and composition; Python `Protocol`, not ABC trees.
- Builders for types with three fields → a constructor or a struct literal.
- Manager / Helper / Utils modules → name the concept the code is about.
- Generic "engine framework" for games other than Briscola → v1 is two-player Briscola; keep `PLAYERS` as a
  constant so four players stays possible, nothing more.

## 4. Abstraction: when to add one

Add it on the **second** real use, extract it on the **third** (rule of three). Before that, duplication is
cheaper than the wrong abstraction. Ask: does the spec name a second implementation? Does a caller in another
language need it? If neither, write the concrete code.

## 5. Language idioms

**Rust (`engine/`)**
- Closed sets are `enum`s; identities are newtypes. Fields private, `pub` only what a caller needs, re-exported
  from `lib.rs`.
- `Result` for anything a caller can cause and handle (an illegal card, a bad deck). `panic!` / `expect` only for
  a broken internal invariant, and the `expect` message states the invariant (`"a full table"`).
- No `unwrap()` in library code outside tests.
- Hot paths (search, millions of games) avoid allocation per move: bitsets and fixed arrays over `Vec` and
  `HashMap`. Measure before optimising anything else.
- `cargo clippy --all-targets -- -D warnings` and `cargo fmt` are the style guide.

**Python (`lab/`)**
- Typed: every public function has annotations; a type checker runs in CI.
- Configs and results are frozen `dataclass`es; no dict-shaped data across module boundaries.
- Bots on the Python side satisfy a `Protocol` mirroring `Bot.act`.
- Notebooks and `lab/experiments/` are scratch: anything imported by the arena, the env or training lives in the
  package and follows these rules.

**TypeScript (`web/`)**
- The bot runs in a Web Worker; worker messages are a discriminated union, typed on both sides.
- Components render; game state comes from the engine through one hook or store, never recomputed in a
  component.

## 6. Determinism

Every game, arena run and training run is reproducible from its seeds. A seed is an explicit argument; a run
records its seeds, engine version and config. Iteration order that feeds an `Rng` must be fixed (bitset order,
sorted keys), never `HashMap` order.

## 7. Tests: where they pay off

- **The engine's rules** are the critical path: hand-checked positions, a hand-traced reference game, property
  tests over thousands of seeded games, a recorded game that pins the RNG.
- **Every bot**: the shared contract test (legal moves, determinism). Strength is measured in the arena, not in
  unit tests.
- **The arena's statistics**: duplicate pairing and intervals, on cases with a known answer.
- **A bug just fixed**, so it does not come back.
- Not for getters, constructors that assign fields, plain conversions in adapters, or the shape of a UI.

Test names say the behaviour (`the_winner_draws_first_and_leads`). Tests live in `tests/` when they use only the
public API, in a `#[cfg(test)]` module when they need private items.

## Before you call it done

- [ ] Nothing built for a case that does not exist yet (YAGNI)
- [ ] No rule of the game implemented outside `engine/core`
- [ ] No bot or adapter reads hidden state
- [ ] New behaviour added as new code, not as a branch in the engine
- [ ] Every new trait / Protocol has two implementations or crosses a boundary
- [ ] Every random choice comes from an injected seed
- [ ] Errors a caller can cause are `Result`s; panics name the invariant
- [ ] Comments pass `code-comments`
