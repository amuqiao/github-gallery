# Content Workflow Test Plan

## Current Baseline

- `catalog/content/{drafts,published,archived}/<hall>/items|collections/` 是公开展馆内容的唯一内容源。
- `scripts/content.sh` 是内容维护入口，当前支持 item 草稿创建、item note 添加、collection 草稿创建、content import batch、publish、archive、restore，以及只读 `list`、`show`、`status` 查询。
- `scripts/verify.sh check` 会运行 fast catalog gate、Astro check 和 static build。
- `scripts/verify.sh release` 会运行 content release gate、Astro check 和 static build。
- `scripts/content.sh` 写操作会加 `.data/catalog-write.lock`，写入或移动失败时会尝试回滚。
- `scripts/content-workflow-test.sh` 已作为独立测试入口存在。当前 Phase 5 覆盖仓库外隔离副本、主仓库前后状态检查、成功清理、失败留痕，GitHub item、模型 item、Markdown note、HTML note、同馆 collection 的创建、发布、归档、恢复、手工编辑、重新发布、只读 list/show/status、列表可见性和渲染内容断言，import batch 的 create、replace、delete、drafts-only 和最小回滚路径，以及确定性失败/幂等边界。
- `scripts/content-workflow-test.sh` 当前不会写入真实 `catalog/content/`，也不会默认进入 `scripts/verify.sh check`；真实生命周期测试只在仓库外副本执行。
- 为了避免在测试里联网安装依赖，隔离副本在确认初始复制没有包含 `node_modules/` 后，会把主仓库已有 `node_modules/` 复制到临时副本中执行 Astro build，构建缓存和副作用只留在临时目录。
- 成功和失败退出路径都会比较主仓库 `git status` 与忽略路径递归 checksum，降低失败时漏报主仓库污染的风险。

## Remaining Gaps

- `content.sh` 目前不是完整 CRUD 管理面：安全删除等管理命令仍未设计，暂不提供物理删除入口。
- import apply 的重复执行语义尚未完整固定：重复 create、replace、delete 的退出码和状态保持需要继续扩展测试。
- 新展馆上线时缺少统一测试矩阵，容易只更新页面或 schema，遗漏脚本和发布门禁。

## Planned Work

### Phase 2: Cover Happy Path Lifecycle

- 在隔离副本中创建一个 GitHub 展馆测试 item 草稿。
- 在隔离副本中创建一个模型展馆测试 item 草稿。
- 为测试 item 添加 Markdown note。
- 为测试 item 添加 HTML fragment note。
- 创建同 hall collection 草稿，并引用测试 item。
- 发布 item，再发布 collection。
- 运行 `scripts/verify.sh release`，确认 published item、note 和 collection 生成 canonical routes。
- 检查 published item 和 collection 出现在对应展馆与专题列表页。
- 归档 collection 和 item，确认公开路由不再生成。
- 检查 archived item 和 collection 从对应展馆与专题列表页消失。
- restore 到 drafts，编辑生成的 Markdown 或 HTML 内容，再次 publish。
- 每次 build 后检查隔离副本 `dist/` 中具体 route 文件存在或不存在，并在重新发布后检查编辑过的内容已经渲染到目标 HTML，而不是只依赖 `verify.sh release` 成功。

### Phase 3: Cover Import Batch Lifecycle

- 覆盖 import batch 的 `validate`、`plan`、`diff` 和 `apply create`，确认 import 只写入 drafts。
- 覆盖 import batch 的 `apply replace --allow-replace` 和 `apply delete --allow-delete`，确认替换和删除只作用于隔离副本中的 drafts。
- 验证 `replace` 缺少 `--allow-replace`、`delete` 缺少 `--allow-delete` 时会失败，并且不会改变 drafts。
- 验证 import create 后 drafts 内容不会进入 `dist/`，发布仍必须显式调用 `content.sh publish`。
- 覆盖 import apply 验证失败时的最小回滚路径，确认已写入的目标 drafts bundle 会被回滚，写锁不会残留。

### Phase 4: Cover Failure And Idempotency Semantics

- 重复 `item new` 应失败，并且不破坏已有 draft。
- 重复 `item note add` 应失败，并且不破坏已有 note 和 `item.yaml`。
- collection 引用不存在 item 应在验证阶段失败，并回滚新建目录。
- published collection 引用 draft item 应在 release gate 失败。
- 对已 published bundle 重复 publish 应失败，并保持 published 内容不变。
- 对已 archived bundle 重复 archive 应失败，并保持 archived 内容不变。
- 对非 archived bundle restore 应失败，并保持现有状态不变。
- planned hall 写入 content bundle 应失败，并保持原仓库现场不变。
- published collection 引用 published item 时，先 archive item 应失败并回滚 item 到 published。
- item 仍 archived 时先 restore collection 应失败并回滚 collection 到 archived。
- import apply 或普通状态移动被中断后，应能证明 lock、backup、staging 目录不会污染原仓库；需要人工恢复时必须输出隔离副本路径和残留位置。
- 失败路径应检查退出码非 0、错误信息可定位，并比较失败前后的隔离副本内容快照。

### Phase 5: Add Script Capability Feedback Loop

- workflow test 需要查询状态时不再依赖 `find` 或手写路径判断，`content.sh` 提供只读命令：
  - `list [[drafts|published|archived] [hall] | [hall]]`
  - `show <hall> <item|collection> <id>`
  - `status <hall> <item|collection> <id>`
- 测试脚本需要验证时直接调用 `scripts/verify.sh` 或复用内部 helper，不给 `content.sh` 增加 `validate`，避免验证入口和内容管理入口重叠。
- 如果需要物理删除测试草稿，优先在隔离副本中直接删除；不要先给生产内容入口增加默认 delete。
- 只有在明确需要人工内容删除流程时，再设计 `delete --force`，并单独测试确认不会误删 published 内容。

