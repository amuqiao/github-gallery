# RabbitMQ

RabbitMQ 是一个消息代理，常用于服务之间的异步通信和任务分发。它通过 exchange、queue、binding 和 routing key 把消息从生产者路由到一个或多个消费者。

## 适合关注什么

- exchange、queue、binding、routing key 如何组成消息分发规则。
- ack、重试、死信队列和延迟处理如何影响任务可靠性。
- RabbitMQ 与 Kafka 在“任务分发”和“事件日志”上的边界差异。
- 在异步任务、削峰填谷、服务解耦和业务事件通知中的适用方式。

## 使用边界

RabbitMQ 适合需要明确路由、确认消费、任务派发和业务异步解耦的场景。面对超高吞吐事件流、长时间历史重放或大规模日志管道时，需要和 Kafka 等事件流平台分清边界。
