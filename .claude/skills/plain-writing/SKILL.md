---
name: plain-writing
description: >
  Removes the stylistic tics that make text read as AI-generated. Use it every time you write text that someone
  other than the chat user will read: comments and doc comments, README and docs, `docs/rules.md`, commit
  messages, PR descriptions, arena reports and write-ups, log messages, error messages, and the site's strings
  in the Italian and English message files. It applies when the text is only part of a larger task (you are
  writing code and put comments in it) and when nobody asked about style.
---

# Writing without AI tics

## Why the rules are mechanical

A model writes in one pass, without rereading the whole: it does not notice it used the same construction three
times. Post-training also rewards prose that *looks* well written, so some figures became the default choice.
You cannot judge by feel whether a text sounds generated, because your default is the thing to avoid. Apply the
bans below as syntactic checks, then do the pass in section 5.

## 1. Banned constructions

| # | Pattern | Do not write | Write instead |
|---|---------|--------------|---------------|
| 1 | Reveal with a colon or dash: flat premise + `:` or `—` + punchline | `It's the last draw: the loser gets the briscola.` | Two sentences, or an explicit clause: `On the last draw the loser takes the briscola.` |
| 2 | Aphoristic closer that rephrases the sentence before it | `…a bot that sees everything learns nothing.` | Delete it. No fact, no sentence. |
| 3 | `not X, but Y` and variants (`it's not about X, it's Y`, `not just X but Y`) | `This isn't a bug, it's the rules.` | State Y: `The rules allow it.` |
| 4 | Echo for rhythm (same root twice in a sentence) | `Shuffling the shuffle…` | Vary the words or split the sentence. |
| 5 | Tricolon built for cadence, not because there are three | `fast, reliable and scalable` | List what exists, with the criterion. |
| 6 | Evaluative adjectives without a number (`robust`, `powerful`, `significant`, `seamless`) | `A significant improvement over Greedy.` | The number: `54.1% ± 1.2 against Greedy over 20 000 duplicate deals.` No number, no adjective. |
| 7 | Dropped referents for density | `…and the one it answered.` | Explicit subject, even if longer. |
| 8 | Rhetorical opening question | `Ever wondered why…?` | Start from the fact. |
| 9 | Decorative metaphor for a mechanism | `ISMCTS is like a detective…` | The mechanism. |
| 10 | Closing summary (`In short`, `The bottom line`, `Ultimately`) | — | Delete. The text is finished. |
| 11 | Emphasis on ordinary words (scattered bold, scare quotes) | `a **truly** different approach` | No emphasis, or only on domain terms. |

The ban is on the rhetorical move (premise, pause, twist), not the character. A colon that introduces a list or
a value is fine.

## 2. Positive rules

- One fact per sentence.
- Explicit subject when the antecedent is more than a sentence away.
- Concrete verbs: `returns`, `draws`, `rejects`; not `handles`, `manages`, `deals with`.
- Numbers instead of vague quantities (`3 cards`, `20 tricks`, not `the cards`).
- Research claims carry their evidence: sample size, interval, seeds. "Beats" without a 95% interval is not a
  claim this repo makes.
- If a sentence can be deleted without losing a fact, delete it.

## 3. Site strings

Italian and English message files carry the same facts; translate the meaning, not the words.

- **Error**: what failed, why if known, what the player can do now. Never "Something went wrong" alone.
- **Confirmation** (abandon a game, reset stats): what is lost, whether it can be undone. The button carries the
  verb (`Abbandona`, `Abandon`), never `OK`.
- **Empty state**: why it is empty and the action that fills it.
- Same object, same name across the site: pick `briscola` once and do not alternate with "trump" in the same
  language.

## 4. Code comments

See `code-comments` for whether a comment should exist and where it goes. Rules 1–4 and 6 above apply even more
strictly there: a doc comment is a contract that ends up in a tooltip.

## 5. Mandatory review pass

Before delivering, reread the output looking for these markers. Do not skip it because the text is short.

- [ ] `:` and `—` introducing a punchline → rewrite
- [ ] `not … but` / `not just … but` → rewrite
- [ ] Same root twice within 15 words → rewrite
- [ ] Last sentence of each paragraph: does it add a fact? If not → delete
- [ ] Evaluative adjectives without a number → delete or quantify
- [ ] Lists of exactly three → check they are three by necessity
- [ ] Every pronoun and ellipsis: is the antecedent less than a sentence away? If not → make it explicit
- [ ] Subject–verb agreement on every sentence rewritten halfway

## 6. When the rules are suspended

- The user explicitly asks for another style.
- Quotations and text that must stay verbatim.
