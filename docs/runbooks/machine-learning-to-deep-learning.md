# Machine Learning to Deep Learning Case Runbook

本文维护一份从传统机器学习到深度学习的实战案例 runbook。它不按课程章节、数学体系或工具清单组织；它按真实任务组织知识点，让读者通过案例逐个击破术语、前置知识、模型、技术栈和开源入口。

使用方式：

```text
按问题选择案例
-> 看清输入、处理、输出和评估
-> 查案例里的术语和前置知识
-> 跑通推荐工具或开源入口
-> 用术语索引反查相邻案例
```

## 目标边界

本文负责：

- 维护从传统机器学习到深度学习的实战案例路线。
- 把术语、数学前置、模型、技术栈和开源入口挂到具体案例下。
- 覆盖表格、文本、视觉、语音、推荐、检索、强化学习、生成式 AI、多模态和工程化。
- 给《一文读懂》或 HTML 可视化文档提供案例卡片和术语索引。

本文不负责：

- 展开完整数学推导。
- 写框架 API 手册。
- 精读论文。
- 维护生产级系统架构。
- 把所有机器学习概念铺成大百科。

## 按问题选案例

| 我想解决的问题 | 优先看这些案例 |
| --- | --- |
| 表格分类或回归 | Iris 鸢尾花分类、Titanic 生存预测、California Housing 房价回归、Breast Cancer 二分类、表格 GBDT 建模 |
| 传统 ML baseline | Iris 鸢尾花分类、Digits 手写数字传统 ML、TF-IDF 文本分类 |
| 评估、泛化和调参 | Breast Cancer 二分类、California Housing 房价回归、表格 GBDT 建模 |
| 深度学习训练闭环 | MNIST MLP 手写数字识别、FashionMNIST 训练循环、CIFAR-10 CNN 图像分类 |
| 视觉任务 | CIFAR-10 CNN 图像分类、图像分类迁移学习、目标检测、图像分割、OCR、CLIP 图文检索 |
| 文本和 NLP | TF-IDF 文本分类、IMDB Transformer 情感分类、NER 命名实体识别、文本相似度、文本摘要、机器翻译 |
| 语音和音频 | Keyword Spotting、音频意图分类、ASR 语音识别、说话人验证、TTS 文本转语音 |
| 推荐、检索和 RAG | MovieLens 协同过滤、Learning to Rank、文本语义检索、RAG 本地文档问答、双塔召回 |
| 图学习 | Cora 节点分类、图链接预测 |
| 强化学习 | Multi-armed Bandit、GridWorld / FrozenLake Q-learning、CartPole DQN、PPO 控制任务 |
| 生成式 AI 和多模态 | Prompting 最小问答、LoRA 指令微调、Diffusion 文生图、VLM 图片问答、CLIP 图文检索 |
| 工程化 | SHAP 模型解释、MLflow 实验追踪、DVC 数据版本、ONNX 导出推理、FastAPI 模型服务、Evidently 漂移监控 |

## 案例总览

