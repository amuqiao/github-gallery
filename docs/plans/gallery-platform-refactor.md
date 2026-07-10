# Breaking Content Publishing Refactor Plan

本文记录 Gallery Platform 的下一次破坏性重构计划：把当前“手写 YAML catalog 的静态站”改成“命令创建内容骨架、目录表达发布状态、统一发布前验证”的静态内容发布系统。

本计划记录当前基线、剩余缺口、实施切片和验收条件。稳定事实仍以 `docs/current/`、`docs/contract/` 和可执行 schema/loader/scripts 为准。

## Mental Model

这次重构不再追求兼容旧的 `project` / `model` 双轨设计。项目尚未上线，允许一次性破坏旧目录、旧路由和旧脚本合同，换取更稳定的长期骨架。

```text
Platform
  统一首页、导航、发布命令、验证门禁。

Hall
  内容领域，例如 github、models、music、movies。

Content Bundle
  一个可发布单元。第一版只有 item 和 collection。
  note 是 bundle 内部资产，支持 Markdown 或受控 HTML，继承父 bundle 的发布状态。

Publication State
  draft、published、archived 由目录或命令管理，不靠用户手写复杂字段。

Release Gate
  发布前统一跑 schema、loader、引用文件、路由和静态构建验证。
```

目标不是取消配置，而是把配置变成脚本生成和维护的底层合同。用户主要编辑 Markdown、受控 HTML 和少量必要字段，不需要记住目录结构、note 引用、发布状态或 YAML 细节。

## Breaking Replacement Boundary

本计划是 cutover 计划，不是兼容迁移计划。实施时下列旧合同会被替换，而不是保留双轨兼容：

| Current surface | Replacement direction |
| --- | --- |
| `catalog/projects/<id>/project.yaml` | `catalog/content/<state>/github/items/<id>/item.yaml` |
| `catalog/models/<id>/model.yaml` | `catalog/content/<state>/models/items/<id>/item.yaml` |
| `catalog/collections/<id>/collection.yaml` | `catalog/content/<state>/<hall>/collections/<id>/collection.yaml` |
| `docs/contract/project-config.md` | 通用 item + `github_project` profile 合同 |
| `docs/contract/model-config.md` | 通用 item + `ai_model` profile 合同 |
| `docs/contract/collection-config.md` | hall-owned collection 合同 |
| `docs/contract/catalog-import-batch.md` | `content-import-batch` 合同 |
| `scripts/catalog.sh new` | `scripts/content.sh item new` |
| `scripts/catalog.sh collection ...` | `scripts/content.sh collection ...` |
| `scripts/catalog.sh import ...` | `scripts/content.sh import ...` |
| `target: project` / `target: collection` import operations | `target: item` / hall-owned `target: collection` operations |
| `/projects/<id>/` | `/halls/<hall>/items/<id>/` |
| `/collections/<id>/` | `/halls/<hall>/collections/<id>/` for detail pages |
| `/categories/<id>/` and `/tags/<id>/` | 未来 hall 内筛选或 taxonomy 页面，第一版不保留 |

`docs/current/` 在 cutover 前继续描述当前事实；cutover 后再改写为新事实。不要提前把本计划中的目标结构写进 current 或 contract 文档。

## Current Baseline

- 站点是 Astro static site，构建期通过 loader 读取 `catalog/` 并生成静态页面。
- 已有多展馆入口：`catalog/halls/<id>/hall.yaml`、`/` 平台首页、`/halls/github/`、`/halls/models/`、`/halls/music/`、`/halls/movies/`。
- GitHub 公开入口已切到 `catalog/content/published/github/`，旧 GitHub projects 和 root collections 已镜像为 published content；legacy project detail、root collection、category/tag 页面仍暂留 `catalog/projects/<id>/project.yaml` 链路。
- 模型内容当前使用 `catalog/models/<id>/model.yaml`，是为了验证模型馆样例的过渡设计。
- 专题当前使用 `catalog/collections/<id>/collection.yaml`，并通过 `items[].project` 引用 GitHub 项目。
- 已实现 content bundle 验证面：`catalog/content/{drafts,published,archived}/<hall>/items/<id>/item.yaml` 和 `collections/<id>/collection.yaml`。
- 已实现 `github_project` 和 `ai_model` profile schema。
- 已实现 `src/lib/catalog/content-validator.js`，用于校验 publication state、hall、body/notes 文件、GitHub taxonomy 引用、collection item 引用和 published collection 规则。
- 已实现 `src/lib/catalog/content.ts`，用于 content bundle read model 适配、公开内容过滤和 route 派生。
- 当前 published content bundle 已生成 canonical item、note 和 hall-owned collection 页面；旧 project/model/root collection 页面仍暂留。
- `scripts/catalog.sh` 当前支持 project list/new/validate、collection 子命令和 project/collection import batch。
- `docs/contract/catalog-import-batch.md` 当前只允许 `target: project` 和 `target: collection`。
- `./scripts/verify.sh check` 当前通过 `npm run build` 间接覆盖 hall、model、project、collection、taxonomy、site 和内容引用。
- 已实现 `./scripts/verify.sh release`，当前通过 `scripts/verify/release-gate.mjs` 调用 `src/lib/catalog/content-validator.js`，再运行 Astro 静态构建。
- 已实现 `./scripts/content.sh import validate|plan|diff|apply`，当前只写入 `catalog/content/drafts/`。

