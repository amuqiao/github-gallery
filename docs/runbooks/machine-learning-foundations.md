# Machine Learning Foundations 系列写作 Runbook

本文维护机器学习基础概念系列《一文读懂》的提示词组装方式，目标是用一组互相承接的专题建立从数学变化率到训练闭环的心智模型，而不是维护多份重复的完整模板。

## 文档职责

本文负责：

- 维护机器学习基础概念系列的专题拆分、阅读顺序和提示词组装方式。
- 为每个专题补充必须讲清的对象边界、交互重点和常见误区。
- 约束总览篇、数学前置、训练机制、模型组件和评估排错之间的职责边界。

本文不负责：

- 维护具体框架 API 手册，例如 PyTorch、TensorFlow、scikit-learn 的完整用法。
- 讲具体模型、论文、开源项目或工程系统；这些内容优先使用模型、工具、开源项目或 AI 工程节点落地说明模板。
- 复制完整通用模板；使用时从对应模板文件复制基础提示词，再追加本文的专题要求。

## 写作结构

推荐先维护 9 篇：

1. **一文读懂机器学习训练闭环**：讲数据、模型、预测、loss、gradient、optimizer、metric 如何组成一次训练 step，作为整个系列的总览入口。
2. **一文读懂导数和偏导数**：讲瞬时变化率、切线斜率、局部线性近似、多变量函数和偏导数，为梯度与反向传播建立数学前置。
3. **一文读懂张量和矩阵计算**：讲 scalar、vector、matrix、tensor、shape、broadcast、matrix multiplication 和 batch 维度，帮助读者看懂模型里的数据流。
4. **一文读懂损失函数**：讲 loss 如何把预测错误变成可优化信号，以及 loss、objective、metric 的边界。
5. **一文读懂激活函数**：讲非线性为什么必要，Sigmoid、Tanh、ReLU、GELU、Softmax 各自改变什么表达能力和梯度行为。
6. **一文读懂梯度与反向传播**：讲链式法则、计算图、autograd、梯度累积、梯度消失和梯度爆炸。
7. **一文读懂优化器和学习率**：讲 Gradient Descent、Momentum、Adam、learning rate、batch size 和参数更新路径。
8. **一文读懂评估指标**：讲 metric 为什么不等于 loss，分类、回归、排序和生成任务如何选择评估指标。
9. **一文读懂过拟合、正则化与泛化**：讲 train/validation/test、bias-variance、regularization、data leakage 和泛化误区。

不要把这些主题合成一篇长文。总览篇只建立训练闭环和概念地图；数学前置只解释后续训练机制需要的概念；训练机制专题再展开 loss、gradient、optimizer 和 autograd；评估排错专题处理效果判断、泛化和训练异常。

## 共用模板

默认专题使用：

- [知识点提示词模板-一文读懂版.md](../prompts/一文读懂/知识点提示词模板-一文读懂版.md)
- [1.风格模板.md](../prompts/一文读懂/1.风格模板.md)
- 本文对应专题的追加要求

涉及端到端 AI 能力落地、POC、存储、评估和升级路线时，优先使用：

- [AI 工程节点落地说明提示词模板 - 一文读懂版.md](<../prompts/一文读懂/AI 工程节点落地说明提示词模板 - 一文读懂版.md>)

某一篇如果聚焦具体算法，例如单独讲 SGD、Adam、Backpropagation 作为算法过程，而不是讲概念体系，可以改用：

- [算法提示词模板-一文读懂版.md](../prompts/一文读懂/算法提示词模板-一文读懂版.md)

使用时先复制基础模板，再复制风格模板，最后追加对应专题要求。若主题目标已经转向工程落地，不要继续叠加解释型模板，改用 AI 工程节点落地说明模板。

## 总览篇追加要求

```md
主题：机器学习训练闭环：从数据到参数更新

本文是机器学习基础概念系列总览，目标是建立一条贯穿全系列的训练主线，而不是深入某一个数学概念或框架 API。

请重点讲清：
- 训练闭环为什么存在：模型先预测，loss 衡量错误，gradient 指出参数局部影响，optimizer 决定如何更新参数，metric 评估最终效果
- 一次 training step 的主链路：batch -> forward -> prediction -> loss -> backward -> optimizer step -> metric/logging
- loss、gradient、optimizer、metric 的职责边界：分别解决什么问题，为什么不能混用
- 监督学习、无监督学习、自监督学习在训练目标上的共同点和差异，只做总览，不展开模型细节
- 用一张可交互流程图展示一次训练 step，允许读者切换任务类型并观察 loss、gradient 和 metric 的位置
- 总览篇只做路线图，不写完整 Python 项目；实现细节放到后续专题
```

