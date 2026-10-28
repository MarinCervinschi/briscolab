---
name: code-comments
description: >
  Use whenever you write or change a comment or a doc comment anywhere in Briscolab: Rust `///` and `//!`,
  Python docstrings, TypeScript JSDoc, an inline `//` or `#`. Decides whether the comment should exist at all,
  which form carries it, and the repo's limits on length and language. For how the sentence itself should read,
  see `plain-writing`.
---

# Comments and doc comments

Two questions, in this order: **should this be written at all**, and **where does it go**. Most bad comments
fail the first one.

## Should it exist

Delete a doc that repeats the identifier. `/// Number of players.` on `pub const PLAYERS` tells the reader
nothing the name did not. Silence is the right amount of documentation for a name that already says it.

Write a doc when it carries something the signature cannot:

1. A precondition or invariant the caller has to respect (`must come from obs.legal_moves()`).
2. The ordering, selection or comparison rule used (`in index order`, `the highest briscola wins`).
3. What `None`, an empty set or a sentinel means, and what unit or encoding a value is in (`suit * 10 + rank`).
4. When it panics or returns `Err`, and for which input.
5. A cost that is not obvious: an allocation in a hot loop, a full replay, a clone of the game.
6. Hidden information: whether a value is something a bot may see. This one is specific to Briscolab and always
   worth a line.

## Where it goes

| What you want to say | Where |
|---|---|
| What a module is for | `//!` at the top of the file (Rust), module docstring (Python), one line |
| What an item is or does | first line of `///` / docstring / JSDoc |
| A condition or constraint on it | the following lines of the doc, one fact per line |
| **Why** it was built this way | a `//` / `#` on the line that embodies it, or the commit message |
| A rule of the game | `docs/rules.md`; the code may quote it, never extend it |
| Behaviour that lives elsewhere | nowhere: document it where it lives |
| Something to fix later | an issue, not the source |

The split broken most often is the fourth row. Rationale reads like it belongs in the doc and does not: the doc
is the contract the caller reads, and the caller can do nothing with a decision. Put it in a `//` on the line
it explains, where the next person to change that line will see it.

## The hard rules

- **First line is one sentence**, ending with a full stop. Rustdoc and editors show it as the summary.
- **No section headers** (`# Examples`, `# Panics`, `Args:`, `Returns:`) unless the section has real content.
  A `# Panics` that says "panics if the invariant is broken" is noise.
- **No redirects** ("see X", "handled by Y"). Say what the item is; an intra-doc link (`[`Game::observation`]`)
  is fine when the reader needs the other item to use this one.
- **No restating the code.** `// remove the card from the hand` above `hand.remove(card)` goes.
- **English** everywhere. Italian appears only as names of the game (`briscola`, `Asso`, `coppe`) and in the
  site's message files.
- **No commented-out code.** Delete it; git has it.
- **No TODO without an issue.** `// TODO(#12): …` or nothing.

## Inline comments

Same test: only where needed, and about the **why**. The what is already the code.

```rust
// The winner draws first, then the others in turn order; the briscola is the last card drawn.
if self.drawn < STOCK_SIZE {
```

That earns its place: it quotes the rule the loop implements. A comment restating the loop would not.

```rust
let threshold = n.wrapping_neg() % n; // 2^64 mod n: draws below it would bias the low values
```

That one too: the line is opaque without it.

## Tests

A test's name is its doc. `the_winner_draws_first_and_leads` needs no comment above it. Comment inside a test
only to say how the expected value was obtained (`// traced by hand`, `// recorded from seed 2026`) or why an
input was picked.

## Before you call it done

- [ ] Every doc that repeats its item's name → deleted
- [ ] Every doc line that is not a fact the caller needs → deleted, or moved to a `//`
- [ ] Every "why" in a doc comment → moved to a `//` next to the code
- [ ] Every mention of another item's behaviour → removed
- [ ] Every comment that restates the next line → deleted
- [ ] Any Italian outside game names and message files → translated
