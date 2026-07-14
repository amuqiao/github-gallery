# Transformer

Transformer 是以 self-attention 为核心的序列建模架构。原版论文面向机器翻译提出 encoder-decoder 结构，后来逐步演化为 BERT、GPT、T5、Whisper 等模型家族的重要基础。

## 适合关注什么

- Attention 如何替代循环结构建模 token 之间的依赖。
- Encoder、decoder、mask、position encoding 和多头注意力的分工。
- 原版 Transformer 与 BERT/GPT 等后续架构之间的关系。

## 使用边界

Transformer 是架构范式，不等于某个可直接下载的单一模型。落地时需要结合具体任务选择模型规模、预训练方式、上下文长度、推理框架和数据治理方案。
