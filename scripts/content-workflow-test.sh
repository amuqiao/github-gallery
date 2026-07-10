#!/usr/bin/env bash
# content-workflow-test.sh - isolated content workflow regression runner.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

cleanup_on_fail=0
tmp_root="${CONTENT_WORKFLOW_TEST_TMP_ROOT:-${TMPDIR:-/tmp}}"
run_dir=""
copy_dir=""
initial_status=""
initial_pollution_snapshot=""

usage() {
  cat <<EOF
用法：
  ./scripts/content-workflow-test.sh [options]
  ./scripts/content-workflow-test.sh -h|--help

作用域：
  在仓库外隔离副本中运行 content workflow 回归测试，避免污染当前项目现场。

当前阶段：
  Phase 1 只验证测试入口、隔离副本、主仓库前后状态检查、成功清理和失败留痕。
  后续阶段会逐步加入 item、note、collection、import、publish、archive、restore 生命周期测试。

选项：
  --tmp-root <path>       仓库外临时根目录，默认 CONTENT_WORKFLOW_TEST_TMP_ROOT、TMPDIR 或 /tmp。
  --cleanup-on-fail       失败时也清理隔离副本；默认失败时保留并打印路径。
  -h, --help              显示帮助。

常用示例：
  ./scripts/content-workflow-test.sh
  ./scripts/content-workflow-test.sh --cleanup-on-fail
  ./scripts/content-workflow-test.sh --tmp-root /private/tmp
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -h|--help|help)
      usage
      exit 0
      ;;
    --cleanup-on-fail)
      cleanup_on_fail=1
      shift
      ;;
    --tmp-root)
      [[ -n "${2:-}" ]] || die "--tmp-root requires a value" 2
      tmp_root="$2"
      shift 2
      ;;
    *)
      die "unknown option: $1" 2
      ;;
  esac
done

canonical_existing_dir() {
  local dir="$1"
  (cd "$dir" && pwd -P)
}

canonical_candidate_dir() {
  local dir="$1"
  local parent
  local name
  parent="$(dirname "$dir")"
  name="$(basename "$dir")"
  [[ -d "$parent" ]] || die "--tmp-root parent directory does not exist: $parent" 2
  parent="$(cd "$parent" && pwd -P)"
  printf "%s/%s" "$parent" "$name"
}

