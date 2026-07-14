# Hall Config Contract

本文说明 `catalog/halls/<id>/hall.yaml` 的配置合同。真正执行校验的代码在 `src/lib/catalog/catalog-schema.js` 和 `src/lib/catalog/halls.ts`。

## Purpose

Hall 是平台首页使用的展馆入口。它只描述展馆身份、摘要、开放状态和路由，不定义展馆内条目的字段合同。

## File Layout

```text
catalog/halls/<id>/hall.yaml
```

目录名必须和 `hall.yaml.id` 一致。

## Required Fields

| Field | Rule |
| --- | --- |
| `schema_version` | 必须是 `1`。 |
| `id` | 必填，唯一，小写 kebab-case，且必须和目录名一致。 |
| `title` | 必填，展馆展示标题。 |
| `summary` | 必填，展馆摘要，最多 220 个字符。 |
| `availability` | 必填，`active` 或 `planned`。 |
| `order` | 必填，非负整数，用于平台首页排序。 |

`planned` 只表示展馆入口已预留，条目合同未开放。不要复用项目维护状态或专题发布状态表达 hall availability。

Hall 路由由 loader 根据 id 推导为 `/halls/<id>/`，不在 YAML 中手写，避免配置链接和实际页面漂移。

## Boundaries

- Hall 配置不包含颜色、布局、卡片 variant 或展示主题。
- Hall 配置不定义模型、音乐、电影等领域条目字段。
- 实验室是 active 展馆，用于临时收纳尚未形成稳定分类的项目、技术笔记和工程资料。
- 音乐展馆和电影展馆当前只有 `planned` 入口，不支持正式条目。
