# Video Speech Localization Runbook

本文维护视频语音本地化的独立技术 runbook。主线固定为：输入视频 + 目标语种 -> 质检本地化后的视频。

这篇文档不再按历史文章或旧素材组织，也不维护泛泛的文章规划。它只回答一件事：一条视频要被本地化成目标语视频，中间会经过哪些关键技术节点，每个节点的输入输出、技术难点、推荐开源方案和质检方式是什么。

## 目标边界

本文负责：

- 以端到端链路拆解视频语音本地化任务。
- 维护关键技术节点、英文术语、中文名、简称和边界。
- 维护每个节点的推荐开源方案、常见难点和输出产物。
- 维护可复制的总览提示词和专题提示词。

本文不负责：

- 维护某个工具的完整 API 手册。
- 直接规定线上生产架构、云厂商合同、商业配音规范或法务流程。
- 追求一次性覆盖所有音视频 AI 技术；只保留和“视频 + 目标语种 -> 本地化视频”相关的节点。

## 英文术语表

重要程度列用于个人学习标记，可按需改成 `★`、`[x] 核心`、`[x] 常用`、`[x] 按需`、`[x] 高风险` 或 `[x] 指标`。备注列用于说明它是否属于主流程、按需增强、质检辅助或高风险能力。

| 简称       | 英文全称                                  | 中文名            | 在链路中的作用                               | 备注                          | 重要程度     |
| -------- | ------------------------------------- | -------------- | ------------------------------------- | --------------------------- | -------- |
| L10n     | Localization                          | 本地化            | 把源语言内容转成目标语用户能理解、能接受、能播放的最终视频。        | 主任务目标。                      |          |
| VSL      | Video Speech Localization             | 视频语音本地化        | 本文主任务：视频输入，目标语种输出，本地化后视频交付。           | 本文范围。                       |          |
| POC      | Proof of Concept                      | 概念验证           | 用最小样例先跑通链路，验证技术路线是否可行。                | 工程验证方式。                     |          |
| QA       | Quality Assurance                     | 质量保证 / 质检      | 交付前检查媒体、字幕、语音、同步、语义和合规问题。             | 必需阶段。                       |          |
| LLM      | Large Language Model                  | 大语言模型          | 可用于翻译、本地化改写、术语一致性检查和 QA 辅助。           | 按需增强，不是媒体处理工具。              |          |
| Emb      | Embedding                             | 向量表征           | 把文本、语音、图像或人脸编码成可比较、可检索的向量。            | 通用基础概念，支撑声纹、人脸、文本和画面检索。     | \[ ] 常用  |
| TE       | Text Embedding                        | 文本向量           | 把字幕、转写或术语文本编码成向量，用于检索、去重、术语一致性和 QA。   | 不属于默认主流程，常用于本地化 QA 或上下文召回。  | \[ ] 按需  |
| VE       | Visual Embedding                      | 视觉向量 / 画面向量    | 把画面、镜头或图像编码成向量，用于画面相似检索和视觉语义辅助判断。     | 适合镜头检索、画面语义 QA，不是语音本地化必经节点。 | \[ ] 按需  |
| FE       | Face Embedding                        | 人脸向量           | 把人脸编码成向量，用于人脸聚类、重识别或身份候选召回。           | 涉及人脸识别和隐私，必须有授权和复核边界。       | \[ ] 高风险 |
| MME      | Multimodal Embedding                  | 多模态向量          | 把文本、图像、音频等放入可比较空间，用于跨模态检索或一致性检查。      | 进阶检索/QA 能力，不应默认进入所有链路。      | \[ ] 按需  |
| OCR      | Optical Character Recognition         | 光学字符识别         | 识别画面中的文字，例如标题卡、路牌、UI、烧录字幕。            | 视频本地化常见漏项，字幕之外的画面文字也可能要翻译。  | \[ ] 常用  |
| OSText   | On-screen Text                        | 画面文字           | 视频画面里直接出现的文字内容。                       | 需要判断是否翻译、遮盖、重绘或保留。          | \[ ] 常用  |
| LID      | Language Identification               | 语种识别           | 判断音频或文本属于哪种语言，处理未知源语种或多语种混说。          | 只有视频输入时很关键。                 | \[ ] 常用  |
| TN       | Text Normalization                    | 文本规范化          | 将数字、日期、缩写、符号等转成适合翻译或 TTS 的文本。         | TTS 前尤其重要。                  | \[ ] 常用  |
| G2P      | Grapheme-to-Phoneme                   | 字音转换           | 将文字转换为发音表示，用于 TTS、专名读音和多语种发音控制。       | 发音控制和配音质量相关。                | \[ ] 按需  |
| CPS      | Characters Per Second                 | 每秒字符数          | 衡量字幕阅读速度。                             | 字幕 QA 常用。                   | \[ ] 指标  |
| CPL      | Characters Per Line                   | 每行字符数          | 衡量字幕单行长度。                             | 字幕排版和可读性常用。                 | \[ ] 指标  |
| FFmpeg   | Fast Forward MPEG                     | 音视频处理工具集       | 探测、抽取、转码、封装、烧录字幕、替换音轨。                | 媒体处理底座。                     |          |
| FPS      | Frames Per Second                     | 帧率             | 影响时间码、字幕同步、镜头切分和音画同步。                 | 媒体基础。                       |          |
| CFR      | Constant Frame Rate                   | 恒定帧率           | 每秒帧数稳定，时间轴更容易对齐。                      | 对齐更稳定。                      |          |
| VFR      | Variable Frame Rate                   | 可变帧率           | 手机录屏和部分素材常见，会导致字幕、切片或对齐漂移。            | 常见同步风险。                     |          |
| PTS      | Presentation Timestamp                | 显示时间戳          | 决定视频帧或音频帧何时显示或播放。                     | 媒体时间轴基础。                    |          |
| DTS      | Decoding Timestamp                    | 解码时间戳          | 决定编码流解码顺序，和 PTS 不总是相同。                | 排查封装问题时出现。                  |          |
| BGM      | Background Music                      | 背景音乐           | 配音版视频通常要保留、压低或从原声中分离。                 | 混音相关。                       |          |
| SFX      | Sound Effects                         | 音效             | 本地化时通常应保留，避免替换人声时破坏场景声音。              | 混音相关。                       |          |
| LUFS     | Loudness Units relative to Full Scale | 响度单位           | 用于判断最终音轨响度是否适合交付。                     | 音频 QA 指标。                   |          |
| VAD      | Voice Activity Detection              | 语音活动检测         | 判断哪些时间段有人声，是 ASR 和 diarization 的前置过滤。 | 语音链路前置。                     |          |
| SAD      | Speech Activity Detection             | 语音活动检测         | 和 VAD 近义，常见于 diarization 文献。          | pyannote.audio 等工具会使用该说法。   |          |
| ASR      | Automatic Speech Recognition          | 自动语音识别         | 把源语音转成源语文本和初步时间段。                     | 主流程核心节点。                    | ★        |
| STT      | Speech To Text                        | 语音转文字          | ASR 的通用说法。                            | 和 ASR 基本同义。                 |          |
| FA       | Forced Alignment                      | 强制对齐           | 把已有文字或 ASR 文本对齐到音频时间轴，生成词级时间戳。        | 字幕和配音同步关键。                  |          |
| WTS      | Word Timestamp                        | 词级时间戳          | 每个词的开始和结束时间，用于字幕、说话人合并和配音对齐。          | Forced Alignment 输出之一。      |          |
| SRT      | SubRip Subtitle                       | SRT 字幕         | 最常见字幕交付格式。                            | 常见交付格式。                     |          |
| VTT      | WebVTT                                | Web 字幕         | Web 播放器常用字幕格式。                        | Web 场景常用。                   |          |
| ASS      | Advanced SubStation Alpha             | ASS 字幕         | 支持更复杂样式和特效的字幕格式。                      | 样式字幕。                       |          |
| MT       | Machine Translation                   | 机器翻译           | 把源语文本转成目标语文本。                         | 本地化前置能力。                    |          |
| TMS      | Translation Memory System             | 翻译记忆系统         | 复用历史翻译，保持术语和表达一致。                     | 长期内容一致性相关。                  |          |
| SD       | Speaker Diarization                   | 说话人分离          | 判断“谁在什么时候说话”，输出匿名 speaker label。      | 多人说话、字幕归属和角色一致性常用。          | ★        |
| SCD      | Speaker Change Detection              | 说话人变化检测        | 发现说话人切换点，是 diarization 子任务之一。         | Diarization 子任务。            |          |
| OSD      | Overlapped Speech Detection           | 重叠语音检测         | 识别多人同时说话片段，影响 diarization 和字幕归属。      | Diarization 难点。             |          |
| SID      | Speaker Identification                | 说话人身份识别        | 把匿名 speaker label 映射到已知身份，需要声纹库和授权。   | 高风险可选节点。                    | ★        |
| SV       | Speaker Verification                  | 说话人验证          | 判断两段声音是否来自同一人。                        | 常用于 SID 或声纹检索后的确认。          | ★        |
| SE       | Speaker Embedding                     | 说话人向量          | 把一段语音编码成声纹向量，用于聚类、识别或验证。              | 声纹检索和 diarization 的基础表示。    | ★        |
| SR       | Speaker Retrieval                     | 说话人向量检索 / 声纹检索 | 用 speaker embedding 在声纹库中检索相似说话人候选。   | 检索只是召回候选，不等于确认身份。           | \[ ] 高风险 |
| FD       | Face Detection                        | 人脸检测           | 在视频帧中找到人脸位置。                          | ASD 和画面人物绑定前置。              |          |
| FT       | Face Tracking                         | 人脸跟踪           | 把跨帧人脸连成同一条 face track。                | ASD 前置。                     |          |
| ReID     | Re-identification                     | 重识别            | 判断跨帧、跨镜头或跨片段对象是否为同一人。                 | 人脸/人物轨迹合并相关。                |          |
| ASD      | Active Speaker Detection              | 活跃说话人检测        | 判断画面中哪张脸正在说话。                         | 多人同框时按需启用。                  |          |
| TTS      | Text To Speech                        | 文本转语音          | 把目标语文本生成目标语音频。                        | 配音链路核心。                     |          |
| VC       | Voice Conversion                      | 声音转换           | 把已有语音转换成目标音色或风格。                      | 配音增强能力。                     |          |
| RVC      | Retrieval-based Voice Conversion      | 检索增强声音转换       | 常见开源声音转换路线之一，适合音色转换实验。                | VC 具体路线。                    |          |
| VClo     | Voice Cloning                         | 声音克隆           | 用参考音频生成相似音色，涉及授权和滥用风险。                | 高风险可选能力。                    |          |
| TSM      | Time Scale Modification               | 时间尺度修改         | 拉伸或压缩音频时长，尽量不改变音高。                    | 时长适配相关。                     |          |
| SS       | Source Separation                     | 声源分离           | 把人声、伴奏、音效等从混合音频中分离。                   | 配音保留背景声时常用。                 |          |
| A/V Sync | Audio Video Synchronization           | 音画同步           | 目标语音频、字幕、口型和画面时间一致。                   | 最终 QA 重点。                   |          |
| Lip Sync | Lip Synchronization                   | 口型同步           | 让画面嘴型匹配目标语音频。                         | 高成本可选增强。                    |          |
| Mux      | Multiplexing                          | 封装 / 复用        | 把视频流、音频流、字幕流合并进同一个容器文件。               | 输出交付相关。                     |          |
| Burn-in  | Burn-in Subtitle                      | 字幕烧录           | 把字幕渲染进视频画面，输出后不可像外挂字幕一样编辑。            | 不可逆交付方式。                    |          |
| Ducking  | Audio Ducking                         | 自动压低背景声        | 说话时降低 BGM/SFX 音量，让人声更清楚。              | 混音相关。                       |          |
| WER      | Word Error Rate                       | 词错误率           | 衡量 ASR 转写错误。                          | ASR QA 指标。                  |          |
| CER      | Character Error Rate                  | 字错误率           | 中文、日文等场景常用的 ASR 错误指标。                 | ASR/字幕 QA 指标。               |          |
| DER      | Diarization Error Rate                | 说话人分离错误率       | 衡量 diarization 的漏检、虚警和说话人混淆。          | Diarization QA 指标。          |          |
| JER      | Jaccard Error Rate                    | Jaccard 错误率    | 另一类 diarization 评估指标，避免长说话人主导结果。      | Diarization QA 指标。          |          |
| MOS      | Mean Opinion Score                    | 主观听感评分         | 评价配音自然度、音质和可接受度。                      | 配音主观 QA 指标。                 |          |

