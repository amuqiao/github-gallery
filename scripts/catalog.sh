#!/usr/bin/env bash
# catalog.sh - catalog maintenance entrypoint.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

PROJECTS_DIR="$ROOT_DIR/catalog/projects"

usage() {
  cat <<EOF
用法：
  ./scripts/catalog.sh <command> [args...]
  ./scripts/catalog.sh -h|--help

作用域：
  当前仓库的 catalog 维护入口。管理 catalog/projects 和 catalog/collections 的本地文件骨架。
  不自动抓取 GitHub 信息，不修改 taxonomy，不绕过 schema/loader。

命令：
  list          列出已有项目 id。
  validate      验证 catalog，等价于 ./scripts/verify.sh catalog。
  new <id>      新增一个项目目录和 project.yaml，可选创建 details.md，并立即验证。
  collection    管理专题 collections。
  import        从 .tmp/import-batches/<batch-id>/ 安全导入 catalog item。
  help          显示帮助。

常用示例：
  ./scripts/catalog.sh list
  ./scripts/catalog.sh validate
  ./scripts/catalog.sh import plan .tmp/import-batches/example-batch
  ./scripts/catalog.sh collection list
  ./scripts/catalog.sh collection new voice-cloning \\
    --title "声音克隆项目" \\
    --summary "适合研究声音克隆项目。" \\
    --project gpt-sovits \\
    --project xtts
  ./scripts/catalog.sh new example-project \\
    --name "Example Project" \\
    --repo "https://github.com/example/example-project" \\
    --summary "Short project summary." \\
    --category ai \\
    --tag audio \\
    --details

Exit Codes:
  0  成功
  2  缺少 command、非法参数、缺少必填字段或项目 id 不合法
  3  目标项目目录已存在
  其他非 0 由验证命令返回
EOF
}

collection_usage() {
  require_command node "install Node.js 20 or newer"
  node "$ROOT_DIR/scripts/catalog-cli.mjs" collection help
}

import_usage() {
  require_command node "install Node.js 20 or newer"
  node "$ROOT_DIR/scripts/catalog-import-cli.mjs" help
}

new_usage() {
  cat <<EOF
用法：
  ./scripts/catalog.sh new <id> --name <name> --repo <url> --summary <summary> --category <id> --tag <id> [--tag <id> ...] [--maintenance-status <id>] [--details]

作用域：
  创建 catalog/projects/<id>/project.yaml。
  使用 --details 时同时创建 details.md，并在 project.yaml 中引用它。

必填：
  <id>          小写 kebab-case，且必须作为目录名。
  --name        项目展示名。
  --repo        GitHub 仓库 URL。
  --summary     160 字以内摘要；长度由 schema 在验证阶段最终裁决。
  --category    已存在 taxonomy category id。
  --tag         至少一个已存在 taxonomy tag id，可重复传入。

可选：
  --maintenance-status
                已存在 project maintenance status id；默认 unknown。
  --details     创建 Markdown 详情文件。

副作用与边界：
  不自动校验 category/tag/maintenance_status 是否存在；运行 ./scripts/catalog.sh validate 由 loader 统一校验。
  目标目录已存在时直接失败，不覆盖已有项目。
  文件先写入临时目录，全部成功后再移动到最终目录。
EOF
}

yaml_string() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

