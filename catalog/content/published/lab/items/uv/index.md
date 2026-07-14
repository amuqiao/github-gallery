# uv

uv 是 Astral 开发的 Python 包、项目和工具管理器，用 Rust 实现高速依赖解析、安装、锁文件、虚拟环境和工具运行。它适合用来理解现代 Python 工程从 `pyproject.toml` 到 `uv.lock`、`.venv` 和 `uv run` 的主路径。

本条目关注 uv 如何统一 pip、venv、pip-tools、pipx、pyenv 等常见工作流，以及它与 Poetry、conda 和传统 `requirements.txt` 流程的边界。
