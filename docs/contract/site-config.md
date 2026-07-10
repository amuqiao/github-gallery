# Site Config Contract

本文说明站点级配置 `catalog/site.yaml`。真正执行校验的代码在 `src/lib/catalog/catalog-schema.js` 和 `src/lib/catalog/site.ts`。

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

## Navigation Route Rules

`navigation[].href` 只能使用入口级 canonical 路径：

- 平台首页：`/`
- 展馆入口：`/halls/<hall-id>/`
- active 展馆的专题列表：`/halls/<hall-id>/collections/`

`hall id` 必须引用 `catalog/halls/<id>/hall.yaml` 中存在的 hall。`planned` hall 可以作为展馆入口导航，但不能配置专题列表导航。

Content item、note 和 collection detail 路由由 content bundle 自动生成，不写进站点导航。

## Change Rules

- 不要在共享布局里硬编码领域分类。
- 新增导航项时修改 `catalog/site.yaml`。
- 导航链接优先保持简单稳定：根页面、展馆页或馆内专题页。
