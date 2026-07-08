#!/usr/bin/env bash
# dev.sh - local Astro development entrypoint.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

usage() {
  cat <<EOF
用法：
  ./scripts/dev.sh <command> [npm-args...]
  ./scripts/dev.sh -h|--help

作用域：
  当前 Astro static site 的本地开发入口。只负责前台启动、预览和构建。
  不负责后台进程管理、部署、远程服务、GitHub 抓取或 catalog 内容生成。

命令：
  start      启动 Astro dev server，等价于 npm run dev。
  preview    预览已构建站点，等价于 npm run preview。
  build      构建站点，等价于 npm run build。
  help       显示帮助。

副作用与边界：
  start/preview 是前台进程，使用 Ctrl-C 停止。
  build 会写入 Astro 构建产物目录。

常用示例：
  ./scripts/dev.sh start
  ./scripts/dev.sh start --host 0.0.0.0
  ./scripts/dev.sh preview
  ./scripts/dev.sh build

Exit Codes:
  0  成功
  2  缺少 command、非法 command 或缺少 npm
  其他非 0 由 npm/Astro 返回
EOF
}

command_usage() {
  local name="$1"
  case "$name" in
    start)
      cat <<EOF
用法：
  ./scripts/dev.sh start [npm-args...]

作用域：
  启动 Astro dev server，支持热更新。

常用示例：
  ./scripts/dev.sh start --host 0.0.0.0

停止方式：
  Ctrl-C
EOF
      ;;
    preview)
      cat <<EOF
用法：
  ./scripts/dev.sh preview [npm-args...]

作用域：
  预览已构建站点。需要先运行 ./scripts/dev.sh build 或 ./scripts/verify.sh build。

常用示例：
  ./scripts/dev.sh preview --host 0.0.0.0

停止方式：
  Ctrl-C
EOF
      ;;
    build)
      cat <<EOF
用法：
  ./scripts/dev.sh build [npm-args...]

作用域：
  执行当前项目构建，等价于 npm run build。
EOF
      ;;
    *)
      usage >&2
      return 2
      ;;
  esac
}

npm_script_for() {
  case "$1" in
    start) printf "dev" ;;
    preview) printf "preview" ;;
    build) printf "build" ;;
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
  start|preview|build)
    shift
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
      command_usage "$command"
      exit $?
    fi
    run_npm_script "$(npm_script_for "$command")" "$@"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