assert_outside_repo() {
  local candidate="$1"
  local root_real="$2"

  if [[ "$candidate" == "$root_real" ]]; then
    die "temporary root must be outside the repository: $candidate" 2
  fi

  case "$candidate/" in
    "$root_real"/*)
      die "temporary root must be outside the repository: $candidate" 2
      ;;
  esac
}

repo_status() {
  (cd "$ROOT_DIR" && git status --short --untracked-files=all)
}

repo_pollution_snapshot() {
  local path
  for path in .data .tmp dist .astro .env node_modules; do
    if [[ ! -e "$ROOT_DIR/$path" ]]; then
      printf "MISSING %s\n" "$path"
      continue
    fi

    if [[ -d "$ROOT_DIR/$path" && "$path" != "node_modules" ]]; then
      (cd "$ROOT_DIR" && find "$path" -maxdepth 2 -print | sort)
    else
      printf "EXISTS %s\n" "$path"
    fi
  done
}

assert_repo_state_unchanged() {
  local current_status
  local current_pollution_snapshot
  current_status="$(repo_status)"
  current_pollution_snapshot="$(repo_pollution_snapshot)"

  if [[ "$current_status" != "$initial_status" ]]; then
    printf "ERROR: repository status changed during content workflow test\n" >&2
    printf "\n== Before ==\n%s\n" "$initial_status" >&2
    printf "\n== After ==\n%s\n" "$current_status" >&2
    exit 1
  fi

  if [[ "$current_pollution_snapshot" != "$initial_pollution_snapshot" ]]; then
    printf "ERROR: repository ignored-path snapshot changed during content workflow test\n" >&2
    printf "\n== Before ==\n%s\n" "$initial_pollution_snapshot" >&2
    printf "\n== After ==\n%s\n" "$current_pollution_snapshot" >&2
    exit 1
  fi
}

cleanup() {
  local exit_code="$?"

  if [[ -z "$run_dir" ]]; then
    return "$exit_code"
  fi

  if [[ "$exit_code" -eq 0 || "$cleanup_on_fail" -eq 1 ]]; then
    rm -rf "$run_dir"
    if [[ "$exit_code" -eq 0 ]]; then
      event "CLEAN" "workspace" "$run_dir"
    fi
  else
    event "KEEP" "workspace" "$run_dir"
  fi

  return "$exit_code"
}

trap cleanup EXIT

copy_worktree() {
  local source_dir="$1"
  local target_dir="$2"

  rsync -a \
    --delete \
    --exclude ".git/" \
    --exclude ".astro/" \
    --exclude ".data/" \
    --exclude ".env" \
    --exclude ".run/" \
    --exclude ".tmp/" \
    --exclude "dist/" \
    --exclude "node_modules/" \
    "$source_dir"/ "$target_dir"/
}

assert_copy_excludes() {
  local entry
  for entry in .git node_modules dist .astro .data .tmp .run .env; do
    if [[ -e "$copy_dir/$entry" ]]; then
      die "isolated copy must not contain $entry" 1
    fi
  done
}

run_copy_smoke() {
  section "Isolated Smoke"
  event "CHECK" "exclude" ".git node_modules dist .data .tmp .run .env"
  assert_copy_excludes

  event "CHECK" "bash" "script syntax"
  (
    cd "$copy_dir"
    local script
    for script in scripts/content-workflow-test.sh scripts/content.sh scripts/verify.sh scripts/lib/common.sh; do
      bash -n "$script"
    done
  )

  event "CHECK" "node" "cli syntax"
  (
    cd "$copy_dir"
    node --check scripts/content/content-cli.mjs >/dev/null
    node --check scripts/content/content-import-cli.mjs >/dev/null
    node --check scripts/verify/release-gate.mjs >/dev/null
  )

  event "RUN" "content" "./scripts/content.sh help"
  (cd "$copy_dir" && ./scripts/content.sh help >/dev/null)

  event "RUN" "verify" "./scripts/verify.sh help"
  (cd "$copy_dir" && ./scripts/verify.sh help >/dev/null)
}

main() {
  require_command git "install Git"
  require_command rsync "install rsync"
  require_command mktemp "install mktemp"
  require_command node "install Node.js 20 or newer"

  local root_real
  local tmp_root_real
  root_real="$(canonical_existing_dir "$ROOT_DIR")"
  case "$tmp_root" in
    /*) ;;
    *) die "--tmp-root must be an absolute path outside the repository" 2 ;;
  esac
  assert_outside_repo "$tmp_root" "$root_real"
  tmp_root_real="$(canonical_candidate_dir "$tmp_root")"
  assert_outside_repo "$tmp_root_real" "$root_real"
  mkdir -p "$tmp_root_real"
  tmp_root_real="$(canonical_existing_dir "$tmp_root_real")"
  assert_outside_repo "$tmp_root_real" "$root_real"

  initial_status="$(repo_status)"
  initial_pollution_snapshot="$(repo_pollution_snapshot)"

  section "Content Workflow Test"
  event "PHASE" "1" "isolated runner smoke"
  event "ROOT" "repo" "$root_real"
  event "ROOT" "tmp" "$tmp_root_real"

  run_dir="$(mktemp -d "$tmp_root_real/github-gallery-content-workflow.XXXXXX")"
  copy_dir="$run_dir/repo"
  mkdir -p "$copy_dir"
  event "CREATE" "workspace" "$run_dir"

  section "Copy Worktree"
  copy_worktree "$root_real" "$copy_dir"
  event "COPIED" "repo" "$copy_dir"

  run_copy_smoke

  section "Main Workspace"
  assert_repo_state_unchanged
  event "CHECK" "status" "unchanged"
}

main
