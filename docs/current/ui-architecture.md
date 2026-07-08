# UI Architecture

本文记录当前已经实现的 UI 样式架构。它说明视觉层如何分层维护，不定义 catalog 数据合同。

## Mental Model

当前 UI 层采用：

```text
src/presentation/*
  管理当前 layoutId/themeId，并提供 layout/theme registry。

Tailwind CSS
  提供 utility、响应式规则和主题 token。

shadcn-style primitives
  提供 Button、Badge、Card 等稳定 UI 语义。

Business components
  组合 UI primitives，并消费已解析的 view model。

Pages
  做页面编排，并把 site read model 以 props 传给 layout。
```

`BaseLayout` 只负责 document shell、站点导航、footer 和全局 CSS import。它不直接读取 catalog loader，只消费页面传入的 `site` props，不承载项目卡片、筛选面板、详情页等组件样式。

`src/presentation/config.ts` 是当前展示版本入口。当前启用：

```text
layoutId = bento-editorial
themeId  = editorial-paper
```

layout 决定页面族分发、section 顺序、列表密度和卡片变体。theme 决定 CSS token、字体、颜色、边框、背景和基础质感。首页精选专题由 `src/presentation/home.ts` 管理。它们都不进入 `project.yaml` 或 `collection.yaml`。

项目集合卡片通过 `src/lib/catalog/project-view-models.ts` 预先解析 category、tags 和 status。`ProjectCollection` 不调用 catalog loader 的运行时 helper。

## Runtime Styling Path

```text
astro.config.mjs
  -> @tailwindcss/vite
  -> src/presentation/config.ts
  -> src/presentation/layouts.ts
  -> src/presentation/themes.ts
  -> src/styles/global.css
  -> src/components/ui/*
  -> src/components/*
  -> src/pages/*
```

`src/styles/global.css` 保存 Tailwind import、shadcn-style CSS variables、Tailwind theme 映射和少量 base/prose 样式。

`BaseLayout` 会把当前展示选择投射成：

```text
html[data-layout="bento-editorial"][data-theme="editorial-paper"]
```

CSS 当前通过 `data-theme` 应用皮肤 token；`data-layout` 用于运行时检查和页面布局分发标识。

## Presentation Registry

| File | Owns | Does Not Own |
| --- | --- | --- |
| `src/presentation/config.ts` | 当前启用的 `layoutId` 和 `themeId`。 | catalog 字段、项目级展示选择。 |
| `src/presentation/home.ts` | 首页展示内容选择，例如 featured collection id。 | layout grid、颜色、catalog schema。 |
| `src/presentation/layouts.ts` | 页面族布局版本、首页 section 顺序、组件 variant 选择。 | 颜色、字体、项目事实。 |
| `src/presentation/status-tones.ts` | 项目维护状态 id 到轻量视觉 tone 的映射。 | 状态文案、状态说明、taxonomy 校验。 |
| `src/presentation/themes.ts` | 皮肤版本元数据。 | 页面 section 顺序、catalog 字段。 |
| `src/presentation/types.ts` | layout/theme/variant 类型边界。 | 运行时数据读取。 |

当前 registry 是代码级开发者配置，不是内容编辑合同。未知 layout 或 theme 不应静默降级。

## UI Primitive Boundary

| Primitive | Owns | Does Not Own |
| --- | --- | --- |
| `Button` | 按钮/链接按钮 variants 和 focus 样式。 | 项目路由、业务动作语义。 |
| `Badge` | 分类、标签等小型标记样式。 | taxonomy 读取和校验。 |
| `ChipLink` | 带可选计数的筛选/导航 chip 链接样式。 | taxonomy 读取、计数规则和路由生成。 |
| `Card` | 卡片外壳、边框、背景、阴影。 | 卡片内部业务结构。 |
| `SectionHeader` | eyebrow、标题、说明文本层级。 | 页面数据加载。 |
| `EmptyState` | 空集合提示。 | 空状态判断规则。 |
| `ContentBlock` | typed block 标题和内容外壳。 | block schema 和 adapter。 |
| `Prose` | Markdown 详情正文容器。 | Markdown 加载和详情格式合同。 |

## Business Component Boundary

| Component | Uses | Owns |
| --- | --- | --- |
| `PageHeader` | `SectionHeader`、`Card` | 页面首屏标题、统计和行动区。 |
| `CollectionGrid` | `SectionHeader`、`Badge`、`EmptyState`、`CollectionCard` | 专题集合网格。 |
| `CollectionCard` | `Card`、`Badge`、`Button` | 单个专题卡片。 |
| `FilterPanel` | `Card`、`Button`、`ChipLink`、`SectionHeader` | 首页 taxonomy 浏览入口和计数展示。 |
| `ProjectCollection` | `SectionHeader`、`Badge`、`EmptyState`、`ProjectCard` | 已解析项目卡片集合网格。 |
| `ProjectCard` | `Card`、`Badge`、`Button`、`ProjectStatus` | 单个项目卡片。 |
| `HomeBentoHero` | `Button`、presentation layout config | 首页 bento hero 和 gallery summary。 |
| `ProjectStatus` | taxonomy status label、presentation status tone | 项目维护状态的轻量视觉标记。 |
| `ProjectHero` | `PageHeader`、`Badge`、`Button`、`ProjectStatus` | 项目详情首屏。 |
| `RelatedProjects` | `ProjectCollection` | 相关项目集合。 |

## Verification

`./scripts/verify.sh check` 会运行 `astro check` 和 static build。当前 UI 架构通过 Tailwind 构建、Astro 类型检查和页面生成验证。