## Remaining Gaps

- 用户新增当前公开页面内容时仍需要理解 `project.yaml`、`model.yaml`、`collection.yaml`、`details.md`、`notes[]` 等底层配置关系。
- `catalog/content/published/` 已驱动平台首页、GitHub 展馆页、模型展馆页、canonical item/note 页面和 hall-owned collection 页面；legacy model detail、project detail、root collection、category/tag 页面仍是旧公开页面数据源。
- 已实现 `scripts/content.sh` 和 `scripts/content/content-cli.mjs`，支持 content bundle item/collection draft 创建、item note 添加、publish、archive、restore。
- `publish` 当前委托 `./scripts/verify.sh release`；`archive` 和 `restore` 当前委托 `./scripts/verify.sh catalog`。
- 旧 root collection 仍未完全切换；新 content collection 已从属于 hall。
- content import batch 是外部整理结果进入 drafts 的安全入口，但不是发布入口。
- `catalog.sh new` 仍只能创建旧 GitHub project；content 写入应使用 `content.sh`，旧入口切除还未完成。

## Planned Work

### 1. Break The Old Catalog Shape

废弃旧目录作为正式合同：

```text
catalog/projects/
catalog/models/
catalog/collections/<id>/
```

新目录按发布状态组织内容包：

```text
catalog/
  halls/
    github/hall.yaml
    models/hall.yaml
    music/hall.yaml
    movies/hall.yaml
  content/
    drafts/
      github/items/<id>/
      github/collections/<id>/
      models/items/<id>/
    published/
      github/items/<id>/
      github/collections/<id>/
      models/items/<id>/
    archived/
      github/items/<id>/
      github/collections/<id>/
      models/items/<id>/
  taxonomies.yaml
  site.yaml
```

发布状态由目录表达，第一版不再在 item 顶层重复保存 `publication_status`。如果后续需要展示发布时间、归档原因或审计记录，再新增受控字段。

状态转移规则：

| Command | From | To | Public route/list visibility |
| --- | --- | --- | --- |
| `content.sh item new` / `content.sh collection new` | none | `drafts` | 不生成公开详情页，不进入公开列表。 |
| `content.sh publish` | `drafts` | `published` | 生成公开详情页，进入展馆列表和平台聚合。 |
| `content.sh archive` | `published` | `archived` | 从公开详情页、展馆列表和平台聚合中移除。 |
| `content.sh restore` | `archived` | `drafts` | 回到草稿，不直接重新发布。 |

`restore` 不允许直接把 archived 内容恢复为 published。重新公开必须再次执行 `content.sh publish` 并通过 release gate。item 和 collection 使用同一套状态机。

公开专题的引用规则：

- `published` collection 只能引用同一 hall 下的 `published` item。
- `draft` collection 可以引用同一 hall 下的 `draft` 或 `published` item，用于发布前编排。
- `archived` collection 不生成公开页面；引用只需要保持同 hall 且目标 item 存在。
- `release` 必须拒绝任何会让 `published` collection 暴露 draft 或 archived item 的引用。

### 2. Make Content Bundle The Stable Unit

每个内容包必须是一个完整、可验证、可移动的目录：

```text
catalog/content/published/models/items/htdemucs-ft-onnx/
  item.yaml
  index.md
  notes/
    quick-start.md
```

