#!/usr/bin/env bash
# compose.sh - docker compose adapter for static-site deployment scripts.

COMPOSE_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$COMPOSE_LIB_DIR/../.." && pwd)}"
source "$ROOT_DIR/scripts/lib/common.sh"

compose_available() {
  docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1
}

compose_project_name() {
  local env_file
  local project_name

  env_file="$(env_file_path)"
  project_name="${COMPOSE_PROJECT_NAME:-$(env_value_from COMPOSE_PROJECT_NAME "$env_file")}"
  [[ -n "$project_name" ]] || die "COMPOSE_PROJECT_NAME is required in ${ENV_FILE:-.env}" 2
  printf "%s" "$project_name"
}

compose() {
  local env_file
  local project_name

  env_file="$(env_file_path)"
  [[ -f "$env_file" ]] || die "$env_file not found; copy .env.example to ${ENV_FILE:-.env} or set ENV_FILE" 2
  project_name="$(compose_project_name)"

  if docker compose version >/dev/null 2>&1; then
    docker compose --env-file "$env_file" -p "$project_name" "$@"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose --env-file "$env_file" -p "$project_name" "$@"
    return
  fi
  die "Docker Compose is not available. Install Docker Desktop or docker-compose." 2
}

canonical_existing_dir() {
  local path="$1"
  if [[ -d "$path" ]]; then
    (cd "$path" >/dev/null 2>&1 && pwd -P) || printf "%s" "$path"
    return
  fi
  printf "%s" "$path"
}

pid_in_lines() {
  local needle="$1"
  local lines="$2"
  case "$lines" in
    "$needle"|"$needle"$'\n'*|*$'\n'"$needle"|*$'\n'"$needle"$'\n'*) return 0 ;;
    *) return 1 ;;
  esac
}

assert_no_compose_project_name_conflict() {
  local project_name
  local current_working_dir
  local working_dirs
  local working_dir
  local normalized_working_dir
  local conflicting_working_dirs=""

  project_name="$(compose_project_name)"
  current_working_dir="$(canonical_existing_dir "$ROOT_DIR")"
  require_command docker "install Docker Desktop or Docker Engine"
  working_dirs="$(docker ps -a \
    --filter "label=com.docker.compose.project=$project_name" \
    --format '{{.Label "com.docker.compose.project.working_dir"}}')" \
    || die "docker ps failed while checking COMPOSE_PROJECT_NAME conflict" 2

  while IFS= read -r working_dir; do
    [[ -n "$working_dir" ]] || continue
    normalized_working_dir="$(canonical_existing_dir "$working_dir")"
    [[ "$normalized_working_dir" != "$current_working_dir" ]] || continue

    if [[ -z "$conflicting_working_dirs" ]]; then
      conflicting_working_dirs="$working_dir"
    elif ! pid_in_lines "$working_dir" "$conflicting_working_dirs"; then
      conflicting_working_dirs="${conflicting_working_dirs}"$'\n'"${working_dir}"
    fi
  done <<< "$working_dirs"

  [[ -z "$conflicting_working_dirs" ]] && return 0
  die "COMPOSE_PROJECT_NAME conflict: project name '$project_name' has existing working_dir '${conflicting_working_dirs//$'\n'/, }' but current ROOT_DIR is '$ROOT_DIR'" 4
}
