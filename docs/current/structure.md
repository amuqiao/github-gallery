# GitHub Gallery Structure

本文只描述当前已经实现的结构和运行路径。

## Current Behavior

- 站点是 Astro static site。
- 项目数据位于 `catalog/projects/<id>/project.yaml`。
- 可选详情正文位于同一项目目录的 `details.md`。
- 专题数据位于 `catalog/collections/<id>/collection.yaml`。
- 可选专题详情正文位于同一专题目录的 `details.md`。
- 分类、标签和项目状态词表位于 `catalog/taxonomies.yaml`，当前使用中英文双语展示字段。
- 站点标题、描述、导航位于 `catalog/site.yaml`。
- 页面不直接解析 YAML，而是调用 `src/lib/catalog/projects.ts` 和 `src/lib/catalog/collections.ts`。
- `src/lib/catalog/projects.ts` 构建共享 catalog snapshot，包括项目索引、taxonomy 索引、关系校验和相关项目查询。
- `src/lib/catalog/collections.ts` 构建专题 snapshot，并校验专题引用的项目是否存在、是否重复。
- `src/lib/catalog/block-adapters.ts` 在渲染前适配 typed blocks。
- `src/lib/catalog/project-view-models.ts` 把项目和 taxonomy 解析成前端卡片视图模型。
- `src/lib/catalog/details.ts` 加载项目和专题的 Markdown 详情正文。
- `src/presentation/` 提供展示层 registry，当前把 `layoutId` 和 `themeId` 拆开管理。
- `src/components/PageHeader.astro`、`src/components/ProjectCollection.astro`、`src/components/CollectionGrid.astro` 等共享组件承载前端导航骨架。
- `src/components/ui/` 提供 shadcn-style UI primitives。
- `src/styles/global.css` 提供 Tailwind 入口、shadcn-style token 和少量全局 prose 样式。
- `src/components/blocks/BlockRenderer.astro` 负责渲染 blocks。
- `scripts/` 提供本地开发、验证和 catalog 维护入口；脚本不定义配置合同。
- `.tmp/import-batches/<batch-id>/` 是 AI 或人工整理结果进入正式 catalog 前的临时交换目录。
- `scripts/catalog-import-cli.mjs` 负责 import batch 的预检、计划、差异、加锁应用和失败回滚。

## Runtime Path

```text
catalog/projects/<id>/project.yaml
  -> src/lib/catalog/project-schema.ts
  -> src/lib/catalog/projects.ts
  -> src/presentation/config.ts
  -> src/pages/index.astro
  -> src/pages/projects/[id].astro
  -> src/pages/categories/[category].astro
  -> src/pages/tags/[tag].astro
  -> src/components/PageHeader.astro
  -> src/components/ProjectCollection.astro
  -> src/components/ui/*
  -> static HTML output

catalog/projects/<id>/details.md
  -> src/lib/catalog/details.ts
  -> src/pages/projects/[id].astro
  -> static HTML output

catalog/collections/<id>/collection.yaml
  -> src/lib/catalog/project-schema.ts
  -> src/lib/catalog/collections.ts
  -> src/presentation/config.ts
  -> src/pages/collections/index.astro
  -> src/pages/collections/[id].astro
  -> src/components/CollectionGrid.astro
  -> src/components/ProjectCollection.astro
  -> static HTML output

catalog/collections/<id>/details.md
  -> src/lib/catalog/details.ts
  -> src/pages/collections/[id].astro
  -> static HTML output

catalog/projects/<id>/project.yaml blocks
  -> src/lib/catalog/project-schema.ts
  -> src/lib/catalog/projects.ts
  -> src/lib/catalog/block-adapters.ts
  -> src/pages/projects/[id].astro
  -> src/components/blocks/BlockRenderer.astro
  -> static HTML output

scripts/verify.sh
  -> npm run build
  -> Astro check
  -> Astro static build
  -> catalog schema/loader validation during page generation

.tmp/import-batches/<batch-id>/manifest.yaml
  -> scripts/catalog-import-cli.mjs
  -> catalog/projects/<id>/ or catalog/collections/<id>/
  -> scripts/verify.sh catalog
  -> rollback on failure
```

## State Authority

`project.yaml` 的 stable core 字段是项目卡片、筛选、路由和跨项目关系的机器可读来源。

`blocks` 是详情页可扩展展示内容来源。

`collection.yaml` 是专题身份、专题路由、公开状态、项目引用顺序和策展备注的机器可读来源。专题只引用已有项目，不复制项目事实。`draft` 专题会被校验，但不会生成公开页面。

`catalog/taxonomies.yaml` 是分类、标签和项目维护状态 id、固定 `zh/en` 双语展示名、双语说明的机器可读来源。项目只引用 taxonomy id；前端从 loader 派生的 `label` 和 `descriptionText` 渲染默认语言。项目状态的轻量视觉 tone 由 `src/presentation/status-tones.ts` 管理。

`catalog/site.yaml` 是站点导航和站点级展示信息来源。

`src/presentation/config.ts` 是当前前端展示版本来源。它选择代码级 `layoutId` 和 `themeId`，不改变项目或专题配置合同。

`details.md` 是人类可读长文说明，不定义可筛选字段。

`.tmp/import-batches/` 是中间交换区，不是长期数据源。导入成功后，正式来源仍是 `catalog/`；导入失败时脚本会回滚已写入的 item 目录。日常操作见 [`../runbooks/catalog-import-workflow.md`](../runbooks/catalog-import-workflow.md)。

前端导航骨架见 [`frontend-navigation.md`](frontend-navigation.md)。当前实现采用 Hub and Spoke + Filtered View + Nested Doll 的组合模式。

UI 样式架构见 [`ui-architecture.md`](ui-architecture.md)。当前实现采用 Tailwind CSS + shadcn-style primitives。

## Verification

- `npm run build` 会运行 `astro check` 和 `astro build`。
- `./scripts/verify.sh check` 是推荐的一次性验证入口，当前委托 `npm run build`。
- 配置违反 schema、引用未知 taxonomy、taxonomy 缺少双语字段、引用缺失文件、引用 symlink 详情文件、路径越出项目或专题目录、related project 不存在、专题引用未知项目、专题重复引用同一项目时，构建应失败。
- `schema_version: 1` 的项目和专题只支持 Markdown 详情。
- `schema_version: 1` 支持 `links`、`highlights`、`use-cases` blocks。
- `./scripts/catalog.sh import validate|plan|diff|apply` 是当前 import batch 工作流入口。合同说明见 [`../contract/catalog-import-batch.md`](../contract/catalog-import-batch.md)，操作手册见 [`../runbooks/catalog-import-workflow.md`](../runbooks/catalog-import-workflow.md)。
