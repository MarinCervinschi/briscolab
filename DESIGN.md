# Briscolab design

The design direction for the site. Decided on 2026-10-30 in an interview, with drafts on a design canvas. The
product decisions behind it are in `SPEC.md` (11 to 17 and "Screens (site v1)").

## The idea

The page is a dark lab bench. Cards are the only light objects on it. The bot's reasoning is drawn in electric
blue, and cantaloupe orange marks the few things that decide a game: the briscola, the card the bot picks and the
61 points that win. The bot thinks in view, and the 120-point bar beside the table is the site's signature.

## Colour

Dark is the default theme; a light theme exists for whoever wants it, and for reading the Lab pages by day. The
theme follows the system unless the player picks one in the settings.

| Token        | Dark      | Role                                                                          |
| ------------ | --------- | ----------------------------------------------------------------------------- |
| `ground`     | `#02070A` | Midnight black: the page                                                      |
| `surface`    | `#0C1418` | One step up: the reasoning panel, the bot's half of a split                   |
| `raised`     | `#17222A` | Two steps up: secondary buttons, the current row, empty bar track             |
| `text`       | `#F2F6F8` | Everything read, and the primary button's fill                                |
| `text-soft`  | `#B4BEC4` | Captions, counts, meta                                                        |
| `text-faint` | `#949EA4` | Axis labels on `raised` only                                                  |
| `data`       | `#0297DE` | Electric blue: what the bot computes (bars, forecasts, the bot's card backs)  |
| `signal`     | `#FC734D` | Cantaloupe orange: the briscola, the bot's pick, the 61-point line            |
| `paper`      | `#FBF8F1` | Card faces and the labels on card backs                                       |
| `ink-card`   | `#2E241A` | The index on a card face                                                      |

The light theme keeps the roles and darkens the two accents so they hold as text: `ground` `#F5F8FA`, `surface`
`#E3EBF0`, `text` `#02070A`, `data` `#0277B0`, `signal` `#C24A26`. It is drawn only as tokens so far; the game
screen is designed dark first.

Proportions matter as much as the hues. Midnight and its two steps cover almost the whole screen, blue covers about
6% and orange about 2%. Blue never fills a button, a tab or a menu; orange never colours running text.

Contrast on the dark theme (WCAG 2):

| Pair                                    | Ratio       |
| --------------------------------------- | ----------- |
| `text` on `ground` / `surface`          | 18.6 / 17.1 |
| `text-soft` on `ground` / `raised`      | 10.7 / 8.5  |
| `text-faint` on `raised`                | 5.9         |
| `data` on `ground` / `surface`          | 6.3 / 5.7   |
| `signal` on `ground` / `surface`        | 7.4 / 6.8   |
| `ground` on `text` (the primary button) | 18.6        |
| `ink-card` on `paper`                   | 14.3        |

## Type

- **Space Grotesk** (OFL) for everything: headings, interface, running text. Weights 400, 500, 600, 700.
- **JetBrains Mono** (OFL) for figures only: points, iterations, visits, seeds, the card index.
- Headings are sentence case, tracking −0.02 to −0.04 em. No uppercase tracked labels.

## Surfaces and shape

- Surfaces are separated by lightness alone: `ground`, `surface`, `raised`. No borders between them and no
  shadows on anything at rest.
- **Glass for what floats over the content**: the top bar on desktop, the round back button and the "Ragionamento"
  pill on a phone, the reasoning sheet, the cursor on the 120-point bar. It is Zuppapp's `.glass` in its dark
  form: a `raised` tint at 62%, `backdrop-filter: blur(20px) saturate(180%)`, a light rim along the top edge and a
  faint sheen in the upper left. Without `backdrop-filter`, or with `prefers-reduced-transparency`, it becomes
  solid `raised`. Glass never sits on glass.
- The primary action is the inverted pill: `text` fill, `ground` label. Secondary actions are `raised` pills.
- Radius: 24–28 px for panels, 12–14 px for cards, full pills for buttons and controls.
- Touch targets are at least 44 px.

## Cards

### Faces

- The Neapolitan deck on Wikimedia Commons, [Category:Naples deck](https://commons.wikimedia.org/wiki/Category:Naples_deck),
  by Trocche100 at Italian Wikipedia, public domain: 40 cards and the original back, 1324×2188. Every file and its
  source page go in the credits.
- The face is `paper` with a 12–14 px radius. The artwork sits inside with a margin and `mix-blend-mode: multiply`,
  so its white ground becomes the paper colour.
- The index (1–7, F, C, R) sits in two opposite corners in JetBrains Mono, the bottom one turned 180°.
- The ace of denari carries the printer's mark ("T. DAL NEGRO TREVISO", "MADE IN ITALY", "531"). The site
  covers it with paper before publishing the deck.
- The briscola under the deck lies sideways and carries a 2 px `signal` outline.

### Backs

A back is a drawing from the lab on a card style. The player picks both in the settings; the default is the tree
on the technical plate.

| Drawing     | What it shows                                                                 | Label        |
| ----------- | ----------------------------------------------------------------------------- | ------------ |
| Albero      | A search tree in blue, with the line the bot keeps in orange                  | ISMCTS · 1000 |
| Monte Carlo | About 300 random points, orange inside a quarter circle, blue outside        | PIMC · 100   |
| Rete        | A four-layer network in blue, with the strongest path to the output in orange | PPO · v1.1   |

| Style          | What it looks like                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| Tavola tecnica | `#04121C` ground, a thin blue frame with corner marks, the B at top left and the label at bottom right |
| Quaderno       | The dot grid of a lab notebook inside a midnight frame, with an orange tab on top                     |
| Vetrino        | A microscope slide: the drawing under blue glass, a diagonal reflection, a paper label with an orange stripe |

Every drawing comes from a fixed seed, so a back looks the same on every render. All backs share the outer card:
14 px radius and a light rim on the top edge.

## The table

### Phone (portrait)

No table surface: the cards sit on the ground.

1. A top row: the round glass back button, the level and the trick ("Esperto", "Presa 9 di 20"), and the glass
   "Ragionamento" pill that opens the reasoning sheet.
2. The 120-point bar runs down the left edge for the full height of the play area.
3. Beside it, from the top: the bot's three backs, one line of status ("Il bot pensa: 640 ipotesi su 1000"), the
   deck with the briscola and the cards left, the card on the table.
4. The player's hand at the bottom, at the thumb.

### Desktop

1. A glass top bar across the window: the wordmark on the left, the segmented "Gioca / Lab" control in the centre
   with the current tab as the inverted pill, the level, the trick and "Abbandona" on the right.
2. The table in a 1280 px column: the bar on the left, the bot's backs on top, then the deck and briscola, the
   card in play and both players' taken tricks in three columns, the hand at the bottom with keys 1–3 under it.
3. The reasoning panel on the right, on `surface`.

## The 120-point bar (filo)

- A 4 px track from the bot (top) to the player (bottom). Blue fills it from the top up to the bot's forecast;
  the rest is a lighter track.
- The 61-point line is a 2 px `signal` notch that sticks out of the track, with "61" beside it.
- The forecast sits in a glass cursor on the boundary ("66"). It slides while the bot thinks.
- "Bot" labels the top end; "Tu" and the player's share label the bottom end.
- It reads as an image for a screen reader: "Il bot prevede 66 punti su 120, tu 54; si vince da 61."

## The bot's reasoning

Shown on the desktop panel and in the phone sheet, in this order:

1. The forecast in large figures ("66 punti previsti su 120") and the iterations ("640 ipotesi su 1000").
2. "Come immagina le tue carte": the latest hypotheses about the player's hand, each with the points its playout
   gave. The current one sits on `raised`.
3. "Le carte che valuta": one row per card the bot holds, with a small card, the expected points, the visits and a
   bar that the 61-point notch crosses. The bot's pick is in `signal`.

Section 3 shows the bot's hand, so it is blurred until the player presses "Mostra le sue carte". The other two
sections stay visible.

## Motion

- Sober and precise: cards slide and turn on short springs, the bars and the cursor grow smoothly. Nothing moves
  for decoration.
- On phones the animations are off by default; the settings turn them on.
- The bot thinks for at least about 1.2 s; a tap or a key skips it (decision 12 in `SPEC.md`).
- Under `prefers-reduced-motion` only fades remain.

## Screens

As in `SPEC.md`, plus a settings screen:

- **Impostazioni**: the card back (drawing and style), the theme (system, light, dark), animations on or off, fast
  thinking (skip the minimum thinking time).

## Checks

The design follows the taste-skill house rules for app screens, with two deliberate exceptions: the glass on
floating elements and the reflection on the Vetrino back. When the site exists:

```bash
node <taste-skill>/scripts/inspect.mjs http://localhost:3000/ --app --allow glass,gradient
```

## References

- Apple's desktop pages, for the true-black stage, the centred segmented control in glass with the current tab
  inverted, and large figures with a caption under them: [macOS](https://www.apple.com/it/os/macos/),
  [MacBook Pro](https://www.apple.com/it/macbook-pro/), [Apple Arcade](https://www.apple.com/it/apple-arcade/).
- Liquid Glass in the Human Interface Guidelines, for glass on controls only:
  [WWDC25 "Meet Liquid Glass"](https://developer.apple.com/videos/play/wwdc2025/219/).
- The evaluation bar of chess sites, for the 120-point bar: [chess.com game analysis](https://support.chess.com/en/articles/10473022-how-do-i-use-game-analysis-on-the-app).
- Zuppapp's `DESIGN.md` and `.glass` in `src/styles/globals.css`.
- The drafts: the design canvas "Briscolab design drafts" (private).
