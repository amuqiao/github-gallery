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
run_stamp=""
github_item_id=""
model_item_id=""
model_collection_id=""
markdown_note_id="quick-start"
html_note_id="html-fragment"

usage() {
  cat <<EOF
用法：
  ./scripts/content-workflow-test.sh [options]
  ./scripts/content-workflow-test.sh -h|--help

作用域：
  在仓库外隔离副本中运行 content workflow 回归测试，避免污染当前项目现场。

当前阶段：
  Phase 2 覆盖隔离副本、主仓库现场不变、item/note/collection 创建、发布、归档、恢复、
  手工编辑生成内容、重新发布、canonical route、列表可见性和渲染内容断言。
  后续阶段会逐步加入 import、失败路径、幂等性和 planned hall 边界测试。

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

repo_pollution_path_snapshot() {
  local path="$1"
  local full_path
  local entry
  full_path="$ROOT_DIR/$path"

  if [[ -L "$full_path" ]]; then
    printf "LINK %s -> %s\n" "$path" "$(readlink "$full_path")"
    return
  fi

  if [[ -f "$full_path" ]]; then
    printf "FILE %s\n" "$path"
    (cd "$ROOT_DIR" && cksum "$path")
    return
  fi

  if [[ -d "$full_path" ]]; then
    printf "DIR %s\n" "$path"
    (
      cd "$ROOT_DIR"
      find "$path" -xdev -print | LC_ALL=C sort | while IFS= read -r entry; do
        if [[ -L "$entry" ]]; then
          printf "LINK %s -> %s\n" "$entry" "$(readlink "$entry")"
        elif [[ -f "$entry" ]]; then
          cksum "$entry"
        elif [[ -d "$entry" ]]; then
          printf "DIR %s\n" "$entry"
        else
          printf "OTHER %s\n" "$entry"
        fi
      done
    )
    return
  fi

  printf "OTHER %s\n" "$path"
}

repo_pollution_snapshot() {
  local path
  local full_path
  local checksum
  for path in .data .tmp dist .astro .env .run node_modules; do
    full_path="$ROOT_DIR/$path"
    if [[ ! -e "$full_path" && ! -L "$full_path" ]]; then
      printf "MISSING %s\n" "$path"
      continue
    fi

    checksum="$(repo_pollution_path_snapshot "$path" | cksum)"
    printf "SNAPSHOT %s %s\n" "$path" "$checksum"
  done
}

run_in_copy() {
  local label="$1"
  shift

  event "RUN" "$label" "$*"
  (cd "$copy_dir" && "$@")
}

assert_copy_path_exists() {
  local relative_path="$1"

  if [[ ! -e "$copy_dir/$relative_path" ]]; then
    die "expected path to exist in isolated copy: $relative_path" 1
  fi

  event "ASSERT" "exists" "$relative_path"
}

assert_copy_path_missing() {
  local relative_path="$1"

  if [[ -e "$copy_dir/$relative_path" ]]; then
    die "expected path to be absent in isolated copy: $relative_path" 1
  fi

  event "ASSERT" "missing" "$relative_path"
}

assert_copy_file_contains() {
  local relative_path="$1"
  local expected="$2"

  if ! grep -Fq "$expected" "$copy_dir/$relative_path"; then
    die "expected file to contain '$expected': $relative_path" 1
  fi

  event "ASSERT" "contains" "$relative_path"
}

assert_copy_file_not_contains() {
  local relative_path="$1"
  local unexpected="$2"

  if [[ -f "$copy_dir/$relative_path" ]] && grep -Fq "$unexpected" "$copy_dir/$relative_path"; then
    die "expected file not to contain '$unexpected': $relative_path" 1
  fi

  event "ASSERT" "omits" "$relative_path"
}

write_copy_file() {
  local relative_path="$1"
  local content="$2"

  printf "%b" "$content" > "$copy_dir/$relative_path"
  event "EDIT" "file" "$relative_path"
}

compare_repo_state() {
  local current_status
  local current_pollution_snapshot
  local changed=0
  current_status="$(repo_status)"
  current_pollution_snapshot="$(repo_pollution_snapshot)"

  if [[ "$current_status" != "$initial_status" ]]; then
    printf "ERROR: repository status changed during content workflow test\n" >&2
    printf "\n== Before ==\n%s\n" "$initial_status" >&2
    printf "\n== After ==\n%s\n" "$current_status" >&2
    changed=1
  fi

  if [[ "$current_pollution_snapshot" != "$initial_pollution_snapshot" ]]; then
    printf "ERROR: repository ignored-path snapshot changed during content workflow test\n" >&2
    printf "\n== Before ==\n%s\n" "$initial_pollution_snapshot" >&2
    printf "\n== After ==\n%s\n" "$current_pollution_snapshot" >&2
    changed=1
  fi

  return "$changed"
}

assert_repo_state_unchanged() {
  compare_repo_state || exit 1
}

cleanup() {
  local exit_code="$?"

  if [[ "$exit_code" -ne 0 && -n "$initial_status" && -n "$initial_pollution_snapshot" ]]; then
    compare_repo_state || exit_code=1
  fi

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

setup_copy_dependencies() {
  section "Copy Dependencies"

  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    die "node_modules is required for isolated build; run npm install in the main repository first" 1
  fi

  rsync -a "$ROOT_DIR/node_modules/" "$copy_dir/node_modules/"
  event "COPIED" "node_modules" "isolated build dependencies"
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

initialize_fixture_ids() {
  run_stamp="$(date +%Y%m%d%H%M%S)-$$"
  github_item_id="workflow-github-$run_stamp"
  model_item_id="workflow-model-$run_stamp"
  model_collection_id="workflow-models-$run_stamp"
}

assert_published_routes_exist() {
  assert_copy_path_exists "dist/halls/github/items/$github_item_id/index.html"
  assert_copy_path_exists "dist/halls/models/items/$model_item_id/index.html"
  assert_copy_path_exists "dist/halls/models/items/$model_item_id/notes/$markdown_note_id/index.html"
  assert_copy_path_exists "dist/halls/models/items/$model_item_id/notes/$html_note_id/index.html"
  assert_copy_path_exists "dist/halls/models/collections/$model_collection_id/index.html"
}

assert_published_routes_missing() {
  assert_copy_path_missing "dist/halls/github/items/$github_item_id/index.html"
  assert_copy_path_missing "dist/halls/models/items/$model_item_id/index.html"
  assert_copy_path_missing "dist/halls/models/items/$model_item_id/notes/$markdown_note_id/index.html"
  assert_copy_path_missing "dist/halls/models/items/$model_item_id/notes/$html_note_id/index.html"
  assert_copy_path_missing "dist/halls/models/collections/$model_collection_id/index.html"
}

assert_public_indexes_include_fixtures() {
  assert_copy_file_contains "dist/halls/github/index.html" "$github_item_id"
  assert_copy_file_contains "dist/halls/models/index.html" "$model_item_id"
  assert_copy_file_contains "dist/halls/models/collections/index.html" "$model_collection_id"
}

assert_public_indexes_omit_fixtures() {
  assert_copy_file_not_contains "dist/halls/github/index.html" "$github_item_id"
  assert_copy_file_not_contains "dist/halls/models/index.html" "$model_item_id"
  assert_copy_file_not_contains "dist/halls/models/collections/index.html" "$model_collection_id"
}

assert_republished_content_rendered() {
  assert_copy_file_contains "dist/halls/github/items/$github_item_id/index.html" "WORKFLOW-SENTINEL-GITHUB-REPUBLISH"
  assert_copy_file_contains "dist/halls/models/items/$model_item_id/index.html" "WORKFLOW-SENTINEL-MODEL-REPUBLISH"
  assert_copy_file_contains "dist/halls/models/items/$model_item_id/notes/$markdown_note_id/index.html" "WORKFLOW-SENTINEL-MARKDOWN-NOTE"
  assert_copy_file_contains "dist/halls/models/items/$model_item_id/notes/$html_note_id/index.html" "WORKFLOW-SENTINEL-HTML-NOTE"
  assert_copy_file_contains "dist/halls/models/collections/$model_collection_id/index.html" "WORKFLOW-SENTINEL-COLLECTION-REPUBLISH"
}

run_content_lifecycle() {
  section "Content Lifecycle"
  initialize_fixture_ids
  event "FIXTURE" "github" "$github_item_id"
  event "FIXTURE" "model" "$model_item_id"
  event "FIXTURE" "collection" "$model_collection_id"

  run_in_copy "github-new" \
    ./scripts/content.sh item new github github_project "$github_item_id" \
      --title "Workflow GitHub Fixture" \
      --summary "用于验证 GitHub 展馆内容工作流的临时项目。" \
      --repo "https://github.com/example/$github_item_id" \
      --category ai \
      --tag audio \
      --maintenance-status unknown
  assert_copy_path_exists "catalog/content/drafts/github/items/$github_item_id/item.yaml"
  assert_copy_path_missing "dist/halls/github/items/$github_item_id/index.html"

  run_in_copy "model-new" \
    ./scripts/content.sh item new models ai_model "$model_item_id" \
      --title "Workflow Model Fixture" \
      --summary "用于验证模型展馆内容工作流的临时模型。" \
      --source-type manual \
      --source-url "https://example.com/models/$model_item_id" \
      --provider "Workflow Lab" \
      --input audio \
      --output audio \
      --task source-separation \
      --access download \
      --format onnx \
      --runtime onnxruntime
  assert_copy_path_exists "catalog/content/drafts/models/items/$model_item_id/item.yaml"
  assert_copy_path_missing "dist/halls/models/items/$model_item_id/index.html"

  run_in_copy "note-md" \
    ./scripts/content.sh item note add models "$model_item_id" "$markdown_note_id" \
      --title "Quick Start" \
      --summary "验证 Markdown note 草稿、发布和路由生成。" \
      --format markdown
  assert_copy_path_exists "catalog/content/drafts/models/items/$model_item_id/notes/$markdown_note_id.md"

  run_in_copy "note-html" \
    ./scripts/content.sh item note add models "$model_item_id" "$html_note_id" \
      --title "HTML Fragment" \
      --summary "验证 HTML fragment note 草稿、发布和路由生成。" \
      --format html \
      --display site
  assert_copy_path_exists "catalog/content/drafts/models/items/$model_item_id/notes/$html_note_id.html"

  run_in_copy "collection-new" \
    ./scripts/content.sh collection new models "$model_collection_id" \
      --title "Workflow Model Collection" \
      --summary "用于验证模型展馆专题状态流转的临时专题。" \
      --item "$model_item_id"
  assert_copy_path_exists "catalog/content/drafts/models/collections/$model_collection_id/collection.yaml"

  run_in_copy "publish-git" ./scripts/content.sh publish github item "$github_item_id"
  run_in_copy "publish-model" ./scripts/content.sh publish models item "$model_item_id"
  run_in_copy "publish-col" ./scripts/content.sh publish models collection "$model_collection_id"
  run_in_copy "verify-release" ./scripts/verify.sh release
  assert_published_routes_exist
  assert_public_indexes_include_fixtures

  run_in_copy "archive-col" ./scripts/content.sh archive models collection "$model_collection_id"
  run_in_copy "archive-model" ./scripts/content.sh archive models item "$model_item_id"
  run_in_copy "archive-git" ./scripts/content.sh archive github item "$github_item_id"
  run_in_copy "verify-archived" ./scripts/verify.sh release
  assert_published_routes_missing
  assert_public_indexes_omit_fixtures
  assert_copy_path_exists "catalog/content/archived/github/items/$github_item_id/item.yaml"
  assert_copy_path_exists "catalog/content/archived/models/items/$model_item_id/item.yaml"
  assert_copy_path_exists "catalog/content/archived/models/collections/$model_collection_id/collection.yaml"

  run_in_copy "restore-model" ./scripts/content.sh restore models item "$model_item_id"
  run_in_copy "restore-col" ./scripts/content.sh restore models collection "$model_collection_id"
  run_in_copy "restore-git" ./scripts/content.sh restore github item "$github_item_id"
  assert_copy_path_exists "catalog/content/drafts/github/items/$github_item_id/item.yaml"
  assert_copy_path_exists "catalog/content/drafts/models/items/$model_item_id/item.yaml"
  assert_copy_path_exists "catalog/content/drafts/models/collections/$model_collection_id/collection.yaml"

  write_copy_file "catalog/content/drafts/github/items/$github_item_id/index.md" \
    "# Workflow GitHub Fixture\n\nWORKFLOW-SENTINEL-GITHUB-REPUBLISH\n"
  write_copy_file "catalog/content/drafts/models/items/$model_item_id/index.md" \
    "# Workflow Model Fixture\n\nWORKFLOW-SENTINEL-MODEL-REPUBLISH\n"
  write_copy_file "catalog/content/drafts/models/items/$model_item_id/notes/$markdown_note_id.md" \
    "# Quick Start\n\nWORKFLOW-SENTINEL-MARKDOWN-NOTE\n"
  write_copy_file "catalog/content/drafts/models/items/$model_item_id/notes/$html_note_id.html" \
    "<section>\n  <h1>HTML Fragment</h1>\n  <p>WORKFLOW-SENTINEL-HTML-NOTE</p>\n</section>\n"
  write_copy_file "catalog/content/drafts/models/collections/$model_collection_id/index.md" \
    "# Workflow Model Collection\n\nWORKFLOW-SENTINEL-COLLECTION-REPUBLISH\n"

  run_in_copy "republish-git" ./scripts/content.sh publish github item "$github_item_id"
  run_in_copy "republish-model" ./scripts/content.sh publish models item "$model_item_id"
  run_in_copy "republish-col" ./scripts/content.sh publish models collection "$model_collection_id"
  run_in_copy "verify-repub" ./scripts/verify.sh release
  assert_published_routes_exist
  assert_public_indexes_include_fixtures
  assert_republished_content_rendered
}

main() {
  require_command git "install Git"
  require_command rsync "install rsync"
  require_command mktemp "install mktemp"
  require_command node "install Node.js 20 or newer"
  require_command date "install coreutils date"
  require_command cksum "install POSIX cksum"

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
  event "PHASE" "2" "isolated lifecycle happy path"
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
  setup_copy_dependencies
  run_content_lifecycle

  section "Main Workspace"
  assert_repo_state_unchanged
  event "CHECK" "status" "unchanged"
}

main
