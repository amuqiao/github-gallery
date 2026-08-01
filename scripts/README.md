# Scripts

`scripts/` 提供本仓库稳定的人类操作入口。它们是薄 wrapper，真正的配置合同由 `src/lib/catalog/catalog-schema.js`、`src/lib/catalog/content-validator.js`、`src/lib/catalog/content.ts`、`src/lib/catalog/halls.ts`、`src/lib/catalog/site.ts` 和 `src/lib/catalog/taxonomy.ts` 执行。

## Mental Model

```text
dev.sh       本地 Astro 开发和 dev server 管理入口
verify.sh    一次性验证和正式发布门禁入口
content.sh   content bundle 创建、导入、发布、归档、恢复和只读查询入口
content-workflow-test.sh
             content workflow 隔离回归测试入口
deploy.sh    Docker 静态站点部署入口
```

当前项目是 Astro static site + YAML content catalog。不要把队列、数据库、迁移、压测或远程运维语义放进这里。

## Entrypoints

| Entrypoint | Owns | Does Not Own |
| --- | --- | --- |
| `dev.sh` | Astro dev server 的 `start` / `stop` / `status` / `restart` / `logs`，以及 `preview`、`build` 的稳定入口。 | 部署、远程服务、GitHub API 抓取、content 生成。 |
| `verify.sh` | content bundle、halls、taxonomy、site、内容资产和 static build 验证。 | README 或 `docs/` 漂移检查。 |
| `content.sh` | content bundle item/collection 草稿创建、item note 添加、content import batch、`added_at` 缺失元数据补齐、publish/archive/restore 状态移动，以及 list/show/status 只读查询。 | 旧 project/root collection 维护、GitHub API 抓取、taxonomy 自动修改、物理删除。 |
| `content-workflow-test.sh` | 在仓库外隔离副本中运行 content workflow 回归测试。当前 Phase 5 覆盖现场隔离、GitHub item、模型 item、notes、collection 的创建、发布、归档、恢复、手工编辑、重新发布、list/show/status、列表可见性、渲染内容断言、import batch create/replace/delete、最小回滚，以及确定性失败/幂等边界。 | 日常内容创建、真实 catalog 写入、默认发布门禁、中断故障注入覆盖。 |
| `deploy.sh` | Docker 静态站点部署：全局 `check`，以及 `preview`、`standalone`、`proxy` 三种模式的 build/start/stop/restart/status。 | Astro dev server、数据库、队列、迁移、反向代理本体或远程云资源。 |

## Commands

Requires Bash, Node.js 20 or newer, and standard local process tools (`ps`, `pgrep`, `lsof`; `logs` also uses `tail`). `content-workflow-test.sh` additionally requires `git`, `rsync`, `mktemp`, `date`, `cksum`, and an existing `node_modules/` in the main repository.

```sh
./scripts/dev.sh start
./scripts/dev.sh start --host 0.0.0.0 --port 4321
./scripts/dev.sh status
./scripts/dev.sh restart
./scripts/dev.sh stop
./scripts/dev.sh logs
./scripts/dev.sh preview
./scripts/dev.sh build

./scripts/verify.sh check
./scripts/verify.sh release
./scripts/verify.sh catalog
./scripts/verify.sh content

./scripts/content.sh item new models ai_model example-model \
  --title "Example Model" \
  --summary "Example model summary." \
  --source-type manual \
  --source-url "https://example.com/model" \
  --provider Example \
  --input audio \
  --output audio \
  --task source-separation \
  --access download \
  --format onnx \
  --runtime onnxruntime \
  --added-at 2026-07-31
./scripts/content.sh item new lab knowledge_article activation-functions \
  --title "Activation Functions" \
  --summary "A focused knowledge article about nonlinearities and gradient flow." \
  --source-type manual \
  --source-url "https://example.com/activation-functions" \
  --domain "Machine Learning Foundations" \
  --topic "nonlinearity" \
  --topic "gradient-flow" \
  --audience "self-study" \
  --added-at 2026-07-31
./scripts/content.sh item note add models example-model quick-start \
  --title "Quick Start" \
  --summary "Quick start note." \
  --format markdown \
  --added-at 2026-07-31
./scripts/content.sh item note import models example-model implementation-guide \
  --state drafts \
  --file .tmp/note-sources/implementation-guide.md \
  --title "Implementation Guide" \
  --summary "Imported note file." \
  --added-at 2026-07-31
./scripts/content.sh item note replace models example-model implementation-guide \
  --state drafts \
  --file .tmp/note-sources/implementation-guide.md
./scripts/content.sh collection new models example-models \
  --title "Example Models" \
  --summary "Example model collection." \
  --item example-model
./scripts/content.sh import validate .tmp/import-batches/example-content-batch
./scripts/content.sh import plan .tmp/import-batches/example-content-batch
./scripts/content.sh import diff .tmp/import-batches/example-content-batch
./scripts/content.sh import apply .tmp/import-batches/example-content-batch
./scripts/content.sh metadata stamp-missing drafts --date 2026-07-31
./scripts/content.sh publish models item example-model
./scripts/content.sh archive models item example-model
./scripts/content.sh restore models item example-model
./scripts/content.sh list published models
./scripts/content.sh list models
./scripts/content.sh status models item example-model
./scripts/content.sh show models item example-model

./scripts/content-workflow-test.sh
./scripts/content-workflow-test.sh --cleanup-on-fail

cp .env.example .env
./scripts/deploy.sh check
./scripts/deploy.sh modes
./scripts/deploy.sh start pre
./scripts/deploy.sh status pre
./scripts/deploy.sh restart pre
./scripts/deploy.sh stop pre
```

