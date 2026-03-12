---
title: 所有 intrinsic RLVR 本质是锐化初始分布
summary: Mock 数据：模拟 AI 论文简报卡片，保留高信息密度的首屏摘要和标签，方便快速筛选要不要继续点开阅读全文。
author: Reading Recall Mock
publishedAt: 2026-03-12T07:50:00+08:00
tags:
  - rlvr
  - reasoning
  - paper
  - model-collapse
categories:
  - Research Brief
readingTimeMinutes: 4
wordCount: 1260
source:
  platform: wechat
  name: AI论文简报
  url: https://example.com/intrinsic-rlvr-brief
language: zh
---

## 核心判断

如果模型先验分布本身不够好，再多的 intrinsic reward 也只是在局部放大已有偏好，很难凭空长出稳定的判断力。

## 关键记忆点

1. 训练天花板先被初始分布决定。
2. collapse 往往能在真正跑 RL 前被预测出来。
3. 代码形式的中间表示，对某些结构推理任务更有利。

## 值得回到原文核对的地方

- 论文实验里不同 warm-start 的对照设置
- collapse step 的定义方式
- 任务分布外迁移的证据强度
