#!/usr/bin/env bash
# common.sh - shared helpers for repository scripts.

COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$COMMON_DIR/../.." && pwd)}"

section() {
  printf "\n== %s ==\n" "$1"
}

event() {
  printf "%-9s %-12s %s\n" "$1" "$2" "${3:-}"
}

die() {
  printf "ERROR: %s\n" "$1" >&2
  exit "${2:-1}"
}

args_include_help() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      -h|--help)
        return 0
        ;;
    esac
  done
  return 1
}

require_command() {
  local name="$1"
  local hint="$2"
  command -v "$name" >/dev/null 2>&1 || die "$name is not available; $hint" 2
}

resolve_repo_path() {
  local path="$1"
  case "$path" in
    /*) printf "%s" "$path" ;;
    *) printf "%s/%s" "$ROOT_DIR" "$path" ;;
  esac
}

env_value_from() {
  local key="$1"
  local path="$2"
  [[ -f "$path" ]] || return 0
  grep -E "^${key}=" "$path" 2>/dev/null | tail -n 1 | cut -d= -f2- || true
}

env_file_path() {
  resolve_repo_path "${ENV_FILE:-.env}"
}

require_npm() {
  require_command npm "install Node.js and npm, then run npm install"
}

run_npm_script() {
  local script="$1"
  shift
  require_npm
  if [[ "$#" -gt 0 ]]; then
    (cd "$ROOT_DIR" && npm run "$script" -- "$@")
  else
    (cd "$ROOT_DIR" && npm run "$script")
  fi
}

assert_project_id() {
  local id="$1"
  [[ "$id" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || die "project id must use lowercase kebab-case: $id" 2
}

with_catalog_write_lock() {
  local lock_dir="$ROOT_DIR/.data/catalog-write.lock"

  mkdir -p "$(dirname "$lock_dir")"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    die "another catalog write is already running" 2
  fi

  cleanup_catalog_write_lock() {
    rm -rf "$lock_dir"
  }

  trap cleanup_catalog_write_lock EXIT INT TERM
}