## Verification Boundary

`verify.sh` 不检查维护文档。文档只解释已实现规则，代码和 loader 才是真相源。

`verify.sh check` 会先运行 fast catalog gate，再运行 Astro check 和 static build。catalog gate 覆盖 publication state 目录、active hall 归属、item/collection schema、body/notes 文件引用、重复 bundle key、related project 引用，以及 published collection 只能引用同 hall published item。

`verify.sh catalog` 和 `verify.sh content` 只运行 fast catalog gate，不执行 Astro check 或 static build。`verify.sh release` 是正式发布门禁，会先运行 release gate，再运行 Astro check 和 static build。

`verify.sh build` 只运行 `npm run build`。

## Dev Server Management

`dev.sh start` 会后台启动 Astro dev server，并把 pid、端口和日志写入 `.run/dev.pid`、`.run/dev.port`、`.run/dev.log`。只有探测到真实监听端口后才报告 `started`。

`dev.sh stop` 和 `restart` 只会停止当前仓库 cwd 下的 dev server，杀进程前会校验 cwd 和命令，避免误杀其他项目。

## Content Commands

`content.sh` 是 content bundle 和 item note 文件写入的安全入口。它创建 `catalog/content/drafts/` 内容，在 `drafts`、`published`、`archived` 之间移动 content bundle，并可把外部 Markdown/HTML 文件导入或替换为 item note。

- `added_at` 表示内容进入 catalog 的收录时间，不会在 `publish`、`archive` 或 `restore` 时自动改写。
- `item new` 会在 `item.yaml` 写入 `added_at`；`--added-at YYYY-MM-DD` 可显式指定，不传时使用本地日期的当天值。
- `item note add` 和 `item note import` 会在 note 元数据写入 `added_at`；`--added-at YYYY-MM-DD` 可显式指定，不传时使用当天日期。
- `metadata stamp-missing [drafts|published|archived] [--date YYYY-MM-DD]` 只补齐 item 和 note 缺失的 `added_at`，不会覆盖已有值；不传 state 时扫描全部 publication state。
- `import apply` 只写入 `drafts` 并运行 `./scripts/verify.sh catalog`。
- `item note import` 新增外部 `.md` 或 `.html` 文件为 `drafts` 或 `published` item note，写后按目标 state 运行验证。
- `item note replace` 只替换已有 note 正文，不修改 note 元数据，写后按目标 state 运行验证。
- `publish` 会运行 `./scripts/verify.sh release`。
- `archive` 和 `restore` 会运行 `./scripts/verify.sh catalog`。
- 验证失败时脚本会回滚目录移动或文件写入。
- `list`、`show`、`status` 是只读命令，不加写锁，不运行验证，也不触发 build。

只读命令输出：

```text
./scripts/content.sh list [[drafts|published|archived] [hall] | [hall]]
state	hall	type	id	title

./scripts/content.sh status <hall> <item|collection> <id>
state	hall	type	id	path

./scripts/content.sh show <hall> <item|collection> <id>
# state: <state>
# path: catalog/content/<state>/<hall>/<items|collections>/<id>/<item.yaml|collection.yaml>
<yaml>
```

`list` 可以不带过滤条件、只带 publication state、只带 active hall，或同时带 publication state 和 active hall。未知 hall 和 planned hall 会失败，避免把拼写错误误判为空结果。

## Import Batch

`content.sh import` 是 AI 或人工整理结果进入 `catalog/content/drafts/` 的安全入口。批次必须位于 `.tmp/import-batches/<batch-id>/`，并由 `manifest.yaml` 显式声明 `target: item|collection`、`hall`、`state: drafts` 和 `create`、`replace`、`delete` 操作。

`replace` 和 `delete` 都需要显式授权参数。应用时脚本会加写锁、备份被影响的 item 或 collection 目录、写入 `catalog/content/drafts/`，然后运行 `./scripts/verify.sh catalog`。验证失败时会回滚已经写入的目录。

Import batch 不是长期数据源。`content.sh import` 应用成功后，正式草稿来源是 `catalog/content/drafts/`。

Content import 合同说明见 [`../docs/contract/content-import-batch.md`](../docs/contract/content-import-batch.md)，日常操作手册见 [`../docs/runbooks/content-import-workflow.md`](../docs/runbooks/content-import-workflow.md)。

## Content Workflow Test

`content-workflow-test.sh` 会先记录主仓库状态和忽略路径递归 checksum，再把当前工作树复制到仓库外临时目录，确认 `.git/`、`dist/`、`.data/`、`.tmp/`、`.run/`、`.env` 和 `node_modules/` 没有进入初始副本，再把主仓库已有 `node_modules/` 复制到临时副本用于真实 build。测试成功会删除临时目录，失败默认保留临时目录并打印路径；成功和失败路径都会检查主仓库现场是否改变。

当前覆盖的 happy path：

```text
item new -> note add -> note import -> collection new -> publish -> route/list exists
published note import/replace -> route/content updated
archive -> route/list missing -> restore -> edit generated files -> republish -> route/list/content exists
list/show/status -> published bundle visible
duplicate create/note/publish/archive/restore -> fail -> bundle unchanged
bad references/planned hall/wrong archive-restore order -> fail -> rollback
import validate/plan/diff/apply create -> drafts-only
import apply replace/delete with --allow-* -> drafts-only -> removed
import apply invalid batch -> rollback
```

这条测试不写入真实 `catalog/content/`，也不作为 `verify.sh check` 的默认子步骤。发布前需要深度确认内容工作流时手动运行：

```sh
./scripts/content-workflow-test.sh
```