## 端到端主线

```text
输入视频 + 目标语种
-> 定义交付形态
-> 探测媒体流
-> 抽取和规范化音频
-> 检测语音区间
-> 转写源语音
-> 对齐词和字幕时间轴
-> 翻译与本地化改写
-> 分离或识别说话人
-> 需要时绑定画面人物
-> 生成目标语字幕或目标语配音
-> 适配时长、停顿和口型
-> 处理背景声、混音和响度
-> 封装或烧录输出视频
-> 质检本地化后的视频
```

每个节点都必须能回答四个问题：

- 输入是什么。
- 输出是什么。
- 哪些错误会向后传播。
- 哪些开源方案可以先跑通 POC。

## 输入形态

| 输入资源             | 可以跳过或弱化的节点       | 仍然必须关注                      |
| ---------------- | ---------------- | --------------------------- |
| 只有视频 + 目标语种      | 没有可跳过节点，通常要全链路处理 | ASR、对齐、翻译、字幕或配音、合成、QA。      |
| 视频 + 已知源语种       | 可以弱化语言检测         | ASR 模型选择、专名、口音、源语标点。        |
| 视频 + 源语 SRT/VTT  | 可以弱化 ASR         | 字幕清洗、强制对齐、翻译、本地化改写、时间轴重分段。  |
| 视频 + 目标语 SRT/VTT | 可以跳过翻译           | 字幕格式、封装/烧录、阅读速度、配音生成、同步 QA。 |
| 视频 + 目标语音频       | 可以跳过 TTS         | 音频对齐、混音、响度、音画同步、封装。         |
| 视频 + 多音轨或分轨录制    | 可以弱化 diarization | 流选择、说话人轨道映射、混音和最终封装。        |

