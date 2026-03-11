# 目标站调研：ainews.qiaomu.ai

调研时间：2026-02-17
目标地址：[https://ainews.qiaomu.ai/](https://ainews.qiaomu.ai/)

## 1. 技术与结构判断

- 静态站生成器：Hugo
- 主题基线：PaperMod
- 首页核心卡片结构：`post-entry -> entry-cover -> entry-header -> entry-content -> entry-footer`
- 正文页核心结构：`post-single -> post-header -> toc -> post-content -> post-source -> post-footer`

## 2. 视觉风格参数（关键）

- 页面主内容宽度：`--main-width: 720px`
- 导航宽度：`--nav-width: 1024px`
- 全局圆角：`--radius: 8px`
- 卡片布局：白底卡片 + 细边框 + 大封面
- 字号体系：
  - 列表标题：`24px`
  - 正文标题：`40px`
  - 正文 `h2`：`32px`
  - 正文 `h3`：`24px`
- 配色体系：浅色/深色双主题，变量化控制（`--theme --entry --primary --secondary --border`）

## 3. 交互行为

- 顶栏含亮暗切换按钮
- 移动端在 `max-width: 768px` 切换为汉堡菜单
- 页面滚动超过阈值后显示回到顶部按钮
- 正文目录可折叠（`details/summary`）

## 4. 内容组织特征

- 首页是“可读摘要流”，不是仅标题列表
- 文章页重视来源透明（底部 `来源链接`）
- 元信息统一展示：发布日期、阅读时长、字数、作者

## 5. 原型复刻策略

- 直接复用 PaperMod 主题样式作为视觉基线（MIT 许可）
- 保持关键 class 命名和 DOM 结构一致，减少偏差
- 用本地 Markdown 内容库驱动模板渲染
- 加 OpenClaw 上传 API 作为后续自动维护入口

## 6. 与你需求的匹配点

- 你要求“先一比一模板化”：已优先完成列表页 + 正文页模板。
- 你要求“让 AI 助理持续维护”：已提供上传 API 和专用 Skill。
- 你要求“分步迭代”：当前是可评审 Demo（MVP），后续可继续加抓取、去重、审核流。
