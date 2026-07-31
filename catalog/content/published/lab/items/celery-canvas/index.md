# Celery Canvas

Celery Canvas 是 Celery 中用于组合任务工作流的机制，它把单个 task 通过 signature、chain、group、chord 等原语组织成可执行的依赖图。

理解 Canvas 时，重点不是“多了几个 API”，而是看任务结果如何在节点之间传递：chain 表达顺序依赖，group 表达并行分发，chord 表达并行完成后的汇总回调。

它适合描述后端异步任务中的编排关系，但不替代业务状态建模、幂等设计、失败补偿和可观测性。
