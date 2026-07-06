"""SQLite 数据层:单文件数据库,零配置。"""
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent / "gallery.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS repos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url         TEXT UNIQUE NOT NULL,
    owner       TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    homepage    TEXT DEFAULT '',
    stars       INTEGER DEFAULT 0,
    language    TEXT DEFAULT '',
    topics      TEXT DEFAULT '[]',      -- GitHub topics, JSON array
    summary     TEXT DEFAULT '',        -- LLM 生成的中文摘要
    category    TEXT DEFAULT '未分类',   -- LLM 生成的分类
    tags        TEXT DEFAULT '[]',      -- LLM 生成的标签, JSON array
    notes       TEXT DEFAULT '',        -- 用户手工备注
    pushed_at   TEXT DEFAULT '',        -- 仓库最近一次 push 时间
    created_at  TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at  TEXT DEFAULT (datetime('now', 'localtime'))
);
"""


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db():
    with conn() as c:
        c.executescript(SCHEMA)


def row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["topics"] = json.loads(d.get("topics") or "[]")
    d["tags"] = json.loads(d.get("tags") or "[]")
    return d


def list_repos() -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT * FROM repos ORDER BY category, stars DESC").fetchall()
    return [row_to_dict(r) for r in rows]


def get_repo(repo_id: int) -> dict | None:
    with conn() as c:
        row = c.execute("SELECT * FROM repos WHERE id = ?", (repo_id,)).fetchone()
    return row_to_dict(row) if row else None


def get_repo_by_url(url: str) -> dict | None:
    with conn() as c:
        row = c.execute("SELECT * FROM repos WHERE url = ?", (url,)).fetchone()
    return row_to_dict(row) if row else None


def existing_categories() -> list[str]:
    with conn() as c:
        rows = c.execute(
            "SELECT DISTINCT category FROM repos WHERE category != '' ORDER BY category"
        ).fetchall()
    return [r["category"] for r in rows]


def insert_repo(data: dict) -> int:
    with conn() as c:
        cur = c.execute(
            """INSERT INTO repos
               (url, owner, name, description, homepage, stars, language,
                topics, summary, category, tags, pushed_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                data["url"], data["owner"], data["name"],
                data.get("description", ""), data.get("homepage", ""),
                data.get("stars", 0), data.get("language", ""),
                json.dumps(data.get("topics", []), ensure_ascii=False),
                data.get("summary", ""), data.get("category", "未分类"),
                json.dumps(data.get("tags", []), ensure_ascii=False),
                data.get("pushed_at", ""),
            ),
        )
        return cur.lastrowid


def update_repo(repo_id: int, fields: dict):
    allowed = {"summary", "category", "notes", "description", "stars",
               "language", "topics", "tags", "pushed_at", "homepage"}
    sets, values = [], []
    for k, v in fields.items():
        if k not in allowed:
            continue
        if k in ("topics", "tags"):
            v = json.dumps(v, ensure_ascii=False)
        sets.append(f"{k} = ?")
        values.append(v)
    if not sets:
        return
    sets.append("updated_at = datetime('now', 'localtime')")
    values.append(repo_id)
    with conn() as c:
        c.execute(f"UPDATE repos SET {', '.join(sets)} WHERE id = ?", values)


def delete_repo(repo_id: int):
    with conn() as c:
        c.execute("DELETE FROM repos WHERE id = ?", (repo_id,))
