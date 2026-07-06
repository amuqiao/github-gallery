# 06 · REST API 契约

> 本篇内容与设计唯一事实源(design brief)§9(REST API 契约)、§10(AI 分析触发时机)保持一致;
> 若后续 brief 更新导致冲突,以 brief 为准,本篇需同步修订。

## 这篇是什么

这是 GitHub Gallery 后端对外暴露的 **HTTP 接口契约**:每个端点的方法、路径、入参、出参、
状态码。它是前端开发、Mock Server、OpenAPI 生成的直接依据。

- **谁读**:前端开发者(对接接口)、后端开发者(实现路由层)、测试(验证契约)。
- **解决什么**:回答"调哪个接口、传什么、拿到什么、错了返回什么"。
- **不负责什么**:
  - 不负责实体字段的权威定义——字段名、类型、枚举取值以 [`02-domain-model.md`](./02-domain-model.md) 为准,本篇只引用。
  - 不负责分层实现细节(路由层怎么调服务层、服务层怎么调仓储层)——见 [`03-architecture.md`](./03-architecture.md)。
  - 不负责产品层面"为什么这样设计"的取舍论证——见 [`01-product-model.md`](./01-product-model.md)。

阅读顺序建议:先读本篇「全局约定」与「端点总览表」建立地图,再按需查阅具体模块的展开章节。

---

## 1. 全局约定

| 项 | 约定 |
|---|---|
| 路径前缀 | 所有接口以 `/api` 开头 |
| 资源命名 | 复数名词(`/repos`、`/docs`、`/candidates`、`/batches`),动作用子路径动词(`/save`、`/dismiss`、`/archive`、`/analyze`、`/refresh`、`/generate`) |
| 数据格式 | 请求体、响应体均为 `application/json`(除首页 `/` 返回静态 HTML,不在本契约范围内) |
| 认证 | 本地单人部署,当前不设认证/多租户;若未来引入,不改变本篇路径与字段,仅追加 Header 约定 |
| 时间格式 | 所有 `*_at` 字段为 ISO 8601 字符串(UTC) |
| JSON 数组字段 | `topics`、`tags` 在数据库中以 JSON 存储,API 出入参一律为原生 JSON 数组(`string[]`),不是逗号拼接字符串 |

### 1.1 错误响应格式

沿用现有实现(`main.py` 中 FastAPI `HTTPException` 的默认行为),错误体统一为:

```json
{ "detail": "人类可读的错误说明" }
```

状态码语义(4xx/5xx 沿用现有约定,未来重构不改变语义):

| 状态码 | 含义 | 典型场景 |
|---|---|---|
| `400` | 请求参数或业务前置条件不满足 | URL 格式非法、状态流转不允许 |
| `404` | 资源不存在 | `repo_id` / `candidate_id` / `doc_id` / `batch_id` 找不到 |
| `409` | 资源冲突 | 手动贴的 URL 对应仓库已在库中(唯一约束 `repo.url`) |
| `422` | 请求体不满足 Pydantic 模型校验 | FastAPI 自动产生,字段类型/必填缺失 |
| `502` | 依赖的外部服务失败 | GitHub API 抓取失败、LLM 调用失败且未走降级 |
| `500` | 未预期的服务器错误 | 兜底 |

### 1.2 成功状态码约定

本篇按目标态(Phase 1 四层重构后)设计标准 REST 语义:

| 操作类型 | 状态码 | 说明 |
|---|---|---|
| 创建资源(`POST` 落地新记录) | `201 Created` | 如 `POST /api/repos`、`POST /api/repos/{repo_id}/docs`、`POST /api/candidates/{candidate_id}/save` |
| 查询 / 更新 / 触发类动作(`GET`、`PATCH`、状态流转类 `POST`) | `200 OK` | 响应体为最新的资源表示 |
| 硬删除(`DELETE`) | `204 No Content` | 无响应体 |

> 说明:当前仓库根目录下的 `main.py` 是重构前的最小实现,对创建/删除统一返回 `200`(如
> `DELETE /api/repos/{repo_id}` 返回 `{"ok": true}`)。本契约面向 [`07-roadmap.md`](./07-roadmap.md)
> Phase 1 重构后的目标形态,实现时按本篇状态码约定收敛,不代表现状。

### 1.3 分页约定