| 领域 | 案例 | 输入 -> 处理 -> 输出 -> 评估 |
| --- | --- | --- |
| 传统 ML | Iris 鸢尾花分类 | 4 个数值特征 -> 分类器 -> 花类别 -> accuracy / confusion matrix |
| 传统 ML | Titanic 生存预测 | 乘客字段 -> 特征处理 + 分类器 -> 生存概率 -> ROC-AUC / PR-AUC |
| 传统 ML | California Housing 房价回归 | 区域特征 -> 回归模型 -> 房价 -> MAE / RMSE / R2 |
| 传统 ML | Breast Cancer 二分类 | 医疗数值特征 -> 二分类模型 -> 良恶性 -> precision / recall / ROC-AUC |
| 传统 ML | Digits 手写数字传统 ML | 8x8 像素 -> SVM / KNN -> 数字类别 -> accuracy / error samples |
| 传统 ML | 表格 GBDT 建模 | 表格特征 -> GBDT -> 预测 -> validation score / feature importance |
| 无监督 | KMeans 客户分群 | 用户特征 -> scaling + KMeans -> cluster label -> silhouette / inertia |
| 无监督 | Isolation Forest 异常检测 | 行为特征 -> anomaly model -> 异常分数 -> precision@k / manual review |
| 深度学习 | MNIST MLP 手写数字识别 | 28x28 图片 -> MLP training loop -> 数字类别 -> validation accuracy |
| 深度学习 | FashionMNIST 训练循环 | Dataset -> DataLoader + model -> 服饰类别 -> validation accuracy |
| 深度学习 | CIFAR-10 CNN 图像分类 | 彩色图片 -> CNN -> 图像类别 -> accuracy / error samples |
| 深度学习 | Autoencoder 图像重建 | 图片 -> encoder / decoder -> 重建图片 -> reconstruction loss |
| 深度学习 | 时间序列预测 | 历史序列 -> window model -> 未来值 -> MAE / rolling validation |
| 视觉 | 图像分类迁移学习 | 自定义图片 -> pretrained backbone -> 类别 -> validation accuracy |
| 视觉 | 目标检测 | 图片 -> detector -> bbox + label -> mAP / IoU |
| 视觉 | 图像分割 | 图片 -> segmentation model -> mask -> mIoU / Dice |
| 视觉 | OCR | 图片文字 -> detection + recognition -> 文本 -> CER / manual review |
| NLP | TF-IDF 文本分类 | 文本 -> TF-IDF + classifier -> 类别 -> accuracy / F1 |
| NLP | IMDB Transformer 情感分类 | 评论 -> tokenizer + Transformer -> 情感标签 -> accuracy / F1 |
| NLP | NER 命名实体识别 | 句子 -> token classifier -> entity spans -> entity-level F1 |
| NLP | 文本相似度 | 句子对 -> embeddings -> similarity score -> STS score / threshold metrics |
| NLP | 文本摘要 | 长文本 -> seq2seq model -> 摘要 -> ROUGE / human review |
| NLP | 机器翻译 | 源语言文本 -> seq2seq model -> 目标语文本 -> BLEU / human review |
| 语音 | Keyword Spotting | 1 秒音频 -> audio classifier -> 命令词 -> accuracy / confusion matrix |
| 语音 | 音频意图分类 | 原始音频 -> Wav2Vec2 classifier -> intent label -> accuracy / macro F1 |
| 语音 | ASR 语音识别 | 语音 -> ASR model -> transcript -> WER / CER |
| 语音 | 说话人验证 | 两段语音 -> speaker embeddings -> same/different -> EER / threshold metrics |
| 语音 | Speaker Diarization | 长音频 -> speaker turns -> 谁在何时说话 -> DER / manual review |
| 语音 | Source Separation | 混合音频 -> stems -> vocals / accompaniment -> SDR / artifact review |
| 语音 | TTS 文本转语音 | text -> TTS model -> waveform -> MOS / pronunciation review |
| 检索推荐 | MovieLens 协同过滤 | user-item ratings -> recommender -> top-N items -> NDCG / MAP |
| 检索推荐 | Learning to Rank | query + candidates -> ranker -> ordered list -> NDCG / MRR |
| 检索推荐 | 文本语义检索 | query + docs -> embedding + ANN -> top-k docs -> recall@k / MRR |
| 检索推荐 | RAG 本地文档问答 | docs + question -> retrieve + generate -> answer -> faithfulness / context precision |
| 检索推荐 | 双塔召回 | user + item features -> two-tower embeddings -> candidates -> recall@k |
| 图学习 | Cora 节点分类 | citation graph -> GCN -> node labels -> accuracy |
| 图学习 | 图链接预测 | graph edges -> graph embeddings -> missing links -> AUC / Hits@K |
| 强化学习 | Multi-armed Bandit | action choices -> rewards -> action policy -> cumulative reward / regret |
| 强化学习 | GridWorld / FrozenLake Q-learning | state grid -> Q update -> policy -> success rate |
| 强化学习 | CartPole DQN | observation -> Q network -> action -> episode return |
| 强化学习 | PPO 控制任务 | rollout -> policy update -> action policy -> average reward |
| 生成式 AI | Prompting 最小问答 | prompt -> LLM -> answer -> manual eval / regression set |
| 生成式 AI | LoRA 指令微调 | instruction data -> LoRA adapter -> adapted model -> eval set / preference review |
| 生成式 AI | Diffusion 文生图 | text prompt -> diffusion pipeline -> image -> visual quality / prompt adherence |
| 多模态 | CLIP 图文检索 | images + texts -> shared embeddings -> matches -> recall@k |
| 多模态 | VLM 图片问答 | image + question -> VLM -> answer -> exact match / hallucination review |
| 工程化 | SHAP 模型解释 | trained tabular model -> feature attribution -> explanation report -> sanity check |
| 工程化 | MLflow 实验追踪 | train script -> run artifacts -> model version -> reproducibility / metric comparison |
| 工程化 | DVC 数据版本 | dataset -> DVC pipeline -> versioned output -> reproducible hash |
| 工程化 | ONNX 导出推理 | trained model -> ONNX Runtime -> prediction -> output parity / latency |
| 工程化 | FastAPI 模型服务 | model -> HTTP API -> JSON response -> latency / error rate |
| 工程化 | Evidently 漂移监控 | reference + current data -> drift report -> alert -> drift score / review action |

## 传统机器学习实战

### Iris 鸢尾花分类

主线：4 个数值特征 -> train/test split -> 分类器 -> 花类别 -> accuracy / confusion matrix。

先查术语：sample、feature、label、classification、fit、predict、accuracy、confusion matrix。

前置只查：二维表、距离度量、决策边界。

技术栈 / 开源入口：scikit-learn `load_iris`、Logistic Regression、KNN、Decision Tree、SVM。

通关标准：能说清一条样本、一个特征、一类标签和一个分类指标。

常见坑：把 feature 和 label 混在一起，或只看 accuracy 不看错误类别。

### Titanic 生存预测

