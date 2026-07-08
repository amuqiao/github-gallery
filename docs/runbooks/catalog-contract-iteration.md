# Catalog Contract Iteration Runbook

本手册说明如何稳定迭代 GitHub Gallery 的配置合同。核心原则是：schema 定义字段级合同，loader 执行跨文件不变量，build 负责验证门禁，docs 只解释已实现规则。

## Mental Model

```text
schema 定规则
  -> loader 执行规则
  -> build 验证规则
  -> docs 解释规则
```

这四层不能倒置。不要先在文档里发明字段，再让配置和页面跟着猜；也不要让页面绕过 loader 直接读取 YAML。

字段形状归 schema；目录名、taxonomy、引用文件、related projects 这类跨文件不变量归 loader。

第一版不保留无类型 `extensions` 顶层字段。任何实验内容进入配置前，都必须先明确它属于 stable core、typed block，还是未来独立数据面。

## Authority

| Layer | Canonical location | Owns |
| --- | --- | --- |
| Schema | `src/lib/catalog/project-schema.ts` | 可执行配置合同。 |
| Project loader | `src/lib/catalog/projects.ts` | project YAML 读取、schema parse、taxonomy 校验、项目关系校验、project read model。 |
| Collection loader | `src/lib/catalog/collections.ts` | collection YAML 读取、schema parse、专题引用项目校验、collection read model。 |
| Block adapters | `src/lib/catalog/block-adapters.ts` | typed blocks 的归一化和默认标题。 |
| Detail loader | `src/lib/catalog/details.ts` | 已实现项目和专题详情格式的加载。 |
| Build gate | `./scripts/verify.sh check` | 统一验证入口；当前委托 `npm run build`。 |
| Script entrypoints | `scripts/` | 本地开发、验证和 catalog 维护的人类操作入口。 |
| Import batch | `.tmp/import-batches/<batch-id>/` | AI 或人工整理结果进入正式 catalog 前的中间交换合同。 |
| Contract docs | `docs/contract/` | 对可执行合同的人类说明。 |
| Current docs | `docs/current/` | 当前已实现结构和运行路径。 |
| Plans | `docs/plans/` | 未来缺口和验收条件。 |
| Runbooks | `docs/runbooks/` | 可重复维护流程。 |

## When Adding Or Changing A Project Field

按这个顺序执行：

1. 判断字段属于 stable core 还是 typed block。
2. 更新 `src/lib/catalog/project-schema.ts`。
3. 只有字段需要跨文件校验、归一化、索引或 helper 时，才更新 `src/lib/catalog/projects.ts`。
4. schema 接受后，再更新示例 `catalog/projects/<id>/project.yaml`。
5. 更新 `docs/contract/project-config.md` 解释字段。
6. 如果运行路径或模块边界变化，更新 `docs/current/structure.md`。
7. 如果打开或关闭未来缺口，更新 `docs/plans/roadmap.md`。
8. 运行 `./scripts/verify.sh check`。

不要把 `docs/contract/project-config.md` 当成真相源。文档和 schema/loader 不一致时，以可执行代码为准，修文档。

可选详情页内容优先使用 typed block。只有通用路由、筛选、身份、跨项目校验需要依赖时，才新增顶层 core 字段。

`meta` 只放人工维护、相对稳定的展示事实。抓取时间、stars、last activity 等自动生成事实应进入未来的 generated metadata 数据面，不放入 `project.yaml`。

## When Adding A Block Type

按这个顺序执行：

1. 在 `src/lib/catalog/project-schema.ts` 增加 block schema。
2. 在 `src/lib/catalog/block-adapters.ts` 增加 adapter。
3. 在 `src/components/blocks/` 增加或更新 renderer。
4. 在至少一个 `catalog/projects/<id>/project.yaml` 中加入样例 block。
5. 更新 `docs/contract/project-config.md`。
6. 如果运行路径变化，更新 `docs/current/structure.md`。
7. 运行 `./scripts/verify.sh check`。

不要添加 `custom` 或自由结构 block。未知 block type 必须构建失败。

不要因为只是换了展示标题就新增 block type。新增 type 必须至少满足一个条件：需要不同数据结构、需要不同 adapter 归一化、需要不同 renderer，或未来有明确机器语义会被筛选、索引、校验使用。

## When Adding A Project

按这个顺序执行：

1. 创建 `catalog/projects/<id>/`，或使用 `./scripts/catalog.sh new <id> ...` 生成骨架。
2. 添加或补全 `catalog/projects/<id>/project.yaml`。
3. 声明 `details` 时，添加 `catalog/projects/<id>/details.md`。
4. 只使用 `catalog/taxonomies.yaml` 中存在的 category、tag 和 status id。
5. `relations.related_projects` 只能引用已经存在的项目 id。
6. 运行 `./scripts/catalog.sh validate` 或 `./scripts/verify.sh check`。

