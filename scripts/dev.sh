#!/usr/bin/env bash
# dev.sh - local Astro development entrypoint and dev-server manager.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

RUN_DIR="$ROOT_DIR/.run"
PID_FILE="$RUN_DIR/dev.pid"
LOG_FILE="$RUN_DIR/dev.log"
PORT_FILE="$RUN_DIR/dev.port"
HOST_FILE="$RUN_DIR/dev.host"
LOCK_DIR="$RUN_DIR/dev.lock"
DEFAULT_PORT=4321
DEFAULT_HOST="127.0.0.1"
ASTRO_BIN="$ROOT_DIR/node_modules/astro/astro.js"

usage() {
  cat <<EOF
用法：
  ./scripts/dev.sh <command> [args...]
  ./scripts/dev.sh -h|--help

作用域：
  当前 Astro static site 的本地开发入口，并管理后台 dev server 的启停与状态。
  dev server 状态维护在 ${RUN_DIR}（pid/port/log，已 gitignore）。
  不负责部署、远程服务、GitHub 抓取或 catalog 内容生成。

运行环境：
  Requires: Bash, Node.js 20+
  Dependencies: node, ps, pgrep, lsof；logs 需要 tail。

命令：
  start      后台启动 dev server（写 pid/log，立即返回；已运行时会接管并拒绝重复启动）。
  stop       停止当前仓库的 dev server（按 pid 树安全终止）。
  restart    先 stop 再 start。
  status     显示 dev server 运行状态（pid、端口、URL、uptime）。
  logs       跟随查看 dev server 日志（Ctrl-C 退出查看，不影响服务）。
  preview    前台预览已构建站点，等价于 npm run preview（Ctrl-C 停止）。
  build      构建站点，等价于 npm run build。
  help       显示帮助。

副作用与边界：
  start 是后台进程，用 ./scripts/dev.sh stop 停止（不再需要 Ctrl-C）。
  preview 是前台进程，使用 Ctrl-C 停止。
  build 会写入 Astro 构建产物目录。

常用示例：
  ./scripts/dev.sh start
  ./scripts/dev.sh start --host 0.0.0.0 --port 4321
  ./scripts/dev.sh status
  ./scripts/dev.sh restart
  ./scripts/dev.sh stop
  ./scripts/dev.sh logs

Exit Codes:
  0  成功（status：运行中）
  2  缺少 command、非法 command 或缺少 node/npm/Astro
  3  status：dev server 未运行
  4  start/status：进程存在但未监听 TCP 端口
  其他非 0 由 npm/Astro 返回或停止失败
EOF
}

command_usage() {
  local name="$1"
  case "$name" in
    start)
      cat <<EOF
用法：
  ./scripts/dev.sh start [astro-dev-args...]

作用域：
  后台启动 Astro dev server（热更新），立即返回。已在运行时会拒绝重复启动。
  额外 astro-dev-args 透传给 astro dev（如 --host 0.0.0.0 --port 4321）。
  未传 --host 时默认绑定 ${DEFAULT_HOST}，避免 localhost 在部分环境解析到 IPv6 后绑定失败。

常用示例：
  ./scripts/dev.sh start --host 0.0.0.0

停止方式：
  ./scripts/dev.sh stop
EOF
      ;;
    stop)
      cat <<EOF
用法：
  ./scripts/dev.sh stop

作用域：
  停止当前仓库的后台 dev server。优先按 ${PID_FILE} 操作；没有 pid 文件时，
  会发现并接管当前仓库 cwd 下的 astro dev / npm run dev。杀前会校验 cwd 和命令，避免误杀。
EOF
      ;;
    restart)
      cat <<EOF
用法：
  ./scripts/dev.sh restart [astro-dev-args...]

作用域：
  先 stop 再 start；astro-dev-args 透传给新的 start。
EOF
      ;;
    status)
      cat <<EOF
用法：
  ./scripts/dev.sh status

作用域：
  显示后台 dev server 状态。运行中退出码 0，未运行退出码 3，进程存在但未监听端口退出码 4。
EOF
      ;;
    logs)
      cat <<EOF
用法：
  ./scripts/dev.sh logs

作用域：
  跟随查看 dev server 日志（tail -f ${LOG_FILE}）。Ctrl-C 只退出查看，不影响服务。
  如果服务未运行，会明确提示正在查看上次日志。
EOF
      ;;
    preview)
      cat <<EOF
用法：
  ./scripts/dev.sh preview [npm-args...]

作用域：
  前台预览已构建站点。需要先运行 ./scripts/dev.sh build 或 ./scripts/verify.sh build。

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

# --- process helpers (repo-scoped, PID-file assisted) ---

