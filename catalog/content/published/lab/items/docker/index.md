# Docker

Docker 把应用、运行时依赖和系统环境打包成可分发的镜像，再以容器进程在目标机器上运行。它适合用来理解镜像分层、容器生命周期、volume、network，以及从单机部署走向集群编排前的基础工作流。

本条目收纳 Docker 的基础心智模型，重点关注从 Dockerfile 构建镜像、用 `docker run` 启动容器、用 volume 保存状态、用 network 连接服务，以及 Docker 与 Docker Compose、Kubernetes 的边界。