## 导数和偏导数专题追加要求

```md
主题：导数和偏导数：从变化率到梯度的前置心智模型

本文是梯度与反向传播的数学前置，目标是让读者先理解“一个变量变化会怎样影响结果”，不要写成微积分公式百科。

请重点讲清：
- 导数解决什么问题：瞬时变化率、切线斜率、局部线性近似
- 偏导数解决什么问题：多变量函数中，只沿一个变量方向观察变化，其它变量暂时固定
- 导数、偏导数、方向导数、梯度的关系：导数是一维变化率，偏导数是多变量的单方向变化率，梯度是所有偏导数组成的向量
- 为什么机器学习关心偏导数：模型参数很多，训练需要知道每个参数对 loss 的局部影响
- 用一元函数曲线、二元曲面、等高线和梯度箭头做可视化
- 常见误区：偏导数不是整体变化率，梯度不是单个偏导数，导数是局部信息，不保证全局最优
```

## 张量和矩阵计算专题追加要求

```md
主题：张量和矩阵计算：看懂模型里的数据形状

本文目标是让读者能看懂机器学习代码里的 shape、batch、矩阵乘法和张量变换，而不是讲完整线性代数教材。

请重点讲清：
- scalar、vector、matrix、tensor 的层级关系，以及它们在样本、特征、权重和 batch 中的常见含义
- shape 如何表达数据结构：例如 `[batch, features]`、`[batch, channels, height, width]`、`[batch, sequence, hidden]`
- matrix multiplication 为什么能表达线性层：`X @ W + b` 如何同时处理多个样本和多个输出维度
- broadcast、reshape、transpose、concat、stack、reduce 的直觉和常见风险
- batch 维度和特征维度的边界：哪些维度参与计算，哪些维度只是并行样本
- 用交互式 shape 面板展示输入、权重、输出如何对齐，并在维度不匹配时说明原因
- 常见误区：把 batch 当成特征，把 transpose 当成 reshape，忽略 broadcast 导致的隐式扩展
```

## 损失函数专题追加要求

```md
主题：损失函数：把错误变成可优化信号

本文目标是让读者理解 loss 如何定义训练目标并塑造梯度方向，不要写成损失函数百科。

请重点讲清：
- loss function、training loss、objective function、evaluation metric 的区别
- 回归损失：MSE、MAE、Huber 各自如何惩罚错误，目标值尺度如何影响 loss 和 gradient
- 分类损失：Binary Cross Entropy、Cross Entropy、KL Divergence 的任务边界和概率直觉
- 为什么分类任务通常使用交叉熵而不是 MSE
- 输出层和 loss API 的配对：logits、Sigmoid、Softmax、BCEWithLogitsLoss、CrossEntropyLoss 的边界
- reduction、sample weight、class weight、mask 如何改变 loss 聚合和梯度尺度
- 用交互图表切换任务、预测值、真实值和 loss，观察 loss 数值、曲线形状和梯度方向
```

## 激活函数专题追加要求

```md
主题：激活函数：非线性如何改变表达能力和梯度传播

本文目标是让读者理解激活函数为什么存在，以及常见激活函数如何影响表达能力、输出含义和梯度行为。

请重点讲清：
- 没有非线性时，多层线性网络仍等价于一层线性变换
- Sigmoid、Tanh、ReLU、Leaky ReLU、GELU、SiLU、Softmax 各自解决什么问题
- 隐藏层激活和输出层激活的区别：回归、二分类、多标签、多分类分别如何选择
- 从导数曲线解释梯度消失、dead ReLU 和平滑激活的训练直觉
- Softmax 不是普通隐藏层激活，它通常用于多分类概率解释、采样或和 loss 配合
- 用交互曲线同时展示函数值、导数和当前输入点，并允许切换不同任务的输出层配置
- 常见误区：隐藏层都用 Sigmoid，ReLU 一定最好，训练前必须手写 Softmax
```

## 梯度与反向传播专题追加要求

