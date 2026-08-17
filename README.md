# Gallery Platform

一个基于合同驱动的静态展馆平台。当前包含 GitHub 展馆、模型展馆、Mac / iOS Store、实验室，以及预留的音乐和电影展馆入口。

## Structure

```text
catalog/halls/<id>/hall.yaml       # 展馆入口机器可读事实
catalog/content/{drafts,published,archived}/ # content bundle 合同；published 生成 canonical 页面
catalog/taxonomies.yaml             # 共享分类、标签和项目维护状态词表
catalog/site.yaml                   # 站点标题、描述和导航
src/lib/catalog/                    # schema、loader、adapter
src/lib/catalog/projections.ts      # content read model 到页面、卡片、搜索视图的投影
src/styles/global.css               # Tailwind 入口和 shadcn-style token
src/components/ui/                  # 通用 UI primitives
src/components/blocks/              # typed block renderers
scripts/                            # 本地开发、验证、content 维护测试和 Docker 部署入口
docs/contract/                      # 维护者可读合同说明
docs/current/                       # 当前已实现结构
docs/plans/                         # 未来计划
docs/runbooks/                      # 可重复维护流程
```

## Maintainer Docs

修改 catalog 模型时按这个顺序阅读：

1. [当前结构](docs/current/structure.md)
2. [前端导航结构](docs/current/frontend-navigation.md)
3. [Hall 配置合同](docs/contract/hall-config.md)
4. [Content Bundle 配置合同](docs/contract/content-bundle-config.md)
5. [Content Import Batch 合同](docs/contract/content-import-batch.md)
6. [Taxonomy 配置合同](docs/contract/taxonomy-config.md)
7. [站点配置合同](docs/contract/site-config.md)

修改前端 UI 时按这个顺序阅读：

1. [UI 架构](docs/current/ui-architecture.md)
2. [Frontend UI Iteration](docs/runbooks/frontend-ui-iteration.md)

长期计划见 [Roadmap](docs/plans/roadmap.md)。

## Commands

Requires Node.js 20 or newer. `./scripts/content-workflow-test.sh` also requires Git, rsync, mktemp, date, cksum, and an existing `node_modules/` in the main repository.

```sh
npm install
./scripts/dev.sh start
./scripts/verify.sh check
./scripts/verify.sh release
./scripts/verify.sh catalog
./scripts/content-workflow-test.sh
```

原始 npm 命令仍可直接使用：

```sh
npm run dev
npm run build
npm run preview
```

Content bundle 发布入口：

```sh
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
  --runtime onnxruntime
./scripts/content.sh item new app-store apple_app example-macos-app \
  --title "Example macOS App" \
  --summary "Example Apple platform app summary." \
  --source-type github \
  --source-url "https://github.com/example/example-macos-app" \
  --platform macos \
  --distribution "GitHub Releases" \
  --tag macos \
  --tag open-source \
  --maintenance-status unknown
./scripts/content.sh import validate .tmp/import-batches/example-content-batch
./scripts/content.sh import apply .tmp/import-batches/example-content-batch
./scripts/content.sh item note import models example-model implementation-guide \
  --state drafts \
  --file .tmp/note-sources/implementation-guide.md \
  --title "Implementation Guide" \
  --summary "Imported note file."
./scripts/content.sh publish models item example-model
./scripts/content.sh status models item example-model
./scripts/content.sh list published models
```

Docker 部署入口：

```sh
cp .env.example .env
./scripts/deploy.sh check
./scripts/deploy.sh modes

# preview / pre：本机临时验收
./scripts/deploy.sh start pre
./scripts/deploy.sh status pre
./scripts/deploy.sh restart pre
./scripts/deploy.sh stop pre

# standalone：单机长期运行
./scripts/deploy.sh start standalone
./scripts/deploy.sh status standalone
./scripts/deploy.sh restart standalone
./scripts/deploy.sh stop standalone

# proxy：接入已有反向代理网络
./scripts/deploy.sh start proxy
./scripts/deploy.sh status proxy
./scripts/deploy.sh restart proxy
./scripts/deploy.sh stop proxy
```

完整脚本说明见 [scripts/README.md](scripts/README.md)。
