# Catalog Import Workflow

本文是日常更新旧项目和 root 专题数据的操作手册。它说明如何把人工或 AI 整理结果先放进 `.tmp/import-batches/`，再通过脚本安全进入正式 `catalog/projects/` 和 `catalog/collections/`。

Content bundle import 使用 [`content-import-workflow.md`](./content-import-workflow.md)，不使用本文流程。

## Mental Model

```text
notes / AI output / manual draft
  -> .tmp/import-batches/<batch-id>/
  -> import validate
  -> import plan
  -> import diff
  -> import apply
  -> catalog/
  -> build gate
```

`catalog/` 永远是正式数据源。`.tmp/import-batches/` 只是中间交换区，用来让不可信或未审核的整理结果先接受合同校验。

## Responsibility

本手册负责：

- 批量新增项目。
- 替换单个项目目录。
- 新增或替换专题。
- 从 `docs/notes/` 或 AI 输出安全导入 catalog 数据。
- 说明人工审核和失败处理顺序。

本手册不负责：

- 定义 `project.yaml` 字段。见 [`../contract/project-config.md`](../contract/project-config.md)。
- 定义 `collection.yaml` 字段。见 [`../contract/collection-config.md`](../contract/collection-config.md)。
- 定义 import batch 格式。见 [`../contract/catalog-import-batch.md`](../contract/catalog-import-batch.md)。
- 变更 schema、loader、block 类型或详情格式。见 [`catalog-contract-iteration.md`](./catalog-contract-iteration.md)。

## When To Use

优先使用 import workflow 的场景：

- 一次新增多个 GitHub 项目。
- 从笔记、网页摘要或 AI 输出整理 catalog 数据。
- 替换一个已有项目的 `project.yaml` 和 `details.md`。
- 替换一个已有专题的 `collection.yaml` 和 `details.md`。
- 需要先看 `plan` 或 `diff`，再决定是否写入正式数据。

可以不使用 import workflow 的场景：

- 新增单个项目骨架：使用 `./scripts/catalog.sh new ...`。
- 新增或维护单个专题：使用 `./scripts/catalog.sh collection ...`。
- 只改前端展示、布局、样式，不涉及 `catalog/` 数据。

## Batch Shape

批次目录、`manifest.yaml`、operation 字段、payload 文件和能力边界由 [`../contract/catalog-import-batch.md`](../contract/catalog-import-batch.md) 定义。本手册不重复字段表。

操作前只需要确认两件事：

- 批次位于 `.tmp/import-batches/<batch-id>/`。
- 批次内容已经按 import batch 合同生成。

## Operation Modes

日常维护时只需要按意图选择操作：

- 新增项目或专题：使用 `create`。
- 替换已有项目或专题：使用 `replace`，应用时传 `--allow-replace`。
- 删除已有项目或专题：使用 `delete`，应用时传 `--allow-delete`。

具体 action 语义和限制见 [`../contract/catalog-import-batch.md`](../contract/catalog-import-batch.md)。

## AI Output Rules

让 AI 生成数据时，要求它只输出 import batch，不要直接修改 `catalog/`。

可直接引用这个约束：

```text
请只生成 .tmp/import-batches/<batch-id>/。
不要直接修改 catalog/。
manifest.yaml 必须符合 docs/contract/catalog-import-batch.md。
project payload 必须符合 docs/contract/project-config.md。
collection payload 必须符合 docs/contract/collection-config.md。
category、tags 和 maintenance_status 必须从 docs/contract/taxonomy-config.md 对应的 taxonomy id 中选择。
不确定的信息不要编造成机器字段；可以写入 details.md 的说明或保持字段缺省。
```

AI 生成内容时要避免：

- 自动新增 taxonomy。
- 猜测 GitHub stars、last activity、维护状态。
- 把模型许可证误写成项目代码许可证。
- 把选择建议、优缺点、部署难度写成未入 schema 的顶层字段。
- 新增 `custom`、`extra`、`extensions` 等自由结构字段。