```md
主题：梯度与反向传播：链式法则如何训练神经网络

本文目标是让读者理解梯度如何告诉参数往哪里改，以及反向传播如何在计算图上高效复用链式法则。

请重点讲清：
- gradient 表示 loss 对参数的局部影响，负梯度方向通常是降低 loss 的局部方向
- 链式法则如何把局部导数连接成整体影响
- 计算图如何组织 forward 和 backward：节点、边、中间值、反向拓扑顺序
- fan-out 场景下梯度为什么需要从多条路径累加
- autograd 做什么，用户通常负责什么：forward、loss、backward、optimizer step、zero grad
- 梯度消失和梯度爆炸的直觉、表现、常见原因和缓解思路
- 用最小神经元 `x -> z = wx + b -> a = f(z) -> loss` 做贯穿示例，展示每个局部导数和最终 `dL/dw`
```

## 优化器和学习率专题追加要求

```md
主题：优化器和学习率：参数如何根据梯度真正移动

本文目标是讲清 optimizer 如何使用梯度更新参数，以及 learning rate、momentum、Adam 等机制分别解决什么训练问题。

请重点讲清：
- backprop 只负责计算梯度，optimizer 负责用梯度更新参数
- Gradient Descent、Mini-batch SGD、Momentum、RMSProp、Adam 的核心直觉和差异
- learning rate 如何影响更新步长：太大可能震荡或发散，太小可能训练缓慢
- batch size、gradient noise、weight decay、learning rate schedule 如何影响训练路径
- Adam 不是总是最优，SGD 也不是过时；要结合任务、数据、模型和泛化表现判断
- 用二维 loss surface 交互模拟不同 optimizer 的路径、步长和震荡
- 常见误区：loss 不降就只换 optimizer，学习率越小越稳，Adam 不需要调学习率
```

## 评估指标专题追加要求

```md
主题：评估指标：如何判断模型真的变好了

本文目标是让读者理解 metric 为什么不等于 loss，以及不同任务如何选择能反映目标的评估指标。

请重点讲清：
- metric 和 loss 的边界：loss 参与训练优化，metric 负责评价效果，不一定可微
- 分类指标：Accuracy、Precision、Recall、F1、AUC、PR-AUC、Confusion Matrix 的适用场景和误区
- 回归指标：MAE、MSE、RMSE、R2、MAPE 如何受尺度、离群点和业务单位影响
- 阈值如何改变分类指标，类别不均衡时为什么 Accuracy 可能误导
- train、validation、test 指标分别回答什么问题
- 用交互混淆矩阵和阈值滑块展示 precision-recall tradeoff
- 常见误区：metric 越多越好，validation 指标可以反复调到满意，测试集可以参与选型
```

## 过拟合、正则化与泛化专题追加要求

```md
主题：过拟合、正则化与泛化：为什么训练集好不等于模型好

本文目标是让读者理解模型为什么会记住训练数据，以及如何用验证集、正则化和数据策略提升泛化能力。

请重点讲清：
- train、validation、test 的职责边界，以及 data leakage 为什么会让评估失真
- underfitting、overfitting、bias-variance 的直觉和训练曲线表现
- 正则化的核心思想：限制模型复杂度、减少对偶然噪声的依赖
- 常见手段：weight decay、dropout、early stopping、data augmentation、label smoothing
- 模型容量、数据量、噪声、训练轮数和特征泄漏如何影响泛化
- 用交互曲线展示训练 loss 和验证 loss 的分离，以及不同正则化强度下的变化
- 常见误区：训练集指标越高越好，正则化越强越好，测试集可以用来调参
```

## 维护规则

- 本文只维护机器学习基础概念系列的写作拆分和提示词组装方式，不复制完整通用模板。
- 新增专题前先判断它属于数学前置、训练机制、模型组件、评估排错还是具体模型/工具；具体模型和工具不要塞进本文。
- 总览篇不承担公式推导和工程实现；专题篇必须围绕一个核心概念主线展开，不要写成术语清单。
- 如果某个专题需要大量框架 API、真实训练脚本、方案选型、POC、存储或评估闭环，改用 AI 工程节点落地说明模板；如果只是解释概念，不强行加入代码。
- 现有 `docs/prompts/other/` 中的一次性提示词可以作为历史素材参考；长期维护入口以本文为准。
