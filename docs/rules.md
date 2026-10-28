# Rules: two-player Briscola

The rules the engine implements. Anything not written here is not a rule.

## Deck

40 Neapolitan cards, four suits: **coppe**, **denari**, **bastoni**, **spade**. Ten ranks per suit, strongest first:

| Rank       | Points |
| ---------- | ------ |
| Asso (1)   | 11     |
| Tre (3)    | 10     |
| Re (10)    | 4      |
| Cavallo (9)| 3      |
| Fante (8)  | 2      |
| 7, 6, 5, 4, 2 | 0   |

120 points in the deck.

## Deal

1. Shuffle. The dealer gives three cards to each player, one at a time, starting with the opponent.
2. The next card is turned face up: its suit is the **briscola** (trump) for the whole game. It goes under the
   deck, half visible, and is the last card drawn.
3. The non-dealer leads the first trick.

## A trick

1. The leader plays any card from their hand; the other player answers with any card. **There is no obligation
   to follow suit or to trump.**
2. The trick is won by:
   - the higher briscola, if at least one briscola was played;
   - otherwise the higher card of the suit led. A card of another suit never wins.
3. The winner takes both cards, then **draws first**, the other player draws second, and the winner leads the
   next trick.
4. On the last draw the deck has one card left plus the face-up briscola: the winner takes the deck card, the
   other player takes the briscola.
5. When the deck is empty, the last three tricks are played without drawing.

## End

After 20 tricks the players count the points in the cards they took. More than 60 wins; 60–60 is a draw.

## What a player knows

Their own hand, the face-up briscola (until it is drawn, and who drew it), every card played, and how many cards
are left in the deck. Once the deck is empty, a player who has counted the cards knows the opponent's hand
exactly: the endgame is a game of perfect information.
