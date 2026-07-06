"""LLM 分析:输入仓库元数据 + README,输出中文摘要、分类、标签。

通过环境变量配置,兼容任何 OpenAI 格式的接口:
  LLM_BASE_URL  例如 https://api.openai.com/v1 、https://api.deepseek.com/v1 、
                本地 Ollama: http://localhost:11434/v1
  LLM_API_KEY   密钥(Ollama 可随便填)
  LLM_MODEL     模型名,例如 gpt-4o-mini / deepseek-chat / qwen2.5:14b
未配置时自动降级:直接使用 GitHub 描述,分类为「未分类」。
"""
import json
import os
import re

import httpx

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "").rstrip("/")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")

SYSTEM_PROMPT = """你是一个开源项目策展助手。根据给定的 GitHub 仓库信息,输出 JSON(不要任何其他文字、不要 markdown 代码块),格式:
{
  "summary": "60字以内的中文摘要,说清这个项目是做什么的、亮点是什么",
  "category": "一个中文分类名(2-6个字)",
  "tags": ["3到5个中文或通用英文标签"]
}
分类规则:如果「已有分类」列表中存在合适的分类,必须复用它,保持分类体系收敛;确实都不合适才创建新分类。"""


def llm_enabled() -> bool:
    return bool(LLM_BASE_URL and LLM_MODEL)


async def analyze(repo: dict, categories: list[str]) -> dict:
    """返回 {summary, category, tags};LLM 未配置或失败时优雅降级。"""
    fallback = {
        "summary": repo.get("description", "")[:120],
        "category": "未分类",
        "tags": repo.get("topics", [])[:5],
    }
    if not llm_enabled():
        return fallback

    user_prompt = (
        f"已有分类: {', '.join(categories) if categories else '(暂无)'}\n\n"
        f"仓库: {repo['owner']}/{repo['name']}\n"
        f"语言: {repo.get('language', '')}\n"
        f"Stars: {repo.get('stars', 0)}\n"
        f"官方描述: {repo.get('description', '')}\n"
        f"Topics: {', '.join(repo.get('topics', []))}\n\n"
        f"README 节选:\n{repo.get('readme', '')[:5000]}"
    )

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {LLM_API_KEY}"},
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                },
            )
            r.raise_for_status()
            text = r.json()["choices"][0]["message"]["content"]
        # 去掉可能出现的 ```json 围栏后解析
        text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
        data = json.loads(text)
        return {
            "summary": str(data.get("summary", ""))[:200] or fallback["summary"],
            "category": str(data.get("category", "未分类"))[:20] or "未分类",
            "tags": [str(t)[:20] for t in data.get("tags", [])][:6],
        }
    except Exception as e:
        print(f"[llm] 分析失败,使用降级结果: {e}")
        return fallback