is_alive() {
  kill -0 "$1" 2>/dev/null
}

descendants() {
  # print all descendant pids of $1 (depth-first), not including $1
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    printf '%s\n' "$child"
    descendants "$child"
  done
}

process_command() {
  ps -o command= -p "$1" 2>/dev/null || true
}

process_cwd() {
  lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1 || true
}

is_repo_dev_pid() {
  local pid="$1" command cwd
  is_alive "$pid" || return 1
  command="$(process_command "$pid")"
  cwd="$(process_cwd "$pid")"
  [ "$cwd" = "$ROOT_DIR" ] || return 1
  printf '%s' "$command" | grep -Eq '(^|[ /])npm([ ]|$).*run dev|(^|[ /])astro dev|astro/astro\.js dev|astro\.js dev'
}

# Verify a pid really is this project's dev server before trusting/killing it.
# Guards against PID reuse after a stale pid file.
is_our_server() {
  local pid="$1" child
  is_alive "$pid" || return 1
  if is_repo_dev_pid "$pid"; then
    return 0
  fi
  for child in $(descendants "$pid"); do
    if is_repo_dev_pid "$child"; then
      return 0
    fi
  done
  return 1
}

parent_pid() {
  ps -o ppid= -p "$1" 2>/dev/null | tr -d ' ' || true
}

server_root_for() {
  local pid="$1" current="$1" parent
  while true; do
    parent="$(parent_pid "$current")"
    [ -n "$parent" ] || break
    [ "$parent" != "1" ] || break
    if is_repo_dev_pid "$parent"; then
      current="$parent"
      continue
    fi
    break
  done
  printf '%s' "$current"
}

candidate_pids() {
  {
    pgrep -f 'astro dev' 2>/dev/null || true
    pgrep -f 'astro/astro\.js dev' 2>/dev/null || true
    pgrep -f 'npm.*run dev' 2>/dev/null || true
  } | sort -nu
}

discover_running_pids() {
  local pid root seen=" "
  for pid in $(candidate_pids); do
    [ "$pid" != "$$" ] || continue
    if is_our_server "$pid"; then
      root="$(server_root_for "$pid")"
      case "$seen" in
        *" $root "*) ;;
        *)
          printf '%s\n' "$root"
          seen="${seen}${root} "
          ;;
      esac
    fi
  done
  [ "$seen" != " " ]
}

discover_running_pid() {
  discover_running_pids | head -n 1
}

append_unique_pid() {
  local list="$1" pid="$2"
  [ -n "$pid" ] || return 0
  case "
$list
" in
    *"
$pid
"*) printf '%s' "$list" ;;
    *)
      if [ -n "$list" ]; then
        printf '%s\n%s' "$list" "$pid"
      else
        printf '%s' "$pid"
      fi
      ;;
  esac
}

runtime_pid() {
  local pid
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ] && is_our_server "$pid"; then
      printf '%s' "$pid"
      return 0
    fi
  fi

  return 1
}

managed_pids() {
  local list="" pid discovered
  if pid="$(runtime_pid 2>/dev/null)"; then
    list="$(append_unique_pid "$list" "$pid")"
  fi
  discovered="$(discover_running_pids || true)"
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    list="$(append_unique_pid "$list" "$pid")"
  done <<<"$discovered"
  [ -n "$list" ] || return 1
  printf '%s\n' "$list"
}

write_runtime_files() {
  local pid="$1" host="${2:-}" port
  mkdir -p "$RUN_DIR"
  printf '%s' "$pid" >"$PID_FILE"
  port="$(detect_port "$pid" 2>/dev/null || true)"
  [ -n "$port" ] && printf '%s' "$port" >"$PORT_FILE"
  if [ -n "$host" ]; then
    printf '%s' "$host" >"$HOST_FILE"
  else
    rm -f "$HOST_FILE" 2>/dev/null || true
  fi
}

# First listening TCP port among the pid's process tree.
detect_port() {
  local root="$1" pid port
  for pid in "$root" $(descendants "$root"); do
    port="$(lsof -nP -a -p "$pid" -iTCP -sTCP:LISTEN 2>/dev/null \
      | awk 'NR>1 {n=split($9,a,":"); print a[n]; exit}')"
    if [ -n "$port" ]; then
      printf '%s' "$port"
      return 0
    fi
  done
  return 1
}

# Recursively signal a process tree: children first, then the parent.
kill_tree() {
  local pid="$1" sig="$2" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child" "$sig"
  done
  kill "-$sig" "$pid" 2>/dev/null || true
}

