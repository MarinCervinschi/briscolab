"""Plays a round robin and prints the report; optionally writes the JSON and logs to MLflow."""

import argparse
import dataclasses
import os
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
    parser.add_argument("--mlflow", action="store_true", help="log the run to MLFLOW_TRACKING_URI")
    parser.add_argument("--run-name", help="the MLflow run's name")
    args = parser.parse_args()
    # Without a URI MLflow writes to a local ./mlruns, which nobody would look at.
    if args.mlflow and not os.environ.get("MLFLOW_TRACKING_URI"):
        parser.error("--mlflow needs MLFLOW_TRACKING_URI")

    config = Config(bots=tuple(args.bots), deals=args.deals, first_seed=args.first_seed)
    results = dataclasses.replace(run(config), git_commit=git_commit())
    print(report(results), end="")
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(to_json(results))
    if args.mlflow:
        # Imported here: MLflow takes a second to load, and most runs do not log.
        from briscolab_lab.tracking import log_run

        print(f"MLflow run {log_run(results, args.run_name)}")


if __name__ == "__main__":
    main()
