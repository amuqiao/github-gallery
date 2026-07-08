# Git 规则

- 提交必须保持单一意图，不混入无关改动；跨主题改动应拆分提交。
- 提交前确认改动范围、提交主题、入口文档或规则文件同步情况。
- 提交前完成最小必要验证；无法验证时说明原因和剩余风险。
- 提交信息默认使用中文；无仓库规范时优先使用 Conventional Commits，例如 `docs:`、`feat:`、`fix:`、`refactor:`、`chore:`。
- 提交信息优先写“改了什么”和对象，不写空泛标题。
- 只在用户明确要求时提交；非明确要求下不做 `amend`，不改写历史。

# 配置维护规则

- 配置规则真源是 `src/lib/catalog/catalog-schema.js`。新增、删除或重命名字段时，先改 schema，再同步 loader、脚本和文档。
- 内容真源位于 `catalog/`：项目使用 `catalog/projects/<id>/project.yaml`，专题使用 `catalog/collections/<id>/collection.yaml`，站点配置使用 `catalog/site.yaml`。
- 受控词表真源是 `catalog/taxonomies.yaml`，只维护项目内容会引用的词表：`categories`、`tags`、`project_maintenance_statuses`。
- 项目维护状态字段必须叫 `maintenance_status`，引用 `catalog/taxonomies.yaml` 的 `project_maintenance_statuses[].id`。
- 专题发布状态字段必须叫 `publication_status`，枚举 `published`、`draft`、`archived`，不放入 taxonomy。
- 不使用裸 `status` / `statuses` 表达配置字段，除非是在子进程退出码等非 catalog 语义中使用。
- 展示配置属于 `src/presentation/`，例如项目维护状态的视觉 tone 位于 `src/presentation/maintenance-status-tones.ts`，专题发布状态的显示文案位于 `src/presentation/publication-status-labels.ts`；不要把颜色、布局或卡片样式写进 `project.yaml` 或 `collection.yaml`。
- 文档只解释已实现规则，不作为项目依赖。可执行真相源始终是 schema、loader 和脚本验证。