主线：乘客字段 -> 缺失值处理 + 类别编码 -> 分类模型 -> 生存概率 -> ROC-AUC / PR-AUC。

先查术语：missing value、categorical feature、one-hot encoding、pipeline、data leakage、ROC-AUC。

前置只查：表格清洗、条件概率、阈值。

技术栈 / 开源入口：pandas、scikit-learn、Kaggle Titanic、LightGBM。

通关标准：能处理缺失值和类别特征，知道为什么不能让测试集信息泄漏。

常见坑：用全量数据做编码或填充统计，导致 data leakage。

### California Housing 房价回归

主线：区域特征 -> 回归模型 -> 房价 -> MAE / RMSE / R2。

先查术语：regression、target、MAE、MSE、RMSE、R2、residual。

前置只查：均值、方差、平方误差。

技术栈 / 开源入口：scikit-learn、Linear Regression、Ridge、Random Forest。

通关标准：能区分分类和回归，能用误差指标比较模型。

常见坑：只看 R2，不看预测误差在业务单位上的大小。

### Breast Cancer 二分类

主线：医疗数值特征 -> 二分类模型 -> 良恶性 -> precision / recall / ROC-AUC。

先查术语：binary classification、precision、recall、F1、ROC-AUC、threshold、false positive、false negative。

前置只查：混淆矩阵、阈值、类别不均衡。

技术栈 / 开源入口：scikit-learn、Logistic Regression、Random Forest、XGBoost。

通关标准：能解释为什么 accuracy 不一定够用。

常见坑：忽略 false negative 和 false positive 的不同成本。

### Digits 手写数字传统 ML

主线：8x8 像素 -> flatten features -> SVM / KNN -> 数字类别 -> accuracy / error samples。

先查术语：image as feature、flatten、SVM、KNN、support vector、nearest neighbor。

前置只查：向量、欧氏距离、决策边界。

技术栈 / 开源入口：scikit-learn `load_digits`。

通关标准：能理解图像也可以先当作特征表处理。

常见坑：以为图像任务必须一开始就用 CNN。

### 表格 GBDT 建模

主线：表格特征 -> GBDT -> 预测 -> validation score / feature importance。

先查术语：decision tree、random forest、boosting、GBDT、feature importance、early stopping、regularization、overfitting。

前置只查：分裂规则、残差、验证集。

技术栈 / 开源入口：XGBoost、LightGBM、CatBoost。

通关标准：能把 GBDT 作为表格任务强 baseline。

常见坑：过早换深度学习，而没有先把 GBDT baseline 做扎实。

### KMeans 客户分群

主线：用户特征 -> scaling -> KMeans -> cluster label -> silhouette / inertia。

先查术语：clustering、centroid、distance、scaling、silhouette、inertia。

前置只查：欧氏距离、标准化。

技术栈 / 开源入口：scikit-learn KMeans。

通关标准：能解释聚类不是分类，聚类标签没有天然业务含义。

常见坑：把聚类编号当作真实业务标签。

### Isolation Forest 异常检测

主线：行为特征 -> anomaly model -> anomaly score -> suspicious samples -> precision@k / manual review。

先查术语：anomaly detection、outlier、isolation、score、threshold、precision@k。

前置只查：分位数、异常值、阈值。

技术栈 / 开源入口：scikit-learn IsolationForest。

通关标准：能用异常分数和阈值做第一版异常检测。

常见坑：没有人工复核就把异常分数当作确定标签。

## 深度学习基础实战

### MNIST MLP 手写数字识别

主线：28x28 图片 -> tensor -> MLP forward -> loss -> backward -> optimizer step -> validation accuracy。

先查术语：tensor、batch、epoch、forward、loss、Cross Entropy、gradient、backpropagation、optimizer、learning rate、activation。

前置只查：矩阵乘法、导数、偏导数、链式法则、梯度。

技术栈 / 开源入口：PyTorch Learn the Basics、TensorFlow MNIST quickstart。

通关标准：能解释 `forward / loss / backward / optimizer.step` 顺序。

常见坑：以为 `backward` 会自动更新参数，忽略 `optimizer.step`。

### FashionMNIST 训练循环

主线：Dataset -> DataLoader -> model -> train loop -> save/load -> validation accuracy。

先查术语：Dataset、DataLoader、transform、training loop、checkpoint、device、dtype。

前置只查：张量 shape、mini-batch。

技术栈 / 开源入口：PyTorch FashionMNIST tutorial、torchvision。

通关标准：能看懂深度学习项目的数据和训练代码分层。

常见坑：训练和验证使用不同预处理逻辑。

### CIFAR-10 CNN 图像分类

主线：彩色图片 -> convolution / pooling -> classifier -> class prediction -> accuracy / error samples。

先查术语：convolution、kernel、stride、padding、pooling、channel、data augmentation、regularization、overfitting。

前置只查：局部感受野、张量 shape。

技术栈 / 开源入口：PyTorch、torchvision、Keras examples。

通关标准：能说清 CNN 为什么适合图像。

常见坑：忽略 normalization 和 data augmentation 对训练的影响。

### Autoencoder 图像重建

