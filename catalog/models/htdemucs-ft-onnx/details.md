# HT-Demucs FT ONNX

HT-Demucs FT ONNX 是 StemSplitio 发布在 Hugging Face 上的音乐源分离模型包。它把 HT-Demucs FT 的四个 specialist 子模型整理为一个完整的 4-stem bag，用于从一段音乐中拆分 drums、bass、other 和 vocals。

这个条目放在模型展馆中，而不是 GitHub 展馆中，因为它的主要入口是 Hugging Face 模型页，核心价值是模型格式、运行方式和音频处理用途，而不是仓库工程结构。

## 展馆观察点

- **输入/输出**：输入音乐音频，输出音频分轨。
- **模型格式**：ONNX。
- **运行方式**：以 onnxruntime 为核心，可用于本地推理。
- **适合记录的笔记**：本地运行、音频切片、输出质量观察、和后续音频工作流衔接。

## 维护边界

这个模型条目的可筛选事实只保留在 `model.yaml` 的稳定字段中。性能数据、benchmark、部署硬件和输出质量观察先写入详情或笔记，不提前扩展为顶层字段。
