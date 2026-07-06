# 04 · 复合导航模型与页面层级

## 这篇是什么

这篇文档回答两个问题:

1. **用户在 GitHub Gallery 里怎么"走路"**——顶层是什么结构、每一层用什么导航模式、为什么不是同一种模式套到底。
2. **前端一共有几个页面、路由怎么定、每个页面装什么内容、需要向后端要哪些数据**。

它是 [`01-product-model.md`](./01-product-model.md) 定义的三层内容模型(流 / 库 / 知识)在**界面结构**上的落地,
也是 [`05-frontend.md`](./05-frontend.md)(技术栈与视觉体系)、[`06-api-contract.md`](./06-api-contract.md)(接口契约)
两篇文档的上游:先确定"有哪些页面、每页要什么数据",后两篇再分别回答"用什么技术做出来"和"数据具体怎么拿"。

**谁读**:前端开发者(搭路由和页面骨架)、负责交互/视觉的人(理解每层导航的心理预期)。

**不负责**:具体组件实现、视觉样式、动效参数(见 [`05-frontend.md`](./05-frontend.md));接口的入参出参细节(见 [`06-api-contract.md`](./06-api-contract.md))。

---

## 1. 先看一张图:外壳 + 页面树

GitHub Gallery 是一个**单一 Tabbed 外壳包着若干页面**,其中"库"这条线还会向下钻两层。整体结构:

```
GitHub Gallery(SPA)
└─ 顶层外壳 · Tabbed View(首页 / 流 / 库,三个常驻 Tab 平级切换)
   │
   ├─ 首页          /                                  Dashboard
   │
   ├─ 流            /flow                              Filtered View(Feed)
   │
   └─ 库            /library                           Filtered View(筛选 + 网格)
       │
       └─ repo 详情  /library/:repoId                  Nested Doll · 第 1 层
           │           (含"文档" Tab,列出该 repo 下的多篇文档)
           │
           └─ 单篇文档 /library/:repoId/docs/:docId    Nested Doll · 第 2 层
                        (Markdown 渲染,可与详情页同页呈现)

（辅助路由，不在三大 Tab 之内）
└─ 归档区        /archive                              软删除项目的存放区
```

要点先立住:

- **三大 Tab 是首页 / 流 / 库**,不是四个——知识层没有自己的 Tab,它挂在"库→详情"里面(第 3.2 节展开)。
- **库这一条线是唯一会"钻入"的地方**:从网格卡片点进详情页,再从详情页的文档 Tab 点进具体某篇文档,层层嵌套(Nested Doll)。流和首页都不钻,只是平铺筛选或聚合展示。
- `/archive` 是独立路由,但**不是**第四个顶层 Tab。

  > **已定稿(入口位置)**:归档区入口放在"库"页面**筛选侧栏底部**的一个次级文字链接(如「查看归档 →」),与常用筛选项在视觉上分层、不抢主视线。它是低频回顾入口,不占顶层导航。

---

## 2. 复合导航模型:为什么不是单一模式

GitHub Gallery 不套用某一种教科书导航模式(纯 Tab、纯 Hub and Spoke、纯层级钻取)贯穿全局,而是按"每一层内容的形态"分别选型:

| 层级 | 采用模式 | 选型理由 |
|---|---|---|
| 顶层外壳 | **Tabbed View** | 首页 / 流 / 库是三块平级、同等重要、随时切换的板块,不存在谁是谁的子集,适合常驻 Tab 平级并列 |
| 首页 | **Dashboard** | 用户打开 App 第一眼要"看全局",而不是钻进某一层;一屏聚合各层关键数字 + 快捷入口最省心智负担 |
| ① 流 | **Filtered View**(Feed) | 内容是"按批次/日期/来源"线性流入的候选卡片,用户诉求是"快速过一遍、随手筛",不需要层级,只需要按维度过滤/排序 |
| ② 库 | **Filtered View**(筛选 + 网格) | 库里的项目靠分类/标签/状态/语言等多维度交叉筛选来找,而不是靠目录层级去翻;网格 + 侧栏筛选 + 搜索最贴近用户"按条件找项目"的心智 |
| ③ 库→详情→文档 | **Nested Doll** | 这条线的内容天然是层层包含的实体关系(repo 包含多篇 doc,doc 内是长文 Markdown),用户诉求是从"这个项目"聚焦到"这篇具体文档",逐层钻入符合关系本身,也符合专注阅读的心理 |

