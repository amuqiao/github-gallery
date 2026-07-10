#!/usr/bin/env bash
# verify.sh - one-shot verification entrypoint.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

usage() {
  cat <<EOF
用法：
  ./scripts/verify.sh <command>
  ./scripts/verify.sh -h|--help

作用域：
  当前仓库的一次性验证入口。验证代码、content bundle、hall、taxonomy、site 和被配置引用的内容资产。
  不把 README 或 docs 作为验证对象；文档只解释已实现规则，不是真相源。

命令：
  check      总验证入口，执行 content catalog、content assets、build。
  release    发布门禁，执行 content bundle 发布语义检查和静态构建。
  build      执行 npm run build。
  catalog    验证 content bundle、hall、taxonomy、site config、relations 等 catalog 合同。
  content    验证已被 content 配置引用的内容资产，例如 body 和 notes。
  help       显示帮助。

副作用与边界：
  build/catalog/content 当前都通过 Astro build 触发 schema 和 loader 校验。
  验证不会启动长期运行的服务。

常用示例：
  ./scripts/verify.sh check
  ./scripts/verify.sh release
  ./scripts/verify.sh catalog
  ./scripts/verify.sh content

Exit Codes:
  0  成功
  2  缺少 command、非法 command 或缺少 npm
  其他非 0 由 npm/Astro 返回
EOF
}

command_usage() {
  local name="$1"
  case "$name" in
    check)
      cat <<EOF
用法：
  ./scripts/verify.sh check

作用域：
  执行 catalog、content 和 build 验证。

说明：
  catalog/content 目前共用 release gate 和 npm run build 作为可执行门禁，因为 loader 已在构建期校验 content bundle、
  schema、taxonomy、collection references、relations 和内容文件引用。未来需要更快反馈时，再拆出 catalog-only 校验。
EOF
      ;;
    build)
      cat <<EOF
用法：
  ./scripts/verify.sh build

作用域：
  执行 npm run build。
EOF
      ;;
    release)
      cat <<EOF
用法：
  ./scripts/verify.sh release

作用域：
  执行正式发布门禁：先验证 content bundle 的发布语义，再执行 Astro 静态构建。

说明：
  release gate 通过 src/lib/catalog/content-validator.js 检查 catalog/content/{drafts,published,archived}/ 目录形状、active hall 归属、
  item/collection schema、body/notes 文件引用、重复 bundle key，以及 published collection 只能引用
  同一 hall 下的 published item。
EOF
      ;;
    catalog)
      cat <<EOF
用法：
  ./scripts/verify.sh catalog

作用域：
  验证 catalog 配置合同：content item.yaml、content collection.yaml、hall.yaml、taxonomies.yaml、site.yaml、relations。
  当前实现通过 release gate 和 npm run build 触发 loader 校验。
EOF
      ;;
    content)
      cat <<EOF
用法：
  ./scripts/verify.sh content

作用域：
  验证已被配置引用的内容资产，例如 content body 和 notes。
  当前实现通过 release gate 和 npm run build 触发 loader 的引用文件校验。
EOF
      ;;
    *)
      usage >&2
      return 2
      ;;
  esac
}

run_build_gate() {
  run_npm_script build
}

run_release_gate() {
  require_command node "install Node.js 20 or newer"
  (cd "$ROOT_DIR" && node scripts/verify/release-gate.mjs)
}

section_name_for() {
  case "$1" in
    build) printf "Build" ;;
    catalog) printf "Catalog" ;;
    content) printf "Content" ;;
    *) printf "%s" "$1" ;;
  esac
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
  check)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
      command_usage "$command"
      exit $?
    fi
    [[ "$#" -eq 0 ]] || die "unexpected arguments for verify check: $*" 2
    section "Build Gate"
    event "COVERS" "catalog" "content item.yaml/collection.yaml, hall.yaml, taxonomy, site config, relations"
    event "COVERS" "content" "configured content body and notes references"
    event "COVERS" "build" "astro check and static build"
    run_release_gate
    run_build_gate
    ;;
  release)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
      command_usage "$command"
      exit $?
    fi
    [[ "$#" -eq 0 ]] || die "unexpected arguments for verify release: $*" 2
    section "Release Gate"
    event "COVERS" "content" "published content item.yaml/collection.yaml, hall ownership, body/notes references"
    event "COVERS" "relations" "published collections and related content only reference published items in the same hall"
    event "COVERS" "build" "astro check and static build"
    run_release_gate
    run_build_gate
    ;;
  build)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
      command_usage "$command"
      exit $?
    fi
    [[ "$#" -eq 0 ]] || die "unexpected arguments for verify build: $*" 2
    section "$(section_name_for "$command")"
    run_build_gate
    ;;
  catalog|content)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
      command_usage "$command"
      exit $?
    fi
    [[ "$#" -eq 0 ]] || die "unexpected arguments for verify $command: $*" 2
    section "$(section_name_for "$command")"
    run_release_gate
    run_build_gate
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
