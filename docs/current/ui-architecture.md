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
  提供 Button、Badge、Card、HoverCardLink 等稳定 UI 语义。

Business components
  组合 UI primitives，并消费已解析的 content/hall read model 或 catalog projection。

Pages
  做页面编排，并把 site read model 以 props 传给 layout。
```

`BaseLayout` 只负责 document shell、站点导航、footer 和全局 CSS import。它不直接读取 catalog loader，只消费页面传入的 `site` props。

`src/presentation/config.ts` 是当前展示版本入口。当前启用：

```text
layoutId = bento-editorial
themeId  = editorial-paper
```

layout/theme 是代码级展示 registry，不进入 content bundle 配置。内容选择由页面读取 `catalog/content/published/` 后编排。

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

`BaseLayout` 会把当前展示选择投射成：

```text
html[data-layout="bento-editorial"][data-theme="editorial-paper"]
```

内容卡片、item 详情 header 和搜索索引的业务展示字段由 `src/lib/catalog/projections.ts` 从 content read model 派生；UI 组件消费这些投影结果，不直接维护 kind/profile 到标签、统计和检索标签的映射。

## Presentation Registry

| File | Owns | Does Not Own |
| --- | --- | --- |
| `src/presentation/config.ts` | 当前启用的 `layoutId` 和 `themeId`。 | catalog 字段、内容选择。 |
| `src/presentation/layouts.ts` | layout 版本元数据。 | 页面内容、颜色、字体。 |
| `src/presentation/themes.ts` | theme 版本元数据。 | 页面内容、catalog 字段。 |
| `src/presentation/maintenance-status-tones.ts` | GitHub content maintenance status id 到轻量视觉 tone 的映射。 | 状态文案、taxonomy 校验。 |
| `src/presentation/types.ts` | layout/theme 类型边界。 | 运行时数据读取。 |

未知 layout 或 theme 不应静默降级。

## UI Primitive Boundary

| Primitive | Owns | Does Not Own |
| --- | --- | --- |
| `Button` | 按钮/链接按钮 variants 和 focus 样式。 | 业务动作语义。 |
| `Badge` | 分类、标签等小型标记样式。 | taxonomy 读取和校验。 |
| `ChipLink` | 带可选计数的导航 chip 链接样式。 | taxonomy 读取和路由生成。 |
| `Card` | 非交互卡片外壳、边框、背景、阴影。 | 可点击卡片 hover 语义、卡片内部业务结构。 |
| `HoverCardLink` | 可点击卡片的链接壳层、hover tone class、focus 样式入口。 | 具体卡片内容结构、catalog 读取。 |
| `SectionHeader` | eyebrow、标题、说明文本层级。 | 页面数据加载。 |
| `EmptyState` | 空集合提示。 | 空状态判断规则。 |
| `ContentBlock` | typed block 标题和内容外壳。 | block schema 和 adapter。 |
| `Prose` | Markdown/HTML fragment 详情正文容器。 | 内容加载和详情格式合同。 |

可点击卡片的 hover 颜色只通过 `HoverCardLink` 的 `tone` 和 `src/styles/global.css` 里的 `--tone-*` token 派生。业务组件不得新增自己的 `:hover` 边框或阴影颜色规则。

## Business Component Boundary

| Component | Uses | Owns |
| --- | --- | --- |
| `PageHeader` | `SectionHeader`、`Card` | 页面首屏标题、统计和行动区。 |
| `ContentItemCard` | `HoverCardLink`、content item card projection | canonical content item 卡片内容。 |
| `ContentCollectionCard` | `HoverCardLink`、content collection read model | canonical 馆内专题卡片内容。 |
| `ContentNoteCard` | `HoverCardLink`、content note read model | canonical 附加笔记卡片内容。 |
| `HallCard` | `HoverCardLink`、hall read model | 平台首页单个展馆入口和状态展示。 |
| `PlannedHallPage` | `PageHeader`、`Button` | planned 展馆占位页。 |
| `Breadcrumbs` | link props | 层级导航。 |
| `BlockRenderer` | adapted typed blocks | block 渲染分发。 |

平台首页、GitHub 展馆页、模型展馆页和实验室页由对应 page 直接编排，保持入口页职责。

## Verification

`./scripts/verify.sh check` 会运行 fast catalog gate、Astro 类型检查和 static build。