`GET /api/repos`、`GET /api/batches`、`GET /api/repos/{repo_id}/docs` 等列表接口统一分页:

| 查询参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `page` | `int` | `1` | 从 1 开始 |
| `page_size` | `int` | `20`(上限 `100`) | 每页条数 |

列表响应统一包一层:

```json
{
  "items": [ /* 资源数组 */ ],
  "total": 0,
  "page": 1,
  "page_size": 20
}
```

### 1.4 端点 ↔ 后端模块对应关系

按 [`03-architecture.md`](./03-architecture.md) 的领域模块纵切,路由层落在对应模块的 API 子层,
经服务层编排后调用仓储层:

| API 分组 | 归属模块 | 主要仓储 | 是否跨模块调用 |
|---|---|---|---|
| 首页 | 跨模块只读聚合(不属于任一业务模块,直接组合各仓储的计数查询) | `crawl_batch`/`candidate`/`repo` 仓储(只读) | 是(聚合读,不改写任何模块内部状态) |
| 流 / ingest | `ingest` | `crawl_batch`、`candidate` 仓储 | 是:判断"是否已收藏"调 `library` 查询接口;收藏晋升调 `library` 写接口;晋升那一刻调 `ai` |
| 库 / library | `library` | `repo` 仓储 | 是:`analyze`/`refresh` 调 `ai` 模块 |
| 知识 / docs | `docs` | `doc` 仓储 | 是:`generate` 调 `ai` 模块 |
| 元数据 | `categories`/`tags` 属于 `library`(对 `repo` 表去重查询);`config` 属于 `ai`(暴露 LLM 开关与模型名) | `repo` 仓储 / 无(读配置) | 否 |

---

## 2. 端点总览表

共 **24** 个端点,按 brief §9 五个分组排列。

| # | 方法 | 路径 | 用途 | 关键状态码 |
|---|---|---|---|---|
| 1 | `GET` | `/api/dashboard/summary` | 首页聚合数据 | 200 |
| 2 | `POST` | `/api/ingest/run` | 手动触发一次抓取 | 201, 502 |
| 3 | `GET` | `/api/batches` | 批次列表 | 200 |
| 4 | `GET` | `/api/batches/{batch_id}/candidates` | 某批次的候选卡片 | 200, 404 |
| 5 | `POST` | `/api/candidates/{candidate_id}/save` | 收藏晋升(candidate → repo,触发 AI 分析) | 201, 404, 409 |
| 6 | `POST` | `/api/candidates/{candidate_id}/dismiss` | 忽略该候选 | 200, 404 |
| 7 | `GET` | `/api/repos` | 库列表(筛选 + 搜索 + 分页) | 200 |
| 8 | `POST` | `/api/repos` | 手动贴 URL 添加 | 201, 400, 409, 502 |
| 9 | `GET` | `/api/repos/{repo_id}` | repo 详情 | 200, 404 |
| 10 | `PATCH` | `/api/repos/{repo_id}` | 编辑 summary/category/tags/notes/status | 200, 404 |
| 11 | `POST` | `/api/repos/{repo_id}/refresh` | 重新抓 GitHub 数据 + 重跑 AI | 200, 404, 502 |
| 12 | `POST` | `/api/repos/{repo_id}/analyze` | 手动触发 AI 分析 | 200, 404 |
| 13 | `POST` | `/api/repos/{repo_id}/archive` | 软删除(归档) | 200, 404 |
| 14 | `POST` | `/api/repos/{repo_id}/unarchive` | 取消归档 | 200, 404 |
| 15 | `DELETE` | `/api/repos/{repo_id}` | 硬删除 | 204, 404 |
| 16 | `GET` | `/api/repos/{repo_id}/docs` | 某项目的文档列表 | 200, 404 |
| 17 | `POST` | `/api/repos/{repo_id}/docs` | 新增文档 | 201, 404 |
| 18 | `POST` | `/api/repos/{repo_id}/docs/generate` | AI 起草某类型文档 | 201, 404 |
| 19 | `GET` | `/api/docs/{doc_id}` | 单篇文档 | 200, 404 |
| 20 | `PATCH` | `/api/docs/{doc_id}` | 编辑文档 | 200, 404 |
| 21 | `DELETE` | `/api/docs/{doc_id}` | 删除文档 | 204, 404 |
| 22 | `GET` | `/api/categories` | 已有分类 | 200 |
| 23 | `GET` | `/api/tags` | 已有标签 | 200 |
| 24 | `GET` | `/api/config` | llm_enabled、model 等 | 200 |