`item.yaml` 是机器可读 manifest，主要由 CLI 创建和维护。`index.md` 是用户主要编辑的正文入口。notes 是 item 内部资产，可以是 Markdown 或受控 HTML，由命令挂载并继承 item 的发布状态，避免用户手写引用关系。第一版不设计独立 document target。

最小 item manifest 草案：

```yaml
schema_version: 2
id: htdemucs-ft-onnx
hall: models
kind: ai_model
title: HT-Demucs FT ONNX
summary: 用于音乐源分离的 ONNX 版 HT-Demucs FT。
source:
  type: huggingface
  url: https://huggingface.co/StemSplitio/htdemucs-ft-onnx
body:
  type: markdown
  path: ./index.md
notes:
  - id: quick-start
    title: 快速试用
    type: markdown
    path: ./notes/quick-start.md
```

领域字段进入 `profile` 或 kind-specific schema：

```yaml
kind: ai_model
profile:
  provider: StemSplitio
  modalities:
    input: [audio]
    output: [audio]
  tasks:
    - source-separation
  access:
    - download
    - local-inference
  formats:
    - onnx
  runtimes:
    - onnxruntime
  license: mit
```

不要加入自由结构的 `metadata`、`extensions`、`custom`。需要长期筛选、排序、路由、引用或验证的字段才进入 schema；只用于说明的内容放正文、notes 或 typed blocks。

### 3. Make Collections Hall-Owned By Default

专题默认属于某个 hall：

```text
catalog/content/published/github/collections/voice-cloning/
  collection.yaml
  index.md
```

馆内专题只引用同一 hall 的 item：

```yaml
schema_version: 2
id: voice-cloning
hall: github
title: 声音克隆项目专题
summary: GitHub 展馆内的声音克隆项目策展。
body:
  type: markdown
  path: ./index.md
items:
  - item: gpt-sovits
  - item: xtts
```

跨馆专题不进入第一版合同。平台首页可以聚合展示各馆 published collections，但不改变 collection 的 hall 归属。

### 4. Replace Scripts With Content Commands

废弃旧命令语义：

```text
./scripts/catalog.sh new <project-id>
./scripts/catalog.sh collection ...
./scripts/catalog.sh import ... target: project
```

新增内容发布命令草案：

```sh
./scripts/content.sh hall list
./scripts/content.sh item new models ai_model htdemucs-ft-onnx \
  --title "HT-Demucs FT ONNX" \
  --source-type huggingface \
  --source-url "https://huggingface.co/StemSplitio/htdemucs-ft-onnx"

./scripts/content.sh item note add models htdemucs-ft-onnx quick-start \
  --title "快速试用" \
  --format markdown

./scripts/content.sh item note add github gpt-sovits architecture-note \
  --title "架构笔记" \
  --format html

./scripts/content.sh collection new github voice-cloning \
  --title "声音克隆项目专题"

./scripts/content.sh publish models item htdemucs-ft-onnx
./scripts/content.sh archive models item htdemucs-ft-onnx
./scripts/content.sh restore models item htdemucs-ft-onnx
./scripts/verify.sh release
```

命令职责：

- 创建目录和合法 manifest。
- 创建空 Markdown 或 HTML 文件。
- 自动把 Markdown 或 HTML note 写入 manifest。
- 在 draft、published、archived 之间移动内容包。
- 写操作加 `.data/catalog-write.lock`。
- 写后运行最小验证；发布前运行完整 release gate。

旧 `catalog.sh` 当前仍保留为 legacy project/root collection 入口。破坏性切换完成后，它不再提供写入能力；可以删除，也可以只保留为提示用户迁移到 `content.sh` 的错误入口；不得继续支持旧 project、旧 collection 或旧 import 写入。

### 5. Replace Import Batch Contract

import batch 继续存在，但只作为 AI 或外部整理结果进入正式内容系统的安全入口。

旧 manifest target 废弃：

```yaml
target: project
target: collection
```

当前已实现的 content import manifest 形态：

```yaml
schema_version: 1
kind: content-import-batch
batch_id: models-audio-2026-07-09
source:
  type: ai
mode: scoped
operations:
  - target: item
    hall: models
    id: htdemucs-ft-onnx
    state: drafts
    action: create
    path: ./items/models/htdemucs-ft-onnx
```

`apply` 只能写入 drafts。把 draft 发布到 published 必须走 `content.sh publish`，并经过完整 release gate。`content.sh import` 不提供发布开关。

