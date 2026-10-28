"""Logs arena results to MLflow, one run per round robin."""

import mlflow

from briscolab_lab.arena import Results, to_json

EXPERIMENT = "briscolab-arena"


def metrics(results: Results) -> dict[str, float]:
    """Each bot's rating, and each pair's score and point difference with their 95% bounds."""
    values = {f"rating/{name}": rating for name, rating in results.ratings.items()}
    for p in results.pairs:
        pair = f"{p.a}_vs_{p.b}"
        for kind, interval in (("score", p.score), ("margin", p.margin)):
            values[f"{kind}/{pair}"] = interval.mean
            values[f"{kind}_low/{pair}"] = interval.low
            values[f"{kind}_high/{pair}"] = interval.high
    return values


def log_run(results: Results, run_name: str | None = None) -> str:
    """Logs the results as a run of the `briscolab-arena` experiment and returns the run's id.

    The server is the one MLflow is configured with, normally through MLFLOW_TRACKING_URI.
    """
    mlflow.set_experiment(EXPERIMENT)  # pyright: ignore[reportUnknownMemberType]
    with mlflow.start_run(run_name=run_name) as run:
        mlflow.log_params(
            {
                "bots": ",".join(results.config.bots),
                "deals": results.config.deals,
                "first_seed": results.config.first_seed,
                "engine_version": results.engine_version,
            }
        )
        if results.git_commit:
            mlflow.set_tag("mlflow.source.git.commit", results.git_commit)
        mlflow.log_metrics(metrics(results))
        mlflow.log_text(to_json(results), "results.json")
        return run.info.run_id
