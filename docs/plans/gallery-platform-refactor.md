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

## Remaining Gaps

- Content authoring 仍需要维护者理解 `item.yaml` / `collection.yaml` 字段。
- 缺少专门的 content-only 列表、搜索或筛选页；当前只有展馆页和专题页。
- 旧 schema 命名中仍保留 `projectNoteSchema`、`projectBlockSchema`、`adaptProjectBlocks` 等历史命名，实际已被 content bundle 复用。
- 计划中的音乐、电影展馆仍只有 planned 入口，没有 item profile 合同。

## Planned Work

- 为 content bundle 增加更友好的创建/编辑子命令或模板，减少手写 YAML。
- 设计 hall 内筛选或搜索能力，替代已删除的旧 category/tag root 路由。
- 视需要把 `projectNoteSchema` / `projectBlockSchema` 重命名为 content-neutral 命名。
- 当音乐或电影展馆进入真实内容阶段，再新增对应 item profile schema。

## Acceptance

- 新内容只通过 `catalog/content/` 发布。
- `./scripts/verify.sh check` 和 `./scripts/verify.sh release` 均通过。
- current docs 只描述已实现事实。
- contract docs 只描述当前可依赖合同。
- plans docs 只保留未完成工作。
