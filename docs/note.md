> Historical note: this file records early brainstorming only. It is not the current implementation fact, project configuration contract, or active roadmap. Use `docs/current/structure.md`, `docs/contract/`, and `docs/plans/roadmap.md` as the maintained sources.

我希望构建一份 GitHub 展馆项目,帮我收集和维护,你有什么建议,比如 markdown,还是 html ,还是 nodejs 还是什么,我想做小而美,方便迭代和维护,支持分类和标签,长期维护,你认为呢
我建议做成**静态站点 + 数据文件驱动**，不要一开始上完整 Node.js 后端。

最适合你这个“小而美、长期维护、支持分类和标签”的形态是：

```text
GitHub repo
  -> data/projects.yaml       # 项目数据源
  -> docs/ 或 site/            # 静态页面
  -> README.md                # 精简入口
  -> scripts/                 # 可选：生成索引、检查链接
  -> GitHub Pages / Vercel    # 部署
```

我的推荐方案：

**Astro + Markdown/YAML/JSON 数据源**

原因：

- 比纯 Markdown 更适合做分类、标签、筛选、搜索。
- 比 Node.js 全栈轻很多，不需要数据库和服务端。
- 内容可以长期沉淀成结构化数据，后续好迁移。
- 可以部署到 GitHub Pages，维护成本低。
- 以后想加页面、专题、排行榜、时间线都容易。

不要一开始做成传统 Node.js 后端。你现在的需求核心不是“动态服务”，而是：

```text
收集项目
分类展示
标签筛选
长期维护
方便引用
```

这些静态站点足够承接。

我建议的数据结构类似：

```yaml
- name: GPT-SoVITS
  repo: https://github.com/RVC-Boss/GPT-SoVITS
  category: voice-cloning-tts
  tags:
    - zero-shot
    - few-shot
    - webui
    - gpt-sovits
  architecture:
    - text-to-semantic
    - semantic-to-waveform
  license: MIT
  status: active
  summary: 支持零样本与少样本声音克隆的 TTS WebUI。
  strengths:
    - 完整 WebUI
    - 支持微调
    - 数据处理工具齐
  weaknesses:
    - 流程较长
    - 需要理解 GPT/SoVITS 双权重
```

页面上可以分几层：

```text
首页：项目卡片 + 搜索 + 标签筛选
分类页：TTS / VC / SVC / Toolkit / Vocoder
项目详情页：架构、输入输出、优缺点、适用场景、维护状态
专题页：比如“音色克隆路线图”“零样本 TTS 对比”
```

技术选型我会这样排：

| 方案 | 适合度 | 判断 |
| --- | --- | --- |
| 纯 Markdown | 初期最快 | 适合先收集，但分类筛选弱 |
| HTML + JS | 可行 | 简单但后期结构容易散 |
| Astro | 最推荐 | 静态、轻、适合内容展馆 |
| Next.js | 偏重 | 适合以后有账号、评论、动态 API |
| Node.js 后端 | 暂不建议 | 增加数据库、部署、运维成本 |

最终建议：

```text
第一版：Astro + data/projects.yaml + GitHub Pages
第二版：加 Fuse.js 本地搜索和标签筛选
第三版：加脚本检查 repo 链接、license、stars、last update
第四版：再考虑自动抓 GitHub API
```

核心原则：**内容先结构化，展示先静态化，自动化后置。**

这样你既能像写 Markdown 一样维护，又不会被纯 Markdown 限制住展示能力。
