#!/usr/bin/env bash
# content.sh - content bundle maintenance entrypoint.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/common.sh"

usage() {
  cat <<EOF
用法：
  ./scripts/content.sh <command> [args...]
  ./scripts/content.sh -h|--help

作用域：
  管理 catalog/content/{drafts,published,archived}/ 下的 content bundle 骨架和发布状态。

命令：
  item new <hall> <github_project|ai_model> <id> [options]
  item note add <hall> <id> <note-id> [options]
  collection new <hall> <id> [options]
  import <validate|plan|diff|apply> <batch> [options]
  publish <hall> <item|collection> <id>
  archive <hall> <item|collection> <id>
  restore <hall> <item|collection> <id>
  help

常用示例：
  ./scripts/content.sh item new models ai_model htdemucs-ft-onnx \\
    --title "HT-Demucs FT ONNX" \\
    --summary "面向音乐四轨分离的 HT-Demucs FT ONNX 模型包。" \\
    --source-type huggingface \\
    --source-url "https://huggingface.co/StemSplitio/htdemucs-ft-onnx" \\
    --provider StemSplitio \\
    --input audio \\
    --output audio \\
    --task source-separation \\
    --access download \\
    --format onnx \\
    --runtime onnxruntime

  ./scripts/content.sh item new github github_project gpt-sovits \\
    --title "GPT-SoVITS" \\
    --summary "支持少样本音色克隆、语音转换和文本转语音实验的 WebUI。" \\
    --repo "https://github.com/RVC-Boss/GPT-SoVITS" \\
    --category ai \\
    --tag audio \\
    --maintenance-status unknown

  ./scripts/content.sh item note add models htdemucs-ft-onnx quick-start \\
    --title "快速试用" \\
    --summary "记录模型定位、运行入口、输入输出和适用边界。" \\
    --format markdown

  ./scripts/content.sh collection new github voice-cloning \\
    --title "声音克隆项目" \\
    --summary "GitHub 展馆内的声音克隆项目策展。" \\
    --item gpt-sovits

  ./scripts/content.sh import validate .tmp/import-batches/example-content-batch
  ./scripts/content.sh import plan .tmp/import-batches/example-content-batch
  ./scripts/content.sh import diff .tmp/import-batches/example-content-batch
  ./scripts/content.sh import apply .tmp/import-batches/example-content-batch

  ./scripts/content.sh publish models item htdemucs-ft-onnx
  ./scripts/content.sh archive models item htdemucs-ft-onnx
  ./scripts/content.sh restore models item htdemucs-ft-onnx
EOF
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
  import)
    require_command node "install Node.js 20 or newer"
    node "$ROOT_DIR/scripts/content/content-import-cli.mjs" "${@:2}"
    ;;
  *)
    require_command node "install Node.js 20 or newer"
    node "$ROOT_DIR/scripts/content/content-cli.mjs" "$@"
    ;;
esac