下面逐层说明。

### 2.1 顶层外壳:Tabbed View

首页、流、库对应产品的三层核心内容模型(仪表盘 / Flow / Library),彼此不是父子关系,用户会频繁在三者间跳转
(例如:流里收藏一个项目 → 切到库确认它进来了 → 回流里继续筛)。Tabbed View 让这种跳转是**一次点击、状态互不干扰**的,
不需要"返回上一页"这种带路径记忆的操作,最贴合"三块并列板块反复横跳"的使用节奏。

### 2.2 首页:Dashboard

首页不承载任何一层的完整内容,只做**聚合与导流**:今日新流数、待筛数、正在学项目数、库总量等关键数字,加上跳转到流/库的
快捷入口(对应 [`06-api-contract.md`](./06-api-contract.md) 中的 `GET /api/dashboard/summary`)。它的价值是让用户一进门就有
"全局概览感",不必逐层点开才知道"现在有多少事要做"。

### 2.3 流:Filtered View

流的内容单元是 `crawl_batch` 产出的 `candidate` 卡片,按时间线(批次/日期)线性排列,天然是一个可以"刷"的 Feed。用户对
候选卡片的操作只有三种(收藏↗ / 忽略✕ / 查看"已收藏✓"角标),不涉及钻入更深层级,因此**按维度过滤 + 平铺展示**
(Filtered View)已经够用,不需要引入层级结构。

### 2.4 库:Filtered View

库的内容单元是正式收藏的 `repo`,数量会持续积累,用户"找项目"的方式是交叉使用分类、标签、状态、语言等筛选条件,
再辅以关键词搜索——这正是 Filtered View 的典型场景。库不需要目录树式的层级导航,因为项目之间不存在天然的从属关系,
只有平行的多维标签。

### 2.5 库→详情→文档:Nested Doll

一旦用户从库的网格里点开某个 repo,内容形态就从"一堆平行项目"变成了"这一个项目的多面信息":基础信息、AI 摘要、
以及可能挂着的多篇详情文档(`ai-analysis` / `install-usage` / `explainer` / `notes` / `custom`)。这是实体关系上真实存在的
一对多包含(`repo 1──N doc`),用 Nested Doll(卡片 → 详情 → 文档,逐层钻入再逐层返回)如实映射这层包含关系,
也让用户在读一篇长文档时保持专注,不被同层的其他信息打扰。

---

## 3. 两个关键决策:为什么不是别的做法

### 3.1 为什么不采用 Hub and Spoke 作主结构

Hub and Spoke 的典型用法是"回到中心页 → 挑一个分支 → 做完事情 → 回到中心页",适合分支之间彼此独立、用户做完一件事就
该"归位"的场景。但 GitHub Gallery 的核心动线恰恰相反,是**跨层连续流动**:

```
流里发现 → 收藏晋升进库 → 库里点开 → 写详情文档
```

这条动线要求用户能从流"直接流向"库,再从库"直接流向"文档,中途不该被强制拉回某个中心页重新出发——那会打断
"发现 → 收藏 → 深挖"这条心流(flow state)。因此顶层结构选择**首页 Dashboard + 常驻 Tab**:Dashboard 提供"回到全局"的
中心感和概览感,但它不是必须"做完一件事就要回来"的枢纽,常驻 Tab 本身就能在任意时刻直接跳到另一层,不需要绕经 Hub。

### 3.2 为什么知识层暂不独立 Tab

三层内容模型里"知识"(优质项目的多角度详情文档)是独立的一层,但它在导航结构上**暂不给独立 Tab**,而是合并进
"库 → repo 详情页"的文档 Tab 里,原因:

- 现阶段每篇 `doc` 都强绑定一个 `repo_id`,用户查看文档的入口天然是"先找到项目,再看它的文档",没有"跨项目直接找文档"的
  独立诉求,单独开一个 Tab 反而多绕一层。
