# Catalog Import Batch Contract

本文解释当前已经实现的 `.tmp/import-batches/<batch-id>/` 交换合同。批次编排规则的可执行真相源是 `scripts/catalog-import-cli.mjs`；项目和专题 payload 的最终合同仍由 `src/lib/catalog/project-schema.ts`、`src/lib/catalog/projects.ts` 和 `src/lib/catalog/collections.ts` 验证。

## Purpose

Import batch 是外部整理结果进入正式 `catalog/` 前的中间交换格式。它适合人工整理，也适合未来接入 AI 后把模型输出先落到临时目录，再通过脚本预检和安全应用。

日常操作流程见 [`../runbooks/catalog-import-workflow.md`](../runbooks/catalog-import-workflow.md)。本文只定义批次格式和边界。

它不是新的数据源。应用成功后，正式数据仍然只在：

- `catalog/projects/<id>/project.yaml`
- `catalog/projects/<id>/details.md`
- `catalog/collections/<id>/collection.yaml`
- `catalog/collections/<id>/details.md`

## Directory

批次必须位于 `.tmp/import-batches/<batch-id>/`，并且 `<batch-id>` 必须是小写 kebab-case。

```text
.tmp/import-batches/<batch-id>/
  manifest.yaml
  projects/<project-id>/project.yaml
  projects/<project-id>/details.md
  collections/<collection-id>/collection.yaml
  collections/<collection-id>/details.md
```

顶层只允许 `manifest.yaml`、`projects/`、`collections/`。批次内不允许 symlink。

`schema_version: 1` 的 item 目录不允许额外文件或子目录。项目目录只允许 `project.yaml` 和被 `details.path` 引用的 `details.md`；专题目录只允许 `collection.yaml` 和被 `details.path` 引用的 `details.md`。

## Manifest

```yaml
schema_version: 1
kind: catalog-import-batch
batch_id: notes-ai-catalog-2026-07-08
source:
  type: ai
  model: "example-model"
  notes:
    - "docs/notes/example.md"
mode: scoped
operations:
  - target: project
    id: example-project
    action: create
    path: ./projects/example-project
  - target: collection
    id: example-collection
    action: replace
    path: ./collections/example-collection
```

字段规则：

| Field | Required | Rule |
| --- | --- | --- |
| `schema_version` | yes | 当前只能是 `1`。 |
| `kind` | yes | 当前只能是 `catalog-import-batch`。 |
| `batch_id` | yes | 必须匹配批次目录名。 |
| `source.type` | yes | `manual` 或 `ai`。 |
| `source.model` | no | AI 生成时可记录模型名。 |
| `source.notes` | no | 可记录输入笔记路径。 |
| `mode` | yes | 当前只能是 `scoped`，不支持全量替换。 |
| `operations` | yes | 至少 1 条操作，且同一 `target:id` 不能重复。 |

## Operations

`target` 只能是 `project` 或 `collection`。

`action` 支持：

- `create`：目标目录必须不存在。
- `replace`：目标目录必须已存在，应用时替换整个 item 目录。
- `delete`：目标目录必须已存在，不能声明 `path`。

`create` 和 `replace` 的 `path` 可以省略；省略时按约定推导：

- project: `./projects/<id>`
- collection: `./collections/<id>`

如果显式声明 `path`，必须和约定路径完全一致。导入不支持任意路径映射。

## Payload

项目 payload 仍然使用正式项目合同：

```text
projects/<id>/project.yaml
projects/<id>/details.md
```

专题 payload 仍然使用正式专题合同：

```text
collections/<id>/collection.yaml
collections/<id>/details.md
```

`details.path` 当前只允许 `./details.md`。声明详情时，文件必须存在且不能是 symlink。

Import batch 预检会校验：

- YAML 字段形状。
- `id` 与 operation id 一致。
- category、tag 和 project status 必须存在于 `catalog/taxonomies.yaml`。
- project 至少 1 个 tag。
- related project 必须存在于当前 catalog 或同一批次创建/替换的 project。
- collection item 必须引用存在的 project，且不能重复。
- `create`、`replace`、`delete` 与当前 catalog 状态一致。
- item 目录不得包含未入合同的额外文件、图片、HTML、MDX 或子目录。

最终应用后还会运行 `./scripts/verify.sh catalog`，由正式 schema/loader 再验证一次。验证失败会回滚已写入的目录。

## Commands

```sh
./scripts/catalog.sh import validate .tmp/import-batches/<batch-id>
./scripts/catalog.sh import plan .tmp/import-batches/<batch-id>
./scripts/catalog.sh import diff .tmp/import-batches/<batch-id>
./scripts/catalog.sh import apply .tmp/import-batches/<batch-id> --allow-replace
```

包含 `replace` 时必须传 `--allow-replace`。包含 `delete` 时必须传 `--allow-delete`。

## Boundaries

- 不支持全量替换 `catalog/`。
- 不自动新增 taxonomy。
- 不抓取 GitHub 元数据。
- 不支持 HTML、MDX 或图片导入合同。
- 不支持自由结构扩展字段。
- 不把 `.tmp` 内容当成正式数据源。
