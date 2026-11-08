#!/usr/bin/env bash
# One night of training: the runs below, one after the other, 170 minutes each unless a run sets --minutes.
# Edit the list for each night.
# Run from lab/ with MLFLOW_TRACKING_URI set: experiments/night.sh night-2
set -uo pipefail
night=${1:?give the night a name, such as night-2}

run() {
	local name=$1
	shift
	# A run that fails leaves the others to run.
	caffeinate -i uv run briscolab-ppo --minutes 170 --mlflow --run-name "$night-$name" "$@" ||
		echo "$night-$name failed"
}

run both-long --informed-critic --points-weight 0.5 --minutes 340
run big-anneal-long --hidden 512 --layers 3 --anneal --minutes 340
