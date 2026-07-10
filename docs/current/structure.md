# Gallery Platform Structure

本文只描述当前已经实现的结构和运行路径。

## Current Behavior

- 站点是 Astro static site。
- 展馆入口数据位于 `catalog/halls/<id>/hall.yaml`。
- 内容真源位于 `catalog/content/{drafts,published,archived}/<hall>/items|collections/`。
- `published` content 会生成公开 canonical item、note 和 hall-owned collection 页面。
- `drafts` 和 `archived` content 参与验证，不生成公开 content 页面。
- 分类、标签和项目维护状态词表位于 `catalog/taxonomies.yaml`。
- 站点标题、描述和导航位于 `catalog/site.yaml`。
- 页面不直接解析 YAML，而是调用 `src/lib/catalog/*` read model。
- `src/lib/catalog/halls.ts` 构建展馆入口 read model，并校验 hall 目录名和 id 一致。
- `src/lib/catalog/content-validator.js` 校验 content bundle publication state、hall、item、collection、body、notes、taxonomy 和跨状态引用规则。
- `src/lib/catalog/content.ts` 构建 content bundle read model、公开内容过滤、相关 item 查询和 canonical route 派生。
- `src/lib/catalog/site.ts` 读取站点配置。
- `src/lib/catalog/taxonomy.ts` 读取并本地化 taxonomy。
- `src/lib/catalog/details.ts` 只加载 content bundle 的 Markdown/HTML body 和 item notes。
- `src/lib/catalog/block-adapters.ts` 在渲染前适配 typed blocks。
- `src/presentation/` 只提供展示层 layout/theme registry，不定义内容选择。
- `src/components/ContentItemCard.astro` 和 `src/components/ContentCollectionCard.astro` 是当前内容卡片入口。
- `scripts/content.sh` 创建、导入、发布、归档、恢复和只读查询 content bundle。
- `scripts/verify.sh` 是一次性验证和发布门禁入口。

## Runtime Path

```text
catalog/halls/<id>/hall.yaml
  -> src/lib/catalog/catalog-schema.js
  -> src/lib/catalog/halls.ts
  -> src/pages/index.astro
  -> src/pages/halls/<known-hall>/index.astro
  -> static HTML output

catalog/content/{drafts,published,archived}/<hall>/items/<id>/item.yaml
  -> src/lib/catalog/catalog-schema.js
  -> src/lib/catalog/content-validator.js
  -> src/lib/catalog/content.ts
  -> src/lib/catalog/details.ts
  -> src/pages/index.astro
  -> src/pages/halls/github/index.astro
  -> src/pages/halls/models/index.astro
  -> src/pages/halls/[hall]/items/[id].astro
  -> src/pages/halls/[hall]/items/[id]/notes/[note].astro
  -> static HTML output for published only

catalog/content/{drafts,published,archived}/<hall>/collections/<id>/collection.yaml
  -> src/lib/catalog/catalog-schema.js
  -> src/lib/catalog/content-validator.js
  -> src/lib/catalog/content.ts
  -> src/lib/catalog/details.ts
  -> src/pages/index.astro
  -> src/pages/halls/github/index.astro
  -> src/pages/halls/[hall]/collections/index.astro
  -> src/pages/halls/[hall]/collections/[id].astro
  -> static HTML output for published only

catalog/taxonomies.yaml
  -> src/lib/catalog/catalog-schema.js
  -> src/lib/catalog/taxonomy.ts
  -> src/lib/catalog/content-validator.js
  -> ContentItemCard and canonical item pages

catalog/site.yaml
  -> src/lib/catalog/site.ts
  -> Astro pages
  -> BaseLayout

scripts/content.sh
  -> scripts/content/content-cli.mjs
  -> scripts/content/content-import-cli.mjs
  -> catalog/content/drafts/ for new and imported bundles
  -> catalog/content/{drafts,published,archived}/ for publish/archive/restore
  -> TSV or YAML output for list/show/status
  -> scripts/verify.sh catalog or release
  -> rollback on failure

scripts/verify.sh release
  -> scripts/verify/release-gate.mjs
  -> src/lib/catalog/content-validator.js
  -> npm run build
  -> Astro check and static build
```

## Public Routes

| Route | Source |
| --- | --- |
| `/` | published content, halls, site config |
| `/halls/github/` | published `github_project` content and GitHub hall collections |
| `/halls/models/` | published `ai_model` content |
| `/halls/music/` | planned hall config |
| `/halls/movies/` | planned hall config |
| `/halls/<hall>/items/<id>/` | published content item |
| `/halls/<hall>/items/<id>/notes/<note>/` | published content item note |
| `/halls/<hall>/collections/` | active hall collection index |
| `/halls/<hall>/collections/<id>/` | published hall-owned content collection |

Legacy root routes such as `/projects/*`, `/collections/*`, `/categories/*`, `/tags/*`, and `/halls/models/<id>/` have been removed.

## State Authority

`catalog/content/` is the only item and collection content source. Publication state is expressed by directory: `drafts`, `published`, or `archived`.

`catalog/halls/` owns hall availability and sort order. A `planned` hall may have an entry page but cannot own content bundles or collection index routes.

`catalog/taxonomies.yaml` owns category, tag, and project maintenance status labels. GitHub content items store only taxonomy ids in `profile`.

`catalog/site.yaml` owns top navigation and site metadata.

`src/presentation/config.ts` owns the active layout/theme ids. It does not select content.

`notes` are content item attachments. Markdown notes render inside the site shell; HTML notes may be site fragments or standalone documents according to the note contract.

`.tmp/import-batches/` is a temporary exchange area. Successful content imports write to `catalog/content/drafts/`.

## Verification

- `npm run build` runs `astro check` and `astro build`.
- `./scripts/verify.sh check` runs the content release gate and static build.
- `./scripts/verify.sh release` validates published content semantics and then builds.
- Content validation fails on invalid schema, unknown hall, planned hall content, missing body/note files, symlinks, path escape, duplicate bundle keys, unknown taxonomy ids, invalid related project ids, or published collections referencing non-published items.
- `./scripts/content.sh list`、`show` 和 `status` 是只读 catalog 查询；它们不会加 catalog write lock，不会运行验证，也不会触发 build。
