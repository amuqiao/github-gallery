# Content Bundle Config Contract

本文解释当前已经实现的 `catalog/content/{drafts,published,archived}/` 内容包合同。可执行真相源是 `src/lib/catalog/catalog-schema.js`、`src/lib/catalog/content-validator.js` 和 `src/lib/catalog/content.ts`。

当前 published content bundle 已驱动平台首页、GitHub 展馆首页、模型展馆首页和 canonical content 路由。旧 GitHub projects、root collections 和模型样例已迁移到 `catalog/content/published/`；legacy project/model/root collection 路由和数据目录已切除。

## Directory

```text
catalog/content/
  drafts/<hall>/items/<id>/
  drafts/<hall>/collections/<id>/
  published/<hall>/items/<id>/
  published/<hall>/collections/<id>/
  archived/<hall>/items/<id>/
  archived/<hall>/collections/<id>/
```

顶层 publication state 只能是 `drafts`、`published`、`archived`。Hall 目录名必须引用 `catalog/halls/<id>/hall.yaml` 中存在且 `availability: active` 的 hall。`planned` hall 只允许预留入口，不允许放入 content bundle。

Item 内容包：

```text
catalog/content/published/models/items/htdemucs-ft-onnx/
  item.yaml
  index.md
  notes/quick-start.md
```

Collection 内容包：

```text
catalog/content/published/github/collections/voice-cloning/
  collection.yaml
  index.md
```

## Item

`item.yaml` 当前使用 `schema_version: 2`。

稳定字段：

| Field | Rule |
| --- | --- |
| `id` | 必填，必须匹配目录名。 |
| `hall` | 必填，必须匹配所在 hall 目录。 |
| `kind` | 必填，当前支持 `github_project`、`ai_model`。 |
| `title` | 必填，展示标题。 |
| `summary` | 必填，最多 180 字符。 |
| `source.type` | 必填，来源类型字符串。 |
| `source.url` | 必填，来源 URL。 |
| `body` | 必填，正文入口。 |
| `profile` | 必填，按 `kind` 使用严格 schema。 |
| `relations` | `github_project` 可选，表达同馆相关项目引用。 |
| `notes` | 可选，Markdown 或受控 HTML note。 |
| `blocks` | 可选，复用已实现的 `links`、`highlights`、`use-cases`。 |

`body.type: markdown` 必须使用 `path: ./index.md`。`body.type: html` 必须使用 `path: ./index.html` 和 `html_mode: fragment`。

`notes[].path` 必须位于 `./notes/` 下。Markdown note 必须使用 `.md` 和 `display: site`；HTML note 必须使用 `.html`，站内 HTML 使用 `html_mode: fragment`，独立 HTML 使用 `html_mode: document`。

## Profiles

`github_project.profile`：

| Field | Rule |
| --- | --- |
| `repo` | 必填，GitHub 项目 URL。 |
| `category` | 必填，引用 `catalog/taxonomies.yaml` 的 category id。 |
| `tags` | 必填，引用 `catalog/taxonomies.yaml` 的 tag id。 |
| `maintenance_status` | 必填，引用 `project_maintenance_statuses` id。 |
| `license` | 可选，展示事实。 |
| `languages` | 可选，展示事实。 |

`github_project.relations`：

| Field | Rule |
| --- | --- |
| `related_projects` | 可选，引用同 hall content item id；published item 只能引用 published item。 |

`ai_model.profile`：

| Field | Rule |
| --- | --- |
| `provider` | 必填，模型提供方。 |
| `modalities.input` / `modalities.output` | 必填，输入/输出模态。 |
| `tasks` | 必填，任务标签。 |
| `access` | 必填，访问方式。 |
| `formats` | 必填，模型格式。 |
| `runtimes` | 必填，运行时。 |
| `license` | 可选，展示事实。 |

## Collection

`collection.yaml` 当前使用 `schema_version: 2`，并且从属于某个 hall。

| Field | Rule |
| --- | --- |
| `id` | 必填，必须匹配目录名。 |
| `hall` | 必填，必须匹配所在 hall 目录。 |
| `title` | 必填，专题标题。 |
| `summary` | 必填，最多 180 字符。 |
| `body` | 必填，正文入口，规则同 item body。 |
| `items[].item` | 必填，引用同 hall item id。 |
| `items[].note` | 可选，策展备注。 |
| `blocks` | 可选，复用已实现的 typed blocks。 |

