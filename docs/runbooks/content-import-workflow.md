# Content Import Workflow

本文说明当前已实现的 content import batch 流程。它用于把人工或 AI 整理结果批量写入 `catalog/content/drafts/`。

导入不会发布内容。发布必须单独执行 `content.sh publish`，并通过 `verify.sh release`。

## Flow

```text
AI or manual source
  -> .tmp/import-batches/<batch-id>/
  -> content.sh import validate
  -> content.sh import plan
  -> content.sh import diff
  -> content.sh import apply
  -> catalog/content/drafts/
  -> edit/review
  -> content.sh publish
```

## Create Batch

```text
.tmp/import-batches/example-content-batch/
  manifest.yaml
  items/models/example-model/
    item.yaml
    index.md
```

`manifest.yaml`:

```yaml
schema_version: 1
kind: content-import-batch
batch_id: example-content-batch
source:
  type: manual
mode: scoped
operations:
  - target: item
    hall: models
    id: example-model
    state: drafts
    action: create
```

## Validate, Plan, Diff

```sh
./scripts/content.sh import validate .tmp/import-batches/example-content-batch
./scripts/content.sh import plan .tmp/import-batches/example-content-batch
./scripts/content.sh import diff .tmp/import-batches/example-content-batch
```

`validate` 只检查 batch 合同、payload 和 drafts 目标状态。`plan` 输出将执行的操作。`diff` 对 create/delete 输出摘要，对 replace 使用 `git diff --no-index`。

## Apply

```sh
./scripts/content.sh import apply .tmp/import-batches/example-content-batch
```

`apply` 只写入 `catalog/content/drafts/`。写入后会运行：

```sh
./scripts/verify.sh catalog
```

验证失败时会回滚已经写入的 bundle。

## Replace And Delete

Replace 和 delete 需要显式授权：

```sh
./scripts/content.sh import apply .tmp/import-batches/example-content-batch --allow-replace
./scripts/content.sh import apply .tmp/import-batches/example-content-batch --allow-delete
```

`replace` 是整 bundle 目录替换。`delete` 只删除 drafts 中的 bundle，不会删除 published 或 archived 内容。

## Publish

导入完成后，发布仍走单条命令：

```sh
./scripts/content.sh publish models item example-model
```

`publish` 会运行 `./scripts/verify.sh release`。不要通过 import batch 直接写入 `published`。

## Boundaries

- Content import batch 的合同见 [`../contract/content-import-batch.md`](../contract/content-import-batch.md)。
- Import batch 不是长期内容源；导入成功后，正式来源是 `catalog/content/drafts/`。
