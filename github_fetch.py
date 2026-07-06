"""GitHub 仓库元数据抓取:repo 信息 + README。"""
import base64
import os
import re

import httpx

GITHUB_API = "https://api.github.com"
# 可选:配置 token 可将速率限制从 60 次/时提升到 5000 次/时
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?(?:[#?].*)?$"
)


class RepoNotFound(Exception):
    pass


def parse_repo_url(url: str) -> tuple[str, str]:
    """从各种形式的 GitHub 链接中解析 owner/name,也支持直接输入 owner/name。"""
    url = url.strip()
    m = URL_RE.match(url)
    if m:
        return m.group(1), m.group(2)
    if re.fullmatch(r"[\w.-]+/[\w.-]+", url):
        owner, name = url.split("/")
        return owner, name
    raise ValueError(f"无法识别的 GitHub 地址: {url}")


def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json",
         "User-Agent": "github-gallery"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


async def fetch_repo(owner: str, name: str) -> dict:
    """抓取仓库元数据和 README 前若干字符。"""
    async with httpx.AsyncClient(headers=_headers(), timeout=20) as client:
        r = await client.get(f"{GITHUB_API}/repos/{owner}/{name}")
        if r.status_code == 404:
            raise RepoNotFound(f"仓库不存在: {owner}/{name}")
        r.raise_for_status()
        meta = r.json()

        readme_text = ""
        rr = await client.get(f"{GITHUB_API}/repos/{owner}/{name}/readme")
        if rr.status_code == 200:
            try:
                readme_text = base64.b64decode(rr.json().get("content", "")).decode(
                    "utf-8", errors="ignore"
                )
            except Exception:
                readme_text = ""

    return {
        "url": meta["html_url"],
        "owner": meta["owner"]["login"],
        "name": meta["name"],
        "description": meta.get("description") or "",
        "homepage": meta.get("homepage") or "",
        "stars": meta.get("stargazers_count", 0),
        "language": meta.get("language") or "",
        "topics": meta.get("topics", []),
        "pushed_at": (meta.get("pushed_at") or "")[:10],
        "readme": readme_text[:6000],  # 给 LLM 的 README 截断,控制 token 消耗
    }