同一个 collection 内不能重复引用同一个 item。

## Publication Rules

- `published` collection 只能引用同一 hall 下的 `published` item。
- `drafts` collection 可以引用同一 hall 下的 `drafts` 或 `published` item。
- `archived` collection 不公开，只要求引用同一 hall 下存在的 item。
- 同一 `(hall, id)` item 不能同时出现在多个 publication state。
- 同一 `(hall, id)` collection 不能同时出现在多个 publication state。

## Commands

当前已实现的维护入口是 `./scripts/content.sh`：

```sh
./scripts/content.sh item new <hall> <github_project|ai_model> <id> ...
./scripts/content.sh item note add <hall> <id> <note-id> ...
./scripts/content.sh collection new <hall> <id> ...
./scripts/content.sh import validate .tmp/import-batches/<batch-id>
./scripts/content.sh import plan .tmp/import-batches/<batch-id>
./scripts/content.sh import diff .tmp/import-batches/<batch-id>
./scripts/content.sh import apply .tmp/import-batches/<batch-id>
./scripts/content.sh publish <hall> <item|collection> <id>
./scripts/content.sh archive <hall> <item|collection> <id>
./scripts/content.sh restore <hall> <item|collection> <id>
./scripts/content.sh list [[drafts|published|archived] [hall] | [hall]]
./scripts/content.sh show <hall> <item|collection> <id>
./scripts/content.sh status <hall> <item|collection> <id>
```

`item new`、`collection new` 和 `import apply` 写入 `drafts`。`publish` 从 `drafts` 移到 `published` 并运行 `./scripts/verify.sh release`。`archive` 从 `published` 移到 `archived`。`restore` 从 `archived` 移回 `drafts`，不会直接发布。

`list`、`show` 和 `status` 是只读查询命令，不加 `.data/catalog-write.lock`，不运行 `verify.sh`，也不触发 Astro build。`list` 可以不带过滤条件、只带 publication state、只带 active hall，或同时带 publication state 和 active hall；未知 hall 和 planned hall 会失败。输出合同：

```text
list:   state<TAB>hall<TAB>type<TAB>id<TAB>title
status: state<TAB>hall<TAB>type<TAB>id<TAB>path
show:   YAML，前两行注释标注 state 和 path
```

Content import batch 合同见 [`content-import-batch.md`](./content-import-batch.md)。

## Verification

`src/pages/index.astro` 会在构建期调用 `getContentCatalogSnapshot()`，因此 `./scripts/verify.sh check`、`catalog`、`content` 和 `release` 都会触发 content bundle 校验。`release` 还会先通过 `scripts/verify/release-gate.mjs` 调用 `src/lib/catalog/content-validator.js`，作为正式发布门禁。

校验覆盖：

- publication state 目录形状。
- hall 是否存在且 `availability: active`。
- `item.yaml` / `collection.yaml` schema。
- 目录名与 `id` 一致。
- `hall` 与目录 hall 一致。
- GitHub profile 的 taxonomy 引用。
- GitHub related project 引用和 publication state 规则。
- body 和 notes 文件存在，且不是 symlink。
- body 和 notes 路径不能越出内容包目录。
- collection item 引用和 publication state 规则。
- 同一 `(hall, id)` item 或 collection 不能跨 publication state 重复出现。
- published collection 只能引用同一 hall 下的 published item。

`release` 的特有行为是先运行上述 content bundle gate，再运行 Astro check 和 static build。

## Public Routes

只有 `catalog/content/published/` 下的 content bundle 会生成公开 canonical 页面：

| Bundle | Public route |
| --- | --- |
| `published/<hall>/items/<id>/item.yaml` | `/halls/<hall>/items/<id>/` |
| `published/<hall>/items/<id>/notes/<note>` | `/halls/<hall>/items/<id>/notes/<note>/` |
| `published/<hall>/collections/` | `/halls/<hall>/collections/` |
| `published/<hall>/collections/<id>/collection.yaml` | `/halls/<hall>/collections/<id>/` |

`drafts` 和 `archived` content bundle 不生成公开 canonical 页面，也不会进入 `/halls/models/` 的已发布模型列表或馆内专题列表。

平台首页和 GitHub 展馆页同样只读取 published content：`/` 使用 published content 计算 hall item 数、模型样例和精选专题；`/halls/github/` 只展示 published `github_project` item 和 GitHub hall 的 published collection。
