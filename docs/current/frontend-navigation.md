# Frontend Navigation Structure

本文记录当前已经实现的前端导航骨架。它说明页面如何组织浏览路径，不定义 catalog 配置合同。

## Mental Model

当前前端采用组合导航模式：

```text
Hub and Spoke
  首页作为中心页，进入专题、分类、标签和项目详情。

Filtered View
  分类页和标签页展示同一批项目的不同过滤视图。

Nested Doll
  项目列表进入项目详情；专题列表进入专题详情，专题详情再展示专题内项目。
```

这些模式只约束页面和组件结构。项目数据来源是 `src/lib/catalog/projects.ts`，专题数据来源是 `src/lib/catalog/collections.ts`。

当前页面组合由 `src/presentation/config.ts` 选择的 `bento-editorial` layout 驱动。layout 可以调整首页 section 顺序和列表变体，但不改变路由角色或 catalog 数据来源。

## Page Roles

| Page | Role | Components |
| --- | --- | --- |
| `/` | Gallery hub，展示总览、专题入口、taxonomy 入口和全部项目。 | `HomeBentoHero`、`CollectionGrid`、`FilterPanel`、`ProjectCollection` |
| `/collections/` | 公开专题入口，展示 `published` 和 `archived` 专题。 | `PageHeader`、`CollectionGrid` |
| `/collections/[id]/` | 单个公开专题详情页，按专题顺序展示已引用项目。 | `Breadcrumbs`、`PageHeader`、`BlockRenderer`、`ProjectCollection` |
| `/categories/[category]/` | 按 category 的 filtered view。 | `PageHeader`、`ProjectCollection` |
| `/tags/[tag]/` | 按 tag 的 filtered view。 | `PageHeader`、`ProjectCollection` |
| `/projects/[id]/` | 项目详情页，承载 Nested Doll 详情路径。 | `Breadcrumbs`、`ProjectHero`、`BlockRenderer`、`RelatedProjects` |

## Component Boundaries

| Component | Owns | Does Not Own |
| --- | --- | --- |
| `PageHeader` | 页面首屏标题、摘要、统计和行动入口。 | 读取 catalog、决定项目集合。 |
| `CollectionGrid` | 专题集合标题、空状态和专题卡片网格。 | 读取 collection YAML、校验项目引用。 |
| `CollectionCard` | 单个专题卡片。 | 专题内项目解析。 |
| `FilterPanel` | 首页 taxonomy 浏览入口和项目计数。 | 搜索状态、URL query、taxonomy 合同。 |
| `ProjectCollection` | 项目集合标题、空状态和卡片网格。 | 解析 YAML、校验 taxonomy。 |
| `ProjectCard` | 单个项目卡片。 | 列表排序、筛选状态。 |
| `Breadcrumbs` | 详情页层级路径。 | 路由生成规则。 |
| `ProjectHero` | 项目详情首屏信息和仓库入口。 | details.md 或 blocks 渲染。 |
| `RelatedProjects` | 详情页相关项目集合。 | related project 校验。 |

## Runtime Path

```text
catalog YAML
  -> src/lib/catalog/catalog-schema.js
  -> src/lib/catalog/projects.ts
  -> src/lib/catalog/collections.ts
  -> Astro pages
  -> shared frontend components
  -> static HTML output
```

页面和组件不直接读取 YAML。当前已有列表型视图均复用 `ProjectCollection`，当前已有页面首屏均复用 `PageHeader` 或基于它封装的 `ProjectHero`。

首页首屏当前由 `HomeBentoHero` 承载，这是 `bento-editorial` layout 的业务组件，不是 catalog 合同。

## Verification

`./scripts/verify.sh check` 会运行 `astro check` 和 static build。当前前端骨架通过构建期类型检查和页面生成验证。