---

## 3. 首页

### 3.1 `GET /api/dashboard/summary`

Dashboard 一屏聚合数据,对应 [`04-navigation-ux.md`](./04-navigation-ux.md) 中的首页 Dashboard 板块。

- **路径参数**:无
- **查询参数**:无
- **请求体**:无

**响应体**:

| 字段 | 类型 | 说明 |
|---|---|---|
| `today_new_candidates` | `int` | 今日新流入的候选数(跨 `crawl_batch`) |
| `pending_count` | `int` | 待筛候选数(`candidate.state = pending`) |
| `library_total` | `int` | 库总量(未归档的 `repo` 数) |
| `archived_total` | `int` | 已归档项目数(`archived_at IS NOT NULL`) |
| `status_counts` | `object` | 各学习状态计数,键为 `watching`/`to-learn`/`learning`/`using`(不含已归档) |
| `latest_batch` | `object \| null` | 最近一次抓取批次的摘要(`id`/`source`/`fetched_at`/候选数),无则 `null` |
| `recent_repos` | `array` | 最近收藏或更新的若干条 `repo`(快捷入口,默认取 8 条) |

> **已定稿(字段清单)**:上表即 Dashboard 聚合的完整字段集,对应三层模型(流的 `today_new_candidates`/
> `pending_count`/`latest_batch`;库的 `library_total`/`archived_total`/`status_counts`;快捷入口 `recent_repos`)。

---

## 4. 流 / ingest

对应领域模块 `ingest`,仓储涉及 [`02-domain-model.md`](./02-domain-model.md) 的 `crawl_batch`、`candidate` 两个实体。

### 4.1 `POST /api/ingest/run`

手动触发一次抓取,落地一个新的 `crawl_batch` 及其下属 `candidate`。

- **路径参数**:无
- **查询参数**:无

