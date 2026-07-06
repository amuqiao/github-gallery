# 02 · 领域数据模型

> 这篇是什么:GitHub Gallery 四个核心实体(`crawl_batch` / `candidate` / `repo` / `doc`)的**字段、类型、枚举取值、可空性,以及它们之间的关系**。
> 解决什么:回答「有哪几张表」「每张表有哪些字段、什么类型、能不能为空」「实体之间怎么连」。
> 谁读:后端(仓储层/服务层)、前端(据此对齐类型)、以及任何需要精确核对字段名的人。
> 不负责什么:不讲三层内容模型的心智与动线、状态流转与软删除的产品语义(见 [01-product-model.md](./01-product-model.md)),不讲分层架构与 ORM 选型(见 [03-architecture.md](./03-architecture.md)),不讲端点契约(见 [06-api-contract.md](./06-api-contract.md))。

实体名、字段名、枚举取值均以本文件为准,与 [01-product-model.md](./01-product-model.md) 保持一致。

---

## 心智模型:四个实体,一条主链

四个实体沿着产品主动线串成一条链:抓取产生批次,批次装候选,候选被收藏后晋升为正式项目,正式项目沉淀多角度文档。

```
crawl_batch  ──1:N──▶  candidate  ──(收藏晋升)──▶  repo  ──1:N──▶  doc
 (抓取批次)             (临时卡片)                    (正式项目)         (详情文档)
```

关系一览:

- `crawl_batch 1──N candidate`:一个抓取批次包含多个候选卡片。
- `candidate ──(收藏晋升)──> repo`:候选被「收藏」后晋升为一个 repo(跨实体转换,不是同一行数据改状态)。晋升后 candidate 通过 `saved_repo_id` 指回该 repo。
- `repo 1──N doc`:一个正式项目可挂多篇详情文档。

> 关键区分:`candidate` 与 `repo` 是**两个不同实体**。`candidate` 只存 GitHub 原始信息,**不含任何 AI 字段(summary/category/tags),也不调 LLM**;AI 字段只存在于 `repo`。这一约束贯穿全系统,详见下方两张表的对比与 [01-product-model.md](./01-product-model.md)「AI 分析触发时机」。

下面逐个实体给出字段表。

---

## crawl_batch(抓取批次)

一次抓取动作的记录,是流(Flow)时间线的组织单位。

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | 主键 | 否 | 批次唯一标识 |
| `source` | 枚举 | 否 | 抓取来源,取值见下 |
| `fetched_at` | 时间戳 | 否 | 抓取时间 |
| `note` | 文本 | **是** | 批次备注 |

`source` 枚举取值:

| 值 | 含义 |
|---|---|
| `daily-trending` | 每日 Trending 抓取 |
| `weekly-search` | 每周 Search 抓取 |
| `manual` | 手动触发的抓取 |

---

## candidate(候选 / 临时卡片)

流里的临时卡片,只承载 GitHub 原始信息,供用户快速筛选。**不含 AI 字段,不调 LLM。**

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | 主键 | 否 | 候选唯一标识 |
| `batch_id` | 外键 → `crawl_batch.id` | 否 | 所属抓取批次 |
| `url` | 文本 | 否 | GitHub 项目地址 |
| `owner` | 文本 | 否 | 所有者 |
| `name` | 文本 | 否 | 仓库名 |
| `description` | 文本 | 是 | GitHub 描述 |
| `stars` | 整数 | 否 | star 数 |
| `language` | 文本 | 是 | 主语言 |
| `topics` | JSON 数组 | 否 | GitHub topics |
| `state` | 枚举 | 否 | 候选筛选状态,取值见下 |
| `saved_repo_id` | 外键 → `repo.id` | **是** | 收藏后指向的 repo;用于在流里显示「✓ 已收藏」角标 |
| `created_at` | 时间戳 | 否 | 创建时间 |

`state` 枚举取值:

| 值 | 中文 | 含义 |
|---|---|---|
| `pending` | 待筛 | 尚未处理 |
| `saved` | 已收藏 | 已晋升为 repo |
| `dismissed` | 已忽略 | 用户忽略该候选 |