## Main Flow

1. 生成或整理 `.tmp/import-batches/<batch-id>/`。
2. 校验批次。

   ```sh
   ./scripts/catalog.sh import validate .tmp/import-batches/<batch-id>
   ```

   `validate` 会同时检查当前 `catalog/` 状态：`create` 目标必须不存在，`replace` / `delete` 目标必须存在。已经应用过的 `create` 批次不能重复作为新建批次验证；需要重新生成 batch，或把 manifest 调整为明确的 `replace` 语义后再走差异审查。

3. 查看操作计划。

   ```sh
   ./scripts/catalog.sh import plan .tmp/import-batches/<batch-id>
   ```

4. 对替换操作查看差异。

   ```sh
   ./scripts/catalog.sh import diff .tmp/import-batches/<batch-id>
   ```

5. 应用批次。

   ```sh
   ./scripts/catalog.sh import apply .tmp/import-batches/<batch-id> --allow-replace
   ```

6. 必要时再跑完整验证。

   ```sh
   ./scripts/verify.sh check
   ```

包含 `delete` 时必须额外传 `--allow-delete`。

## Review Checklist

应用前人工检查：

```text
[ ] manifest 只声明本次想执行的 item 级操作。
[ ] create 没有覆盖已有项目或专题。
[ ] replace 的 diff 符合预期。
[ ] delete 没有删除仍被项目关系或专题引用的项目。
[ ] repo URL 是明确的 GitHub 仓库地址。
[ ] summary 简短、克制，没有排名式或广告式判断。
[ ] category、tags 和 maintenance_status 来自 catalog/taxonomies.yaml。
[ ] details.md 只承载长文说明，不承载机器可筛选字段。
[ ] collection 只保存策展顺序、note 和 publication_status，不复制项目事实。
[ ] publication_status 符合当前审核程度。
```

## Failure Handling

`validate` 失败时：

- 修改 `.tmp/import-batches/<batch-id>/`。
- 不要绕过脚本直接写 `catalog/`。
- 重新运行 `validate` 和 `plan`。

`apply` 失败时：

- 脚本会回滚本次已写入的 item 目录。
- 需要确认正式 catalog 是否健康时，运行 `./scripts/catalog.sh validate`。
- 需要修复 batch 时，修改 `.tmp/import-batches/<batch-id>/`，再重新运行 `import validate`、`plan` 和必要的 `diff`。
- 如果失败发生在构建验证阶段，优先修复 batch payload，再重新 apply。

批次过期时：

- 已经成功 apply 的 `create` 批次再次运行通常会失败，因为目标目录已经存在。
- 这不是异常。需要继续更新时，生成新的 batch，并把对应操作改成 `replace`。

留下写锁时：

- 写锁路径是 `.data/catalog-write.lock`。
- 只有确认没有 catalog 写操作正在运行时，才手动删除该锁目录。

## Common Scenarios

新增一组项目：

```yaml
operations:
  - target: project
    id: example-a
    action: create
    path: ./projects/example-a
  - target: project
    id: example-b
    action: create
    path: ./projects/example-b
```

替换一个项目：

```yaml
operations:
  - target: project
    id: example-a
    action: replace
    path: ./projects/example-a
```

新增专题：

```yaml
operations:
  - target: collection
    id: example-collection
    action: create
    path: ./collections/example-collection
```

替换专题：

```yaml
operations:
  - target: collection
    id: example-collection
    action: replace
    path: ./collections/example-collection
```

## Maintenance Notes

当 import batch 合同变化时，先更新可执行代码，再更新 [`../contract/catalog-import-batch.md`](../contract/catalog-import-batch.md)，最后更新本手册。

当项目或专题字段变化时，先更新 schema/loader，再更新 [`../contract/project-config.md`](../contract/project-config.md) 或 [`../contract/collection-config.md`](../contract/collection-config.md)。本手册只补操作步骤，不重复字段表。