**请求体**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source` | `string` 枚举 | 是 | `daily-trending` \| `weekly-search` \| `manual`,取值同 `crawl_batch.source` |
| `note` | `string` | 否 | 批次备注,对应 `crawl_batch.note` |

**响应体**(新建的 `crawl_batch` + 候选数量):

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `int` | `crawl_batch.id` |
| `source` | `string` | 同请求 |
| `fetched_at` | `string` | `crawl_batch.fetched_at` |
| `note` | `string \| null` | `crawl_batch.note` |
| `candidate_count` | `int` | 本批次抓到的候选数 |

- **关键状态码**:`201`(批次创建成功);`502`(抓取源不可用,如 GitHub Trending 页面/搜索 API 失败)。
- 抓到的 `candidate` 只落 GitHub 原始信息(`url`/`owner`/`name`/`description`/`stars`/`language`/`topics`),
  **不调用 LLM**,`state` 一律初始化为 `pending`(见 brief §2 candidate 注意事项)。

### 4.2 `GET /api/batches`

批次列表,按 `fetched_at` 倒序,支持 §1.3 通用分页参数。

- **路径参数**:无
- **查询参数**:`page`、`page_size`(见 §1.3)
- **请求体**:无

**响应体**:分页包裹结构(见 §1.3),`items` 为 `crawl_batch` 数组,字段同 4.1 响应(不含 `candidate_count`,
如需数量需另调 4.3 或由 Dashboard 聚合接口提供)。

### 4.3 `GET /api/batches/{batch_id}/candidates`

某批次下的候选卡片列表,供「流」feed 页渲染。

- **路径参数**:`batch_id`(`int`,对应 `candidate.batch_id`)
- **查询参数**:`page`、`page_size`(见 §1.3)
- **请求体**:无

**响应体**:分页包裹结构,`items` 为 `candidate` 数组:

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `int` | `candidate.id` |
| `batch_id` | `int` | `candidate.batch_id` |
| `url` | `string` | `candidate.url` |
| `owner` | `string` | `candidate.owner` |
| `name` | `string` | `candidate.name` |
| `description` | `string \| null` | `candidate.description` |
| `stars` | `int` | `candidate.stars` |
| `language` | `string \| null` | `candidate.language` |
| `topics` | `string[]` | `candidate.topics` |
| `state` | `string` 枚举 | `pending` \| `saved` \| `dismissed` |
| `saved_repo_id` | `int \| null` | 已收藏时指向 `repo.id` |
| `created_at` | `string` | `candidate.created_at` |

- 「✓ 已收藏」角标**不新增字段**,前端直接依据 `state === "saved"`(或 `saved_repo_id` 非空)推导,
  对应 brief §9 所说"带 in_library 角标信息"——角标信息即 `state`/`saved_repo_id` 本身,非独立字段。
- **关键状态码**:`404`(`batch_id` 不存在)。

### 4.4 `POST /api/candidates/{candidate_id}/save`

**收藏晋升**:candidate → repo。这是流→库路径上触发 AI 分析(summary/category/tags)的时刻。

> **已定稿**:候选阶段不调 LLM,仅在收藏晋升这一刻触发 AI 分析。详见
> [`01-product-model.md`](./01-product-model.md) §AI 触发时机。

- **路径参数**:`candidate_id`(`int`)
- **查询参数**:无
- **请求体**:无(收藏晋升不需要用户此刻填写额外字段,新 `repo` 的初始 `status` 固定为 `watching`,
  见 brief §3;分类/标签/摘要由 AI 生成,用户可后续 `PATCH` 编辑)

**响应体**:新建的 `repo` 完整对象:

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `int` | `repo.id` |
| `url` | `string` | `repo.url`(唯一) |
| `owner` | `string` | `repo.owner` |
| `name` | `string` | `repo.name` |
| `description` | `string \| null` | GitHub 原始描述 |
| `homepage` | `string \| null` | `repo.homepage` |
| `stars` | `int` | `repo.stars` |
| `language` | `string \| null` | `repo.language` |
| `topics` | `string[]` | `repo.topics` |
| `pushed_at` | `string \| null` | `repo.pushed_at` |
| `summary` | `string \| null` | AI 生成中文摘要;LLM 未配置时按 §10 降级规则填充 GitHub 描述 |
| `category` | `string \| null` | AI 生成中文分类;LLM 未配置时降级为「未分类」 |
| `tags` | `string[]` | AI 生成标签 |
| `notes` | `string \| null` | 用户备注,初始为空 |
| `status` | `string` 枚举 | 初始固定为 `watching` |
| `archived_at` | `string \| null` | 初始为 `null` |
| `created_at` | `string` | — |
| `updated_at` | `string` | — |

- 服务层同时把源 `candidate.state` 置为 `saved`、`saved_repo_id` 指向新建 `repo.id`。
- **关键状态码**:`404`(`candidate_id` 不存在);`409`(该 candidate 已是 `saved`/`dismissed` 状态,
  不可重复晋升,或 `candidate.url` 对应的 `repo.url` 已存在)。
- 对应仓储层:`ingest` 模块写 `candidate` 表,`library` 模块写 `repo` 表,`ai` 模块被同步调用生成分析结果;
  三者的编排顺序与事务边界见 [`03-architecture.md`](./03-architecture.md) 服务/用例层说明。

### 4.5 `POST /api/candidates/{candidate_id}/dismiss`

忽略该候选,`candidate.state` 置为 `dismissed`。

- **路径参数**:`candidate_id`(`int`)
- **请求体**:无

**响应体**:更新后的 `candidate` 对象(字段同 4.3)。

- **关键状态码**:`404`(不存在);`409`(该 candidate 已是 `saved` 状态,已收藏的候选不可再忽略)。

---

## 5. 库 / library

对应领域模块 `library`,仓储涉及 [`02-domain-model.md`](./02-domain-model.md) 的 `repo` 实体。

### 5.1 `GET /api/repos`

库列表,是「库」页 Filtered View 的数据来源(见 [`04-navigation-ux.md`](./04-navigation-ux.md))。

- **路径参数**:无

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | `string` | 否 | 精确匹配 `repo.category` |
| `tag` | `string` | 否 | 匹配 `repo.tags` 中包含该值(可重复传参表示多选 AND/OR 语义) |
| `status` | `string` 枚举 | 否 | `watching` \| `to-learn` \| `learning` \| `using` |
| `language` | `string` | 否 | 精确匹配 `repo.language` |
| `q` | `string` | 否 | 全文/模糊搜索,匹配 `name`/`description`/`summary`/`notes` |
| `archived` | `bool` | 否 | 归档筛选:不传或 `false` → 只返回未归档(`archived_at IS NULL`);`true` → 只返回已归档 |
| `page`、`page_size` | 见 §1.3 | 否 | 分页 |

- **默认范围**:不传 `archived`(或 `archived=false`)时只返回未归档记录(库主视图);前端归档区页面
  (`/archive`)传 `archived=true` 复用本接口拉取归档列表。

> **已定稿**:归档区**不拆独立端点**,由本接口 + `archived` 参数承载。理由:归档项目与库项目结构完全
> 相同,只是可见性维度不同,复用同一端点最简洁,也让"库/归档"共享同一套筛选与分页逻辑。

**响应体**:分页包裹结构,`items` 为 `repo` 数组,字段同 4.4 响应体。

### 5.2 `POST /api/repos`

手动贴 URL 添加,直接进库(不经过候选池)。

- **路径参数**:无

**请求体**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `url` | `string` | 是 | GitHub 仓库地址 |
| `analyze_now` | `bool` | 否 | 是否立即触发 AI 分析,**默认 `true`** |

> **已定稿**:`analyze_now` 默认 `true`——手动贴单个 URL 通常就是想立刻看到 AI 结果。显式传 `false`
> 可先入库、稍后再调 5.6 `POST /api/repos/{repo_id}/analyze` 手动分析。

**响应体**:新建的 `repo` 完整对象(字段同 4.4)。若 `analyze_now=false`,则 `summary`/`category`/`tags`
为空,等待用户后续调用 5.6 `POST /api/repos/{repo_id}/analyze`。

- **关键状态码**:
  - `400`:URL 格式非法/无法解析出 `owner`/`name`
  - `409`:`repo.url` 已存在(唯一约束)
  - `502`:GitHub 抓取失败

### 5.3 `GET /api/repos/{repo_id}`

repo 详情,Nested Doll 第一层(见 brief §8)。

- **路径参数**:`repo_id`(`int`)
- **请求体**:无

**响应体**:`repo` 完整对象(字段同 4.4)。

- **关键状态码**:`404`。

### 5.4 `PATCH /api/repos/{repo_id}`

编辑用户可维护字段。

- **路径参数**:`repo_id`(`int`)

**请求体**(均为可选,partial update,未传字段不变):

| 字段 | 类型 | 说明 |
|---|---|---|
| `summary` | `string` | — |
| `category` | `string` | — |
| `tags` | `string[]` | — |
| `notes` | `string` | — |
| `status` | `string` 枚举 | `watching` \| `to-learn` \| `learning` \| `using`;自由流转,不强制单向(brief §3) |

**响应体**:更新后的 `repo` 完整对象。

- **关键状态码**:`404`;`422`(`status` 传入非枚举值)。
- 本端点不修改 `archived_at`——归档/取消归档走 5.7/5.8 独立端点,避免"归档"与"普通编辑"语义混淆
  (brief §4:归档是与 status 正交的软删除维度)。

### 5.5 `POST /api/repos/{repo_id}/refresh`

重新抓取 GitHub 数据并重跑 AI 分析(摘要/分类/标签全部重新生成)。

- **路径参数**:`repo_id`(`int`)
- **请求体**:无

**响应体**:更新后的 `repo` 完整对象(`description`/`homepage`/`stars`/`language`/`topics`/`pushed_at`
重新抓取,`summary`/`category`/`tags` 重新由 AI 生成)。

- **关键状态码**:`404`;`502`(GitHub 抓取或 LLM 调用失败)。
- 与 5.6 的区别:`refresh` = 重抓 GitHub 原始数据 + 重跑 AI;`analyze` = 只重跑 AI,不重新抓取 GitHub 数据。

### 5.6 `POST /api/repos/{repo_id}/analyze`

手动触发 AI 分析,不重新抓取 GitHub 数据,仅基于当前已存的 GitHub 原始字段重新生成
`summary`/`category`/`tags`。

- **路径参数**:`repo_id`(`int`)
- **请求体**:无

**响应体**:更新后的 `repo` 完整对象。

- **关键状态码**:`404`。
- **AI 未配置时**(`GET /api/config` 的 `llm_enabled = false`):不报错,优雅降级为
  `summary` = GitHub `description`、`category` = 「未分类」(沿用现有 `llm.py` 行为,brief §10)。
- 这是详情页/卡片上「AI 分析」按钮的直接后端支撑,呼应 brief §9、§10 的手动触发场景。

### 5.7 `POST /api/repos/{repo_id}/archive`

**软删除(归档)**,brief §4 定义的默认"移除"动作:置 `repo.archived_at` 为当前时间,
`status` 不变(保留最后的学习状态,便于日后恢复)。项目退出流/库主视图(即 5.1 默认查询排除),
但仍可在归档区、搜索中找到。

- **路径参数**:`repo_id`(`int`)
- **请求体**:无

**响应体**:更新后的 `repo` 完整对象(`archived_at` 非空)。

- **关键状态码**:`404`;`409`(重复归档一个已归档的项目,视实现是否幂等而定——
  建议幂等处理,重复调用直接返回当前状态而非报错,具体以实现约定为准)。

### 5.8 `POST /api/repos/{repo_id}/unarchive`

取消归档,置 `repo.archived_at = null`,恢复出现在库主视图。

- **路径参数**:`repo_id`(`int`)
- **请求体**:无

**响应体**:更新后的 `repo` 完整对象(`archived_at` 为 `null`)。

- **关键状态码**:`404`。

### 5.9 `DELETE /api/repos/{repo_id}`

**硬删除**,真正物理删除,次级操作,仅用于误加/重复/纯垃圾场景(brief §4)。
与 5.7 `archive` 的区别:

| | `archive`(软删除) | `DELETE`(硬删除) |
|---|---|---|
| 数据 | 保留,仅打标记 `archived_at` | 物理删除该 `repo` 行(及其下属 `doc`,级联删除) |
| 可恢复 | 可(`unarchive`) | 不可 |
| 适用场景 | 默认的"不再关注" | 误加、重复、纯垃圾 |
| 语义定位 | 产品默认路径,非降级 | 显式的次级危险操作 |

- **路径参数**:`repo_id`(`int`)
- **请求体**:无
- **响应体**:无(`204 No Content`)
- **关键状态码**:`404`。
- 前端交互上建议对硬删除加二次确认(交互细节属于 [`04-navigation-ux.md`](./04-navigation-ux.md) 范畴,
  本篇仅定义接口语义)。

---

## 6. 知识 / docs

对应领域模块 `docs`,仓储涉及 [`02-domain-model.md`](./02-domain-model.md) 的 `doc` 实体。

### 6.1 `GET /api/repos/{repo_id}/docs`

某项目的文档列表,按 `sort_order` 升序,供 repo 详情页的文档 tab 渲染(brief §8 Nested Doll)。

- **路径参数**:`repo_id`(`int`)
- **查询参数**:`page`、`page_size`(见 §1.3;单项目文档数通常不多,分页为兜底)
- **请求体**:无

**响应体**:分页包裹结构,`items` 为 `doc` 数组:

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `int` | `doc.id` |
| `repo_id` | `int` | `doc.repo_id` |
| `doc_type` | `string` 枚举 | `ai-analysis` \| `install-usage` \| `explainer` \| `notes` \| `custom` |
| `title` | `string` | `doc.title` |
| `sort_order` | `int` | `doc.sort_order` |
| `created_at` | `string` | — |
| `updated_at` | `string` | — |

- **关键状态码**:`404`(`repo_id` 不存在)。

> **已定稿**:列表接口**省略 `content`**,只返回文档元数据(供详情页渲染文档 tab 列表);完整
> Markdown 正文走 6.4 `GET /api/docs/{doc_id}` 按需拉取。避免一次带回多篇长文正文。

### 6.2 `POST /api/repos/{repo_id}/docs`

新增文档(用户手写,非 AI 起草;AI 起草见 6.3)。

- **路径参数**:`repo_id`(`int`)

**请求体**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `doc_type` | `string` 枚举 | 是 | 同上 |
| `title` | `string` | 是 | — |
| `content` | `string` | 是 | Markdown 源文本 |
| `sort_order` | `int` | 否 | 缺省时追加到该 repo 下已有文档末尾 |

**响应体**:新建的 `doc` 完整对象(字段同 6.1)。

- **关键状态码**:`404`(`repo_id` 不存在)。

### 6.3 `POST /api/repos/{repo_id}/docs/generate`

AI 起草某类型文档,由 `ai` 模块基于 `repo` 的 GitHub 原始信息(必要时含 README)生成初稿。

- **路径参数**:`repo_id`(`int`)

**请求体**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `doc_type` | `string` 枚举 | 是 | `ai-analysis` \| `install-usage` \| `explainer` \| `notes` \| `custom` |

**响应体**:新建的 `doc` 完整对象(含 `content`),`title`/`content` 由 AI 生成,`sort_order` 追加到末尾。

- **关键状态码**:`404`(`repo_id` 不存在);`422`(LLM 未配置,禁止起草);`502`(LLM 调用失败)。

> **已定稿**:文档起草是**用户在详情页文档区显式点击「AI 起草 + 类型」触发**的动作(非自动、非批量)。
> 生成后**直接持久化为一篇新 `doc`** 并返回,用户随后在详情页编辑打磨。LLM 未配置时返回 `422` 明确禁止
> (不造占位文案),与"不擅自降级兜底"的原则一致。

### 6.4 `GET /api/docs/{doc_id}`

单篇文档详情。

- **路径参数**:`doc_id`(`int`)
- **请求体**:无

**响应体**:`doc` 完整对象(字段同 6.1)。

- **关键状态码**:`404`。

### 6.5 `PATCH /api/docs/{doc_id}`

编辑文档。

- **路径参数**:`doc_id`(`int`)

**请求体**(均可选,partial update):

| 字段 | 类型 | 说明 |
|---|---|---|
| `doc_type` | `string` 枚举 | — |
| `title` | `string` | — |
| `content` | `string` | Markdown 源文本 |
| `sort_order` | `int` | — |

**响应体**:更新后的 `doc` 完整对象。

- **关键状态码**:`404`。

### 6.6 `DELETE /api/docs/{doc_id}`

删除文档(文档层面无"归档"概念,brief §4 的软删除仅定义在 `repo` 上;删除文档即物理删除该行)。

- **路径参数**:`doc_id`(`int`)
- **请求体**:无
- **响应体**:无(`204 No Content`)
- **关键状态码**:`404`。

---

## 7. 元数据

### 7.1 `GET /api/categories`

已有分类清单,供 AI 分类收敛(避免同义分类膨胀)与前端「库」页筛选下拉使用。

- **请求体**:无

**响应体**:

```json
["Web 框架", "CLI 工具", "..."]
```

`string[]`,对 `repo.category` 去重后的结果(排除 `null`/空字符串)。

### 7.2 `GET /api/tags`

已有标签清单,来源同上,对 `repo.tags`(JSON 数组字段)展平去重。

**响应体**:

```json
["React", "轻量", "..."]
```

### 7.3 `GET /api/config`

暴露 AI 相关运行时配置,供前端判断是否展示"未配置 AI"的提示(brief §10 降级场景)。

**响应体**:

| 字段 | 类型 | 说明 |
|---|---|---|
| `llm_enabled` | `bool` | 是否已配置可用的 LLM(沿用现有 `llm.py` 行为) |
| `model` | `string \| null` | 当前使用的模型名 |

---

## 8. 已定稿决策汇总

本篇原有的待确认事项均已拍板(完整决策记录见 [`08-decisions.md`](./08-decisions.md)):

1. **§3.1** Dashboard 聚合字段清单——已定为 7 字段完整集(见 §3.1 表)。
2. **§5.1** 归档区数据来源——复用 `GET /api/repos` + `archived` 参数,不拆独立端点。
3. **§5.2** `POST /api/repos` 的 `analyze_now`——保留该字段,默认 `true`(即时分析)。
4. **§4.4** 收藏晋升触发 AI 分析——候选阶段不调 LLM,仅晋升那一刻触发。
5. **§6.1** 文档列表接口——省略 `content`,只返回元数据;正文走 6.4。
6. **§6.3** AI 起草文档——用户在详情页显式点击触发,直接持久化为新 `doc`;LLM 未配置返回 `422`。

---

相关文档:[`02-domain-model.md`](./02-domain-model.md)(实体字段权威定义)、
[`03-architecture.md`](./03-architecture.md)(端点与仓储层/模块的实现对应关系)、
[`04-navigation-ux.md`](./04-navigation-ux.md)(页面如何消费这些接口)、
[`07-roadmap.md`](./07-roadmap.md)(本契约的目标态与当前 MVP 实现的差异将在哪个阶段收敛)。
