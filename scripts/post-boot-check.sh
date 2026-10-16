#!/usr/bin/env bash
# Runs on the Docker host after sign-in. Docker Desktop on WSL2 sometimes starts
# containers before the /mnt drives are ready, leaving bind mounts empty inside the
# container even though the host directory has files. A plain restart doesn't fix
# this; recreating the container does. This script waits for the stack to come up,
# finds services with an empty bind mount, and recreates them.
set -euo pipefail

cd "$(dirname "$0")/.."
exec > >(tee -a data/post-boot-check.log) 2>&1

log() {
  echo "[stavrobot] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >&2
}

wait_for_docker() {
  local deadline=$((SECONDS + 900))
  until docker info >/dev/null 2>&1; do
    if ((SECONDS > deadline)); then
      log "Docker did not come up within 15 minutes, giving up."
      exit 1
    fi
    sleep 10
  done
  log "Docker is up."
}

# Prints the names of running services that have a bind mount whose host directory
# is non-empty but whose container directory is empty or unreadable.
find_broken_services() {
  local service container source target
  for service in $(docker compose ps --services); do
    container=$(docker compose ps -q "$service")
    if [[ -z "$container" ]]; then
      continue
    fi
    while IFS=$'\t' read -r source target; do
      if [[ ! -d "$source" || -z "$(ls -A "$source")" ]]; then
        continue
      fi
      if ! docker compose exec -T "$service" sh -c "test -n \"\$(ls -A '$target')\"" </dev/null >/dev/null 2>&1; then
        log "Service $service has an empty mount at $target (host $source)."
        echo "$service"
        break
      fi
    done < <(docker inspect --format '{{range .Mounts}}{{if eq .Type "bind"}}{{.Source}}{{"\t"}}{{.Destination}}{{"\n"}}{{end}}{{end}}' "$container")
  done
}

wait_for_docker

# Give restart policies time to bring every container back before inspecting them.
sleep 60

broken=$(find_broken_services)
if [[ -z "$broken" ]]; then
  log "All bind mounts look healthy."
  exit 0
fi

log "Recreating: $(echo $broken)"
# shellcheck disable=SC2086
docker compose up -d --force-recreate --no-deps $broken
sleep 15

still_broken=$(find_broken_services)
if [[ -n "$still_broken" ]]; then
  log "Still broken after recreate: $(echo $still_broken)"
  exit 1
fi
log "Recreated services are healthy."
