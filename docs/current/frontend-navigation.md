# Frontend Navigation Structure

本文记录当前已经实现的前端导航骨架。它说明页面如何组织浏览路径，不定义 catalog 配置合同。

## Mental Model

当前前端采用组合导航模式：

```text
Hub and Spoke
  平台首页作为展馆入口，进入 GitHub 展馆、模型展馆、专题和 planned 展馆。

Hall Home
  GitHub 展馆页展示 published GitHub content item 和馆内专题；模型展馆页展示 published 模型 content item。

Filtered View
  分类页和标签页仍是 legacy GitHub 项目的过滤视图，后续会切换或删除。

Nested Doll
  GitHub content item 和模型 content item 进入 canonical item 详情；馆内专题进入 canonical collection 详情，专题详情再展示专题内条目。

Project Notes
  项目详情页作为项目 hub，附加笔记作为从项目页进入的 spoke 页面。

Model Notes
  模型详情页作为模型 hub，附加笔记作为从模型页进入的 spoke 页面。
```

这些模式只约束页面和组件结构。展馆数据来源是 `src/lib/catalog/halls.ts`，平台首页、GitHub 展馆、模型馆和 canonical content 路由数据来源是 `src/lib/catalog/content.ts`。旧模型、项目、category/tag 和 root collection 页面仍分别读取 `src/lib/catalog/models.ts`、`src/lib/catalog/projects.ts` 和 `src/lib/catalog/collections.ts`。

当前页面组合由 `src/presentation/config.ts` 选择的 `bento-editorial` layout 驱动。layout 可以调整首页 section 顺序和列表变体，但不改变路由角色或 catalog 数据来源。

## Page Roles

| Page | Role | Components |
| --- | --- | --- |
| `/` | Platform hub，展示展馆入口、published 模型样例和 published content collection。 | `HallCard`、`ContentItemCard`、`ContentCollectionCard` |
| `/halls/github/` | GitHub 展馆 hub，展示 published GitHub content item 和馆内 published collection。 | `Breadcrumbs`、`PageHeader`、`ContentItemCard`、`ContentCollectionCard` |
| `/halls/models/` | 模型展馆入口，展示 `catalog/content/published/models/items/` 中的已发布 `ai_model` 条目。 | `Breadcrumbs`、`PageHeader`、`ContentItemCard` |
| `/halls/<hall>/items/<id>/` | canonical content item 详情页，只为 published item 生成。 | `Breadcrumbs`、`PageHeader`、`BlockRenderer`、`Prose` |
| `/halls/<hall>/items/<id>/notes/<note>/` | canonical content item 附加笔记页；Markdown 和 HTML fragment 使用站内布局，HTML document 返回独立页面。 | `Breadcrumbs`、`PageHeader`、`Prose` |
| `/halls/<hall>/collections/` | 馆内 published collection 列表。 | `Breadcrumbs`、`PageHeader`、`ContentCollectionCard` |
| `/halls/<hall>/collections/<id>/` | canonical hall-owned collection 详情页，只为 published collection 生成。 | `Breadcrumbs`、`PageHeader`、`BlockRenderer`、`ContentItemCard` |
| `/halls/models/[id]/` | legacy 模型详情页，暂时读取 `catalog/models/`。 | `Breadcrumbs`、`PageHeader`、`BlockRenderer`、`Prose` |
| `/halls/models/[id]/notes/[note]/` | legacy 模型附加笔记页。 | `Breadcrumbs`、`PageHeader`、`Prose` |
| `/halls/music/` | planned 音乐展馆占位页。 | `PlannedHallPage` |
| `/halls/movies/` | planned 电影展馆占位页。 | `PlannedHallPage` |
| `/collections/` | 公开专题入口，展示 `published` 和 `archived` 专题。 | `PageHeader`、`CollectionGrid` |
| `/collections/[id]/` | 单个公开专题详情页，按专题顺序展示已引用项目。 | `Breadcrumbs`、`PageHeader`、`BlockRenderer`、`ProjectCollection` |
| `/categories/[category]/` | 按 category 的 filtered view。 | `PageHeader`、`ProjectCollection` |
| `/tags/[tag]/` | 按 tag 的 filtered view。 | `PageHeader`、`ProjectCollection` |
| `/projects/[id]/` | 项目详情页，承载 Nested Doll 详情路径和项目笔记入口。 | `Breadcrumbs`、`ProjectHero`、`ProjectNotes`、`BlockRenderer`、`RelatedProjects` |
| `/projects/[id]/notes/[note]/` | 项目附加笔记页；Markdown 和 HTML fragment 使用站内布局，HTML document 返回独立页面。 | `Breadcrumbs`、`PageHeader`、`Prose` |

## Component Boundaries

| Component | Owns | Does Not Own |
| --- | --- | --- |
| `PageHeader` | 页面首屏标题、摘要、统计和行动入口。 | 读取 catalog、决定项目集合。 |
| `CollectionGrid` | 专题集合标题、空状态和专题卡片网格。 | 读取 collection YAML、校验项目引用。 |
| `CollectionCard` | 单个专题卡片。 | 专题内项目解析。 |
| `FilterPanel` | 首页 taxonomy 浏览入口和项目计数。 | 搜索状态、URL query、taxonomy 合同。 |
| `ProjectCollection` | 项目集合标题、空状态和卡片网格。 | 解析 YAML、校验 taxonomy。 |
| `ProjectCard` | 单个项目卡片。 | 列表排序、筛选状态。 |
| `Breadcrumbs` | 详情页层级路径。 | 路由生成规则。 |
| `ProjectHero` | 项目详情首屏信息和仓库入口。 | details.md 或 blocks 渲染。 |
| `ProjectNotes` | 项目笔记索引卡片。 | note 内容加载、note 文件校验。 |
| `RelatedProjects` | 详情页相关项目集合。 | related project 校验。 |
| `HallCard` | 平台首页单个展馆入口。 | hall YAML 读取和排序。 |
| `ModelCard` | 模型条目卡片。 | model YAML 读取、详情加载。 |
| `PlannedHallPage` | planned 展馆占位页。 | 领域 item 合同。 |

## Runtime Path

```text
catalog YAML
  -> src/lib/catalog/catalog-schema.js
  -> src/lib/catalog/halls.ts
  -> src/lib/catalog/content.ts for platform home, hall homes, and canonical published content routes
  -> src/lib/catalog/models.ts for legacy model routes
  -> src/lib/catalog/projects.ts
  -> src/lib/catalog/collections.ts
  -> Astro pages
  -> shared frontend components
  -> static HTML output
```

页面和组件不直接读取 YAML。当前 canonical content 列表视图使用 `ContentItemCard` 和 `ContentCollectionCard`；legacy 项目列表视图仍使用 `ProjectCollection`。

平台首页和 GitHub 展馆页当前由对应 page 直接编排，保持入口页职责，不再通过旧 GitHub `HomePage`/`HomeBentoHero` 读取 project catalog。

## Verification

`./scripts/verify.sh check` 会运行 `astro check` 和 static build。当前前端骨架通过构建期类型检查和页面生成验证。
