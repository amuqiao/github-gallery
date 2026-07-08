# Frontend Page Composition Runbook

本文说明如何迭代 GitHub Gallery 的前端页面结构。核心原则是：页面可以自由设计信息架构，但稳定能力要沉淀为可复用组件。

## Mental Model

```text
catalog schema/loader
  -> page read model
  -> page composition
  -> reusable business components
  -> UI primitives
```

页面负责决定信息怎么组织。组件负责复用稳定展示能力。UI primitives 负责统一视觉语义。

不要把 `ProjectCard`、`CollectionCard`、`ProjectCollection` 这类组件清单理解成页面模板。它们是能力边界，不是强制页面布局。

## Composition Boundary

| Layer | Owns | Does Not Own |
| --- | --- | --- |
| `src/pages/*` | 页面路由、信息架构、组件顺序、页面级数据查询。 | 重复实现卡片、按钮、badge、loader 校验。 |
| `src/components/*` | 项目卡片、专题卡片、集合网格、详情首屏、筛选入口等业务展示能力。 | 直接读取 YAML、定义 catalog 字段合同。 |
| `src/components/ui/*` | Button、Badge、Card、SectionHeader 等稳定视觉 primitive。 | 项目、专题、taxonomy 等业务含义。 |
| `src/lib/catalog/*` | schema parse、loader 校验、view model 适配。 | 页面布局和视觉样式。 |

页面可以换布局，组件边界不要随意打散。

## Required Page Families

做一轮完整视觉方案时，至少要考虑这些页面族：

| Page Family | Current Routes | Primary Reusable Components |
| --- | --- | --- |
| Gallery hub | `/` | `PageHeader`、`CollectionGrid`、`FilterPanel`、`ProjectCollection` |
| Project detail | `/projects/[id]/` | `Breadcrumbs`、`ProjectHero`、`BlockRenderer`、`RelatedProjects` |
| Collection index | `/collections/` | `PageHeader`、`CollectionGrid` |
| Collection detail | `/collections/[id]/` | `Breadcrumbs`、`PageHeader`、`BlockRenderer`、`ProjectCollection` |
| Filtered project views | `/categories/[category]/`、`/tags/[tag]/` | `PageHeader`、`ProjectCollection` |

分类页和标签页可以复用项目集合视觉，不需要每次单独设计一套。

## Component Capabilities

这些组件是推荐稳定复用的能力，不是页面必须照抄的版式：

```text
ProjectCard        单个项目卡片
CollectionCard     单个专题卡片
ProjectCollection  项目集合标题、空状态和项目卡片网格
CollectionGrid     专题集合标题、空状态和专题卡片网格
FilterPanel        taxonomy 浏览和筛选入口
ProjectHero        项目详情首屏
PageHeader         通用页面标题、摘要、统计和行动入口
Breadcrumbs        详情页层级路径
```

如果新页面也要展示项目列表，优先复用 `ProjectCollection` 和 `ProjectCard`。如果新页面也要展示专题列表，优先复用 `CollectionGrid` 和 `CollectionCard`。

## When Redesigning The Home Page

按这个顺序执行：

1. 先确认首页仍然是 gallery hub，而不是单个专题页或营销页。
2. 决定首页要突出项目、专题、分类、标签中的哪些入口。
3. 保留项目卡片和专题卡片的复用路径。
4. 页面可以重排 `CollectionGrid`、`FilterPanel`、`ProjectCollection`，也可以增加新的业务组件。
5. 如果新增组件只服务首页，先放在 `src/components/`，不要改 catalog schema。
6. 运行 `./scripts/verify.sh check`。

首页可以重新设计，但不要为了首页视觉直接复制一套项目卡片。

## When Redesigning Detail Pages

项目详情页和专题详情页可以有不同视觉节奏，但它们共享这些规则：

1. 详情页顶部必须让用户知道当前对象是什么。
2. `details.md` 继续作为长文说明来源。
3. `blocks` 继续通过 `BlockRenderer` 渲染。
4. 相关项目或专题内项目继续使用项目集合组件。
5. 页面不要直接读取 Markdown 或 YAML。
6. 运行 `./scripts/verify.sh check`。

## Multiple Project Detail Pages

`schema_version: 1` 不支持一个项目多个详情页。当前每个项目最多有一个 canonical route：

```text
/projects/[id]/
```

以及一个可选详情文件：

```text
catalog/projects/<id>/details.md
```

如果未来要支持：

```text
/projects/[id]/training/
/projects/[id]/examples/
/projects/[id]/compare/
```

这不是单纯页面改版，必须先走 catalog 合同扩展：

1. 在 `src/lib/catalog/project-schema.ts` 设计 `pages` 或等价字段。
2. 在 `src/lib/catalog/projects.ts` 增加跨文件校验。
3. 在 `src/lib/catalog/details.ts` 支持多详情加载。
4. 增加 Astro route。
5. 更新 `docs/contract/project-config.md`。
6. 更新当前结构文档和本 runbook。
7. 运行 `./scripts/verify.sh check`。

代码没有支持前，不要在页面里临时扫描项目目录生成子详情页。

## When Adding A New Page

按这个顺序执行：

1. 判断新页面属于 hub、filtered view、detail，还是新的页面模式。
2. 优先从 loader 或 view model 取数据，不直接读 YAML。
3. 优先复用已有业务组件。
4. 新组件只在有清晰复用价值或职责边界时新增。
5. 如果页面需要新字段，回到 catalog 合同迭代流程。
6. 更新 [`../current/frontend-navigation.md`](../current/frontend-navigation.md)。
7. 运行 `./scripts/verify.sh check`。

## Drift Checklist

```text
[ ] 页面结构变化没有要求修改 catalog schema，除非确实新增机器可读事实。
[ ] 新页面没有直接读取 YAML 或 Markdown 文件。
[ ] 项目列表仍复用 `ProjectCollection` 或明确的新集合组件。
[ ] 项目卡片样式没有在多个页面重复实现。
[ ] 专题列表仍复用 `CollectionGrid` 或明确的新集合组件。
[ ] 详情页仍通过 `details.ts` 和 `BlockRenderer` 消费详情内容。
[ ] 新页面角色已同步到 `docs/current/frontend-navigation.md`。
[ ] `./scripts/verify.sh check` 通过。
```

## Anti-Patterns

- 把组件清单当成固定页面模板，导致页面无法根据内容重新设计。
- 每个页面各写一套项目卡片或专题卡片。
- 为了视觉布局新增 catalog 顶层字段。
- 在页面中扫描 `catalog/projects` 或 `catalog/collections`。
- 在 `src/components/ui/` 中引入项目、专题、taxonomy 等业务对象。
- 未扩展合同就临时实现多个项目详情页。
