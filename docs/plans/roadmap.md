# Roadmap

本文只记录尚未实现但值得继续推进的工作。已经实现的事实应移动到 `docs/current/`，配置合同应写在 `docs/contract/`。

## Remaining Gaps

- Hall 内筛选尚未实现；当前已有全站搜索、最近新增和 `search-index.json`。
- GitHub stars、license 刷新、last activity 等生成元数据尚未自动化。
- `media-gallery` block 尚未实现。
- MDX 详情格式尚未实现。

## Planned Work

- 设计 hall 内筛选能力，复用现有 search projection，不修改 content item core 合同。
- 增加单独的 generated metadata 数据面，避免覆盖手写项目事实。
- 资产发布策略稳定后，增加 `media-gallery` block。
- 安装并验证 Astro MDX integration 后，再考虑 MDX 详情。

## Acceptance

- Hall 内筛选不需要修改 content item core 合同。
- generated metadata 不覆盖手写项目事实。
- 缺失文件、未知标签、错误 related project id 在部署前失败。
- 新 block type 必须有 schema、adapter、renderer、样例数据和文档。
- MDX 详情只有在 build-time validation 覆盖后才能进入合同。
