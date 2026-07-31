# taskiq

taskiq 是一个 Python 异步分布式任务队列框架，面向 async/await 风格的后台任务执行。

它的主线是：业务代码把 async 函数声明为 task，producer 将任务消息发送到 broker，worker 从 broker 消费任务并执行，结果可以按配置写入 result backend 或由调用方异步等待。

理解 taskiq 时，应关注 broker、worker、task 声明、依赖注入、结果后端和自动化调用契约，而不是把它只看成 Celery 的轻量替代品。
