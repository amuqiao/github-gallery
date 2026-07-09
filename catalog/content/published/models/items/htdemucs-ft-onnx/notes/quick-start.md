# HT-Demucs FT ONNX 快速试用笔记

这篇笔记用于记录第一次理解和试用 HT-Demucs FT ONNX 时需要关注的事实。

## 定位

它是一个音频到音频的音乐分轨模型包，适合在人声分离、伴奏制作、采样和 AI 音乐预处理流程中使用。

## 输入输出

- 输入：一段 stereo 音频。
- 输出：drums、bass、other、vocals 四类音频 stem。

## 运行入口

模型页提供了 `bag_infer.py` 和 `demucs-onnx` 相关用法。正式写实验记录时，应把本地环境、音频样本、输出目录和耗时单独记录，不把一次性观察写进 `item.yaml` core 字段。
