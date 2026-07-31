# Diffusion Models

Diffusion Models 是一类生成建模范式，不是单个具体模型。它们通常先定义逐步加噪的数据破坏过程，再训练模型学习反向去噪，从噪声或条件信号中生成图像、视频、音频、结构等数据。

## 适合关注什么

- 前向加噪、反向去噪、噪声调度和采样步数的关系。
- DDPM、DDIM、score-based/SDE、Latent Diffusion、Flow Matching 等框架差异。
- U-Net、DiT、潜空间、条件控制和具体产品模型之间的层级关系。

## 使用边界

扩散模型家族包含多个理论框架和工程实现。全局学习时应先建立共同心智模型，再针对 Stable Diffusion、Imagen、视频扩散或 Flow Matching 等具体分支单独深挖。