parse_port() {
  local port="$DEFAULT_PORT" arg expect=""
  for arg in "$@"; do
    if [ "$expect" = "port" ]; then
      port="$arg"
      expect=""
      continue
    fi
    case "$arg" in
      --port=*) port="${arg#--port=}" ;;
      --port) expect="port" ;;
    esac
  done
  if [ "$expect" = "port" ]; then
    die "--port requires a value" 2
  fi
  [[ "$port" =~ ^[0-9]+$ ]] || die "--port must be numeric: $port" 2
  if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    die "--port must be between 1 and 65535: $port" 2
  fi
  printf '%s' "$port"
}

has_host_arg() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --host|--host=*)
        return 0
        ;;
    esac
  done
  return 1
}

parse_host() {
  local host="$DEFAULT_HOST" arg expect=""
  for arg in "$@"; do
    if [ "$expect" = "host" ]; then
      if [[ "$arg" == --* ]]; then
        expect=""
      else
        host="$arg"
        expect=""
        continue
      fi
    fi
    case "$arg" in
      --host=*) host="${arg#--host=}" ;;
      --host)
        host="0.0.0.0"
        expect="host"
        ;;
    esac
  done
  printf '%s' "$host"
}

url_host_for() {
  case "$1" in
    0.0.0.0|::) printf 'localhost' ;;
    *) printf '%s' "$1" ;;
  esac
}

runtime_host() {
  [ -f "$HOST_FILE" ] || return 1
  cat "$HOST_FILE"
}

server_location() {
  local host="$1" port="$2"
  if [ -n "$host" ]; then
    printf 'http://%s:%s/' "$(url_host_for "$host")" "$port"
  else
    printf 'port %s (host unknown)' "$port"
  fi
}

require_astro_runtime() {
  require_command node "install Node.js, then run npm install"
  require_process_tools
  [ -f "$ASTRO_BIN" ] || die "Astro CLI not found at $ASTRO_BIN; run npm install" 2
}

require_process_tools() {
  require_command ps "install standard process tools for dev server management"
  require_command pgrep "install pgrep for dev server discovery"
  require_command lsof "install lsof for repo-scoped process and port checks"
}

require_no_args() {
  local command_name="$1"
  shift
  [ "$#" -eq 0 ] || die "./scripts/dev.sh ${command_name} does not accept arguments: $*" 2
}

with_dev_lock() {
  mkdir -p "$RUN_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    die "another dev.sh start/stop/restart operation is already running" 2
  fi

  cleanup_dev_lock() {
    rm -rf "$LOCK_DIR"
  }

  trap cleanup_dev_lock EXIT INT TERM
  "$@"
}

wait_gone() {
  # wait up to ~10s for pid to exit; return 0 if gone, 1 if still alive
  local pid="$1" i
  for i in $(seq 1 40); do
    is_alive "$pid" || return 0
    sleep 0.25
  done
  ! is_alive "$pid"
}

# --- commands ---

do_start() {
  require_astro_runtime
  local existing_pids existing count=0 not_ready=0
  existing_pids="$(managed_pids || true)"
  if [ -n "$existing_pids" ]; then
    while IFS= read -r existing; do
      [ -n "$existing" ] || continue
      local port host location
      count=$((count + 1))
      host="$(runtime_host 2>/dev/null || true)"
      [ "$count" -eq 1 ] && write_runtime_files "$existing" "$host"
      port="$(detect_port "$existing" 2>/dev/null || true)"
      if [ -n "$port" ]; then
        location="$(server_location "$host" "$port")"
        event start "running" "已在运行 (pid $existing, $location)"
      else
        event start "not-ready" "已有进程 pid $existing，但尚未监听 TCP 端口"
        not_ready=1
      fi
    done <<<"$existing_pids"
    if [ "$count" -gt 1 ]; then
      event start "warning" "发现 $count 个当前仓库 dev server；建议运行 ./scripts/dev.sh restart 收敛为一个"
    else
      event start "hint" "如需重启用 ./scripts/dev.sh restart"
    fi
    [ "$not_ready" -eq 0 ] || return 4
    return 0
  fi

  mkdir -p "$RUN_DIR"
  local port_hint host_hint url_host
  local -a dev_args=()
  if ! has_host_arg "$@"; then
    dev_args+=(--host "$DEFAULT_HOST")
  fi
  dev_args+=("$@")
  port_hint="$(parse_port "${dev_args[@]}")"
  host_hint="$(parse_host "${dev_args[@]}")"
  url_host="$(url_host_for "$host_hint")"

  cd "$ROOT_DIR"
  nohup env ASTRO_TELEMETRY_DISABLED=1 node "$ASTRO_BIN" dev "${dev_args[@]}" >"$LOG_FILE" 2>&1 </dev/null &
  local leader=$!
  disown "$leader" 2>/dev/null || true
  printf '%s' "$leader" >"$PID_FILE"
  printf '%s' "$port_hint" >"$PORT_FILE"
  printf '%s' "$host_hint" >"$HOST_FILE"

  local port="" i
  for i in $(seq 1 40); do
    if ! is_alive "$leader"; then
      event start "failed" "dev server 启动时退出，最后日志："
      tail -n 20 "$LOG_FILE" >&2 2>/dev/null || true
      rm -f "$PID_FILE" "$PORT_FILE" "$HOST_FILE"
      return 1
    fi
    port="$(detect_port "$leader" 2>/dev/null || true)"
    [ -n "$port" ] && break
    sleep 0.25
  done
  if [ -z "$port" ]; then
    event start "failed" "dev server 未在等待窗口内监听 TCP 端口，最后日志："
    tail -n 20 "$LOG_FILE" >&2 2>/dev/null || true
    kill_tree "$leader" TERM
    wait_gone "$leader" || kill_tree "$leader" KILL
    rm -f "$PID_FILE" "$PORT_FILE" "$HOST_FILE"
    return 4
  fi
  printf '%s' "$port" >"$PORT_FILE"

  event start "started" "pid $leader, http://$url_host:$port/"
  event start "logs" "$LOG_FILE  (跟随查看：./scripts/dev.sh logs)"
}