用户入口统一迁移为：

```sh
./scripts/content.sh import validate .tmp/import-batches/<batch-id>
./scripts/content.sh import plan .tmp/import-batches/<batch-id>
./scripts/content.sh import diff .tmp/import-batches/<batch-id>
./scripts/content.sh import apply .tmp/import-batches/<batch-id>
```

当前 `./scripts/catalog.sh import ...` 仍是 legacy project/root collection import 入口。破坏性切换完成后，它不保留为兼容入口。

### 6. Replace Loaders And Routes

新增 loader 以 content bundle 为单位读取：

```text
src/lib/catalog/content.ts
src/lib/catalog/items.ts
src/lib/catalog/collections.ts
src/lib/catalog/halls.ts
src/lib/catalog/details.ts
```

删除或重写旧 project/model 入口：

```text
src/lib/catalog/projects.ts
src/lib/catalog/models.ts
src/lib/catalog/project-view-models.ts
```

目标路由：

```text
/                         平台首页
/halls/<hall>/             展馆首页
/halls/<hall>/items/<id>/   条目详情
/halls/<hall>/items/<id>/notes/<note>/ 条目笔记
/halls/<hall>/collections/  馆内专题列表
/halls/<hall>/collections/<id>/ 馆内专题详情
/collections/                平台专题聚合页，可选保留，但不承载详情页
```

不保留旧路由兼容：

```text
/projects/<id>             删除
/collections/<id>          删除，不保留详情页
/categories/<id>           删除，未来由 hall 内筛选或 taxonomy 页面重新设计
/tags/<id>                 删除，未来由 hall 内筛选或 taxonomy 页面重新设计
```

因为项目未上线，第一版不做 redirect 和兼容页。构建中如果仍有旧页面文件、旧 loader 或旧链接，应失败或在 review 中阻断。

### 7. Route Public Pages From Published Content

后续切换公开页面数据源时，必须保证：

- 公开详情页只读取 `catalog/content/published/`。
- draft 内容不会生成公开详情页，不进入公开列表。
- archived 内容不会生成公开详情页，不进入公开列表。
- `./scripts/verify.sh release` 继续作为唯一正式发布门禁。

### 8. Update Documentation Buckets Only When Implemented

计划执行时按以下边界同步文档：

```text
docs/current/
  只写已经实现的 content bundle 运行路径、页面路由和脚本入口。

docs/contract/
  只解释 schema/loader/scripts 已支持的 hall、item、collection、import batch、release gate 合同。

docs/plans/
  记录当前基线、已完成切片、尚未完成的 gaps 和 acceptance；稳定事实仍以 current/contract 和可执行代码为准。

docs/runbooks/
  只写可以真实执行的创建、编辑、发布、归档、导入和验证流程。
```

不要在 contract 文档里提前宣称音乐或电影 item 合同已经支持。它们第一版仍只是 `planned` hall。

## Migration Slices

### Slice 1: Plan And Contract Decision

- 本计划成为唯一平台重构方向。
- 明确不兼容旧 `project` / `model` / root `collection` 目录和路由。
- 不改 current/contract，避免把未实现能力写成事实。

### Slice 2: Content Bundle Schema

- 已新增 `content` bundle schema。
- 已新增 `item` schema 和 `github_project` / `ai_model` kind profile。
- 已新增 hall-owned collection schema。
- 已明确 draft/published/archived 目录规则。
- 已新增最小 published、drafts 和 archived 样例。
- 已通过 `src/pages/index.astro` 让 content loader 参与构建期验证。

### Slice 3: Loader And Route Replacement

- 新增 content bundle loader。
- 替换 project/model loader。
- 替换旧页面路由。
- 确保 draft/archived 不生成公开页面。

### Slice 4: CLI Creation Workflow

- 已新增 `scripts/content.sh`。
- 已新增 `scripts/content/content-cli.mjs`。
- 已支持 item、Markdown note、HTML note、collection 的 draft 创建。
- 已支持 publish、archive、restore。
- 已实现写操作加锁，验证失败回滚。
- 已验证 draft item 的 publish -> archive -> restore 状态闭环。

### Slice 5: Release Gate

- 已新增 `scripts/verify/release-gate.mjs`。
- 已新增 `src/lib/catalog/content-validator.js` 作为 content bundle 校验共享入口。
- 已新增 `./scripts/verify.sh release`。
- 已让 `content.sh publish` 委托 `verify.sh release`。
- 已验证当前 content bundle release gate。