## 技术节点总览

| 顺序 | 节点               | 必需性   | 输入                           | 输出                         | 关键技术                                              | 推荐开源方案                                                               | 主要难点                      |
| -- | ---------------- | ----- | ---------------------------- | -------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- | ------------------------- |
| 1  | 交付定义             | 必需    | 视频、目标语种、交付要求                 | 交付策略                       | 字幕版、配音版、多音轨版、lip sync 版                           | 无固定工具                                                                | 交付形态不清会导致后面全链路返工。         |
| 2  | 媒体流探测            | 必需    | 原始视频                         | stream manifest            | container、codec、stream、PTS/DTS、CFR/VFR            | FFmpeg、ffprobe、MediaInfo                                             | 多音轨、内嵌字幕、VFR、异常编码。        |
| 3  | 音频抽取与规范化         | 必需    | 原始视频或音轨                      | 规范化 wav                    | demux、resample、mono、loudness                      | FFmpeg、SoX、torchaudio、librosa                                        | 采样率、声道、响度、截断、音轨选错。        |
| 4  | 长视频分段            | 可选    | 视频、音频                        | clips、scene list           | shot detection、scene detection                    | PySceneDetect、TransNetV2                                             | 切点错、VFR 漂移、片段上下文丢失。       |
| 5  | VAD/SAD          | 常用必需  | wav                          | speech segments            | VAD、SAD、threshold、hangover                        | Silero VAD、WebRTC VAD、pyannote.audio                                 | 漏掉短句、误收音乐、边界切坏。           |
| 6  | ASR/STT          | 常用必需  | speech segments 或 wav        | source transcript          | Whisper、CTC/seq2seq、language ID                   | Whisper、faster-whisper、whisper.cpp                                   | 口音、噪声、专名、代码切换、标点。         |
| 7  | Forced Alignment | 常用必需  | wav、源文本                      | word timestamps            | alignment model、phoneme、word timestamp            | WhisperX、Montreal Forced Aligner、aeneas                              | 语言支持、歌词/对白偏差、时间漂移。        |
| 8  | 字幕切分             | 必需    | word timestamps、源文本          | source SRT/VTT             | segmentation、reading speed、line break             | pysubs2、Subtitle Edit、ffsubsync                                      | 阅读速度、断句、镜头切换、短字幕闪烁。       |
| 9  | 翻译与本地化           | 必需    | source text、术语表、上下文          | target text                | MT、LLM rewrite、termbase、TMS                       | Argos Translate、NLLB、MarianMT/OPUS-MT、Bergamot、Ollama、llama.cpp、vLLM | 直译、术语不一致、语气错、目标语变长。       |
| 10 | 说话人分离            | 按需    | wav、speech segments          | speaker turns              | diarization、speaker embedding、clustering、OSD      | pyannote.audio、NVIDIA NeMo、SpeechBrain                               | 说话人数估计、重叠语音、声音相似。         |
| 11 | 说话人身份识别          | 可选高风险 | speaker turns、声纹库            | known speaker labels       | speaker verification、speaker identification       | SpeechBrain、Resemblyzer、ECAPA-TDNN、FAISS                             | 需要授权、跨视频身份持久化、误识别风险。      |
| 12 | 人脸检测与跟踪          | 可选    | 视频帧                          | face tracks                | face detection、tracking、re-id                     | MediaPipe、InsightFace、RetinaFace、OpenCV、ByteTrack                    | 遮挡、侧脸、切镜、同人 track 断裂。     |
| 13 | ASD              | 可选    | face tracks、audio windows    | active face track          | audio-visual fusion、lip motion、active score       | TalkNet、Light-ASD                                                    | 画外音、多人同框、嘴动无声、音画不同步。      |
| 14 | 目标字幕生成           | 常用必需  | target text、time windows     | target SRT/VTT/ASS         | subtitle timing、style、speaker label               | pysubs2、Subtitle Edit、Aegisub                                        | 目标语变长、阅读速度、字幕遮挡。          |
| 15 | TTS/声音克隆         | 配音必需  | target text、voice setting    | target speech chunks       | TTS、voice cloning、voice conversion、prosody        | Piper、CosyVoice、F5-TTS、GPT-SoVITS、OpenVoice、Coqui TTS/XTTS、RVC       | 授权、发音、韵律、音色一致、跨语种自然度。     |
| 16 | 时长适配             | 配音常用  | target speech、原时间窗           | fitted speech              | TSM、tempo、pause control、sentence rewrite、lip sync | FFmpeg atempo、rubberband、pyrubberband、librosa、Wav2Lip、MuseTalk       | 过度拉伸失真、语速不自然、句子溢出、口型生成伪影。 |
| 17 | 声源分离             | 可选    | 原始混合音频                       | vocals、accompaniment、stems | source separation、vocal isolation                 | Demucs、UVR、MDX-Net                                                   | 分离伪影、人声残留、BGM/SFX 被破坏。    |
| 18 | 混音与响度            | 配音必需  | target speech、background bed | final audio track          | mixing、ducking、fade、LUFS、limiter                  | FFmpeg filters、SoX、pyloudnorm、Audacity                               | 削波、响度不稳、目标语被背景声盖住。        |
| 19 | 封装/烧录            | 必需    | video、audio、subtitle         | localized video            | mux、burn-in、stream mapping、codec                  | FFmpeg、MKVToolNix                                                    | 丢流、编码不兼容、字幕不可编辑、时间轴错。     |
| 20 | 质检               | 必需    | localized video、源材料、中间产物     | QA report                  | decode check、sync check、WER/CER、DER、human review  | ffprobe、ffmpeg、jiwer、pyannote.metrics、pysubs2、Subtitle Edit、自定义抽检脚本  | 指标和人工体验不一致，难例覆盖不足。        |