- 这个决定**可延后、不强制重构**:等未来出现"跨项目检索/浏览所有文档"的真实需求时,再把文档列表提升为独立 Tab
  (路由层面 `/library/:repoId/docs/:docId` 本身已经是独立可寻址的,届时无需改动详情文档的 URL 结构,只需新增一个
  聚合入口)。这也呼应 [`07-roadmap.md`](./07-roadmap.md) 中"知识层排在自动流之前,因为它只依赖库、不依赖抓取"的分期考虑。

---

## 4. 前端页面层级与路由表

路由命名严格照 brief §8 清单,不做改动:

| 路由 | 页面名 | 承载层 / 模式 | 一句话职责 |
|---|---|---|---|
| `/` | Dashboard(首页) | 首页 · Dashboard | 聚合各层关键数字,提供跳转入口 |
| `/flow` | 流 | ① Flow · Filtered View | 按批次/日期浏览候选卡片,收藏或忽略 |
| `/library` | 库 | ② Library · Filtered View | 筛选 + 搜索 + 网格浏览已收藏项目 |
| `/library/:repoId` | repo 详情页 | ② → ③ · Nested Doll 第 1 层 | 展示项目详情信息 + 该项目下的文档列表(Tab) |
| `/library/:repoId/docs/:docId` | 单篇详情文档 | ③ Knowledge · Nested Doll 第 2 层 | 渲染单篇 Markdown 文档,可编辑 |
| `/archive` | 归档区 | 辅助页(跨 ①②,展示软删除项目) | 查看/恢复/彻底删除已归档项目 |

下面逐页展开职责、承载内容与所需数据。数据来源统一指向 [`06-api-contract.md`](./06-api-contract.md) 中对应章节,
具体入参出参以该文档为准,这里只列"这页需要哪些接口"。

### 4.1 `/` Dashboard(首页)

- **职责**:一屏概览,不做任何筛选/编辑操作,只做展示与跳转。
- **承载内容**:各层的聚合计数(今日新流数、待筛候选数、正在学项目数、库总量等)与快捷入口。
- **所需数据**:`GET /api/dashboard/summary`(详见 [`06-api-contract.md`](./06-api-contract.md) 首页章节)。

### 4.2 `/flow` 流

- **职责**:按批次/日期/来源浏览候选卡片,支持收藏晋升或忽略;可手动触发一次新的抓取。
- **承载内容**:`crawl_batch` 时间线 + 每个批次下的 `candidate` 卡片;卡片展示 GitHub 原始信息(不含 AI 字段,因为
  candidate 阶段不调 LLM,详见 [`01-product-model.md`](./01-product-model.md));已收藏的候选需要显示"✓ 已收藏"角标。
- **所需数据**:
  - `GET /api/batches` —— 批次列表
  - `GET /api/batches/{batch_id}/candidates` —— 某批次的候选卡片(带 `in_library` 角标信息)
  - `POST /api/candidates/{candidate_id}/save` —— 收藏晋升(触发 AI 分析)
  - `POST /api/candidates/{candidate_id}/dismiss` —— 忽略
  - `POST /api/ingest/run` —— 手动触发抓取(若页面提供该入口)

### 4.3 `/library` 库

- **职责**:多维度筛选 + 搜索 + 网格浏览已收藏项目;支持手动贴 URL 添加项目。
- **承载内容**:`repo` 列表,按分类 / 标签 / 状态 / 语言筛选,支持关键词搜索;筛选条件的可选值来自元数据接口。
- **所需数据**:
  - `GET /api/repos`(query:`category` / `tag` / `status` / `language` / `q` / 分页)
  - `POST /api/repos` —— 手动贴 URL 添加(是否即时分析见 [`01-product-model.md`](./01-product-model.md) §AI 触发时机)
  - `GET /api/categories`、`GET /api/tags` —— 筛选栏可选项来源

### 4.4 `/library/:repoId` repo 详情页(Nested Doll 第 1 层)

