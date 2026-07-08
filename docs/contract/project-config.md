# Project Config Contract

本文说明 `project.yaml` 的配置合同。真正执行校验的代码在 `src/lib/catalog/catalog-schema.js`；本文只解释已经实现的规则。

## 心智模型

每个 GitHub Gallery 项目都有一个 `project.yaml`。配置分为两层：

```text
stable core = 项目身份、路由、筛选、关系等稳定事实
typed blocks = 详情页可扩展展示内容
notes = 项目附加文章或独立笔记入口
```

不要把可选展示内容持续加成顶层字段。顶层字段只放长期稳定、跨页面会依赖的事实；详情页扩展内容放入 `blocks`。

长文概览属于 `details.md`。可点击的附加文章、私人笔记或独立 HTML 页面属于 `notes`。

## 文件布局

```text
catalog/projects/<id>/
  project.yaml
  details.md
  notes/
    intro.md
    experiment-log/
      index.html
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
| `notes` | 项目附加内容索引；每个 note 会生成独立访问路由。 |
| `blocks` | typed extension blocks 数组。 |

`meta` 只保存人工维护、相对稳定的展示事实。GitHub stars、last activity、last checked 等抓取结果属于未来的 generated metadata 数据面，不进入 `project.yaml`。

被 `details.path` 引用的文件不能是 symlink。

## Notes

`notes` 是项目附加内容入口，和 `details`、`blocks` 并列：

- `details` 是项目详情页内的主概览正文。
- `blocks` 是项目详情页内的结构化短信息。
- `notes` 是从项目详情页跳转出去的文章或独立页面。

每个 note 必须包含：

| Field | Rule |
| --- | --- |
| `id` | 必填，项目内唯一，小写 kebab-case；路由使用该 id。 |
| `title` | 必填，笔记标题。 |
| `type` | 必填，`markdown` 或 `html`。 |
| `path` | 必填，必须位于项目本地 `./notes/` 下。 |
| `summary` | 必填，笔记索引卡片摘要，最多 180 个字符。 |
| `display` | 必填，`site` 或 `standalone`。 |
| `html_mode` | HTML note 必填，`fragment` 或 `document`；Markdown note 不允许设置。 |

`display: site` 表示进入本站统一页面壳层。Markdown note 和 HTML fragment note 可以使用 `site`。

`display: standalone` 表示返回独立 HTML 页面，不套本站 `BaseLayout`。只有 HTML document note 可以使用 `standalone`。

合法组合只有：

| Type | Display | HTML Mode | Behavior |
| --- | --- | --- | --- |
| `markdown` | `site` | 不设置 | 渲染为本站统一风格文章。 |
| `html` | `site` | `fragment` | 作为受控 HTML 正文片段渲染进本站统一页面。 |
| `html` | `standalone` | `document` | 返回独立 HTML 页面。 |

HTML fragment 是正文片段，不是完整 HTML 文档。它不能包含 `doctype`、`html`、`head`、`body`、`script`、`link`、`meta`、内联事件处理器或内联 `style` 属性。违反这些规则会构建失败。

示例：

```yaml
notes:
  - id: intro
    title: GPT-SoVITS 项目介绍
    type: markdown
    path: ./notes/intro.md
    summary: 从用途、能力边界和典型流程理解 GPT-SoVITS。
    display: site
  - id: experiment-log
    title: 私人实验记录
    type: html
    path: ./notes/experiment-log/index.html
    summary: 一份独立排版的本地实验笔记。
    display: standalone
    html_mode: document
  - id: html-brief
    title: 站内 HTML 笔记
    type: html
    path: ./notes/html-brief.html
    summary: 一篇使用本站页面壳层承载的受控 HTML 片段。
    display: site
    html_mode: fragment
```

被 `notes[].path` 引用的文件必须存在，不能是 symlink，真实路径不能越出项目目录。未在 `project.yaml` 声明的 note 文件不会生成页面。

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

MDX 详情页是未来能力，不属于 `schema_version: 1`。HTML 仅作为 `notes` 的附加内容类型进入合同；主详情 `details` 仍只支持 Markdown。

## 变更规则

- 新增顶层字段前，先判断它是否真的属于 stable core。
- 可选详情页内容优先新增 typed block。
- 新字段必须先更新 `src/lib/catalog/catalog-schema.js`。
- 跨文件不变量必须在 `src/lib/catalog/projects.ts` 中执行。
- 本文只解释 schema 和 loader 已经实现的规则。
- 第一版不提供无类型 `extensions` 顶层字段；实验内容进入代码前必须先设计成 stable core 或 typed block。