list_projects() {
  local dir
  [[ -d "$PROJECTS_DIR" ]] || die "$PROJECTS_DIR not found" 2
  for dir in "$PROJECTS_DIR"/*; do
    [[ -d "$dir" ]] || continue
    [[ -f "$dir/project.yaml" ]] || continue
    basename "$dir"
  done | sort
}

validate_catalog() {
  "$ROOT_DIR/scripts/verify.sh" catalog
}

write_project_yaml() {
  local project_dir="$1"
  local id="$2"
  local name="$3"
  local repo="$4"
  local summary="$5"
  local category="$6"
  local maintenance_status="$7"
  local include_details="$8"
  shift 8
  local tags=("$@")
  local project_yaml="$project_dir/project.yaml"

  {
    printf "schema_version: 1\n"
    printf "id: %s\n" "$id"
    printf "name: %s\n" "$(yaml_string "$name")"
    printf "repo: %s\n" "$(yaml_string "$repo")"
    printf "summary: %s\n" "$(yaml_string "$summary")"
    printf "category: %s\n" "$category"
    printf "tags:\n"
    local tag
    for tag in "${tags[@]}"; do
      printf "  - %s\n" "$tag"
    done
    printf "maintenance_status: %s\n" "$maintenance_status"
    if [[ "$include_details" == "true" ]]; then
      printf "details:\n"
      printf "  type: markdown\n"
      printf "  path: ./details.md\n"
    fi
  } >"$project_yaml"
}

write_details_markdown() {
  local project_dir="$1"
  local name="$2"
  local details_path="$project_dir/details.md"

  {
    printf "# %s\n\n" "$name"
    printf "## Overview\n\n"
    printf "Add project details here.\n"
  } >"$details_path"
}

create_project() {
  local id="${1:-}"
  [[ -n "$id" ]] || die "missing project id" 2
  assert_project_id "$id"
  shift

  local name=""
  local repo=""
  local summary=""
  local category=""
  local maintenance_status="unknown"
  local include_details="false"
  local tags=()

  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --name)
        [[ "$#" -ge 2 ]] || die "--name requires a value" 2
        name="$2"
        shift 2
        ;;
      --repo)
        [[ "$#" -ge 2 ]] || die "--repo requires a value" 2
        repo="$2"
        shift 2
        ;;
      --summary)
        [[ "$#" -ge 2 ]] || die "--summary requires a value" 2
        summary="$2"
        shift 2
        ;;
      --category)
        [[ "$#" -ge 2 ]] || die "--category requires a value" 2
        category="$2"
        shift 2
        ;;
      --tag)
        [[ "$#" -ge 2 ]] || die "--tag requires a value" 2
        tags+=("$2")
        shift 2
        ;;
      --maintenance-status)
        [[ "$#" -ge 2 ]] || die "--maintenance-status requires a value" 2
        maintenance_status="$2"
        shift 2
        ;;
      --details)
        include_details="true"
        shift
        ;;
      -h|--help)
        new_usage
        exit 0
        ;;
      *)
        die "unknown argument for catalog new: $1" 2
        ;;
    esac
  done

  [[ -n "$name" ]] || die "--name is required" 2
  [[ -n "$repo" ]] || die "--repo is required" 2
  [[ "$repo" == https://github.com/* || "$repo" == http://github.com/* ]] || die "--repo must be a GitHub URL" 2
  [[ -n "$summary" ]] || die "--summary is required" 2
  [[ -n "$category" ]] || die "--category is required" 2
  assert_project_id "$category"
  [[ "${#tags[@]}" -gt 0 ]] || die "at least one --tag is required" 2

  local tag
  for tag in "${tags[@]}"; do
    assert_project_id "$tag"
  done

  assert_project_id "$maintenance_status"

  local project_dir="$PROJECTS_DIR/$id"
  local tmp_dir="$PROJECTS_DIR/.${id}.tmp.$$"
  [[ ! -e "$project_dir" ]] || die "$project_dir already exists" 3
  [[ ! -e "$tmp_dir" ]] || die "$tmp_dir already exists" 3

  with_catalog_write_lock
  local created_project="false"

  cleanup_tmp_dir() {
    [[ -n "${tmp_dir:-}" && -d "$tmp_dir" ]] && rm -rf "$tmp_dir"
    if [[ "${created_project:-false}" == "true" && -d "$project_dir" ]]; then
      rm -rf "$project_dir"
    fi
    rm -rf "$ROOT_DIR/.data/catalog-write.lock"
  }

  trap cleanup_tmp_dir EXIT INT TERM

  mkdir -p "$tmp_dir"
  write_project_yaml "$tmp_dir" "$id" "$name" "$repo" "$summary" "$category" "$maintenance_status" "$include_details" "${tags[@]}"

  if [[ "$include_details" == "true" ]]; then
    write_details_markdown "$tmp_dir" "$name"
  fi

  mv "$tmp_dir" "$project_dir"
  created_project="true"

  validate_catalog
  created_project="false"
  trap - EXIT INT TERM
  rm -rf "$ROOT_DIR/.data/catalog-write.lock"

  event "CREATED" "$id" "catalog/projects/$id"
}

command="${1:-}"
case "$command" in
  -h|--help|help)
    usage
    ;;
  "")
    usage >&2
    exit 2
    ;;
  list)
    shift
    if args_include_help "$@"; then
      usage
      exit 0
    fi
    [[ "$#" -eq 0 ]] || die "unexpected arguments for catalog list: $*" 2
    list_projects
    ;;
  validate)
    shift
    if args_include_help "$@"; then
      usage
      exit 0
    fi
    [[ "$#" -eq 0 ]] || die "unexpected arguments for catalog validate: $*" 2
    validate_catalog
    ;;
  new)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
      new_usage
      exit 0
    fi
    create_project "$@"
    ;;
  collection)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
      collection_usage
      exit 0
    fi
    require_command node "install Node.js 20 or newer"
    node "$ROOT_DIR/scripts/catalog-cli.mjs" collection "$@"
    ;;
  import)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || "${1:-}" == "help" ]]; then
      import_usage
      exit 0
    fi
    require_command node "install Node.js 20 or newer"
    node "$ROOT_DIR/scripts/catalog-import-cli.mjs" "$@"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
