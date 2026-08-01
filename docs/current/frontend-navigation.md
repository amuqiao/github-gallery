# Frontend Navigation Structure

本文记录当前已经实现的前端导航骨架。它说明页面如何组织浏览路径，不定义 catalog 配置合同。

## Mental Model

当前前端采用：

```text
Platform Hub
  `/` 展示展馆入口、模型样例和精选专题。

Hall Hub
  `/halls/github/`、`/halls/models/` 和 `/halls/lab/` 展示馆内 published content。

Canonical Detail
  `/halls/<hall>/items/<id>/` 展示 content item 详情。
  `/halls/<hall>/collections/<id>/` 展示馆内专题详情。

Nested Notes
  `/halls/<hall>/items/<id>/notes/<note>/` 展示 content item 附加笔记。
```

页面数据来源是 `src/lib/catalog/halls.ts`、`src/lib/catalog/content.ts`、`src/lib/catalog/site.ts` 和 `src/lib/catalog/taxonomy.ts`。旧 project/model/root collection 路由已删除。

## Page Roles

| Page | Role | Components |
| --- | --- | --- |
| `/` | Platform hub，展示展馆入口、published 模型样例和 published content collection。 | `HallCard`、`ContentItemCard`、`ContentCollectionCard` |
| `/halls/github/` | GitHub 展馆 hub，展示 published GitHub content item 和馆内 published collection。 | `Breadcrumbs`、`PageHeader`、`ContentItemCard`、`ContentCollectionCard` |
| `/halls/models/` | 模型展馆入口，展示 published `ai_model` item。 | `Breadcrumbs`、`PageHeader`、`ContentItemCard` |
| `/halls/lab/` | 实验室入口，展示临时收纳的 published content item 和馆内 published collection。 | `Breadcrumbs`、`PageHeader`、`ContentItemCard`、`ContentCollectionCard` |
| `/halls/music/` | planned 音乐展馆占位页。 | `PlannedHallPage` |
| `/halls/movies/` | planned 电影展馆占位页。 | `PlannedHallPage` |
| `/halls/<hall>/items/<id>/` | canonical content item 详情页，只为 published item 生成。 | `Breadcrumbs`、`PageHeader`、`ContentItemCard`、`ContentCollectionCard`、`BlockRenderer`、`Prose` |
| `/halls/<hall>/items/<id>/notes/<note>/` | canonical content item 附加笔记页。 | `Breadcrumbs`、`PageHeader`、`Prose` |
| `/halls/<hall>/collections/` | 馆内 published collection 列表；无专题时显示空状态。 | `Breadcrumbs`、`PageHeader`、`ContentCollectionCard` |
| `/halls/<hall>/collections/<id>/` | canonical hall-owned collection 详情页，只为 published collection 生成。 | `Breadcrumbs`、`PageHeader`、`BlockRenderer`、`ContentItemCard`、`Prose` |

## Component Boundaries

| Component | Owns | Does Not Own |
| --- | --- | --- |
| `PageHeader` | 页面首屏标题、摘要、统计和行动入口。 | 读取 catalog、决定集合内容。 |
| `Breadcrumbs` | 详情页层级路径。 | 路由生成规则。 |
| `HallCard` | 平台首页单个展馆入口。 | hall YAML 读取和排序。 |
| `ContentItemCard` | 单个 content item 卡片。 | content bundle 校验。 |
| `ContentCollectionCard` | 单个 content collection 卡片。 | collection item 引用校验。 |
| `PlannedHallPage` | planned 展馆占位页。 | 领域 item 合同。 |
| `BlockRenderer` | typed block 分发渲染。 | block schema。 |
| `Prose` | Markdown/HTML fragment 正文容器。 | 内容加载和 HTML 安全校验。 |

## Runtime Path

```text
catalog YAML
  -> src/lib/catalog/catalog-schema.js
  -> src/lib/catalog/halls.ts
  -> src/lib/catalog/content-validator.js
  -> src/lib/catalog/content.ts
  -> src/lib/catalog/site.ts
  -> src/lib/catalog/taxonomy.ts
  -> Astro pages
  -> shared frontend components
  -> static HTML output
```

页面和组件不直接读取 YAML。列表视图使用 `ContentItemCard` 和 `ContentCollectionCard`。

## Verification

`./scripts/verify.sh check` 会运行 fast catalog gate、Astro 类型检查和 static build。
