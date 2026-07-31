# BERT

BERT 是基于 Transformer encoder 的双向语言表示模型。它通过掩码语言建模等预训练任务学习上下文表示，再通过微调适配分类、抽取、匹配、问答等语言理解任务。

## 适合关注什么

- Encoder-only 架构与 GPT decoder-only 架构的差异。
- MLM、NSP、预训练语料和下游微调之间的关系。
- `[CLS]`、token embedding、segment embedding、position embedding 的作用。

## 使用边界

BERT 是理解语言理解模型的重要基线，但不是现代生成式对话模型。实际选型时需要比较上下文长度、多语言能力、推理成本、任务类型和是否需要文本生成。