主线：图片 -> encoder -> latent vector -> decoder -> reconstructed image -> reconstruction loss。

先查术语：encoder、decoder、latent space、reconstruction loss、bottleneck。

前置只查：向量压缩、MSE。

技术栈 / 开源入口：PyTorch / Keras Autoencoder examples。

通关标准：能理解 representation 不一定直接等于分类标签。

常见坑：只看重建图是否好看，不看 latent space 是否服务任务。

### 时间序列预测

主线：历史序列 -> windowing -> sequence model -> future value -> MAE / rolling validation。

先查术语：sequence、window、lag、hidden state、teacher forcing、forecast horizon。

前置只查：滑动窗口、时间顺序切分。

技术栈 / 开源入口：PyTorch、Keras、sktime。

通关标准：能避免把未来信息泄漏到训练集。

常见坑：随机划分时间序列导致未来信息泄漏。

## 视觉实战

### 图像分类迁移学习

主线：自定义图片 -> pretrained backbone -> classification head -> class prediction -> validation accuracy。

先查术语：backbone、head、fine-tuning、freeze、augmentation、top-1 accuracy。

前置只查：CNN、softmax、交叉熵。

技术栈 / 开源入口：torchvision、timm、ResNet / ViT。

通关标准：能替换分类头并微调一个预训练模型。

常见坑：数据太少却解冻全部参数，导致过拟合。

### 目标检测

主线：图片 -> detector -> bounding boxes + labels -> filtered detections -> mAP / IoU。

先查术语：bounding box、anchor、IoU、NMS、mAP、confidence score。

前置只查：坐标框、IoU。

技术栈 / 开源入口：torchvision detection tutorial、YOLO / Ultralytics。

通关标准：能区分分类、检测和分割。

常见坑：只看可视化框，不看 mAP 和 IoU 阈值。

### 图像分割

主线：图片 -> segmentation model -> pixel mask -> class mask -> mIoU / Dice。

先查术语：semantic segmentation、instance segmentation、mask、Dice、mIoU。

前置只查：像素级标签、IoU。

技术栈 / 开源入口：torchvision Mask R-CNN、segmentation_models.pytorch。

通关标准：能解释 mask 和 bbox 的区别。

常见坑：把语义分割和实例分割混为一谈。

### OCR

主线：图片文字 -> text detection -> text recognition -> string output -> CER / manual review。

先查术语：OCR、text detection、text recognition、CTC、language model。

前置只查：图像裁剪、序列解码。

技术栈 / 开源入口：PaddleOCR、Tesseract、TrOCR。

通关标准：能区分检测文字位置和识别文字内容。

常见坑：只测清晰截图，不测倾斜、遮挡和低清图片。

### CLIP 图文检索

主线：images + texts -> image/text embeddings -> similarity search -> matched pairs -> recall@k。

先查术语：CLIP、image-text embedding、contrastive learning、cosine similarity、zero-shot。

前置只查：向量相似度、top-k。

技术栈 / 开源入口：OpenCLIP、Transformers。

通关标准：能用同一向量空间做图文检索。

常见坑：相似度高不等于语义完全正确。

## 文本和 NLP 实战

### TF-IDF 文本分类

主线：文本 -> tokenization -> TF-IDF -> Logistic Regression -> class label -> accuracy / F1。

先查术语：token、vocabulary、bag-of-words、TF-IDF、sparse matrix。

前置只查：词频、余弦相似度。

技术栈 / 开源入口：scikit-learn `TfidfVectorizer`。

通关标准：能不用深度学习先跑通文本分类 baseline。

常见坑：一开始就微调大模型，忽略简单 baseline。

### IMDB Transformer 情感分类

主线：评论文本 -> tokenizer -> pretrained model -> fine-tuning -> sentiment label -> accuracy / F1。

先查术语：tokenizer、subword、attention mask、Transformer、fine-tuning、accuracy。

前置只查：概率分类、交叉熵。

技术栈 / 开源入口：Hugging Face Transformers IMDb text classification。

通关标准：能区分 tokenizer、model 和 Trainer。

常见坑：忽略 max length 截断对长文本的影响。

### NER 命名实体识别

主线：句子 -> token labels -> entity spans -> entity types -> entity-level F1。

先查术语：NER、BIO tagging、token classification、span、entity。

前置只查：序列标注、token/word 对齐。

技术栈 / 开源入口：Transformers token classification。

通关标准：能理解文本分类和 token 分类的区别。

常见坑：word 被切成 subword 后 label 对不齐。

### 文本相似度

主线：sentence pair -> embeddings -> similarity score -> same/different decision -> threshold metrics。

先查术语：sentence embedding、cosine similarity、semantic textual similarity、threshold。

前置只查：向量、距离度量。

技术栈 / 开源入口：sentence-transformers。

通关标准：能用 embedding 做语义相似判断。

常见坑：相似度阈值不做验证就直接上线。

### 文本摘要

主线：长文本 -> seq2seq model -> summary -> quality check -> ROUGE / human review。

