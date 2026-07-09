#!/usr/bin/env bash
# deploy.sh - Docker deployment entrypoint for the Astro static site.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-.env}"
source "$ROOT_DIR/scripts/lib/common.sh"
source "$ROOT_DIR/scripts/lib/compose.sh"

cd "$ROOT_DIR"

usage() {
  cat <<EOF
用法：
  ./scripts/deploy.sh <command> [mode]
  ./scripts/deploy.sh -h|--help

作用域：
  管理当前 Astro static site 的 Docker 部署形态。
  不管理 Astro dev server、数据库、队列、迁移、远程云资源或反向代理本体。

命令：
  modes                  展示支持的 3 种 Docker 部署模式。
  check                  校验 Docker 部署文件、compose 配置和脚本语法。
  build <mode>           构建指定模式需要的静态站点镜像或产物。
  up <mode>              启动指定模式。
  down <mode>            停止指定模式。
  status <mode>          查看指定模式状态。

模式：
  preview|pre            本机临时验收容器，绑定 PREVIEW_HOST_PORT。
  standalone             单机长期运行容器，绑定 STANDALONE_HOST_PORT。
  proxy                  Compose 管理容器，加入 PROXY_NETWORK，不直接绑定宿主机端口。

配置与环境变量：
  ENV_FILE               默认 .env；up/build/status/down 会读取该文件。
  COMPOSE_PROJECT_NAME   Compose project 名，必须在 ENV_FILE 或运行时环境中提供。
  APP_IMAGE              静态站点镜像名。
  PREVIEW_CONTAINER_NAME / PREVIEW_HOST_PORT
  STANDALONE_CONTAINER_NAME / STANDALONE_HOST_PORT
  PROXY_NETWORK / PROXY_HOST

常用示例：
  cp .env.example .env
  ./scripts/deploy.sh check
  ./scripts/deploy.sh modes

  # preview / pre：本机临时验收
  ./scripts/deploy.sh up pre
  ./scripts/deploy.sh status pre
  ./scripts/deploy.sh down pre

  # standalone：单机长期运行
  ./scripts/deploy.sh up standalone
  ./scripts/deploy.sh status standalone
  ./scripts/deploy.sh down standalone

  # proxy：接入已有反向代理网络
  ./scripts/deploy.sh up proxy
  ./scripts/deploy.sh status proxy
  ./scripts/deploy.sh down proxy

Exit Codes:
  0  成功
  2  缺少 command、非法 mode、缺少必要文件或 Docker/Compose 不可用
  4  Compose project 名冲突、容器名冲突或运行态冲突
EOF
}

command_usage() {
  local name="$1"
  case "$name" in
    modes)
      cat <<EOF
用法：
  ./scripts/deploy.sh modes

作用域：
  展示 deploy.sh 管理的 Docker 部署模式。
EOF
      ;;
    check)
      cat <<EOF
用法：
  ./scripts/deploy.sh check

作用域：
  校验部署入口、Dockerfile、compose 配置、env 示例和脚本语法。
  不启动容器，不执行 Docker build。
EOF
      ;;
    build|up|down|status)
      cat <<EOF
用法：
  ./scripts/deploy.sh ${name} <preview|pre|standalone|proxy>

作用域：
  对指定 Docker 部署模式执行 ${name}。
EOF
      ;;
    *)
      usage >&2
      return 2
      ;;
  esac
}

require_file() {
  local path="$1"
  [[ -f "$path" ]] || die "$path not found" 2
}

require_env_file() {
  local env_file
  env_file="$(env_file_path)"
  [[ -f "$env_file" ]] || die "$env_file not found; copy .env.example to ${ENV_FILE:-.env} or set ENV_FILE" 2
}

require_docker_daemon() {
  docker info >/dev/null 2>&1 || die "Docker daemon is not reachable; start Docker Desktop or Docker Engine" 2
}

