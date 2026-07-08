# Site Config Contract

本文说明站点级配置 `catalog/site.yaml`。真正执行校验的代码在 `src/lib/catalog/project-schema.ts`。

## Purpose

`catalog/site.yaml` 负责站点标题、默认描述和导航。共享布局不应该硬编码某个领域分类，例如 `ai`。

## File Layout

```text
catalog/site.yaml
```

## Required Fields

| Field | Rule |
| --- | --- |
| `title` | 必填，站点展示标题。 |
| `description` | 必填，默认 meta description。 |
| `navigation` | 必填，非空 `{ label, href }` 数组。 |

## Route Rules

- 项目路由：`/projects/<project-id>/`
- 分类路由：`/categories/<category-id>/`
- 标签路由：`/tags/<tag-id>/`
- `project id`、`category id`、`tag id` 都是对外 URL 标识，重命名属于破坏性路由变更。
- 第一版允许空分类页和空标签页存在，因为 taxonomy id 是稳定入口。

## Change Rules

- 不要在共享布局里硬编码领域分类。
- 新增导航项时修改 `catalog/site.yaml`。
- 导航链接优先保持简单稳定：根页面、锚点、分类页或标签页。