先查术语：summarization、encoder-decoder、beam search、ROUGE。

前置只查：序列到序列。

技术栈 / 开源入口：Transformers summarization pipeline。

通关标准：能知道摘要质量不能只看是否流畅。

常见坑：摘要包含原文没有的事实。

### 机器翻译

主线：源语言文本 -> seq2seq model -> target text -> translation quality -> BLEU / human review。

先查术语：translation、BLEU、tokenizer、encoder-decoder。

前置只查：语言对、序列建模。

技术栈 / 开源入口：MarianMT、Transformers。

通关标准：能跑通小文本翻译并看懂基本评估。

常见坑：专名、术语和语气没有单独检查。

## 语音和音频实战

### Keyword Spotting

主线：1 秒音频 -> waveform / spectrogram -> audio classifier -> command label -> accuracy / confusion matrix。

先查术语：waveform、sample rate、resampling、spectrogram、MFCC、audio classification。

前置只查：采样率、频谱图。

技术栈 / 开源入口：torchaudio Speech Commands tutorial。

通关标准：能把音频转成模型可训练输入。

常见坑：训练和推理采样率不一致。

### 音频意图分类

主线：原始音频 -> feature extractor -> Wav2Vec2 classifier -> intent label -> accuracy / macro F1。

先查术语：feature extractor、Wav2Vec2、audio classification、label mapping。

前置只查：采样率、train/test split。

技术栈 / 开源入口：Hugging Face audio classification。

通关标准：能用预训练音频模型做分类。

常见坑：忽略 resampling 和音频长度截断。

### ASR 语音识别

主线：语音 -> ASR model -> transcript -> aligned text -> WER / CER。

先查术语：ASR、CTC、seq2seq、WER、CER、language model、forced alignment。

前置只查：编辑距离、音频时间轴。

技术栈 / 开源入口：Whisper、Transformers ASR、torchaudio。

通关标准：能把语音转文字并用 WER / CER 粗评估。

常见坑：只看单句效果，不看噪声、口音和长音频切分。

### 说话人验证

主线：enrollment audio + test audio -> speaker embeddings -> similarity score -> same/different -> EER / threshold metrics。

先查术语：speaker embedding、speaker verification、cosine similarity、EER、threshold。

前置只查：向量相似度、阈值。

技术栈 / 开源入口：SpeechBrain、pyannote.audio。

通关标准：能区分 verification、identification、diarization。

常见坑：把相似度检索结果当作身份确认。

### Speaker Diarization

主线：长音频 -> VAD / segmentation -> speaker turns -> speaker timeline -> DER / manual review。

先查术语：speaker diarization、speaker turn、VAD、segmentation、overlapped speech、DER、RTTM。

前置只查：音频时间轴、区间重叠、阈值。

技术栈 / 开源入口：pyannote.audio、pyannote speaker diarization pipeline。

通关标准：能把“谁在什么时候说话”从音频中切出来，并知道 diarization 不等于身份识别。

常见坑：把匿名 speaker label 当作真实人物身份。

### Source Separation

主线：混合音频 -> source separation model -> stems -> vocals / accompaniment -> SDR / artifact review。

先查术语：source separation、stem、vocals、accompaniment、spectrogram、artifact、SDR。

前置只查：频谱图、相位、音频伪影。

技术栈 / 开源入口：Demucs、UVR、MDX-Net。

通关标准：能把人声和伴奏拆成不同 stem，并能识别分离伪影。

常见坑：把分离后的人声残留或音乐伪影当作模型可忽略误差。

### TTS 文本转语音

主线：text -> text normalization / phoneme -> TTS model -> waveform -> MOS / pronunciation review。

先查术语：TTS、phoneme、prosody、vocoder、MOS。

前置只查：文本规范化、音素。

技术栈 / 开源入口：Piper、Coqui TTS、SpeechT5。

通关标准：能知道 TTS 不只是“文字变声音”，还涉及发音和韵律。

常见坑：只听自然度，不检查专名读音和韵律。

## 推荐、检索和 RAG 实战

### MovieLens 协同过滤

主线：user-item ratings -> matrix factorization -> user/item factors -> top-N items -> NDCG / MAP。

先查术语：collaborative filtering、matrix factorization、implicit feedback、top-N、NDCG。

前置只查：矩阵、点积、排序指标。

技术栈 / 开源入口：Surprise、implicit、LightFM。

通关标准：能理解推荐不是普通分类任务。

常见坑：离线评分高不代表线上点击高。

### Learning to Rank

主线：query + candidate features -> ranker -> ordered list -> top results -> NDCG / MRR。

先查术语：ranking、pairwise、listwise、NDCG、MAP、MRR。

前置只查：排序指标。

技术栈 / 开源入口：LightGBM ranker、XGBoost ranker。

通关标准：能区分分类准确率和排序质量。

常见坑：把排序问题当成独立二分类问题处理。

### 文本语义检索

主线：query + documents -> embedding -> ANN search -> top-k docs -> recall@k / MRR。

先查术语：dense retrieval、embedding、ANN、top-k、recall、FAISS index。