deploy_env() {
  local key="$1"
  local env_file
  local value

  value="${!key:-}"
  if [[ -z "$value" ]]; then
    env_file="$(env_file_path)"
    value="$(env_value_from "$key" "$env_file")"
  fi
  [[ -n "$value" ]] || die "$key is required in ${ENV_FILE:-.env}" 2
  printf "%s" "$value"
}

show_modes() {
  section "Deployment Modes"
  event "MODE" "preview" "alias: pre；临时本机验收：docker run，绑定 PREVIEW_HOST_PORT，容器移除即结束"
  event "MODE" "standalone" "单机部署：docker run，绑定 STANDALONE_HOST_PORT，restart unless-stopped"
  event "MODE" "proxy" "反向代理部署：docker compose，不暴露宿主机端口，加入 PROXY_NETWORK"
}

check_deploy() {
  section "Files"
  require_file "Dockerfile"
  event "OK" "Dockerfile" "present"
  require_file ".dockerignore"
  event "OK" ".dockerignore" "present"
  require_file "docker-compose.yml"
  event "OK" "compose" "present"
  require_file ".env.example"
  event "OK" ".env.example" "present"
  require_file "docker/nginx/default.conf"
  event "OK" "nginx" "present"
  require_file "scripts/lib/compose.sh"
  event "OK" "compose.sh" "present"

  section "Tools"
  require_command docker "install Docker Desktop or Docker Engine"
  event "OK" "docker" "cli available"
  require_docker_daemon
  event "OK" "docker" "daemon reachable"
  compose_available || die "Docker Compose is not available. Install Docker Desktop or docker-compose." 2
  event "OK" "compose" "cli available"

  section "Compose Config"
  ENV_FILE=.env.example compose config --quiet
  event "OK" "compose" "docker compose config"

  section "Scripts"
  bash -n "$ROOT_DIR/scripts/deploy.sh"
  event "OK" "deploy.sh" "syntax"
  bash -n "$ROOT_DIR/scripts/lib/compose.sh"
  event "OK" "compose.sh" "syntax"
}

build_image() {
  require_env_file
  require_command docker "install Docker Desktop or Docker Engine"
  require_docker_daemon
  section "Build Image"
  docker build -t "$(deploy_env APP_IMAGE)" .
}

build_mode() {
  local mode="$1"
  case "$mode" in
    preview|standalone|proxy) build_image ;;
    *) die "build requires mode: preview, pre, standalone or proxy" 2 ;;
  esac
}

container_exists() {
  local name="$1"
  [[ -n "$(docker ps -a --filter "name=^/${name}$" --format '{{.Names}}')" ]]
}

container_running() {
  local name="$1"
  [[ -n "$(docker ps --filter "name=^/${name}$" --format '{{.Names}}')" ]]
}

assert_container_absent() {
  local name="$1"
  container_exists "$name" && die "container '$name' already exists; run ./scripts/deploy.sh down for its mode first" 4
}

run_static_container() {
  local mode="$1"
  local name="$2"
  local port="$3"
  local restart_policy="$4"
  local image

  image="$(deploy_env APP_IMAGE)"
  assert_container_absent "$name"
  build_image
  section "Docker ${mode}"
  docker run -d \
    --name "$name" \
    --restart "$restart_policy" \
    -p "${port}:80" \
    "$image"
  event "URL" "$mode" "http://127.0.0.1:${port}/"
}

up_preview() {
  require_env_file
  run_static_container preview "$(deploy_env PREVIEW_CONTAINER_NAME)" "$(deploy_env PREVIEW_HOST_PORT)" "no"
}

up_standalone() {
  require_env_file
  run_static_container standalone "$(deploy_env STANDALONE_CONTAINER_NAME)" "$(deploy_env STANDALONE_HOST_PORT)" "unless-stopped"
}

up_proxy() {
  require_env_file
  require_command docker "install Docker Desktop or Docker Engine"
  require_docker_daemon
  assert_no_compose_project_name_conflict
  build_image
  section "Compose Proxy"
  compose --profile proxy up -d app
}