项目目录名必须匹配 `project.yaml` 的 `id`。

批量新增或由 AI 生成项目数据时，不要直接写入 `catalog/`。先生成 `.tmp/import-batches/<batch-id>/`，再按 [`catalog-import-workflow.md`](./catalog-import-workflow.md) 操作。

## When Adding A Collection

按这个顺序执行：

1. 优先使用 `./scripts/catalog.sh collection new <id> ...` 创建专题。
2. 至少传入一个 `--project <id>`。
3. 需要详情正文时传入 `--details`。
4. 创建后脚本会自动运行 `./scripts/verify.sh catalog`。
5. 手写维护时，仍必须保证 `id` 和目录名一致，并运行 `./scripts/verify.sh check`。

专题只保存策展顺序和可选备注，不复制项目事实。

常用命令：

```sh
./scripts/catalog.sh collection new voice-cloning \
  --title "声音克隆项目" \
  --summary "适合研究声音克隆项目。" \
  --status draft \
  --project gpt-sovits \
  --project xtts \
  --details

./scripts/catalog.sh collection add-project voice-cloning cosyvoice --note "适合研究情绪和指令控制。"
./scripts/catalog.sh collection set-status voice-cloning published
```

批量新增或替换专题时，同样优先使用 [`catalog-import-workflow.md`](./catalog-import-workflow.md)。`replace` 是整 item 目录替换，适合一个专题自己的 `collection.yaml` 和 `details.md` 一起更新。

## When Adding Or Changing A Collection Field

按这个顺序执行：

1. 判断字段属于专题 stable core、`items` 策展备注，还是 typed block。
2. 更新 `src/lib/catalog/project-schema.ts`。
3. 字段需要跨文件校验、公开过滤、索引或 read model 时，更新 `src/lib/catalog/collections.ts`。
4. 字段影响详情加载格式时，更新 `src/lib/catalog/details.ts`。
5. 更新 `docs/contract/collection-config.md` 解释字段。
6. 如果运行路径或页面角色变化，更新 `docs/current/structure.md` 和 `docs/current/frontend-navigation.md`。
7. 运行 `./scripts/verify.sh check`。

不要把 collection 字段反向写入 `project.yaml`。专题字段只描述专题本身。

## When Adding A Category Or Tag

按这个顺序执行：

1. 先把 category 或 tag 加到 `catalog/taxonomies.yaml`。
2. 同时提供 `name.zh`、`name.en`、`description.zh` 和 `description.en`。
3. 再从项目配置中引用它。
4. 更新时遵守 [`../contract/taxonomy-config.md`](../contract/taxonomy-config.md)。
5. category 保持宽泛稳定。
6. tag 用于更窄或领域相关的含义。
7. 运行 `./scripts/verify.sh check`。

category id 和 tag id 是对外 URL 标识。重命名属于路由变更。

当前 taxonomy 是固定 `zh/en` 双语 registry。新增第三语言不是纯数据变更，必须先更新 schema、loader 和 import CLI。

## When Adding A Project Status

按这个顺序执行：

1. 先把 status 加到 `catalog/taxonomies.yaml` 的 `statuses`。
2. 同时提供 `name.zh`、`name.en`、`description.zh` 和 `description.en`。
3. 如果前端会渲染它，在 `src/presentation/status-tones.ts` 增加对应 tone。
4. 再从项目配置的 `status` 中引用它。
5. 运行 `./scripts/verify.sh check`。

status id 是项目维护状态合同，不是筛选分类。具体视觉 tone 属于 presentation 层，不进入 taxonomy 数据合同。

## When Importing AI-Generated Catalog Data

适用场景：模型把 `docs/notes/` 或其他输入资料整理成项目需要的数据格式，但还不能直接信任输出内容。

日常操作流程见 [`catalog-import-workflow.md`](./catalog-import-workflow.md)。本节只保留合同迭代边界。

Import batch 的合同心智模型：

```text
AI/manual output
  -> .tmp/import-batches/<batch-id> exchange contract
  -> import validate preflight
  -> explicit plan
  -> locked apply
  -> schema/loader build gate
  -> catalog/ source of truth
```

当前规则只以 [`../contract/catalog-import-batch.md`](../contract/catalog-import-batch.md) 为准，日常操作见 [`catalog-import-workflow.md`](./catalog-import-workflow.md)。

变更 import batch 能力时：

1. 先更新 `scripts/catalog-import-cli.mjs` 和必要的 schema/loader。
2. 再更新 [`../contract/catalog-import-batch.md`](../contract/catalog-import-batch.md)。
3. 如果操作步骤变化，再更新 [`catalog-import-workflow.md`](./catalog-import-workflow.md)。
4. 运行 `./scripts/verify.sh check` 和最小脚本验证。

## When Changing Site Navigation

按这个顺序执行：