- **职责**:展示单个项目的完整信息;承载编辑(分类/标签/备注/状态)、状态流转、软删除(归档)、AI 分析等操作;
  同页内以 Tab 形式列出该项目的多篇文档,构成向 Nested Doll 第 2 层的入口。
- **承载内容**:`repo` 详情字段(GitHub 原始信息 + AI 生成字段 + 用户维护字段);`doc` 列表(按 `doc_type`:
  `ai-analysis` / `install-usage` / `explainer` / `notes` / `custom` 分 Tab 或列表展示)。
- **所需数据**:
  - `GET /api/repos/{repo_id}` —— 详情
  - `PATCH /api/repos/{repo_id}` —— 编辑 summary/category/tags/notes/status
  - `POST /api/repos/{repo_id}/refresh` —— 重新抓 GitHub 数据 + 重跑 AI
  - `POST /api/repos/{repo_id}/analyze` —— 手动触发 AI 分析
  - `POST /api/repos/{repo_id}/archive`、`POST /api/repos/{repo_id}/unarchive`、`DELETE /api/repos/{repo_id}` —— 归档/取消归档/硬删除
  - `GET /api/repos/{repo_id}/docs` —— 文档列表(供页内文档 Tab 使用)
  - `POST /api/repos/{repo_id}/docs`、`POST /api/repos/{repo_id}/docs/generate` —— 新增文档 / AI 起草文档

### 4.5 `/library/:repoId/docs/:docId` 单篇详情文档(Nested Doll 第 2 层)

- **职责**:渲染单篇文档的 Markdown 内容并支持编辑;是"库→详情→文档"这条钻取链路的终点。
- **承载内容**:单篇 `doc` 的 `title`、`content`(Markdown 源文本渲染为 HTML)。
- **交互说明**:该路由**独立可寻址**(可直接分享/刷新定位到某一篇文档),但 UI 上**可以与详情页同页呈现**——即点击
  详情页的文档 Tab 时,页面内容原地切换而不做整页跳转,只是 URL 随之更新;具体的过渡动效属于 [`05-frontend.md`](./05-frontend.md) 范畴。
- **所需数据**:
  - `GET /api/docs/{doc_id}` —— 单篇文档
  - `PATCH /api/docs/{doc_id}` —— 编辑
  - `DELETE /api/docs/{doc_id}` —— 删除

### 4.6 `/archive` 归档区

- **职责**:查看已归档(软删除)的项目,支持取消归档或彻底硬删除,不进入库/流的主视图统计。
- **承载内容**:`archived_at` 非空的 `repo` 列表。
- **所需数据**:
  - `GET /api/repos?archived=true` —— 拉取已归档列表(复用库列表端点,靠 `archived` 参数切换;
    详见 [`06-api-contract.md`](./06-api-contract.md) §5.1)
  - `POST /api/repos/{repo_id}/unarchive`、`DELETE /api/repos/{repo_id}` —— 恢复 / 彻底删除

  > **已定稿**:归档列表复用 `GET /api/repos` + `archived` 参数(不传/`false` → 只返回未归档;
  > `true` → 只返回已归档),**不拆独立端点**。详见 [`06-api-contract.md`](./06-api-contract.md) §5.1。

---

## 5. 小结

- 导航结构不是单一模式,而是"顶层 Tabbed 外壳 + 首页 Dashboard + 流/库两个 Filtered View + 库内 Nested Doll"的组合,
  每一层的选型都对应该层内容本身的形态(平级板块 / 聚合概览 / 可筛选集合 / 包含关系)。
- 不用 Hub and Spoke 做主结构,是因为产品的核心动线是跨层连续流动,Hub 的"做完回中心"会打断这条心流。
- 知识层暂不独立成 Tab,是刻意的延后决策,不是遗漏——路由结构已经为未来独立埋好了钩子。
- 路由表中的 6 个路由与 brief §8 完全一致,是前端搭建路由骨架的直接依据;每页所需的数据接口已标注,
  具体入参出参以 [`06-api-contract.md`](./06-api-contract.md) 为准;视觉与动效实现方式见 [`05-frontend.md`](./05-frontend.md)。