前置只查：余弦相似度、近邻搜索。

技术栈 / 开源入口：sentence-transformers、FAISS、Qdrant、Milvus。

通关标准：能搭建一个最小向量检索。

常见坑：只看 top-1 示例，不做召回评估。

### RAG 本地文档问答

主线：documents -> chunk -> embedding -> retriever / reranker -> LLM answer -> faithfulness / context precision。

先查术语：chunk、retriever、reranker、context window、grounding、citation、faithfulness。

前置只查：top-k、召回率、文本切分。

技术栈 / 开源入口：sentence-transformers、FAISS/Qdrant、Ollama/vLLM、Ragas、DeepEval。

通关标准：能解释 RAG 里检索和生成各自负责什么。

常见坑：回答流畅但没有引用和上下文支撑。

### 双塔召回

主线：user features + item features -> two-tower embeddings -> candidate retrieval -> top-k candidates -> recall@k。

先查术语：two-tower、negative sampling、in-batch negatives、recall@k。

前置只查：点积、采样。

技术栈 / 开源入口：TensorFlow Recommenders、PyTorch。

通关标准：能理解大规模推荐为什么先召回再排序。

常见坑：负样本采样方式改变训练目标。

## 图学习实战

### Cora 节点分类

主线：citation graph -> node features + edge_index -> GCN -> node labels -> accuracy。

先查术语：graph、node、edge、edge_index、message passing、GCN、node classification。

前置只查：图结构、邻接关系、特征矩阵。

技术栈 / 开源入口：PyTorch Geometric、Cora / Planetoid dataset、GCNConv。

通关标准：能把非表格关系数据表示成图，并训练一个最小 GCN 做节点分类。

常见坑：把图节点随机拆分后忽略边带来的信息泄漏。

### 图链接预测

主线：graph edges -> positive / negative edge sampling -> graph embeddings -> missing links -> AUC / Hits@K。

先查术语：link prediction、positive edge、negative sampling、graph embedding、AUC、Hits@K。

前置只查：图结构、邻接关系、负采样、排序指标。

技术栈 / 开源入口：PyTorch Geometric、DGL。

通关标准：能理解链接预测不是普通二分类，负样本构造会改变任务。

常见坑：训练集和测试集边拆分不干净，导致图结构泄漏。

## 强化学习实战

### Multi-armed Bandit

主线：action choices -> reward observations -> value estimate -> next action -> cumulative reward / regret。

先查术语：exploration、exploitation、epsilon-greedy、UCB、regret。

前置只查：均值、期望。

技术栈 / 开源入口：NumPy 手写 bandit。

通关标准：能解释探索和利用的冲突。

常见坑：只选当前最优动作，导致探索不足。

### GridWorld / FrozenLake Q-learning

主线：state grid -> action -> reward / next state -> Q table update -> policy -> success rate。

先查术语：state、action、reward、episode、Q-value、Bellman update。

前置只查：表格、折扣回报。

技术栈 / 开源入口：Gymnasium FrozenLake、NumPy。

通关标准：能用表格 Q-learning 学到一条策略。

常见坑：reward 设计不清导致策略投机。

### CartPole DQN

主线：observation -> neural Q network -> action -> replay update -> policy -> episode return。

先查术语：DQN、replay buffer、target network、epsilon decay、terminal state。

前置只查：MLP、loss、梯度下降。

技术栈 / 开源入口：PyTorch DQN tutorial、Gymnasium CartPole。

通关标准：能解释为什么 DQN 需要经验回放和目标网络。

常见坑：把每一步 reward 当作最终目标，忽略 episode return。

### PPO 控制任务

主线：rollout -> advantage estimate -> policy update -> action policy -> average reward。

先查术语：policy、value function、advantage、clip objective、PPO、rollout。

前置只查：概率分布、期望回报。

技术栈 / 开源入口：Stable-Baselines3 PPO、Gymnasium。

通关标准：能区分 value-based 和 policy-based 方法。

常见坑：只看单次 episode，不看多轮平均回报。

## 生成式 AI 和多模态实战

### Prompting 最小问答

主线：instruction + context -> LLM sampling -> answer -> manual eval / regression set。

先查术语：prompt、system prompt、temperature、top-p、hallucination、context window。

前置只查：概率采样。

技术栈 / 开源入口：Ollama、llama.cpp、Transformers pipeline。

通关标准：能解释 prompt 参数如何影响输出稳定性。

常见坑：只看一次输出，缺少回归样例集。

### LoRA 指令微调

主线：instruction data -> SFT -> LoRA adapter -> adapted model -> eval set / preference review。

先查术语：SFT、LoRA、QLoRA、adapter、instruction tuning、DPO、regularization、overfitting。

前置只查：训练/验证、交叉熵。

技术栈 / 开源入口：PEFT、TRL、Transformers。

通关标准：能区分 prompting、RAG 和微调。

常见坑：数据质量差时，微调只会稳定放大坏样本。

### Diffusion 文生图

主线：text prompt -> diffusion pipeline -> denoising steps -> image -> visual quality / prompt adherence。