## 节点拆解

### 1. 交付定义

先定义最终要交付什么，否则后面的技术选择会混乱。

- 字幕版：只输出目标语字幕或带字幕视频。
- 配音版：输出目标语音轨，可能保留原 BGM/SFX。
- 多音轨版：原语音轨和目标语音轨同时保留。
- 口型同步版：需要让画面嘴型匹配目标语音频，成本最高。

关键难点：

- 目标语字幕和目标语配音对时间轴的要求不同。
- 配音版不等于简单替换音轨，通常还涉及背景声、响度、停顿和同步。
- 口型同步涉及画面生成或编辑，必须单独评估授权、质量和成本。

### 2. 媒体流探测与音频抽取

这一层只处理媒体文件，不理解内容。

输入：

- 原始视频文件。

输出：

- 流信息清单。
- ASR/VAD 使用的规范化音频，通常是 `wav`、mono、16kHz 或模型要求的采样率。
- 后续封装需要保留的视频流、音轨、字幕流信息。

推荐开源方案：

- FFmpeg：抽音频、转码、封装、过滤器处理。
- ffprobe：检查 container、codec、duration、stream、frame rate、time base。
- SoX：轻量音频转换和处理。
- torchaudio / librosa：Python 音频读取、重采样和特征处理。

关键难点：

