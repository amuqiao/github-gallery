# GitHub Gallery

贴一个 GitHub 仓库地址 → AI 自动生成中文摘要、分类、标签 → 汇成一个漂亮的本地展示页。

**工作流:发现项目 → 粘贴链接 → 剩下的交给 AI。**

## 快速开始

```bash
uv sync
cp .env.example .env        # 编辑 .env 填入 LLM 配置
uv run uvicorn main:app --reload
# 打开 http://localhost:8000
```

不配置 LLM 也能用(降级模式:直接使用 GitHub 官方描述,分类为「未分类」,之后可手工编辑)。

## LLM 配置

支持任何 OpenAI 兼容接口,在 `.env` 中三个变量搞定:

| 提供商 | LLM_BASE_URL | LLM_MODEL 示例 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Ollama(本地离线) | `http://localhost:11434/v1` | `qwen2.5:14b` |

可选:配置 `GITHUB_TOKEN`(GitHub → Settings → Developer settings → Personal access tokens,无需任何权限勾选)可将 API 限额从 60 次/小时提升到 5000 次/小时。

## 功能

- **一键收藏**:粘贴任意形式的 GitHub 链接(或直接 `owner/repo`),自动抓取描述、star、语言、topics、README
- **AI 归档**:LLM 阅读 README 生成 60 字中文摘要 + 自动分类 + 标签;分类体系自动收敛(优先复用已有分类)
- **展示页**:按分类分区的卡片画廊,语言配色点缀,搜索 + 分类筛选 + 点标签即搜
- **可修正**:AI 结果随时手工编辑(分类/摘要/标签/个人备注)
- **可刷新**:一键重新抓取 star 数和最新 README 并重跑分析
- **零依赖存储**:SQLite 单文件(`gallery.db`),备份 = 复制一个文件

## 项目结构(二开指引)

```
main.py              # FastAPI 路由,所有 API 定义在这里
github_fetch.py      # GitHub 抓取,想抓 release/contributors 在这里加
llm.py               # LLM 分析,改 SYSTEM_PROMPT 即可调整摘要风格和分类粒度
db.py                # SQLite 数据层,加字段改 SCHEMA + allowed 集合
templates/index.html # 前端单文件(HTML+CSS+JS),无构建步骤,改完刷新即生效
```

### 常见二开方向

- **换摘要风格/分类粒度**:改 `llm.py` 的 `SYSTEM_PROMPT`
- **批量导入现有 Star**:写个脚本循环调 `POST /api/repos`(见下方 API)
- **导出静态页/Markdown**:读 `db.list_repos()` 渲染模板即可
- **换主题色**:改 `index.html` 顶部 `:root` 中的 CSS 变量

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/repos` | 列出所有收藏 |
| POST | `/api/repos` | `{"url": "..."}` 收藏并 AI 分析 |
| PATCH | `/api/repos/{id}` | 编辑 category/summary/tags/notes |
| POST | `/api/repos/{id}/refresh` | 重新抓取 + 重新分析 |
| DELETE | `/api/repos/{id}` | 删除 |
| GET | `/api/config` | 查看 LLM 是否已配置 |

交互式文档:启动后访问 `http://localhost:8000/docs`
