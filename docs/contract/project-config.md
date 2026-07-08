# Project Config Contract

本文说明 `project.yaml` 的配置合同。真正执行校验的代码在 `src/lib/catalog/catalog-schema.js`；本文只解释已经实现的规则。

## 心智模型

每个 GitHub Gallery 项目都有一个 `project.yaml`。配置分为两层：

```text
stable core = 项目身份、路由、筛选、关系等稳定事实
typed blocks = 详情页可扩展展示内容
```

不要把可选展示内容持续加成顶层字段。顶层字段只放长期稳定、跨页面会依赖的事实；详情页扩展内容放入 `blocks`。

长文说明属于 `details.md`。

## 文件布局

```text
catalog/projects/<id>/
  project.yaml
  details.md
```

项目目录名必须和 `project.yaml` 的 `id` 一致。

## 必填 Core 字段

| Field | Rule |
| --- | --- |
| `schema_version` | 必须是 `1`。 |
| `id` | 必填，唯一，小写 kebab-case，且必须和项目目录名一致。 |
| `name` | 必填，项目展示名。 |
| `repo` | 必填，项目仓库 URL。 |
| `summary` | 必填，卡片摘要，最多 160 个字符。 |
| `category` | 必填，必须引用 `catalog/taxonomies.yaml` 中存在的分类 id。taxonomy 合同见 [`taxonomy-config.md`](./taxonomy-config.md)。 |
| `tags` | 必填，1 到 8 个标签 id，必须来自 `catalog/taxonomies.yaml`。taxonomy 合同见 [`taxonomy-config.md`](./taxonomy-config.md)。 |
| `maintenance_status` | 必填，必须引用 `catalog/taxonomies.yaml` 中存在的项目维护状态 id。taxonomy 合同见 [`taxonomy-config.md`](./taxonomy-config.md)。 |

## 可选 Core 字段

| Field | Rule |
| --- | --- |
| `details.type` | `schema_version: 1` 只支持 `markdown`。 |
| `details.path` | `schema_version: 1` 必须是 `./details.md`。 |
| `meta.license` | 手写维护的许可证文本标签。 |
| `meta.languages` | 手写维护的主要语言列表；存在时必须是非空数组。 |
| `relations.related_projects` | 项目 id 数组；所有 id 必须存在。 |
| `blocks` | typed extension blocks 数组。 |

`meta` 只保存人工维护、相对稳定的展示事实。GitHub stars、last activity、last checked 等抓取结果属于未来的 generated metadata 数据面，不进入 `project.yaml`。

被 `details.path` 引用的文件不能是 symlink。

## Blocks

`blocks` 是详情页可扩展内容入口。每个 block 必须有已知 `type`；未知 `type` 会构建失败。

`schema_version: 1` 支持：

| Type | Purpose |
| --- | --- |
| `links` | 一组外部链接。 |
| `highlights` | 项目亮点、优点或关键事实。 |
| `use-cases` | 常见使用场景。 |

新增 block type 的门槛是它需要独立 schema、adapter 或 renderer。不要只因为想换一个小标题就新增 type；同结构、同渲染、同数据含义的内容应复用已有 block，并用可选 `title` 调整展示标题。

示例：

```yaml
blocks:
  - type: highlights
    title: Highlights
    items:
      - Includes a browser WebUI.
      - Useful for learning the full workflow.
```

## 保留格式

MDX 和 HTML 详情页是未来能力，不属于 `schema_version: 1`。只有在代码完成集成、校验和安全处理后，才能进入本合同。

## 变更规则

- 新增顶层字段前，先判断它是否真的属于 stable core。
- 可选详情页内容优先新增 typed block。
- 新字段必须先更新 `src/lib/catalog/catalog-schema.js`。
- 跨文件不变量必须在 `src/lib/catalog/projects.ts` 中执行。
- 本文只解释 schema 和 loader 已经实现的规则。
- 第一版不提供无类型 `extensions` 顶层字段；实验内容进入代码前必须先设计成 stable core 或 typed block。