- 多音轨视频可能有旁白、环境声、原声、人声分轨，不能默认选第一条音轨。
- VFR 视频会让字幕、切片、对齐出现漂移。
- 封装时不用 `-map` 容易丢字幕流或额外音轨。

### 3. VAD/SAD

VAD 只判断哪里有人声，不负责转文字，也不负责判断是谁。

输入：

- 规范化音频。

输出：

- 语音时间段，例如 `{start, end, speech_prob}`。

推荐开源方案：

- Silero VAD：轻量、常用于本地批处理。
- WebRTC VAD：传统实时 VAD，适合低资源场景。
- pyannote.audio：包含 speech activity detection 等语音分段能力，也常用于 diarization pipeline。

关键难点：

- 漏检会导致 ASR 永远没有机会识别那段话。
- 背景音乐、掌声、笑声、环境噪声容易造成虚警。
- 阈值、最短语音长度、最短静音长度会影响字幕切分和 ASR 上下文。

### 4. ASR/STT 与 Forced Alignment

ASR 把语音转成文字，Forced Alignment 把文字精确贴回音频时间轴。

输入：

- 音频或 VAD 后的语音片段。
- 可选源语字幕或人工转写。

输出：

- 源语文本。
- segment-level timestamps。
- word-level timestamps。
- 可选置信度分数。

推荐开源方案：

- Whisper：通用 ASR 基线。
- faster-whisper：基于 CTranslate2 的 Whisper 推理实现，常用于更快转写。
- whisper.cpp：适合本地、轻量和边缘设备实验。
- WhisperX：常用于 Whisper 转写后的 forced alignment，并可结合 diarization。
- Montreal Forced Aligner：适合已有文本和较明确语言资源的强制对齐。
- aeneas：可用于音频和文本对齐的轻量方案。

关键难点：

- ASR 错词会传染给翻译、字幕和配音。
- 词级时间戳不准会影响字幕切分、说话人合并和配音时长。
- 源字幕存在时，不一定要重新 ASR；可能更适合做清洗和 forced alignment。

### 5. 字幕切分与本地化改写

本地化不是逐句翻译，而是把源语内容变成目标语用户可读、可听、可接受的表达。

输入：

- 源语文本、词级时间戳、说话人信息、术语表。

输出：

- 目标语字幕文本。
- 目标语 SRT/VTT/ASS。
- 可选双语字幕。

推荐开源方案：

- pysubs2：Python 处理 SRT/ASS 字幕。
- Subtitle Edit / Aegisub：人工校对、样式、时间轴检查。
- Argos Translate、NLLB、MarianMT/OPUS-MT、Bergamot：机器翻译基线。
- Ollama、llama.cpp、vLLM：用于本地或自托管 LLM 改写、术语统一、语气改写和上下文一致性检查。

关键难点：

- 目标语通常比源语更长或更短，会影响阅读速度和显示时间。
- 字幕要同时满足语义准确、可读、同步和不遮挡画面。
- 专名、术语、口头禅、笑点和文化表达不能只靠直译。

### 6. Speaker Diarization 与 Speaker Identification

Speaker Diarization 回答“谁在什么时候说话”。Speaker Identification 回答“这个说话人是谁”。两者不要混用。

输入：

- 音频。
- VAD segments。
- 可选 ASR 结果。

输出：

- 匿名 speaker turns，例如 `SPEAKER_00`、`SPEAKER_01`。
- 可选已知身份标签。

推荐开源方案：

- pyannote.audio：重点推荐的 diarization 工具包，覆盖 speaker diarization、speech activity detection、speaker change detection、overlapped speech detection、speaker embedding 等能力。
- NVIDIA NeMo：包含 diarization 相关组件和语音处理能力。
- SpeechBrain：可用于 speaker embedding、speaker verification 等。
- Resemblyzer：轻量声纹 embedding 方案。
- FAISS：跨视频声纹检索或已知说话人库检索。

关键难点：

- Diarization 输出的是匿名标签，不是人物身份。
- 重叠语音、短促发言、说话人数未知、声音相似是主要难点。
- Speaker Identification 需要注册声纹库和明确授权，隐私风险更高。

### 7. 人脸检测、跟踪与 ASD

这层只在视频画面需要参与说话人判断时启用。

输入：

- 视频帧。
- 音频窗口。
- 可选 speaker turns。

输出：

- face tracks。
- active speaker score。
- 可选 speaker-to-face 绑定结果。

推荐开源方案：

- MediaPipe：人脸检测和关键点相关能力。
- InsightFace：人脸检测、识别和 embedding 能力。
- RetinaFace：常见人脸检测模型路线。
- OpenCV / ByteTrack：跟踪和工程拼接。
- TalkNet：Active Speaker Detection 方案。
- Light-ASD：轻量 ASD 方案。

关键难点：

- ASD 不是 VAD，也不是身份识别；它只判断画面中哪条 face track 正在说话。
- 画外音、旁白、多人同框、嘴动无声、遮挡、剪辑切镜都会造成误判。
- face track 断裂会导致同一人物被拆成多个轨迹。

