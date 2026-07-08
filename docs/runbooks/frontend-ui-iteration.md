# Frontend UI Iteration Runbook

本文说明如何维护 GitHub Gallery 的前端 UI 层。核心原则是：Tailwind 提供 utility 和 token，`components/ui` 提供稳定 primitives，业务组件组合 primitives，页面只做编排。

## Mental Model

```text
src/presentation/themes.ts
  -> registered theme ids

src/styles/global.css
  -> theme tokens + base/prose styles

src/components/ui/*
  -> reusable UI primitives

src/components/*
  -> business display components that consume resolved view models

src/pages/*
  -> page composition
```

不要把视觉样式重新堆回 `BaseLayout.astro`。`BaseLayout` 只保留站点壳层、导航、footer 和全局 CSS import，并通过 props 消费页面传入的 `site` read model。

## When Changing Visual Style

按这个顺序执行：

1. 先判断变化属于 theme token、UI primitive、业务组件还是页面编排。
2. 颜色、半径、基础语义 token 改 `src/styles/global.css`。
3. 新增皮肤版本时，先在 `src/presentation/themes.ts` 和 `src/presentation/types.ts` 注册 theme。
4. Button、Badge、Card、EmptyState 这类通用样式改 `src/components/ui/`。
5. ProjectCard、FilterPanel、ProjectHero 这类业务展示改 `src/components/`。
6. 页面只调整组件顺序和 props，不堆复杂 Tailwind class。
7. 运行 `./scripts/verify.sh check`。

## When Adding A UI Primitive

新增 primitive 前先确认它不属于已有 primitive 的 variant。

1. 在 `src/components/ui/` 新增 Astro 组件。
2. 使用显式 `variant` / `size` map，不生成动态 Tailwind class。
3. 保持组件不知道 catalog、Project、Taxonomy 等业务对象。
4. 更新 [`../current/ui-architecture.md`](../current/ui-architecture.md)。
5. 运行 `./scripts/verify.sh check`。

## When Updating Business Components

业务组件可以消费已解析好的展示 props 或 view model，但不能直接读取 YAML，也不应调用 catalog loader 的运行时 helper。

优先组合：

```text
Button
Badge
ChipLink
Card
SectionHeader
EmptyState
ContentBlock
Prose
```

不要在业务组件里复制一套按钮、徽标或卡片样式。

## Drift Checklist

```text
[ ] `BaseLayout.astro` 没有新增业务组件样式。
[ ] `BaseLayout.astro` 没有直接调用 catalog loader。
[ ] 通用视觉变化进入 `src/components/ui/` 或 `src/styles/global.css`。
[ ] 新皮肤通过 `html[data-theme="<id>"]` token 生效。
[ ] layoutId 和 themeId 仍在 `src/presentation/config.ts` 集中切换。
[ ] 业务组件没有直接解析 YAML。
[ ] 业务组件没有调用 catalog loader 的运行时 helper。
[ ] 新 Tailwind class 是静态字符串，不依赖运行时拼接生成。
[ ] focus-visible 样式仍可见。
[ ] heading 层级没有被卡片复用破坏。
[ ] `./scripts/verify.sh check` 通过。
```

## Anti-Patterns

- 在页面里堆很长的组件级样式。
- 在 `BaseLayout.astro` 里新增 `.project-card`、`.filter-panel`、`.content-block` 这类选择器。
- 为一个页面临时发明按钮、badge、card 样式。
- 用动态字符串生成 Tailwind class，导致构建无法发现样式。
- 为视觉需求修改 catalog schema。