先查术语：diffusion、noise schedule、denoising、U-Net、scheduler、CFG。

前置只查：随机噪声、迭代去噪。

技术栈 / 开源入口：diffusers。

通关标准：能跑通文生图并知道 seed / scheduler 的影响。

常见坑：只看好看的样例，不看 prompt 遵循和失败样本。

### VLM 图片问答

主线：image + question -> multimodal model -> answer -> exact match / hallucination review。

先查术语：VLM、image encoder、vision-language alignment、OCR、grounding。

前置只查：embedding、attention。

技术栈 / 开源入口：Transformers VLM、LLaVA-like projects。

通关标准：能理解图文问答不等于 OCR，也不等于纯文本问答。

常见坑：模型看似回答了图片问题，但实际在猜。

## 工程化实战

### SHAP 模型解释

主线：trained tabular model -> SHAP values -> feature attribution -> explanation report -> sanity check。

先查术语：feature attribution、SHAP value、global explanation、local explanation、baseline value。

前置只查：特征贡献、模型输出、相关不等于因果。

技术栈 / 开源入口：SHAP、scikit-learn、XGBoost / LightGBM。

通关标准：能用特征归因解释一个表格模型的预测，并知道解释不等于因果证明。

常见坑：把 SHAP 排名当作业务因果结论。

### MLflow 实验追踪

主线：train script -> params / metrics / artifacts -> run comparison -> model version -> reproducibility / metric comparison。

先查术语：experiment、run、artifact、metric、model registry、model version。

前置只查：文件版本、指标表。

技术栈 / 开源入口：MLflow Tracking / Model Registry。

通关标准：能复现一次实验并找到对应模型版本。

常见坑：只保存模型文件，不保存参数、数据版本和指标。

### DVC 数据版本

主线：raw data -> DVC track -> pipeline stage -> versioned output -> reproducible hash。

先查术语：data versioning、remote、pipeline、stage、artifact。

前置只查：Git 基础、文件哈希。

技术栈 / 开源入口：DVC。

通关标准：能把数据和模型产物纳入版本管理。

常见坑：代码可复现，但训练数据不可复现。

### ONNX 导出推理

主线：trained model -> ONNX export -> ONNX Runtime -> prediction -> output parity / latency。

先查术语：serialization、ONNX、runtime、operator、input signature。

前置只查：tensor shape、dtype。

技术栈 / 开源入口：ONNX Runtime、PyTorch / TensorFlow export。

通关标准：能导出一个小模型并用 runtime 推理。

常见坑：导出后没有检查和原框架输出是否一致。

### FastAPI 模型服务

主线：model -> API schema -> `/predict` -> JSON response -> latency / error rate。

先查术语：online inference、request、response、schema、latency、throughput。

前置只查：HTTP、JSON。

技术栈 / 开源入口：FastAPI、BentoML、TorchServe、Triton。

通关标准：能把模型包成一个最小预测 API。

常见坑：训练预处理和服务端预处理不一致。

### Evidently 漂移监控

主线：reference data + current data -> drift report -> alert / review -> drift score / action。

先查术语：data drift、prediction drift、reference/current、monitoring、alert。

前置只查：分布差异、统计检验。

技术栈 / 开源入口：Evidently。

通关标准：能用漂移报告判断输入分布是否变化。

常见坑：没有 ground truth 时误把 drift 当作模型质量结论。

## 术语反查索引

| 术语 | 优先看哪些案例 |
| --- | --- |
| feature / label / sample | Iris 鸢尾花分类、Titanic 生存预测、California Housing 房价回归 |
| train / validation / test | Iris 鸢尾花分类、Breast Cancer 二分类、MNIST MLP 手写数字识别、IMDB Transformer 情感分类 |
| loss / objective / metric | California Housing 房价回归、Breast Cancer 二分类、MNIST MLP 手写数字识别、MLflow 实验追踪 |
| gradient descent / backpropagation | MNIST MLP 手写数字识别 |
| derivative / partial derivative / chain rule | MNIST MLP 手写数字识别 |
| regularization / overfitting | 表格 GBDT 建模、CIFAR-10 CNN 图像分类、LoRA 指令微调 |
| distance / similarity | Digits 手写数字传统 ML、KMeans 客户分群、文本语义检索、CLIP 图文检索 |
| cosine similarity | 文本相似度、说话人验证、CLIP 图文检索、文本语义检索 |
| normalization / standardization | KMeans 客户分群、CIFAR-10 CNN 图像分类 |
| embedding | 文本相似度、文本语义检索、RAG 本地文档问答、双塔召回、CLIP 图文检索 |
| tokenization | TF-IDF 文本分类、IMDB Transformer 情感分类 |
| attention / Transformer | IMDB Transformer 情感分类、VLM 图片问答 |
| convolution / pooling | CIFAR-10 CNN 图像分类、图像分类迁移学习、目标检测、图像分割 |
| speaker diarization / speaker turn | Speaker Diarization |
| source separation / stem | Source Separation |
| graph / edge | Cora 节点分类、图链接预测 |
| node / node classification | Cora 节点分类 |
| message passing / GCN | Cora 节点分类 |
| feature attribution / SHAP value | SHAP 模型解释 |
| reward / policy / value | Multi-armed Bandit、GridWorld / FrozenLake Q-learning、CartPole DQN、PPO 控制任务 |
| model registry | MLflow 实验追踪 |
| data drift | Evidently 漂移监控 |
| serving | FastAPI 模型服务 |

