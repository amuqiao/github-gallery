"""GitHub Gallery — 贴链接、AI 理解归档、生成展示页。

启动: uvicorn main:app --reload
访问: http://localhost:8000
"""
from dotenv import load_dotenv

load_dotenv()  # 必须在导入依赖环境变量的模块之前执行

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path

import db
import github_fetch
import llm

app = FastAPI(title="GitHub Gallery")
BASE = Path(__file__).parent

db.init_db()


class AddRepoIn(BaseModel):
    url: str


class UpdateRepoIn(BaseModel):
    summary: str | None = None
    category: str | None = None
    notes: str | None = None
    tags: list[str] | None = None


@app.get("/")
async def index():
    return FileResponse(BASE / "templates" / "index.html")


@app.get("/api/config")
async def config():
    return {"llm_enabled": llm.llm_enabled(), "model": llm.LLM_MODEL}


@app.get("/api/repos")
async def api_list():
    return db.list_repos()


@app.post("/api/repos")
async def api_add(body: AddRepoIn):
    try:
        owner, name = github_fetch.parse_repo_url(body.url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    canonical = f"https://github.com/{owner}/{name}"
    if db.get_repo_by_url(canonical):
        raise HTTPException(409, "该仓库已在收藏中")

    try:
        repo = await github_fetch.fetch_repo(owner, name)
    except github_fetch.RepoNotFound as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(502, f"GitHub 抓取失败: {e}")

    analysis = await llm.analyze(repo, db.existing_categories())
    repo.update(analysis)
    repo.pop("readme", None)
    repo_id = db.insert_repo(repo)
    return db.get_repo(repo_id)


@app.post("/api/repos/{repo_id}/refresh")
async def api_refresh(repo_id: int):
    """重新抓取 GitHub 数据并重跑 LLM 分析。"""
    existing = db.get_repo(repo_id)
    if not existing:
        raise HTTPException(404, "记录不存在")
    repo = await github_fetch.fetch_repo(existing["owner"], existing["name"])
    analysis = await llm.analyze(repo, db.existing_categories())
    repo.update(analysis)
    repo.pop("readme", None)
    db.update_repo(repo_id, repo)
    return db.get_repo(repo_id)


@app.patch("/api/repos/{repo_id}")
async def api_update(repo_id: int, body: UpdateRepoIn):
    if not db.get_repo(repo_id):
        raise HTTPException(404, "记录不存在")
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    db.update_repo(repo_id, fields)
    return db.get_repo(repo_id)


@app.delete("/api/repos/{repo_id}")
async def api_delete(repo_id: int):
    if not db.get_repo(repo_id):
        raise HTTPException(404, "记录不存在")
    db.delete_repo(repo_id)
    return {"ok": True}


app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
