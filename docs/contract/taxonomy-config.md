# Taxonomy Config Contract

本文说明 `catalog/taxonomies.yaml` 的配置合同。真正执行校验的代码在 `src/lib/catalog/project-schema.ts` 和 `src/lib/catalog/projects.ts`；本文只解释已经实现的规则。

## Purpose

`catalog/taxonomies.yaml` 是分类和标签的受控词表。项目配置只引用 `category id` 和 `tag id`，不直接写展示名。

```text
catalog/taxonomies.yaml
  -> category/tag id registry
  -> catalog/projects/<id>/project.yaml references ids
  -> loader validates references
  -> frontend renders localized labels
```

## File Layout

```text
catalog/taxonomies.yaml
```

## Required Top-Level Fields

| Field | Rule |
| --- | --- |
| `schema_version` | 必须是 `1`。 |
| `locale.default` | 默认展示语言，当前只能是 `zh` 或 `en`。 |
| `locale.supported` | 已支持语言列表，当前必须包含且只实际支持 `zh` 和 `en`。 |
| `categories` | 非空分类数组。 |
| `tags` | 非空标签数组。 |

## Taxonomy Item Fields

分类和标签 item 使用相同结构：

| Field | Rule |
| --- | --- |
| `id` | 必填，唯一，小写 kebab-case。作为项目引用、筛选和 URL 标识。 |
| `name.zh` | 必填，中文展示名。 |
| `name.en` | 必填，英文展示名。 |
| `description.zh` | 必填，中文说明。 |
| `description.en` | 必填，英文说明。 |

当前 taxonomy 是固定双语 registry，不是任意多语言系统。新增第三种语言需要先修改 `src/lib/catalog/project-schema.ts`、`src/lib/catalog/projects.ts` 和 `scripts/catalog-import-cli.mjs`，不能只改 `catalog/taxonomies.yaml`。

示例：

```yaml
tags:
  - id: voice-cloning
    name:
      zh: 声音克隆
      en: Voice Cloning
    description:
      zh: 从参考音频克隆或适配音色的项目。
      en: Projects that clone or adapt a voice from reference audio.
```

## ID Rules

`id` 是稳定机器合同：

- `project.yaml` 的 `category` 必须引用 `categories[].id`。
- `project.yaml` 的 `tags` 必须引用 `tags[].id`。
- 分类路由使用 `/categories/<category-id>/`。
- 标签路由使用 `/tags/<tag-id>/`。

重命名 `id` 属于破坏性路由变更。只修改展示名时，优先修改 `name.zh` 或 `name.en`，不要改 `id`。

## Category And Tag Boundaries

分类保持宽泛稳定，用于项目大方向。标签用于更窄的领域、能力、技术路线或工作流。

```text
category = 这个项目属于哪个大领域
tag      = 这个项目有什么能力、主题、技术路线或使用场景
```

不要为了一个很窄的主题新增 category。声音克隆、视频翻译、配音、字幕等应优先作为 tag。

## AI Usage

把 taxonomy 发送给 AI 时，应要求：

```text
category 必须从 categories[].id 中选择一个。
tags 必须从 tags[].id 中选择 1 到 8 个。
禁止直接新增未列出的 category/tag。
如果缺少合适 tag，只提出新增建议，不要写入项目 payload。
```

## Change Rules

- 新增 category 或 tag 前，先确认它不是已有词表的同义重复。
- 新增 item 必须同时提供 `zh` 和 `en` 的 `name`、`description`。
- 修改 `locale.default` 可以切换默认展示语言；新增第三语言必须先改代码合同。
- 删除或重命名 id 前，先检查所有项目引用和公开 URL 影响。
- 更新后运行 `./scripts/verify.sh check`。
