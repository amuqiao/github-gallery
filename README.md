# GitHub Gallery

一个基于合同驱动的 GitHub 项目静态展馆。

## Structure

```text
catalog/projects/<id>/project.yaml  # 项目机器可读事实
catalog/projects/<id>/details.md    # 可选详情正文
catalog/collections/<id>/collection.yaml # 专题机器可读事实
catalog/collections/<id>/details.md  # 可选专题详情正文
catalog/taxonomies.yaml             # 共享分类、标签和项目状态词表
catalog/site.yaml                   # 站点标题、描述和导航
src/lib/catalog/                    # schema、loader、adapter
src/styles/global.css               # Tailwind 入口和 shadcn-style token
src/components/ui/                  # 通用 UI primitives
src/components/blocks/              # typed block renderers
scripts/                            # 本地开发、验证、catalog 维护入口
docs/contract/                      # 维护者可读合同说明
docs/current/                       # 当前已实现结构
docs/plans/                         # 未来计划
docs/runbooks/                      # 可重复维护流程
```

## Maintainer Docs

修改 catalog 模型时按这个顺序阅读：

1. [当前结构](docs/current/structure.md)
2. [前端导航结构](docs/current/frontend-navigation.md)
3. [项目配置合同](docs/contract/project-config.md)
4. [专题配置合同](docs/contract/collection-config.md)
5. [Taxonomy 配置合同](docs/contract/taxonomy-config.md)
6. [站点配置合同](docs/contract/site-config.md)
7. [Catalog 合同迭代手册](docs/runbooks/catalog-contract-iteration.md)

修改前端 UI 时按这个顺序阅读：

1. [UI 架构](docs/current/ui-architecture.md)
2. [Frontend UI Iteration](docs/runbooks/frontend-ui-iteration.md)

长期计划见 [Roadmap](docs/plans/roadmap.md)。

## Commands

Requires Node.js 20 or newer.

```sh
npm install
./scripts/dev.sh start
./scripts/verify.sh check
```

原始 npm 命令仍可直接使用：

```sh
npm run dev
npm run build
npm run preview
```

Catalog 维护入口：

```sh
./scripts/catalog.sh list
./scripts/catalog.sh validate
./scripts/catalog.sh collection list
./scripts/catalog.sh collection show voice-cloning
```

完整脚本说明见 [scripts/README.md](scripts/README.md)。
