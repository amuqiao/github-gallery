# Temporal

Temporal 是一个 durable execution / workflow orchestration 平台，面向长时间、多步骤、容易被失败打断的业务流程。

它的关键不是把任务排进队列，而是把 Workflow Execution 的进度写入 Event History。Worker 崩溃、重启或升级后，Temporal SDK 可以按历史重放 Workflow 代码，恢复到正确的决策点，再继续调度 Activity、Timer、Signal 或 Child Workflow。

理解 Temporal 时要先切清边界：Workflow 负责编排和确定性决策，Activity 负责外部副作用，Worker 运行你的代码，Temporal Service 持久化历史、调度任务并维护执行状态。它适合订单履约、审批、支付补偿、长周期任务和跨服务业务流程，不适合作为高吞吐消息流、普通 cron 或短小 RPC 的直接替代品。