### 8. TTS、声音克隆与时长适配

目标语配音的核心不是“能生成声音”，而是生成能放回视频时间轴里的声音。

输入：

- 目标语文本。
- 时间窗。
- 可选参考音色。

输出：

- 目标语音频片段。
- 目标语完整音轨。

推荐开源方案：

- Piper：本地轻量 TTS，适合快速验证和部分离线场景；使用前确认当前维护分支。
- CosyVoice、F5-TTS：适合多语种或较新 TTS/voice cloning 实验；使用前确认模型许可、推理资源和目标语种支持。
- Coqui TTS / XTTS：常用于多语言 TTS 和声音克隆实验；使用前要确认许可证和维护状态。
- GPT-SoVITS：常用于少样本声音克隆和 TTS 实验。
- OpenVoice：声音克隆和跨语种音色迁移方案。
- RVC：声音转换实验常见方案。
- FFmpeg atempo、rubberband、pyrubberband、librosa：时长压缩、拉伸和 tempo 调整。
- Wav2Lip、MuseTalk：属于高成本 lip sync 增强方向，不是默认配音链路；使用前必须确认授权、许可和画面伪影风险。

关键难点：

- 目标语句子经常比源语更长，必须处理语速、停顿、改写和溢出。
- 克隆声音和真实人物声音涉及授权、同意、滥用和标识。
- 单句生成更容易对齐，整段生成更自然但难编辑。

### 9. 声源分离、背景声与混音

配音版视频通常要保留背景声和音效，而不是粗暴替换整条音轨。

输入：

- 原始音频。
- 目标语音频。
- 可选分离出的 vocals、accompaniment、SFX。

输出：

- 最终目标语混音音轨。

推荐开源方案：

- Demucs：常见音乐和人声分离方案。
- UVR：图形化声源分离工具集合，适合人工流程和快速实验。
- MDX-Net 系列：常见 source separation 模型路线。
- FFmpeg filters：ducking、fade、volume、loudnorm、amix。
- pyloudnorm：Python 响度测量和归一化。

关键难点：

- 人声分离会产生伪影，不能默认可用于生产。
- BGM/SFX 被破坏会让视频显得廉价。
- 目标语音轨必须控制响度、峰值、淡入淡出和背景遮挡。

### 10. 封装、烧录与输出

最终视频交付是媒体工程问题，不是模型问题。

输入：

- 原视频。
- 目标语字幕。
- 目标语音轨。
- 可选原音轨、BGM/SFX、双语字幕。

输出：

- 本地化后视频。
- 可选独立字幕文件、音频文件、QA 报告。

推荐开源方案：

- FFmpeg：封装、烧录字幕、替换音轨、保留多音轨。
- MKVToolNix：MKV 封装和轨道处理。
- libass：ASS 字幕渲染。

关键难点：

- 烧录字幕不可编辑，外挂字幕依赖播放器支持。
- MP4/MKV 对字幕、音轨、编码支持不同。
- 必须确认输出文件没有丢字幕、丢音轨或变成不可播放编码。

### 11. 质检

质检是链路的一部分，不是最后随手看一眼。

输入：

- 本地化后视频。
- 原视频。
- 中间产物。
- 人工抽检样本。

输出：

- QA report。
- 阻断级问题清单。
- 可接受瑕疵清单。

推荐开源方案：

- ffprobe / ffmpeg：检查流信息、完整解码、时长、音轨、字幕、编码。
- jiwer：计算 WER/CER。
- pyannote.metrics：评估 diarization 相关指标。
- pysubs2：检查字幕时间轴、重叠、空字幕和格式。
- 自定义抽检脚本：按难例抽样，例如多人同框、重叠语音、长句、背景音乐。

关键难点：

- 媒体文件能播放不代表本地化质量合格。
- 指标合格不代表观感可接受，配音和字幕必须人工抽检。
- 需要区分阻断级问题和可接受瑕疵。

## 推荐开源方案速查

