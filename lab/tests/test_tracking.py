from collections.abc import Iterator
from pathlib import Path

import mlflow
import mlflow.artifacts
import pytest

from briscolab_lab.arena import Config, run
from briscolab_lab.tracking import EXPERIMENT, log_run, metrics


@pytest.fixture
def local_tracking(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    # A throwaway file store; MLflow 3 accepts it only with this opt-in.
    monkeypatch.setenv("MLFLOW_ALLOW_FILE_STORE", "true")
    previous = mlflow.get_tracking_uri()
    mlflow.set_tracking_uri(tmp_path.as_uri())
    yield
    mlflow.set_tracking_uri(previous)


def test_metrics_cover_every_bot_and_pair() -> None:
    values = metrics(run(Config(bots=("random", "hard"), deals=50)))
    assert set(values) == {
        "rating/random",
        "rating/hard",
        *(f"{k}{b}/random_vs_hard" for k in ("score", "margin") for b in ("", "_low", "_high")),
    }


@pytest.mark.usefixtures("local_tracking")
def test_a_logged_run_carries_config_metrics_and_results() -> None:
    results = run(Config(bots=("random", "greedy", "hard"), deals=50, first_seed=3))
    run_id = log_run(results, "test")

    logged = mlflow.get_run(run_id)
    assert logged.data.params["bots"] == "random,greedy,hard"
    assert logged.data.params["first_seed"] == "3"
    assert logged.data.metrics["rating/hard"] == pytest.approx(results.ratings["hard"])
    assert mlflow.get_experiment(logged.info.experiment_id).name == EXPERIMENT
    text = Path(mlflow.artifacts.download_artifacts(run_id=run_id, artifact_path="results.json"))
    assert '"deals": 50' in text.read_text()