### Slice 6: Content Import Batch

- 已新增 `scripts/content/content-import-cli.mjs`。
- 已新增 `docs/contract/content-import-batch.md`。
- 已新增 `docs/runbooks/content-import-workflow.md`。
- 已支持 `content.sh import validate|plan|diff|apply`。
- 已限制 import 只写入 `catalog/content/drafts/`。
- 已支持 apply 加锁、备份、验证失败回滚。

### Slice 7: Published Content Public Routes

- 已新增 canonical content item route：`/halls/<hall>/items/<id>/`。
- 已新增 canonical content note route：`/halls/<hall>/items/<id>/notes/<note>/`。
- 已新增 canonical hall collection list route：`/halls/<hall>/collections/`。
- 已新增 canonical hall collection detail route：`/halls/<hall>/collections/<id>/`。
- 已让 `/halls/models/` 读取 `catalog/content/published/models/items/` 中的 `ai_model` content item。
- 已让平台首页 `/` 读取 published content 的 hall item count、模型样例和精选专题。
- 已让 `/halls/github/` 读取 published GitHub content item 和 GitHub hall collection。
- 已把旧 GitHub projects 全量迁移为 `catalog/content/published/github/items/`，旧 root collections 全量迁移为 `catalog/content/published/github/collections/`。
- 旧 `/projects/*`、`/collections/*`、`/categories/*`、`/tags/*` 和 legacy `/halls/models/[id]/*` 仍暂留，等待后续破坏性切换。

### Slice 8: Documentation And Cleanup

- 更新 `docs/current/` 为新运行事实。
- 替换 `docs/contract/project-config.md`、`model-config.md`、`collection-config.md`、`catalog-import-batch.md`。
- 更新 `docs/runbooks/` 为内容发布流程。
- 删除旧 project/model 计划残留和旧脚本说明。

## Acceptance

本计划完成后必须满足：

- `catalog/projects/` 和 `catalog/models/` 不再是正式内容来源。
- 正式公开内容只来自 `catalog/content/published/`。
- drafts 和 archived 内容不会生成公开详情页。
- drafts 和 archived 内容不会进入展馆列表、平台聚合或专题聚合。
- 所有 item 都通过 `item.yaml` 和 kind profile 验证。
- 所有 collections 都有 hall 归属，默认只引用同一 hall 的 item。
- published collections 只能引用同一 hall 下的 published items。
- 用户可以通过 CLI 创建 model item、GitHub item、Markdown note、HTML note 和 hall-owned collection 骨架。
- 用户发布内容只需要编辑生成的 Markdown/HTML 和少量 CLI 参数，不需要手写 note 引用路径。
- `content.sh publish` 在发布前运行 release gate，失败时不移动到 published。
- import batch 支持 content bundle，并默认写入 drafts。
- `content.sh import` 是正式 import 用户入口。
- published content 会生成 canonical item、note 和 hall-owned collection 页面。
- 平台首页和 GitHub 展馆页读取 published content。
- `/halls/models/` 读取 published `models` hall `ai_model` content item。
- 破坏性切换完成后，旧 `target: project`、旧 `target: collection`、旧 `catalog.sh new`、旧 `catalog.sh collection`、旧 `catalog.sh import` 不再作为兼容入口存在。
- `/projects/<id>`、`/collections/<id>`、`/categories/<id>`、`/tags/<id>` 不生成公开详情页。
- `/halls/<hall>/items/<id>/` 和 `/halls/<hall>/collections/<id>/` 是 canonical detail 路由。
- `./scripts/verify.sh release` 通过。
- `docs/current/` 只描述已实现的新运行路径。
- `docs/contract/` 只描述可执行 schema/loader/scripts 已支持的新合同。
- `docs/runbooks/` 包含创建、编辑、预览、发布、归档、导入和 release check 的可执行流程。

## Non-Goals

- 不设计音乐 item 和电影 item 的完整领域合同。
- 不引入 ECharts 或重型 table 库。
- 不实现全站搜索。
- 不自动抓取 GitHub、Hugging Face 或其他外部元数据。
- 不支持自由结构扩展字段。
- 不支持 note 附属图片、CSS、JS 或任意资产目录。
- 不把 `.tmp/import-batches/` 当成长期内容源。
