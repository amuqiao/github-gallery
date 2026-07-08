# Scripts

`scripts/` 提供本仓库稳定的人类操作入口。它们是薄 wrapper，真正的配置合同仍由 `src/lib/catalog/project-schema.ts`、`src/lib/catalog/projects.ts` 和 `src/lib/catalog/collections.ts` 执行。

## Mental Model

```text
dev.sh       本地 Astro 开发入口
verify.sh    一次性验证入口
catalog.sh   catalog 项目维护入口
```

不要把后端服务项目的部署、队列、数据库、压测或远程运维语义放进这里。当前项目是 Astro static site + YAML catalog。

## Entrypoints

| Entrypoint | Owns | Does Not Own |
| --- | --- | --- |
| `dev.sh` | `npm run dev`、`npm run preview`、`npm run build` 的稳定入口。 | 后台进程、部署、远程服务。 |
| `verify.sh` | build/catalog/content 验证，包括 projects、collections、taxonomy、site 和被引用详情文件。 | README 或 `docs/` 漂移检查。 |
| `catalog.sh` | project list/validate/new，以及 collection list/show/new/delete/update。 | GitHub API 抓取、taxonomy 自动修改、schema 之外的字段生成。 |

## Commands

Requires Node.js 20 or newer.

```sh
./scripts/dev.sh start
./scripts/dev.sh start --host 0.0.0.0
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
  --status draft \
  --project xtts
./scripts/catalog.sh collection add-project smoke-collection f5-tts --note "Useful comparison project."
./scripts/catalog.sh collection set-note smoke-collection f5-tts --note "Updated note."
./scripts/catalog.sh collection remove-project smoke-collection f5-tts
./scripts/catalog.sh collection delete smoke-collection --force
```

## Verification Boundary

`verify.sh` 不检查维护文档。文档只解释已实现规则，代码和 loader 才是真相源。

`catalog` 和 `content` 当前都通过 `npm run build` 触发可执行校验。项目、专题、taxonomy、site 和详情文件引用都由 schema/loader 在构建期验证。未来如果构建变慢，可以新增更窄的 catalog-only 校验，但仍应复用 schema/loader，不在 shell 里重写合同。

`catalog.sh new` 创建项目后会立即调用 `./scripts/catalog.sh validate`。如果 category、tag、summary、status 或引用文件不符合合同，最终由 schema/loader 失败退出。

`catalog.sh collection` 使用结构化 YAML 读写专题配置。写操作会调用 `./scripts/verify.sh catalog`；验证失败时脚本会回滚刚才的写入。collection 字段合同仍由 `src/lib/catalog/project-schema.ts` 和 `src/lib/catalog/collections.ts` 执行。

脚本里的 id、status、必填参数检查只是为了更早给出友好错误，不是配置合同来源。脚本和 loader 不一致时，以 schema/loader 为准。

project 和 collection 写操作共用 `.data/catalog-write.lock`。如果进程被强制终止并留下锁目录，确认没有 catalog 写操作运行后可以删除该目录，再重新执行命令。
