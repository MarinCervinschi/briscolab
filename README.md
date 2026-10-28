# Briscolab

A lab for Briscola bots, and a site to play against them.

One rules engine in Rust, shared by a Python arena where bots play each other with honest statistics, and by a
web app for phone and desktop where the bots run in your browser. Search bots first (PIMC, ISMCTS, an exact endgame
solver), reinforcement learning next.

Status: the rules engine (milestone 1) is in `engine/`. See [SPEC.md](SPEC.md) and [docs/rules.md](docs/rules.md).

It grows out of [Briscola](https://github.com/MarinCervinschi/Briscola), a JavaFX university project, whose Hard
bot becomes one of the baselines here.

## License

MIT.