### Phase 6: Decide Optional Verification Integration

- `scripts/content-workflow-test.sh` 保持为独立入口，适合本地回归和 CI 深度检查。
- `scripts/verify.sh check` 不默认调用 workflow test，避免每次构建都复制仓库和跑全生命周期。
- 只有在独立入口稳定后，才评估是否增加显式命令 `scripts/verify.sh content-workflow` 转发调用 `scripts/content-workflow-test.sh`。
- 发布前人工 checklist 可选择运行：

```sh
./scripts/verify.sh check
./scripts/content-workflow-test.sh
```

## Test Matrix

| Area | Required Coverage |
| --- | --- |
| GitHub item | `item new github github_project`、Markdown body、publish、archive、restore、republish |
| Model item | `item new models ai_model`、Markdown body、Markdown note、HTML note、publish、archive、restore、republish |
| Collection | `collection new`、同 hall item 引用、publish、archive、restore |
| Import batch | `import validate`、`plan`、`diff`、`apply create`、`apply replace --allow-replace`、`apply delete --allow-delete`、缺少授权失败、最小回滚 |
| Read-only commands | `list [[state] [hall] | [hall]]`、`show <hall> <item|collection> <id>`、`status <hall> <item|collection> <id>` |
| Published routes | `/halls/<hall>/items/<id>/`、`/notes/<note>/`、`/collections/`、`/collections/<id>/` |
| Draft isolation | drafts 内容不进入 `dist`，不进入展馆列表 |
| Archived isolation | archived 内容不进入 `dist`，restore 后只回到 drafts |
| Planned hall | planned hall 不能创建 content bundle，planned collections route 不生成 |
| Idempotency | 重复执行和错误顺序失败时退出码非 0，已有 bundle、notes、collections 不变 |
| Route files | published route 对应 `dist/**/*.html` 存在，draft 和 archived route 对应文件不存在 |
| Cleanup | 原仓库测试前后状态一致，且测试不在原仓库内创建目录 |

## Phase 2 Acceptance

- `scripts/content-workflow-test.sh` 在隔离副本中运行全生命周期测试。
- 测试前后原仓库工作区状态一致；测试不得修改、删除或新增真实 `catalog/content/` 内容，也不得在原仓库内创建测试目录。
- 成功运行必须清理隔离副本；失败运行默认保留隔离副本并打印路径，可通过 `--cleanup-on-fail` 改为失败后清理。
- 测试能证明 GitHub item、model item、Markdown note、HTML note 和 collection 的 draft、publish、archive、restore、republish 路径可用。
- 测试能通过检查隔离副本 `dist/` 具体文件证明 published route 生成，draft 和 archived route 不生成。
- 测试能证明 published fixture 出现在展馆/专题列表页，archived fixture 从列表页消失。
- 测试能证明手工编辑后的 Markdown 和 HTML 内容在重新发布后渲染到公开 HTML。
- 测试输出必须列出每个生命周期步骤、断言结果、失败命令、退出码；失败时保留隔离目录并打印路径。

## Phase 3 Acceptance

- 测试能证明 import batch 的 `validate`、`plan`、`diff`、`apply create`、`apply replace --allow-replace` 和 `apply delete --allow-delete` 路径可用。
- 测试能证明 import create 和 replace 只写入隔离副本中的 `catalog/content/drafts/`，不会生成公开 route，也不会进入模型展馆页或专题列表页。
- 测试能证明 replace 和 delete 缺少显式 `--allow-*` 参数时会失败，并且失败后 drafts 保持原状态。
- 测试能证明 import apply 在 catalog 验证失败后会回滚已写入 drafts bundle，并清理 `.data/catalog-write.lock`。

## Phase 4 Acceptance

- 测试能证明重复 `item new`、重复 `item note add`、重复 `publish`、重复 `archive`、非 archived `restore` 都会失败，并且目标 bundle 快照保持不变。
- 测试能证明 collection 引用不存在 item、published collection 引用 draft item、planned hall 写入 content bundle 都会失败，并回滚新增目录或状态移动。
- 测试能证明 published collection 仍引用 published item 时，先 archive item 会失败并回滚 item 到 published。
- 测试能证明 item 仍 archived 时先 restore collection 会失败并回滚 collection 到 archived。
- 失败断言必须检查错误输出包含可定位原因，并确认 `.data/catalog-write.lock` 不残留。

## Phase 5 Acceptance

- `content.sh list [[drafts|published|archived] [hall] | [hall]]` 能以稳定 TSV 输出 state、hall、type、id 和 title。
- `content.sh list` 能过滤点号临时目录，未知 hall 和 planned hall 不能被误判为空结果。
- `content.sh status <hall> <item|collection> <id>` 能输出单个 bundle 当前 state 和目录路径，不存在时失败。
- `content.sh show <hall> <item|collection> <id>` 能输出匹配 bundle 的 YAML，并在头部标注 state 和 path。
- 只读命令不加 catalog write lock，不触发 `verify.sh`，也不触发 Astro build。
- `content-workflow-test.sh` 覆盖只读命令成功路径、表头/path 输出、missing status 退出码、未知 hall 失败、点号临时目录过滤和代表性路径快照。

## Final Acceptance

- 测试能证明重复 import apply 和更复杂 import 失败回滚不会破坏已有内容。
- 测试能覆盖中断或模拟中断后的 lock、backup、staging 清理或人工恢复提示。
- 当测试入口稳定后，把已实现事实移动到 `docs/current/` 或 `scripts/README.md`，并关闭或缩减本计划。
