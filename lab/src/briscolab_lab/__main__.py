"""Plays a round robin, prints the report and optionally writes the results as JSON."""

import argparse
import dataclasses
import subprocess
from pathlib import Path

import briscolab_engine

from briscolab_lab.arena import Config, report, run, to_json


def git_commit() -> str | None:
    """The current commit, with `-dirty` if the tree has changes; None outside a git checkout."""
    try:
        commit = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        ).stdout.strip()
        status = subprocess.run(
            ["git", "status", "--porcelain"], capture_output=True, text=True, check=True
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return None
    return commit + ("-dirty" if status.strip() else "")


def main() -> None:
    parser = argparse.ArgumentParser(prog="briscolab-arena", description=__doc__)
    parser.add_argument("--bots", nargs="+", default=briscolab_engine.bot_names())
    parser.add_argument("--deals", type=int, default=10_000)
    parser.add_argument("--first-seed", type=int, default=0)
    parser.add_argument("--out", type=Path, help="where to write the results as JSON")
    args = parser.parse_args()

    config = Config(bots=tuple(args.bots), deals=args.deals, first_seed=args.first_seed)
    results = dataclasses.replace(run(config), git_commit=git_commit())
    print(report(results), end="")
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(to_json(results))


if __name__ == "__main__":
    main()
