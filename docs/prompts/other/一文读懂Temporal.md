下面是按 `docs/prompts/一文读懂` 现有风格整理的可直接复制提示词：

```md
生成《一文读懂 Temporal》单文件交互式 HTML，核心目标是让读者真正理解：Temporal 是什么问题的解法，为什么它不是普通任务队列、定时任务或状态机库，Workflow、Activity、Worker、Task Queue、Temporal Service、Event History 如何协同实现 durable execution，以及工程上什么时候适合采用它。

读者背景：
- 懂基本后端服务、异步任务、消息队列、定时任务或微服务调用，但不清楚 Temporal 的心智模型
- 容易把 Temporal 理解成 queue、cron、BPMN、Airflow、RPC 框架或普通 workflow UI
- 希望先建立全局视角，以后再深入 Temporal SDK、部署、可观测性、Nexus 或具体业务实践

整体要求：
- 这里的 Temporal 指 Temporal.io durable execution / workflow orchestration platform，不是 JavaScript `Temporal` 日期时间 API
- 不要写成官网功能清单或 SDK API 摘要，要围绕“Temporal 如何让长时间、易失败、多步骤业务流程可靠运行”这一主线展开
- 重点覆盖入门全局视角：durable execution、Workflow、Activity、Worker、Task Queue、Temporal Service、Event History、replay、determinism、retry、timeout、Signal、Query、Update、Timer、Child Workflow、Schedule、Namespace 和可观测性
- 单文件 HTML，内联 CSS/JS，离线可打开
- 自然中文表达，术语、代码、命令、SDK 名称保留英文
- 必须包含可交互执行链路图，让读者能切换“正常执行 / Worker 崩溃 / Activity 失败重试 / Signal 到达 / replay 恢复 / 查询状态”等场景
- 视觉风格贴合长期业务流程、事件历史、Worker polling、任务队列、故障恢复，不要做成普通博客页
- 生成结果应是自学型交互文档，而不是静态展示页或视觉 demo。读者应能通过阅读、切换、拖动、对比、展开、自检或最小实验逐步理清知识点；每个交互组件都应回答一个明确理解问题，避免加入只装饰、不帮助理解的动效。

首屏设计：
- 首屏呈现一个订单处理流程：
  `Client -> Start Workflow -> Task Queue -> Worker -> Workflow -> Activity -> Event History -> Replay/Resume`
- 提供交互控件：
  - 切换故障场景：Worker crash / network failure / Activity timeout / retry exhausted / process restart
  - 切换消息类型：Signal / Query / Update
  - 点击节点显示：谁负责持久化、谁负责执行代码、谁负责调度任务、哪些状态进入 Event History
- 首屏一句话点题：
  “Temporal 的核心不是排队执行任务，而是把业务流程的进度写进 Event History，让代码在失败后能按历史恢复到正确状态。”

正文结构建议：

## 1. 先理解：Temporal 到底解决什么问题
- 从一个真实业务流程切入，例如订单履约、支付后发货、用户 onboarding、长时间审批、数据处理管道
- 讲清这些流程的共同痛点：
  - 跨多个服务和外部系统
  - 持续数秒、数小时、数天甚至更久
  - 中间步骤可能失败、超时、重复执行或需要人工/外部事件介入
  - 需要可恢复、可查询、可审计、可重试
- 说明普通代码、queue、cron、数据库状态字段为什么会变复杂：
  - 状态散落在多处
  - 重试和幂等逻辑到处都是
  - 失败恢复路径难测
  - 流程进度难以可靠重建
- 给出 Temporal 的一句话心智模型：
  “用普通代码描述业务流程，由 Temporal 负责持久化进度、调度任务、失败恢复和长时间运行。”

## 2. Durable Execution：Temporal 的核心抽象
- 讲清 durable execution 是什么：
  - 业务代码可以像普通函数一样写长流程
  - 执行进度被记录
  - 发生崩溃、网络故障或 Worker 重启后，可以从历史恢复
- 用可视化展示：
  `run -> record event -> crash -> replay history -> continue`
- 强调它不是内存快照：
  - Temporal 不是把进程内存直接保存下来
  - 它通过 Event History 和 replay 让 Workflow 重新走到一致状态
- 讲清为什么这改变了后端心智模型：
  - 你写的是流程代码
  - Temporal 维护流程状态和执行历史
  - Worker 可以挂掉再回来

## 3. 最小概念地图：Temporal 的核心对象
必须用一张分层图讲清，不要把术语平铺罗列。

覆盖这些对象：
- Temporal Service：
  - 负责持久化 Event History、调度任务、维护 Workflow 状态
  - 可以自托管，也可以使用 Temporal Cloud
- Temporal Client：
  - 用于 start、signal、query、update、cancel、terminate Workflow
- Workflow Definition：
  - 开发者写的流程代码
- Workflow Execution：
  - 某次实际运行的流程实例
- Activity：
  - 执行外部副作用或不确定操作，例如 HTTP、DB、发邮件、调用支付网关
- Worker：
  - 运行开发者的 Workflow 和 Activity 代码
- Task Queue：
  - Worker polling 的队列，用于把 Workflow Task 或 Activity Task 分发给合适 Worker
- Event History：
  - Workflow 的事实来源，记录流程发生过什么
- Namespace：
  - 隔离 Workflow、Task Queue、配置和可见性的逻辑边界

交互要求：
- 点击每个对象时显示：
  - 它负责什么
  - 它不负责什么
  - 它和相邻对象的关系

## 4. 一次 Workflow 是如何跑起来的
用一个订单流程贯穿全文，不要只讲抽象架构。

建议示例：
`PlaceOrder -> ReserveInventory -> ChargePayment -> WaitForShipmentSignal -> ShipOrder -> SendReceipt`

必须展示：
- Client 发起 Workflow Execution
- Temporal Service 创建初始事件并安排 Workflow Task
- Worker 从 Task Queue poll 到 Workflow Task
- Workflow 代码决定下一步：安排 Activity、Timer、Child Workflow 或等待 Signal
- Activity Worker 执行外部操作
- Activity 结果写回 Event History
- Workflow 根据历史继续推进
- 最终完成、失败、取消或继续等待

交互要求：
- 做一个“执行播放器”：每一步高亮 Client、Service、Task Queue、Worker、Event History 和业务代码位置。

## 5. Event History 与 Replay：为什么能恢复
- 讲清 Event History 是 append-only 的事实记录
- 展示典型事件：
  - Workflow Started
  - Activity Scheduled
  - Activity Completed
  - Timer Started
  - Signal Received
  - Workflow Completed
- 解释 replay：
  - Workflow 重新运行代码
  - 已发生过的结果从 Event History 回放
  - 不重新执行已经记录的外部副作用
- 强调 replay 的目的：
  - 重建 Workflow 内部状态
  - 让 Worker 崩溃后能继续
  - 支持升级、恢复和长期运行
- 用对比图展示：
  - 普通进程崩溃：内存状态丢失
  - Temporal Workflow 恢复：按 Event History 重建状态

## 6. Determinism：为什么 Workflow 代码不能随便写
必须单独成章，避免读者踩坑。

讲清以下规则：
- Workflow 代码必须 deterministic：
  - 同一份 Event History replay 时，代码必须做出同样决策
- 不应直接在 Workflow 里做不确定操作：
  - 当前时间
  - 随机数
  - 网络请求
  - 直接数据库调用
  - 读取外部可变状态
- 不确定或有副作用的事情应该放进 Activity
- SDK 通常提供 replay-safe 的时间、timer、side effect 或 versioning 工具
- 解释为什么：
  - replay 时如果代码路径和历史不匹配，Workflow 无法正确恢复

交互要求：
- 提供“determinism 检测卡片”：展示一段 Workflow 伪代码，让读者判断哪些操作应该移到 Activity。

## 7. Workflow vs Activity：流程编排和副作用执行的边界
- Workflow 负责：
  - 编排步骤
  - 保存业务流程状态
  - 等待事件
  - 安排 Activity、Timer、Child Workflow
  - 根据结果决定下一步
- Activity 负责：
  - 执行外部 I/O
  - 调用 HTTP / DB / message broker / payment API
  - 执行可能失败、超时、需要重试的副作用
- 讲清 Activity 的工程语义：
  - 可以配置 retry policy
  - 可以配置 timeout
  - 可以 heartbeat
  - 应该设计成 idempotent
- 用对比表总结：
  Workflow、Activity、普通函数、队列任务的职责边界。

## 8. Worker、Task Queue 与调度路径
- 讲清 Worker 是开发者部署和运行的进程
- 讲清 Task Queue 是 Worker poll 的逻辑队列
- 解释任务分发路径：
  - Temporal Service 产生 Workflow Task 或 Activity Task
  - Task 放到 Task Queue
  - Worker polling 获取 Task
  - Worker 执行代码并回报结果
- 区分：
  - Workflow Task：让 Workflow 代码推进决策
  - Activity Task：真正执行外部副作用
- 讲清扩缩容：
  - 增加 Worker 可以提升处理能力
  - Task Queue 可以用于路由不同类型任务
  - Worker 挂掉不等于 Workflow 丢失

交互要求：
- 提供 Worker 数量滑块，展示 Task Queue backlog、polling、任务分发和吞吐变化。

## 9. Retry、Timeout、Heartbeat：失败如何被建模
- 讲清 Temporal 不只是“自动重试”，而是把失败处理建模成可配置的执行语义
- 必须覆盖：
  - Retry Policy：失败后如何重试
  - Start-To-Close Timeout：单次 Activity 执行最长时间
  - Schedule-To-Start Timeout：任务从入队到被 Worker pick up 的等待时间
  - Schedule-To-Close Timeout：整个 Activity Execution 总耗时上限
  - Heartbeat：长 Activity 汇报进度，支持检测卡死和恢复进度
- 用故障时间线展示：
  `Activity scheduled -> attempt failed -> retry delay -> second attempt -> heartbeat -> completed`
- 强调幂等：
  - Activity 可能被重试
  - 外部副作用必须避免重复扣款、重复发货、重复发邮件

## 10. Signal、Query、Update：运行中的 Workflow 如何交互
- 讲清三者区别：
  - Signal：异步发送事件，改变 Workflow 后续行为
  - Query：同步读取当前 Workflow 状态，不改变状态
  - Update：请求 Workflow 执行一次可校验、可返回结果的状态变更
- 用订单流程示例：
  - Signal：用户修改收货地址
  - Query：查看订单当前状态
  - Update：申请取消订单并返回是否接受
- 讲清这些消息如何进入 Event History 或运行状态
- 用对比表总结：
  消息类型、是否改变状态、是否返回结果、是否写入历史、适用场景。

## 11. Timer、Schedule、Child Workflow：长流程如何组合
- Timer：
  - 在 Workflow 中等待一段时间
  - 等待是 durable 的，不依赖 Worker 进程一直活着
- Schedule：
  - 定期启动 Workflow Execution
  - 适合可靠定时触发业务流程
- Child Workflow：
  - 从一个 Workflow 中启动另一个 Workflow
  - 适合拆分复杂流程、隔离失败边界或组织子流程
- 讲清它们和普通 sleep、cron、子函数调用的区别
- 用流程图展示：
  parent workflow、child workflow、timer event、scheduled start。

## 12. Temporal 与常见替代方案的区别
必须讲清边界，避免读者把 Temporal 错当成单一组件。

至少对比：
- Temporal vs message queue：
  - queue 负责传递任务
  - Temporal 负责持久化流程状态、任务调度、重试、恢复和可查询执行历史
- Temporal vs cron：
  - cron 负责定时触发
  - Temporal 可以可靠运行长期流程并记录状态
- Temporal vs Airflow：
  - Airflow 更偏数据工作流和 DAG 调度
  - Temporal 更偏业务应用的 durable execution
- Temporal vs BPMN / Camunda：
  - BPMN 更偏图形化流程建模
  - Temporal 更偏用代码表达流程
- Temporal vs saga 手写状态机：
  - 手写方案灵活但恢复、重试、可观测和状态一致性成本高
  - Temporal 提供统一运行时和事件历史

## 13. 架构视角：谁持久化，谁执行，谁调度
- 用一张架构图展示：
  `Client -> Frontend Service -> History Service -> Matching Service -> Task Queue -> Worker -> Event History/Persistence`
- 讲清开发者负责：
  - Workflow Definition
  - Activity Definition
  - Worker 部署
  - Client 调用
  - 幂等和业务语义
- Temporal 负责：
  - Workflow Execution 状态
  - Event History
  - Task 调度
  - retry / timeout / timer
  - replay 和恢复
- 数据库负责：
  - 持久化事件历史、状态和元数据
- 避免过度深入内部服务实现，重点讲清入门心智模型。

## 14. 可观测性与运维入口
- 讲清 Temporal Web UI 能帮助查看：
  - Workflow Execution
  - Event History
  - 当前状态
  - Activity attempts
  - failures
  - search attributes
- 讲清 Visibility / Search Attributes 的用途：
  - 查找和筛选 Workflow Executions
  - 支持运营、排查、审计
- 讲清生产采用还要考虑：
  - Namespace 隔离
  - retention
  - Worker 部署和扩缩容
  - SDK 版本和 Workflow 代码演进
  - 数据加密和 payload converter
  - Temporal Cloud vs self-host

## 15. 工程实践：什么时候适合用 Temporal
给出实用但不绝对化的判断：
- 适合：
  - 长时间业务流程
  - 多步骤、跨服务、有外部副作用的流程
  - 需要可靠重试、可恢复、可查询、可审计的流程
  - 人工审批、等待外部事件、补偿逻辑、订单履约、支付、onboarding
- 不适合或未必需要：
  - 极简单的 fire-and-forget 异步任务
  - 纯 CPU 短任务且无流程状态需求
  - 只需要低延迟 RPC
  - 团队暂时无法接受新的运行时和编程约束
- 讲清采用成本：
  - 需要理解 determinism
  - 需要设计 Activity 幂等
  - 需要部署 Worker
  - 需要处理版本升级和可观测性

## 16. 常见误区与反例
必须包含：
- “Temporal 就是一个消息队列”是误区
- “Temporal 就是 cron”是误区
- “Workflow 里可以随便调用外部 API”是误区
- “Worker 挂了 Workflow 就丢了”是误区
- “Event History 是日志而已，和恢复关系不大”是误区
- “Activity 自动重试就不需要幂等”是误区
- “Temporal 会让所有失败自动消失”是误区，业务失败和补偿仍要建模
- “Temporal 只能跑短任务”是误区
- “用了 Temporal 就不用数据库或业务状态了”是误区，Temporal 管流程状态，业务系统仍要维护自己的领域数据

## 17. 最小代码示例
提供 TypeScript、Go 或 Python 中任选一种最小示例，保持短小：
- 定义一个 Workflow
- 在 Workflow 中调用 Activity
- 设置 Activity retry / timeout
- 启动 Worker poll Task Queue
- 用 Client start Workflow
- 用 Query 读取状态
- 用 Signal 改变流程
- 展示一次 Activity 失败后重试的日志或 Event History 片段

代码要求：
- 示例必须服务理解，不要写成完整生产项目
- 用注释标明哪些代码属于 Workflow，哪些属于 Activity，哪些属于 Worker，哪些属于 Client
- 明确指出 Workflow 代码中不能直接做不确定外部 I/O

交互组件要求：
- 执行链路播放器：展示 Client、Service、Task Queue、Worker、Event History 的流转
- 崩溃恢复模拟器：模拟 Worker crash 后 replay 和 continue
- Event History 浏览器：点击事件查看它如何影响 Workflow 状态
- Workflow vs Activity 对比器：判断一段逻辑应该放在哪里
- Retry/Timeout 时间线：调整失败次数、timeout、retry interval，观察 Activity Execution 结果
- Signal/Query/Update 对照器：选择消息类型，看是否改变状态、是否返回结果、是否写入历史
- 采用判断器：输入流程特征，判断是否适合 Temporal，并说明原因
- 自检卡片：让读者判断某个场景更像 queue、cron、Temporal、Airflow 还是普通 RPC

质量要求：
- 先建立“Temporal 如何让长期业务流程可靠运行”的心智模型，再讲 SDK、架构和代码
- 每个概念都要说明它解决什么问题、由谁负责、和相邻概念有什么区别
- 不要把 Temporal 写成万能可靠性魔法；要讲清 determinism、幂等、版本升级、Worker 部署这些采用成本
- 不要只列功能，要围绕订单流程或类似真实流程贯穿全文
- 不要过度深入具体 SDK 细节；本篇目标是入门和全局理解，具体 SDK 专题可后续展开
- 最后给出一张“Temporal 概念与职责速查表”
```

这个提示词可以直接作为“Temporal 入门专题”的生成入口，定位是先建立 durable execution、Event History、replay、Workflow/Activity/Worker/Task Queue 的核心心智模型，而不是深挖某个 SDK 或部署方案。
