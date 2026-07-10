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
  组合 UI primitives，并消费已解析的 content/hall read model。

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
| `Card` | 卡片外壳、边框、背景、阴影。 | 卡片内部业务结构。 |
| `SectionHeader` | eyebrow、标题、说明文本层级。 | 页面数据加载。 |
| `EmptyState` | 空集合提示。 | 空状态判断规则。 |
| `ContentBlock` | typed block 标题和内容外壳。 | block schema 和 adapter。 |
| `Prose` | Markdown/HTML fragment 详情正文容器。 | 内容加载和详情格式合同。 |

## Business Component Boundary

| Component | Uses | Owns |
| --- | --- | --- |
| `PageHeader` | `SectionHeader`、`Card` | 页面首屏标题、统计和行动区。 |
| `ContentItemCard` | content item read model、taxonomy read model | canonical content item 卡片。 |
| `ContentCollectionCard` | content collection read model | canonical 馆内专题卡片。 |
| `HallCard` | hall read model | 平台首页单个展馆入口和状态展示。 |
| `PlannedHallPage` | `PageHeader`、`Button` | planned 展馆占位页。 |
| `Breadcrumbs` | link props | 层级导航。 |
| `BlockRenderer` | adapted typed blocks | block 渲染分发。 |

平台首页、GitHub 展馆页和模型展馆页由对应 page 直接编排，保持入口页职责。

## Verification

`./scripts/verify.sh check` 会运行 content release gate、Astro 类型检查和 static build。