| 阶段                        | 优先看                                                                  | 适合解决                              | 注意事项                               |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------- | ---------------------------------- |
| 输入资源识别                    | ffprobe、FFmpeg、MediaInfo                                             | 检查视频、音轨、字幕流、编码、时长、帧率、VFR/CFR      | 先确认已有资源，避免重复跑 ASR、翻译或 diarization。 |
| 媒体预处理                     | FFmpeg、SoX、torchaudio、librosa                                        | 抽音频、重采样、转 mono、响度预处理、生成模型输入 wav   | 不理解内容，只处理媒体流和音频数据。                 |
| 长视频分段                     | PySceneDetect、TransNetV2                                             | 镜头切分、长视频拆片段、QA 抽检定位               | 切分是辅助，不应破坏语义上下文和字幕连续性。             |
| VAD/SAD                   | Silero VAD、WebRTC VAD、pyannote.audio                                 | 语音区间检测、静音过滤、ASR/diarization 前置切段  | VAD 漏检会直接损坏后续链路。                   |
| ASR/STT                   | Whisper、faster-whisper、whisper.cpp                                   | 源语音转写、语言识别、初步时间段                  | 专名、口音、噪声和长视频上下文仍要复核。               |
| Forced Alignment          | WhisperX、Montreal Forced Aligner、aeneas                              | 词级时间戳、源字幕校准、ASR 时间轴修正             | 语言支持和源文本质量决定效果上限。                  |
| 字幕处理                      | pysubs2、Subtitle Edit、Aegisub、ffsubsync                              | 字幕清洗、切分、重定时、样式和人工校对               | 阅读速度、断句、画面遮挡和时间轴漂移要人工抽检。           |
| 翻译与本地化                    | Argos Translate、NLLB、MarianMT/OPUS-MT、Bergamot、Ollama、llama.cpp、vLLM | 翻译、术语统一、本地化改写、语气和上下文一致性检查         | 直译不是本地化，术语表和上下文很关键。                |
| Diarization               | pyannote.audio、NVIDIA NeMo、SpeechBrain                               | 匿名说话人分离、speaker turns、重叠语音辅助判断    | pyannote.audio 是本链路必须认识的重点方案。      |
| Speaker Verification / ID | SpeechBrain、Resemblyzer、ECAPA-TDNN、FAISS                             | 声纹向量、说话人验证、声纹检索、已知说话人候选召回         | 检索只是召回候选，不等于确认身份；需要授权和隐私边界。        |
| Face Detection / Tracking | MediaPipe、InsightFace、RetinaFace、OpenCV、ByteTrack                    | 人脸检测、face track、跨帧跟踪、人物轨迹维护       | 遮挡、侧脸、切镜和 track 断裂会影响后续 ASD。       |
| ASD                       | TalkNet、Light-ASD                                                    | 判断画面中哪张脸正在说话，把音频说话片段绑定到可见人物       | ASD 不是 VAD，也不是身份识别；画外音和剪辑切换会造成误判。  |
| TTS / Voice Cloning / VC  | Piper、CosyVoice、F5-TTS、Coqui TTS/XTTS、GPT-SoVITS、OpenVoice、RVC       | 目标语配音、音色迁移、声音克隆和 voice conversion | 许可证、授权、音色相似度和滥用风险必须检查。             |
| 时长适配 / Lip Sync           | FFmpeg atempo、rubberband、pyrubberband、librosa、Wav2Lip、MuseTalk       | 语速调整、时长拉伸压缩、停顿处理、口型同步增强           | Lip sync 是高成本可选节点，不应默认进入所有链路。      |
| Source Separation         | Demucs、UVR、MDX-Net                                                   | 分离人声、伴奏、背景声，给配音保留 background bed  | 分离伪影和 SFX 损坏要人工听检。                 |
| Mixing / Loudness         | FFmpeg filters、SoX、pyloudnorm、Audacity                               | 混音、ducking、fade、响度归一、削波检查         | 指标只是辅助，最终可懂度必须听检。                  |
| Packaging                 | FFmpeg、ffprobe、MKVToolNix、libass                                     | 多音轨封装、字幕烧录/外挂、编码兼容、输出流验证          | 必须检查 `-map`，避免丢字幕、丢音轨或输出不可编辑。      |
| QA / Metrics              | ffprobe、ffmpeg、jiwer、pyannote.metrics、pysubs2、Subtitle Edit、自定义抽检脚本  | 媒体完整性、WER/CER、DER/JER、字幕时间轴、人工抽检  | “能播放”不等于“可交付”；必须区分阻断级问题和可接受瑕疵。     |

## 总览提示词

```md
请围绕“视频语音本地化：输入视频 + 目标语种 -> 质检本地化后的视频”生成一份技术总览。

目标不是写音视频术语百科，也不是先规划呈现形式。请围绕一条端到端主线讲解：原始视频进入系统后，如何一步步变成目标语本地化视频，并通过质检。

必须覆盖：
- 输入形态：只有视频、已知源语种、有源语 SRT/VTT、有目标语 SRT/VTT、有目标语音频、多音轨视频。
- 主链路：交付定义 -> 媒体流探测 -> 音频抽取与规范化 -> VAD/SAD -> ASR/STT -> Forced Alignment -> 字幕切分 -> 翻译与本地化改写 -> Speaker Diarization -> 可选 Speaker Identification -> 可选 Face Detection/Tracking -> 可选 ASD -> TTS/Voice Cloning/Voice Conversion -> 时长适配 -> Source Separation -> 混音与响度 -> 封装/烧录 -> QA。
- 每个节点的输入、输出、中间产物、关键技术、错误如何向后传播。
- 推荐开源方案：FFmpeg、ffprobe、Silero VAD、WebRTC VAD、pyannote.audio、Whisper、faster-whisper、whisper.cpp、WhisperX、Montreal Forced Aligner、pysubs2、Subtitle Edit、Argos Translate、NLLB、MarianMT/OPUS-MT、Ollama、llama.cpp、vLLM、MediaPipe、InsightFace、TalkNet、Light-ASD、Piper、CosyVoice、F5-TTS、GPT-SoVITS、OpenVoice、RVC、Demucs、UVR、pyloudnorm、jiwer、pyannote.metrics。
- 英文术语表：简称、英文全称、中文名、在链路中的作用、重要程度、备注。
- 质检：媒体完整性、字幕同步、音画同步、ASR 错误、说话人错误、翻译质量、配音听感、响度、合规授权和人工抽检。

输出结构建议：
- 先给端到端主线。
- 再给输入形态分支。
- 再给节点矩阵：节点、必需性、输入、输出、关键技术、推荐开源方案、主要难点。
- 再给英文术语表，并说明哪些术语是主流程、按需增强、质检辅助或高风险能力。
- 最后给 QA 分层和阻断级问题。

避免：
- 不要把 VAD、ASD、人脸检测、pyannote.audio、FFmpeg、TTS 等术语平铺成百科清单。
- 不要只讲概念，不讲输入输出和产物。
- 不要遗漏 pyannote.audio。
- 不要默认所有视频都需要 ASD、speaker identification、voice cloning 或 lip sync；明确它们是按需节点。
- 不要先设计呈现形式、布局、动效或交互控件；先把技术链路讲清。
- 不要生成完整项目代码，必要时只给伪代码或最小命令片段。
```

