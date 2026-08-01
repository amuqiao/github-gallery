# Gallery Platform Refactor Plan

## Current Baseline

- 平台已经从 GitHub-only gallery 切到多展馆静态站骨架。
- 内容真源是 `catalog/content/{drafts,published,archived}/<hall>/items|collections/`。
- GitHub 展馆旧 projects 和 root collections 已迁移为 `catalog/content/published/github/`。
- 模型样例 `htdemucs-ft-onnx` 已迁移为 `catalog/content/published/models/items/`。
- 公开入口 `/`、`/halls/github/`、`/halls/models/` 和 canonical content routes 都读取 published content。
- 旧 `/projects/*`、`/collections/*`、`/categories/*`、`/tags/*`、legacy `/halls/models/<id>/*` 路由、旧数据目录、旧 loader 和旧 `catalog.sh` 已切除。
- `scripts/content.sh` 是内容创建、导入、发布、归档和恢复入口。
- `./scripts/verify.sh release` 是发布门禁，先跑 content validator，再跑 Astro static build。
- `src/lib/catalog/projections.ts` 已收敛 item 详情 header、内容卡片和搜索索引使用的 content projection。
- `./scripts/verify.sh catalog` 和 `./scripts/verify.sh content` 已使用 fast catalog-only gate。

## Frozen Surfaces

这些外部面在后续重构中优先保持兼容，除非单独做破坏性迁移：

- `catalog/content/{drafts,published,archived}/<hall>/items|collections/` 目录语义。
- `catalog/halls/<id>/hall.yaml`、`catalog/site.yaml`、`catalog/taxonomies.yaml` 配置入口。
- 公开路由：`/`、`/search/`、`/recent/`、`/search-index.json`、`/halls/<hall>/`、canonical item/note/collection routes。
- `./scripts/content.sh` 命令名、`list/show/status` 输出形状、publish/archive/restore 状态迁移语义和失败回滚保证。
- `./scripts/verify.sh check`、`release`、`catalog`、`content` 的验证职责边界。

## Remaining Gaps

- Content authoring 仍需要维护者理解 `item.yaml` / `collection.yaml` 字段。
- Hall 内筛选能力仍未实现。
- `ContentCatalogSnapshot` 仍只覆盖 content；hall、site 和 taxonomy 还没有统一进入 repo-level catalog snapshot。
- publish/archive/restore/import/note replace 写侧语义仍主要位于 CLI 脚本中。
- 旧 schema 命名中仍保留 `projectNoteSchema`、`projectBlockSchema`、`adaptProjectBlocks` 等历史命名，实际已被 content bundle 复用。
- 计划中的音乐、电影展馆仍只有 planned 入口，没有 item profile 合同。

## Planned Work

- 扩展现有 `ContentCatalogSnapshot` 为 repo-level catalog snapshot，收敛 hall、site、taxonomy 和 content 的读取边界。
- 把 publish/archive/restore/import/note replace 收敛到应用服务层，保持 `scripts/content.sh` 外部行为不变。
- 为 content bundle 增加更友好的创建/编辑子命令或模板，减少手写 YAML。
- 设计 hall 内筛选能力，替代已删除的旧 category/tag root 路由。
- 视需要把 `projectNoteSchema` / `projectBlockSchema` 重命名为 content-neutral 命名。
- 当音乐或电影展馆进入真实内容阶段，再新增对应 item profile schema。

## Acceptance

- 新内容只通过 `catalog/content/` 发布。
- `./scripts/verify.sh check` 和 `./scripts/verify.sh release` 均通过。
- current docs 只描述已实现事实。
- contract docs 只描述当前可依赖合同。
- plans docs 只保留未完成工作。
