# GitHub Gallery

一个基于合同驱动的 GitHub 项目静态展馆。

## Structure

```text
catalog/projects/<id>/project.yaml  # 项目机器可读事实
catalog/projects/<id>/details.md    # 可选详情正文
catalog/taxonomies.yaml             # 共享分类和标签
catalog/site.yaml                   # 站点标题、描述和导航
src/lib/catalog/                    # schema、loader、adapter
src/components/blocks/              # typed block renderers
docs/contract/                      # 维护者可读合同说明
docs/current/                       # 当前已实现结构
docs/plans/                         # 未来计划
docs/runbooks/                      # 可重复维护流程
```

## Maintainer Docs

修改 catalog 模型时按这个顺序阅读：

1. [当前结构](docs/current/structure.md)
2. [项目配置合同](docs/contract/project-config.md)
3. [站点配置合同](docs/contract/site-config.md)
4. [Catalog 合同迭代手册](docs/runbooks/catalog-contract-iteration.md)
5. [Roadmap](docs/plans/roadmap.md)

## Commands

```sh
npm install
npm run dev
npm run build
```
