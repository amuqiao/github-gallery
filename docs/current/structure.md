# GitHub Gallery Structure

本文只描述当前已经实现的结构和运行路径。

## Current Behavior

- 站点是 Astro static site。
- 项目数据位于 `catalog/projects/<id>/project.yaml`。
- 可选详情正文位于同一项目目录的 `details.md`。
- 分类和标签词表位于 `catalog/taxonomies.yaml`。
- 站点标题、描述、导航位于 `catalog/site.yaml`。
- 页面不直接解析 YAML，而是调用 `src/lib/catalog/projects.ts`。
- `src/lib/catalog/projects.ts` 构建共享 catalog snapshot，包括项目索引、taxonomy 索引、关系校验和相关项目查询。
- `src/lib/catalog/block-adapters.ts` 在渲染前适配 typed blocks。
- `src/lib/catalog/details.ts` 加载 Markdown 详情正文。
- `src/components/blocks/BlockRenderer.astro` 负责渲染 blocks。

## Runtime Path

```text
catalog/projects/<id>/project.yaml
  -> src/lib/catalog/project-schema.ts
  -> src/lib/catalog/projects.ts
  -> src/pages/index.astro
  -> src/pages/projects/[id].astro
  -> src/pages/categories/[category].astro
  -> src/pages/tags/[tag].astro
  -> static HTML output

catalog/projects/<id>/details.md
  -> src/lib/catalog/details.ts
  -> src/pages/projects/[id].astro
  -> static HTML output

catalog/projects/<id>/project.yaml blocks
  -> src/lib/catalog/project-schema.ts
  -> src/lib/catalog/projects.ts
  -> src/lib/catalog/block-adapters.ts
  -> src/pages/projects/[id].astro
  -> src/components/blocks/BlockRenderer.astro
  -> static HTML output
```

## State Authority

`project.yaml` 的 stable core 字段是项目卡片、筛选、路由和跨项目关系的机器可读来源。

`blocks` 是详情页可扩展展示内容来源。

`catalog/site.yaml` 是站点导航和站点级展示信息来源。

`details.md` 是人类可读长文说明，不定义可筛选字段。

## Verification

- `npm run build` 会运行 `astro check` 和 `astro build`。
- 配置违反 schema、引用未知 taxonomy、引用缺失文件、路径越出项目目录、related project 不存在时，构建应失败。
- `schema_version: 1` 只支持 Markdown 详情。
- `schema_version: 1` 支持 `links`、`highlights`、`use-cases` blocks。