do_stop() {
  require_no_args stop "$@"
  require_process_tools
  local pids pid failed=0
  pids="$(managed_pids || true)"
  if [ -z "$pids" ]; then
    rm -f "$PID_FILE" "$PORT_FILE" "$HOST_FILE" 2>/dev/null || true
    event stop "stopped" "没有由 start 启动的 dev server 在运行"
    return 0
  fi

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    event stop "stopping" "pid $pid"
    kill_tree "$pid" TERM
  done <<<"$pids"

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    if ! wait_gone "$pid"; then
      event stop "force" "pid $pid 优雅停止超时，发送 KILL"
      kill_tree "$pid" KILL
      wait_gone "$pid" || true
    fi
    if is_alive "$pid"; then
      event stop "failed" "pid $pid 仍在运行"
      failed=1
    else
      event stop "stopped" "pid $pid"
    fi
  done <<<"$pids"

  rm -f "$PID_FILE" "$PORT_FILE" "$HOST_FILE"
  [ "$failed" -eq 0 ] || die "部分 dev server 无法停止，请手动检查" 1
}

do_status() {
  require_no_args status "$@"
  require_process_tools
  local pids pid count=0 not_ready=0
  pids="$(managed_pids || true)"
  if [ -n "$pids" ]; then
    while IFS= read -r pid; do
      [ -n "$pid" ] || continue
      local port uptime host location
      count=$((count + 1))
      port="$(detect_port "$pid" 2>/dev/null || true)"
      host="$(runtime_host 2>/dev/null || true)"
      uptime="$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
      if [ -n "$port" ]; then
        location="$(server_location "$host" "$port")"
        event status "running" "pid $pid, $location, uptime ${uptime:-?}"
      else
        event status "not-ready" "pid $pid, 未监听 TCP 端口, uptime ${uptime:-?}"
        not_ready=1
      fi
    done <<<"$pids"
    if [ "$count" -gt 1 ]; then
      event status "warning" "发现 $count 个当前仓库 dev server；建议运行 ./scripts/dev.sh restart 收敛为一个"
    fi
    event status "logs" "$LOG_FILE"
    [ "$not_ready" -eq 0 ] || return 4
    return 0
  fi

  event status "stopped" "没有由 start 启动的 dev server 在运行"
  return 3
}

do_restart() {
  do_stop
  do_start "$@"
}

do_logs() {
  require_no_args logs "$@"
  require_process_tools
  require_command tail "install tail to follow dev server logs"
  [ -f "$LOG_FILE" ] || die "暂无日志文件：${LOG_FILE}（先 ./scripts/dev.sh start）" 2
  if ! managed_pids >/dev/null 2>&1; then
    event logs "warning" "dev server 未运行，正在查看上次日志"
  fi
  event logs "follow" "$LOG_FILE  (Ctrl-C 退出查看，不影响服务)"
  tail -n 120 -f "$LOG_FILE"
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
  start|stop|restart|status|logs|preview|build)
    shift
    if args_include_help "$@"; then
      command_usage "$command"
      exit $?
    fi
    case "$command" in
      start) with_dev_lock do_start "$@" ;;
      stop) with_dev_lock do_stop "$@" ;;
      restart) with_dev_lock do_restart "$@" ;;
      status) do_status "$@" ;;
      logs) do_logs "$@" ;;
      preview) run_npm_script preview "$@" ;;
      build) run_npm_script build "$@" ;;
    esac
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