1. 更新 `catalog/site.yaml`。
2. 保持共享 layout 与具体领域解耦。
3. 不要在 `src/layouts/` 里硬编码 `ai` 这类分类 id。
4. 运行 `./scripts/verify.sh check`。

## When Adding A New Detail Format

`schema_version: 1` 只支持 Markdown 详情。准确结构由 `src/lib/catalog/project-schema.ts` 定义，并在 [`docs/contract/project-config.md`](../contract/project-config.md) 解释。

```yaml
details:
  type: markdown
  path: ./details.md
```

未来增加 MDX 或 HTML 时：

1. 先增加必要运行时集成或 sanitization。
2. 在 `src/lib/catalog/project-schema.ts` 增加可执行校验。
3. 更新 `src/lib/catalog/details.ts`。
4. 添加至少一个样例项目覆盖新路径。
5. 更新 `docs/contract/project-config.md`。
6. 从 `docs/plans/roadmap.md` 移出对应计划项。
7. 运行 `./scripts/verify.sh check`。

代码没有验证和构建通过前，不要在 `docs/contract/` 中宣称 MDX 或 HTML 已支持。

## When Using Scripts

`scripts/` 是稳定操作入口，不是配置合同来源。完整脚本说明维护在 [`../../scripts/README.md`](../../scripts/README.md)。

```text
scripts/dev.sh       本地 Astro 开发、预览和构建
scripts/verify.sh    build/catalog/content 一次性验证
scripts/catalog.sh   项目 list、validate、new；专题 list、show、new、delete、add/remove project、set field；import batch validate/plan/diff/apply
```

`./scripts/verify.sh` 不检查 README 或 `docs/`。文档只解释已实现规则，不能成为项目验证依赖。

新增或修改脚本时：

1. 顶层入口只做参数分发、help 和调用现有真相源。
2. 脚本可以做参数级 fast-fail，但不能把这类检查当成配置合同来源。
3. 不在 shell 中重写 `project-schema.ts`、`projects.ts` 或 `collections.ts` 的合同逻辑。
4. `catalog.sh new` 只能写 `catalog/projects/<id>/project.yaml` 和可选 `details.md`，不得自动修改 taxonomy 或猜测 GitHub 元数据。
5. `catalog.sh collection` 只能写 `catalog/collections/<id>/collection.yaml` 和可选 `details.md`，不得修改项目事实。
6. `catalog.sh import` 只能从 `.tmp/import-batches/<batch-id>/` 写入正式 catalog，且只能执行 manifest 显式声明的 item 级操作。
7. `catalog.sh import` 可以做 import 前置快失败校验，但最终必须调用 schema/loader 门禁验证。
8. 写入后必须调用 schema/loader 门禁验证。
9. catalog 写操作必须共用 repo 级写锁。
10. 删除专题必须限制在 `catalog/collections/<id>/` 并要求显式 `--force`。
11. 运行脚本 help 和最小验证。

## Drift Checklist

完成合同相关变更前检查：

```text
[ ] 新字段或变更字段已定义在 `project-schema.ts`。
[ ] 可选详情内容使用 typed block，除非它属于 stable core。
[ ] 新 block type 有 schema、adapter、renderer、样例数据和文档。
[ ] 新 block type 不是仅用于替代 Markdown 小标题或普通列表标题。
[ ] `meta` 没有混入抓取快照或自动生成事实。
[ ] AI 或外部整理结果先进入 `.tmp/import-batches/`，没有直接写入 `catalog/`。
[ ] import batch 只做 scoped item 级 create/replace/delete，没有全量替换 catalog。
[ ] 没有新增无类型 `extensions`、`custom`、`extra` 等逃生口字段。
[ ] 页面仍通过 `src/lib/catalog/projects.ts`，没有直接解析 YAML。
[ ] 专题页面仍通过 `src/lib/catalog/collections.ts`，没有直接解析 YAML。
[ ] 跨文件校验放在 loader，不放在页面组件。
[ ] `docs/contract/` 只解释已实现 schema。
[ ] `docs/current/` 只描述已发布行为。
[ ] `docs/plans/` 只包含未来工作。
[ ] `docs/note.md` 仍是历史笔记，不作为权威来源。
[ ] `./scripts/verify.sh check` 通过。
```

## Anti-Patterns

- 因为文档提到某个 key，就直接把它写进 `project.yaml`，但 schema 不支持。
- 把可选详情内容加成顶层字段，而不是 typed block。
- 添加绕开 schema 的自由结构 `custom` block。
- 在 loader 中添加 fallback 默认值来隐藏错误配置。
- 让页面为了某个展示需求直接读取 YAML。
- 在 shell 脚本里重新实现一套 catalog schema。
- 让 AI 输出直接覆盖 `catalog/`，跳过 import batch 预检。
- 用全量目录替换绕过 item 级 plan 和显式授权。
- 重复表达 category 或 tag 已经表达的含义。
- 把未来的 MDX、HTML、generated metadata、search 行为写成当前事实。
