# Content Import Batch Contract

本文解释当前已经实现的 `content-import-batch` 交换合同。可执行真相源是 `scripts/content/content-import-cli.mjs`、`src/lib/catalog/catalog-schema.js` 和 `src/lib/catalog/content-validator.js`。

Content import 只写入 `catalog/content/drafts/`。导入不会发布内容；公开发布必须继续使用 `./scripts/content.sh publish <hall> <item|collection> <id>`。

## Directory

批次必须位于 `.tmp/import-batches/<batch-id>/`，并且 `<batch-id>` 必须是小写 kebab-case。

```text
.tmp/import-batches/<batch-id>/
  manifest.yaml
  items/<hall>/<id>/
    item.yaml
    index.md
    notes/<note-id>.md
  collections/<hall>/<id>/
    collection.yaml
    index.md
```

`items/` 和 `collections/` 只保存 manifest 显式声明的 bundle。批次目录内不允许 symlink。

## Manifest

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

| Field | Rule |
| --- | --- |
| `schema_version` | 必须是 `1`。 |
| `kind` | 必须是 `content-import-batch`。 |
| `batch_id` | 必须匹配批次目录名。 |
| `source.type` | 必须是 `manual` 或 `ai`。 |
| `source.model` | 可选，记录 AI 生成来源。 |
| `source.notes` | 可选，记录人工审阅备注。 |
| `mode` | 当前必须是 `scoped`。 |
| `operations` | 至少一条操作。 |

Operation 字段：

| Field | Rule |
| --- | --- |
| `target` | 必须是 `item` 或 `collection`。 |
| `hall` | 必须是小写 kebab-case，并匹配 payload 的 `hall`。 |
| `id` | 必须是小写 kebab-case，并匹配 payload 的 `id`。 |
| `state` | 当前只能是 `drafts`。 |
| `action` | 必须是 `create`、`replace` 或 `delete`。 |
| `path` | 可选；非 delete 操作如果提供，必须等于默认路径。delete 不允许设置 `path`。 |

默认路径：

```text
target: item       -> ./items/<hall>/<id>
target: collection -> ./collections/<hall>/<id>
```

## Actions

| Action | Rule |
| --- | --- |
| `create` | 目标 `(hall, target, id)` 不能存在于 `drafts`、`published` 或 `archived`。 |
| `replace` | 只能替换 `catalog/content/drafts/` 中已有的同一 bundle，需要 `--allow-replace`。 |
| `delete` | 只能删除 `catalog/content/drafts/` 中已有的同一 bundle，需要 `--allow-delete`。 |

`replace` 是整 bundle 目录替换，不做文件级合并。`delete` 不读取 payload 目录。

## Commands

```sh
./scripts/content.sh import validate .tmp/import-batches/<batch-id>
./scripts/content.sh import plan .tmp/import-batches/<batch-id>
./scripts/content.sh import diff .tmp/import-batches/<batch-id>
./scripts/content.sh import apply .tmp/import-batches/<batch-id>
./scripts/content.sh import apply .tmp/import-batches/<batch-id> --allow-replace
./scripts/content.sh import apply .tmp/import-batches/<batch-id> --allow-delete
```

`apply` 会加 `.data/catalog-write.lock`，写入 `catalog/content/drafts/`，然后运行 `./scripts/verify.sh catalog`。验证失败时会回滚已经写入的 bundle。

## Payload

Item payload 必须符合 [`content-bundle-config.md`](./content-bundle-config.md) 的 `item.yaml` 合同。Collection payload 必须符合同一文档的 `collection.yaml` 合同。

导入预检会校验：

- manifest schema。
- 批次路径必须留在 `.tmp/import-batches/` 内。
- 批次目录不能包含 symlink。
- 非 delete 操作必须有默认 payload 路径。
- payload `id` 和 `hall` 必须匹配 operation。
- body 和 notes 文件必须存在、不是 symlink、不能越出 bundle。
- create/replace/delete 的 drafts 目标状态。

最终合法性仍由 `./scripts/verify.sh catalog` 和 `src/lib/catalog/content-validator.js` 判断。