## 单节点专题提示词

```md
请围绕“[填写节点名称] 在视频语音本地化中的作用”生成一份单节点技术分析。

背景主线固定为：输入视频 + 目标语种 -> 质检本地化后的视频。本文只深入讲这个节点，不要偏离到完整项目教程、页面设计或工具百科。

请按以下方式讲清：
- 这个节点解决什么问题，为什么会出现在视频语音本地化链路中。
- 它在端到端链路中的上游和下游分别是什么。
- 输入数据是什么，输出数据是什么，中间产物是什么。
- 关键英文术语、简称、中文名和边界。
- 推荐开源方案有哪些，它们分别适合 POC、批处理、本地离线、人工辅助还是线上服务。
- 核心技术难点是什么，例如时间轴漂移、说话人混淆、目标语变长、背景声伪影、音画不同步。
- 这个节点做错后会如何影响后续节点。
- 这个节点如何质检，哪些问题是阻断级，哪些可以人工复核后接受。

如果节点涉及以下方向，必须补充：
- VAD/SAD：说明 Silero VAD、WebRTC VAD、pyannote.audio 的边界。
- Speaker Diarization：重点说明 pyannote.audio、匿名 speaker label、DER、重叠语音和 speaker identification 的区别。
- ASR/Alignment：说明 Whisper、faster-whisper、whisper.cpp、WhisperX、word timestamp 和 forced alignment。
- Face/ASD：说明 MediaPipe、InsightFace、TalkNet、Light-ASD，以及 ASD 不是 VAD、不是身份识别。
- TTS/VC：说明 Piper、GPT-SoVITS、OpenVoice、RVC，以及授权、音色、时长适配。
- Mixing/Packaging：说明 FFmpeg、source separation、Demucs、响度、字幕烧录/外挂和最终封装。
- QA：说明 ffprobe、jiwer、pyannote.metrics、人工抽检和阻断级问题。

避免：
- 不要写成术语百科。
- 不要只列工具名。
- 不要省略输入输出。
- 不要把可选节点写成所有项目必做。
- 不要先设计 HTML 或交互表现。
```

## QA 专题提示词

```md
请围绕“本地化视频 QA：如何判断输出真的可交付”生成一份 QA 技术分析。

背景主线固定为：输入视频 + 目标语种 -> 质检本地化后的视频。本文聚焦最后的质检阶段，同时要能反向定位是哪一个上游节点出了问题。

请重点讲清：
- QA 输入：原视频、本地化后视频、目标语字幕、目标语音轨、ASR 文本、word timestamps、speaker turns、中间日志。
- QA 输出：QA report、阻断级问题、可接受瑕疵、需要人工复核的片段。
- 媒体层检查：容器、编码、音轨、字幕流、时长、帧率、完整解码、可播放性。
- 字幕层检查：时间轴、阅读速度、行长、重叠字幕、空字幕、错别字、术语一致、专名一致。
- 音频层检查：响度、削波、噪声、目标语被 BGM/SFX 遮挡、音轨缺失。
- 语音理解层检查：WER/CER、word timestamp drift、DER/JER、speaker 数量、重叠语音。
- 本地化层检查：是否直译、是否漏译、是否新增事实、语气是否符合人物和场景。
- 配音层检查：发音、韵律、音色一致性、时长适配、停顿、口型和音画同步。
- 合规层检查：voice cloning、speaker identification、人脸识别、云 API、数据留存和授权。
- 抽检策略：覆盖多人同框、画外音、背景音乐、重叠语音、快速剪辑、长句、专有名词、目标语明显变长片段。

请明确给出：
- 从 QA 问题反查上游节点。
- 阻断级问题与可接受瑕疵的区别。
- 自动指标和人工审核各自能发现什么。

避免：
- 不要只列指标。
- 不要把“能播放”当作“可交付”。
- 不要忽略人工抽检。
- 不要先设计 HTML 或交互表现。
```

## 维护规则

- 本文保持独立，不依赖其它提示词文档或历史素材。
- 主线永远是“输入视频 + 目标语种 -> 质检本地化后的视频”。
- 新增内容必须落到具体节点：输入、输出、关键技术、开源方案、难点、质检。
- 英文简称必须进入术语表，不能只在正文里零散出现；新增术语要补齐重要程度和备注。
- 推荐开源方案要写清适用节点和边界，不要只堆工具名。
- `pyannote.audio` 必须出现在 VAD/SAD 或 Speaker Diarization 相关节点中，并说明它在说话人分离和语音分段里的位置。
- 涉及声音克隆、说话人身份、人脸识别、云 API 或个人数据时，必须补充授权、隐私和人工复核边界。