> 注意:candidate **没有** `summary` / `category` / `tags` 等 AI 生成字段。这些字段只出现在 `repo`。`saved_repo_id` 可空——只有当 `state = saved` 时才非空。

---

## repo(收藏 / 正式项目)

库(Library)里的正式项目资产。字段分四组:GitHub 原始、AI 生成、用户维护、软删除/时间。

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | 主键 | 否 | 项目唯一标识 |
| `url` | 文本(**唯一**) | 否 | GitHub 项目地址,唯一约束 |
| `owner` | 文本 | 否 | 所有者 |
| `name` | 文本 | 否 | 仓库名 |
| `description` | 文本 | 是 | GitHub 原始:描述 |
| `homepage` | 文本 | 是 | GitHub 原始:主页 |
| `stars` | 整数 | 否 | GitHub 原始:star 数 |
| `language` | 文本 | 是 | GitHub 原始:主语言 |
| `topics` | JSON 数组 | 否 | GitHub 原始:topics |
| `pushed_at` | 时间戳 | 是 | GitHub 原始:最后推送时间 |
| `summary` | 文本 | 是 | AI 生成:中文摘要 |
| `category` | 文本 | 是 | AI 生成:中文分类 |
| `tags` | JSON 数组 | 否 | AI 生成:标签数组 |
| `notes` | 文本 | 是 | 用户维护:备注 |
| `status` | 枚举 | 否 | 用户维护:生命周期状态,取值见下 |
| `archived_at` | 时间戳 | **是** | 软删除:非空即为已归档 |
| `created_at` | 时间戳 | 否 | 创建时间 |
| `updated_at` | 时间戳 | 否 | 更新时间 |

`status` 枚举取值(活动取值 4 个,英文存储 / 中文展示;流转规则见 [01-product-model.md](./01-product-model.md)):

| 存储值 | 中文标签 | 含义 |
|---|---|---|
| `watching` | 关注中 | 留意着,还没深入 |
| `to-learn` | 想学 | 排进学习队列 |
| `learning` | 正在学 | 当前在啃 |
| `using` | 在用 | 已用在我的项目里 |

默认新收藏为 `watching`。

> 软删除说明:`archived_at` 与 `status` **正交**——归档不是一个 status 取值,而是独立的软删除维度。`archived_at` 为空表示在库主视图;非空表示已归档、仅在归档区与搜索中可见。语义详见 [01-product-model.md](./01-product-model.md)「软删除语义」。

---

## doc(详情文档)

挂在某个 repo 下的多角度详情文档,构成知识(Knowledge)层。

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `id` | 主键 | 否 | 文档唯一标识 |
| `repo_id` | 外键 → `repo.id` | 否 | 所属项目 |
| `doc_type` | 枚举 | 否 | 文档类型,取值见下 |
| `title` | 文本 | 否 | 文档标题 |
| `content` | 文本 | 否 | **Markdown 源文本存储,渲染为 HTML 展示** |
| `sort_order` | 整数 | 否 | 同一 repo 下多篇文档的排序 |
| `created_at` | 时间戳 | 否 | 创建时间 |
| `updated_at` | 时间戳 | 否 | 更新时间 |

`doc_type` 枚举取值:

| 值 | 含义 |
|---|---|
| `ai-analysis` | AI 解读 |
| `install-usage` | 安装 & 使用 |
| `explainer` | 项目讲解 / 架构剖析 |
| `notes` | 我的笔记 |
| `custom` | 自定义 |

---

## 附:AI 字段归属对照

为强调「candidate 不含 AI 字段、不调 LLM」这一核心约束,列出 AI 生成字段在两个实体上的归属:

| AI 生成字段 | candidate | repo |
|---|---|---|
| `summary`(中文摘要) | ✗ 无 | ✓ 有 |
| `category`(中文分类) | ✗ 无 | ✓ 有 |
| `tags`(标签数组) | ✗ 无 | ✓ 有 |

candidate 停留在「GitHub 原始信息」层面;只有当它被收藏晋升为 repo,AI 分析才介入(触发时机见 [01-product-model.md](./01-product-model.md))。
