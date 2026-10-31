# Briscolab

A lab for Briscola bots, and a site to play against them.

One rules engine in Rust, shared by a Python arena where bots play each other with honest statistics, and by a
web app for phone and desktop where the bots run in your browser. Search bots first (PIMC, ISMCTS, an exact endgame
solver), reinforcement learning next.

Status: the rules engine, the arena and the search bots are done (milestones 1–3); the site is next. Results are
in [lab/results/](lab/results/). See [SPEC.md](SPEC.md) and [docs/rules.md](docs/rules.md).

It grows out of [Briscola](https://github.com/MarinCervinschi/Briscola), a JavaFX university project, whose Hard
bot becomes one of the baselines here.

## Deploy

The site is served at https://briscolab.cervinschi.site from a container on Coolify. `Dockerfile` builds the engine
to WebAssembly and prerenders every page, then nginx serves the files (`web/nginx.conf`). Coolify rebuilds it on
every push to `main` that touches `web/` or `engine/`. The Coolify app itself is managed in a private repo.

## License

MIT.