## 前置知识按案例补

| 前置知识 | 不要系统学，先挂到这些案例里 |
| --- | --- |
| 矩阵乘法 | MNIST MLP 手写数字识别 |
| 导数 / 偏导数 | MNIST MLP 手写数字识别 |
| 链式法则 | MNIST MLP 手写数字识别 |
| 梯度 | MNIST MLP 手写数字识别 |
| 阈值 | Breast Cancer 二分类、文本相似度、说话人验证 |
| 概率采样 / 概率分布 | Prompting 最小问答、PPO 控制任务 |
| 交叉熵 / Cross Entropy | MNIST MLP 手写数字识别、IMDB Transformer 情感分类、LoRA 指令微调 |
| 距离度量 | Digits 手写数字传统 ML、KMeans 客户分群 |
| 余弦相似度 | 文本相似度、CLIP 图文检索、说话人验证 |
| 标准化 / 归一化 | KMeans 客户分群、CIFAR-10 CNN 图像分类 |
| 排序指标 | Learning to Rank、MovieLens 协同过滤 |
| 音频时间轴 | Speaker Diarization、ASR 语音识别 |
| 频谱图 | Keyword Spotting、Source Separation |
| 图结构 / 邻接关系 | Cora 节点分类、图链接预测 |
| 特征贡献 | SHAP 模型解释 |

## 常见坑按领域

| 领域 | 常见坑 | 优先回到哪个案例修正 |
| --- | --- | --- |
| 传统 ML | 只看 accuracy，不看类别不均衡和错误类型。 | Breast Cancer 二分类 |
| 表格 | 随机划分导致时间泄漏或目标泄漏。 | Titanic 生存预测、表格 GBDT 建模 |
| 聚类 | 把聚类编号当作真实业务标签。 | KMeans 客户分群 |
| 深度学习训练 | 只盯 training loss，不看 validation 指标和过拟合。 | MNIST MLP 手写数字识别、FashionMNIST 训练循环 |
| 视觉 | 训练增强和验证增强混用，导致评估不可信。 | CIFAR-10 CNN 图像分类、图像分类迁移学习 |
| 文本 | 把 token 当作 word，忽略截断和 label alignment。 | IMDB Transformer 情感分类、NER 命名实体识别 |
| 语音 | 忽略 sample rate、静音和噪声，导致模型输入不一致。 | Keyword Spotting、ASR 语音识别 |
| 说话人分析 | 把匿名 speaker label 当作真实人物身份。 | Speaker Diarization、说话人验证 |
| 音频分离 | 只听主观效果，不检查残留和分离伪影。 | Source Separation |
| 检索 / 推荐 | 离线 recall@k 或 NDCG 高，不代表线上 CTR 一定高。 | Learning to Rank、双塔召回 |
| 图学习 | 随机拆边或拆点导致图结构泄漏。 | Cora 节点分类、图链接预测 |
| RAG | 生成答案流畅但没有 grounding 或 citation。 | RAG 本地文档问答 |
| 强化学习 | reward 设计不清，agent 学到投机策略。 | GridWorld / FrozenLake Q-learning、CartPole DQN、PPO 控制任务 |
| 工程化 | 训练代码和推理代码预处理不一致。 | ONNX 导出推理、FastAPI 模型服务 |
| 模型解释 | 把特征归因当作业务因果证明。 | SHAP 模型解释 |

## 案例卡片模板

```md
### {{案例名}}

主线：
{{输入}} -> {{处理节点}} -> {{输出}} -> {{评估}}

先查术语：
{{术语 1}}、{{术语 2}}、{{术语 3}}

前置只查：
{{数学或基础知识点名称，不展开推导}}

技术栈 / 开源入口：
{{工具、数据集、官方 tutorial 或开源项目}}

通关标准：
{{能解释的概念；能跑通的最小结果；能判断的下一步}}

常见坑：
{{最容易误解或跑偏的点}}
```

## 维护规则

- 本文以实战案例为第一维度，不以课程章节、数学体系或工具清单为第一维度。
- 新增案例必须有稳定 `###` 标题，供术语索引和 HTML 可视化引用。
- 新增案例必须写成 `输入 -> 处理 -> 输出 -> 评估` 闭环。
- 新增术语必须挂到至少一个精确案例标题。
- 新增数学前置必须说明服务哪个精确案例标题，不单独扩展成数学路线。
- 新增开源项目必须说明它能跑通哪个案例。
- 案例可以重复覆盖同一术语，重复有助于强化理解。
- 单个案例只写学习卡片，不写完整教程；需要细讲时另开《一文读懂》专题。
