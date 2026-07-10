# Roadmap

本文只记录尚未实现但值得继续推进的工作。已经实现的事实应移动到 `docs/current/`，配置合同应写在 `docs/contract/`。

## Remaining Gaps

- 本地搜索和客户端筛选尚未实现。
- GitHub stars、license 刷新、last activity 等生成元数据尚未自动化。
- `media-gallery` block 尚未实现。
- MDX 和 HTML 详情格式尚未实现。

## Planned Work

- 增加基于项目名称、摘要、分类、标签的本地搜索。
- 如果内容编辑变慢，增加更窄的配置验证命令。
- 增加单独的 generated metadata 数据面，避免覆盖手写项目事实。
- 资产发布策略稳定后，增加 `media-gallery` block。
- 安装并验证 Astro MDX integration 后，再考虑 MDX 详情。
- 实现安全 sanitization 和渲染隔离后，再考虑 HTML 详情。

## Acceptance

- 搜索不需要修改 content item core 合同。
- generated metadata 不覆盖手写项目事实。
- 缺失文件、未知标签、错误 related project id 在部署前失败。
- 新 block type 必须有 schema、adapter、renderer、样例数据和文档。
- MDX 或 HTML 详情只有在 build-time validation 覆盖后才能进入合同。
