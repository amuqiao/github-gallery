# Model Config Contract

本文说明 `catalog/models/<id>/model.yaml` 的配置合同。真正执行校验的代码在 `src/lib/catalog/catalog-schema.js`、`src/lib/catalog/models.ts` 和 `src/lib/catalog/details.ts`。

## Purpose

Model 是模型展馆当前支持的条目类型。它用于收集模型来源、提供方、输入输出模态、任务、运行格式和用途说明。

## File Layout

```text
catalog/models/<id>/
  model.yaml
  details.md
  notes/
    quick-start.md
```

目录名必须和 `model.yaml.id` 一致。

## Required Core Fields

| Field | Rule |
| --- | --- |
| `schema_version` | 必须是 `1`。 |
| `id` | 必填，唯一，小写 kebab-case，且必须和目录名一致。 |
| `name` | 必填，模型展示名。 |
| `provider` | 必填，模型提供方或发布方。 |
| `source_url` | 必填，模型来源 URL。 |
| `summary` | 必填，最多 180 个字符。 |
| `modalities.input` | 必填，非空输入模态数组。 |
| `modalities.output` | 必填，非空输出模态数组。 |
| `tasks` | 必填，非空任务数组。 |
| `access` | 必填，非空访问方式数组。 |
| `formats` | 必填，非空模型格式数组。 |
| `runtimes` | 必填，非空运行时数组。 |
| `use_cases` | 必填，非空使用场景数组。 |

## Optional Fields

| Field | Rule |
| --- | --- |
| `license` | 手写维护的许可证文本标签。 |
| `details` | 当前只支持 `type: markdown` 和 `path: ./details.md`。 |
| `notes` | 模型附加内容索引，字段组合沿用项目 notes 合同。 |
| `blocks` | typed extension blocks，当前复用 `links`、`highlights`、`use-cases`。 |

## Notes And Blocks

模型 notes 支持当前已实现的组合：

| Type | Display | HTML Mode |
| --- | --- | --- |
| `markdown` | `site` | 不设置 |
| `html` | `site` | `fragment` |
| `html` | `standalone` | `document` |

被 `details.path` 和 `notes[].path` 引用的文件必须存在，不能是 symlink，真实路径不能越出模型目录。HTML fragment 仍受站内安全规则限制。

不要把 benchmark、部署硬件、耗时、输出质量观察等一次性实验事实提升为 core 字段；这些内容优先进入 `details.md`、`notes` 或 typed blocks。
