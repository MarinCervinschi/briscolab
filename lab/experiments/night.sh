#!/usr/bin/env bash
# One night of training: the runs below, 170 minutes each, one after the other. Edit the list for each night.
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

run by-seat --encoding by-seat
run by-seat-s1 --encoding by-seat --seed 1
run big --hidden 512 --layers 3
run by-seat-big --encoding by-seat --hidden 512 --layers 3
