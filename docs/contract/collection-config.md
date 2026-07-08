# Collection Config Contract

本文说明 `collection.yaml` 的配置合同。真正执行校验的代码在 `src/lib/catalog/project-schema.ts`、`src/lib/catalog/collections.ts` 和 `src/lib/catalog/details.ts`；本文只解释已经实现的规则。

## 心智模型

专题是人工策展的项目列表：

```text
projects
  项目事实本体。

collections
  只引用已有 project id，决定专题名称、说明、展示顺序和策展备注。
```

专题不复制项目的 repo、summary、category、tags 或 status。删除、修改、新增专题不改变项目本体。

## 文件布局

```text
catalog/collections/<id>/
  collection.yaml
  details.md
```

专题目录名必须和 `collection.yaml` 的 `id` 一致。

## 必填字段

| Field | Rule |
| --- | --- |
| `schema_version` | 必须是 `1`。 |
| `id` | 必填，唯一，小写 kebab-case，且必须和专题目录名一致。 |
| `title` | 必填，专题展示标题。 |
| `summary` | 必填，专题摘要，最多 180 个字符。 |
| `status` | 必填，枚举：`published`、`draft`、`archived`。 |
| `items` | 必填，至少 1 个项目引用。 |

`published` 和 `archived` 会生成公开专题页面。`draft` 会被 loader 校验，但不会进入 `/collections/` 列表，也不会生成 `/collections/[id]/` 详情页。

## Items

`items` 保存专题内项目引用和可选策展备注。

| Field | Rule |
| --- | --- |
| `items[].project` | 必填，必须引用已经存在的 project id。 |
| `items[].note` | 可选，最多 180 个字符，用于解释该项目为什么进入专题。 |

同一个专题内不能重复引用同一个项目。

专题页面按照 `items` 的顺序展示项目。

## 可选字段

| Field | Rule |
| --- | --- |
| `details.type` | `schema_version: 1` 只支持 `markdown`。 |
| `details.path` | `schema_version: 1` 必须是 `./details.md`。 |
| `blocks` | typed extension blocks 数组，结构和项目 blocks 使用同一套 block schema。 |

`details.md` 是专题长文说明，不定义可筛选字段。

`details.path` 的字段规则由 `src/lib/catalog/project-schema.ts` 校验；Markdown 文件注册和加载路径由 `src/lib/catalog/details.ts` 执行。

## 示例

```yaml
schema_version: 1
id: voice-cloning
title: 声音克隆项目
summary: 适合研究声音克隆、参考音频生成和音色转换的开源项目。
status: published
items:
  - project: gpt-sovits
    note: 适合学习完整音色克隆训练流程。
  - project: xtts
    note: 适合快速用参考音频做多语言 TTS。
details:
  type: markdown
  path: ./details.md
blocks:
  - type: highlights
    title: 适合谁
    items:
      - 想系统比较开源声音克隆项目。
```

## 变更规则

- 新增专题时创建 `catalog/collections/<id>/collection.yaml`。
- 专题只能引用已有项目，不能在专题里复制项目事实。
- 跨文件不变量由 `src/lib/catalog/collections.ts` 执行。
- 新字段必须先更新 `src/lib/catalog/project-schema.ts`。
- 本文只解释 schema 和 loader 已经实现的规则。