down_container() {
  local mode="$1"
  local name="$2"
  require_command docker "install Docker Desktop or Docker Engine"
  require_docker_daemon
  section "Docker ${mode}"
  if ! container_exists "$name"; then
    event "STATUS" "$mode" "stopped"
    return 0
  fi
  docker rm -f "$name"
}

down_preview() {
  require_env_file
  down_container preview "$(deploy_env PREVIEW_CONTAINER_NAME)"
}

down_standalone() {
  require_env_file
  down_container standalone "$(deploy_env STANDALONE_CONTAINER_NAME)"
}

down_proxy() {
  require_env_file
  assert_no_compose_project_name_conflict
  section "Compose Proxy"
  compose --profile proxy stop app
}

status_container() {
  local mode="$1"
  local name="$2"
  local port="$3"
  require_command docker "install Docker Desktop or Docker Engine"
  require_docker_daemon
  section "Docker ${mode}"
  if container_running "$name"; then
    docker ps --filter "name=^/${name}$" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
    event "URL" "$mode" "http://127.0.0.1:${port}/"
    return 0
  fi
  if container_exists "$name"; then
    docker ps -a --filter "name=^/${name}$" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
    return 3
  fi
  event "STATUS" "$mode" "stopped"
  return 3
}

status_preview() {
  require_env_file
  status_container preview "$(deploy_env PREVIEW_CONTAINER_NAME)" "$(deploy_env PREVIEW_HOST_PORT)"
}

status_standalone() {
  require_env_file
  status_container standalone "$(deploy_env STANDALONE_CONTAINER_NAME)" "$(deploy_env STANDALONE_HOST_PORT)"
}

status_proxy() {
  require_env_file
  assert_no_compose_project_name_conflict
  section "Compose Proxy"
  compose --profile proxy ps app
}

normalize_mode() {
  case "$1" in
    pre) printf "preview" ;;
    preview|standalone|proxy) printf "%s" "$1" ;;
    *) return 1 ;;
  esac
}

up_mode() {
  case "$1" in
    preview) up_preview ;;
    standalone) up_standalone ;;
    proxy) up_proxy ;;
    *) die "up requires mode: preview, pre, standalone or proxy" 2 ;;
  esac
}

down_mode() {
  case "$1" in
    preview) down_preview ;;
    standalone) down_standalone ;;
    proxy) down_proxy ;;
    *) die "down requires mode: preview, pre, standalone or proxy" 2 ;;
  esac
}

status_mode() {
  case "$1" in
    preview) status_preview ;;
    standalone) status_standalone ;;
    proxy) status_proxy ;;
    *) die "status requires mode: preview, pre, standalone or proxy" 2 ;;
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
  modes)
    shift
    if args_include_help "$@"; then command_usage "$command"; exit $?; fi
    [[ "$#" -eq 0 ]] || die "unexpected arguments for deploy modes: $*" 2
    show_modes
    ;;
  check)
    shift
    if args_include_help "$@"; then command_usage "$command"; exit $?; fi
    [[ "$#" -eq 0 ]] || die "unexpected arguments for deploy check: $*" 2
    check_deploy
    ;;
  build|up|down|status)
    shift
    if args_include_help "$@"; then command_usage "$command"; exit $?; fi
    mode="${1:-}"
    [[ -n "$mode" ]] || die "$command requires mode: preview, pre, standalone or proxy" 2
    mode="$(normalize_mode "$mode")" || die "$command requires mode: preview, pre, standalone or proxy" 2
    shift
    [[ "$#" -eq 0 ]] || die "unexpected arguments for deploy $command $mode: $*" 2
    case "$command" in
      build) build_mode "$mode" ;;
      up) up_mode "$mode" ;;
      down) down_mode "$mode" ;;
      status) status_mode "$mode" ;;
    esac
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
