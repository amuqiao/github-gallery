# Scripts

`scripts/` 提供本仓库稳定的人类操作入口。它们是薄 wrapper，真正的配置合同仍由 `src/lib/catalog/catalog-schema.js`、`src/lib/catalog/projects.ts` 和 `src/lib/catalog/collections.ts` 执行。

## Mental Model

```text
dev.sh       本地 Astro 开发和 dev server 管理入口
verify.sh    一次性验证入口
catalog.sh   catalog 项目维护入口
  import     .tmp/import-batches 安全导入入口
```

不要把后端服务项目的部署、队列、数据库、压测或远程运维语义放进这里。当前项目是 Astro static site + YAML catalog。

## Entrypoints

| Entrypoint | Owns | Does Not Own |
| --- | --- | --- |
| `dev.sh` | Astro dev server 的 `start` / `stop` / `status` / `restart` / `logs`，以及 `preview`、`build` 的稳定入口。 | 部署、远程服务、GitHub API 抓取、catalog 内容生成。 |
| `verify.sh` | build/catalog/content 验证，包括 projects、collections、taxonomy、site 和被引用详情文件。 | README 或 `docs/` 漂移检查。 |
| `catalog.sh` | project list/validate/new、collection list/show/new/delete/update、import batch validate/plan/diff/apply。 | GitHub API 抓取、taxonomy 自动修改、schema 之外的字段生成、全量替换 catalog。 |

## Commands

Requires Bash, Node.js 20 or newer, and standard local process tools (`ps`, `pgrep`, `lsof`; `logs` also uses `tail`).

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
./scripts/verify.sh catalog
./scripts/verify.sh content

./scripts/catalog.sh list
./scripts/catalog.sh validate
./scripts/catalog.sh new example-project \
  --name "Example Project" \
  --repo "https://github.com/example/example-project" \
  --summary "Short project summary." \
  --category ai \
  --tag audio \
  --details

./scripts/catalog.sh collection list
./scripts/catalog.sh collection show voice-cloning
./scripts/catalog.sh collection new smoke-collection \
  --title "Smoke Collection" \
  --summary "Smoke summary." \
  --publication-status draft \
  --project xtts
./scripts/catalog.sh collection add-project smoke-collection f5-tts --note "Useful comparison project."
./scripts/catalog.sh collection set-note smoke-collection f5-tts --note "Updated note."
./scripts/catalog.sh collection remove-project smoke-collection f5-tts
./scripts/catalog.sh collection set-publication-status smoke-collection published
./scripts/catalog.sh collection delete smoke-collection --force

./scripts/catalog.sh import validate .tmp/import-batches/example-batch
./scripts/catalog.sh import plan .tmp/import-batches/example-batch
./scripts/catalog.sh import diff .tmp/import-batches/example-batch
./scripts/catalog.sh import apply .tmp/import-batches/example-batch --allow-replace
```

## Verification Boundary

`verify.sh` 不检查维护文档。文档只解释已实现规则，代码和 loader 才是真相源。

## Dev Server Management

`dev.sh start` 会后台启动 Astro dev server，并把 pid、端口和日志写入 `.run/dev.pid`、`.run/dev.port`、`.run/dev.log`。只有探测到真实监听端口后才报告 `started`；进程存在但未监听端口会返回退出码 4。`status` 同样只在探测到监听端口时返回 running。如果当前仓库目录下已经存在 `astro dev` / `npm run dev`，`start` 会接管并拒绝重复启动；如果发现多个 dev server，运行 `./scripts/dev.sh restart` 收敛为一个。`start` / `stop` / `restart` 通过 `.run/dev.lock` 串行执行，避免并发启动互相覆盖运行状态。

`dev.sh start` 直接运行项目本地 Astro CLI，并把参数透传给 `astro dev`。未传 `--host` 时默认绑定 `127.0.0.1`，避免部分环境中 `localhost` 解析到 IPv6 后绑定失败；host 会写入 `.run/dev.host`，供 `status` 显示 URL。

`dev.sh stop` 和 `restart` 只会停止当前仓库 cwd 下的 dev server，杀进程前会校验 cwd 和命令，避免误杀其他项目。

`catalog` 和 `content` 当前都通过 `npm run build` 触发可执行校验。项目、专题、taxonomy、site 和详情文件引用都由 schema/loader 在构建期验证。未来如果构建变慢，可以新增更窄的 catalog-only 校验，但仍应复用 schema/loader，不在 shell 里重写合同。

`catalog.sh new` 创建项目后会立即调用 `./scripts/catalog.sh validate`。如果 category、tag、maintenance_status、summary 或引用文件不符合合同，最终由 schema/loader 失败退出。项目 maintenance_status 和 category/tag 一样引用 `catalog/taxonomies.yaml` 中的受控 id。

`catalog.sh collection` 使用结构化 YAML 读写专题配置。写操作会调用 `./scripts/verify.sh catalog`；验证失败时脚本会回滚刚才的写入。collection 字段合同仍由 `src/lib/catalog/catalog-schema.js` 和 `src/lib/catalog/collections.ts` 执行。

脚本里的 id、maintenance_status、publication_status、必填参数检查只是为了更早给出友好错误，不是配置合同来源。脚本和 loader 不一致时，以 schema/loader 为准。

project 和 collection 写操作共用 `.data/catalog-write.lock`。如果进程被强制终止并留下锁目录，确认没有 catalog 写操作运行后可以删除该目录，再重新执行命令。

## Import Batch

`catalog.sh import` 是 AI 或人工整理结果进入正式 catalog 前的安全入口。批次必须位于 `.tmp/import-batches/<batch-id>/`，并由 `manifest.yaml` 显式声明 `create`、`replace`、`delete` 操作。

`replace` 和 `delete` 都需要显式授权参数。应用时脚本会加写锁、备份被影响的 item 目录、写入正式 `catalog/`，然后运行 `./scripts/verify.sh catalog`。验证失败时会回滚已经写入的目录。

Import batch 不是长期数据源。应用成功后，正式来源仍是 `catalog/projects/` 和 `catalog/collections/`。

合同说明见 [`../docs/contract/catalog-import-batch.md`](../docs/contract/catalog-import-batch.md)。
日常操作手册见 [`../docs/runbooks/catalog-import-workflow.md`](../docs/runbooks/catalog-import-workflow.md)。
