# NVIDIA Triton Inference Server

Triton Inference Server 是面向生产推理服务的模型服务器。它把模型仓库、后端运行时、动态 batching、并发实例和 HTTP/gRPC 接口组合起来，让不同框架的模型可以用相对统一的方式上线。

## 适合关注什么

- 模型文件、config、backend 和服务接口之间的关系。
- Triton 与 ONNX Runtime、TensorRT、PyTorch backend 的分工。
- 镜像化部署、GPU 资源、batching 和 PAI-EAS 等平台托管方式。

## 使用边界

Triton 解决的是推理服务运行时和服务化问题，不替代模型训练、特征工程、业务网关、权限控制和端到端监控。落地时仍需要结合具体平台处理镜像构建、模型版本、资源配额和发布回滚。
