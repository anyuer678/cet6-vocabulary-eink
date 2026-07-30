# CET-6 Vocabulary · 墨水屏版

**E-Ink 电子墨水屏优化版** — 最终版

针对 E-Ink 墨水屏设备优化的 CET-6 词汇学习应用，去除彩色动画和动效，保留完整学习功能，提供低功耗、护眼的阅读体验。

## 功能

- **单词背诵** — 极简卡片式浏览
- **练习模式** — 释义猜词、默写、配对、听写、限时闯关、选择题（集成在同一 Tab）
- **错词本** — 自动记录，针对性复习
- **学习统计** — 掌握进度、打卡、排行榜
- **笔记系统** — 纯文本笔记
- **显示设置** — 字号、卡片样式、背景主题、屏幕方向
- **发音设置** — TTS 离线引擎、口音/语速调节

## 快速开始

```bash
# 直接用浏览器打开
npx http-server . -p 8080

# 开发启动
.\start.ps1
```

## 构建

```bash
.\build.ps1           # 交互式选择构建目标
npm run build:www     # Web 文件已就绪
npm run build:apk     # Android APK (E-Ink 优化版)
npm run build:exe     # Windows 桌面 EXE
npm run build:all     # 全部构建
```

## 与彩色版的区别

| 特性 | 彩色版 | 墨水屏版 |
|------|--------|----------|
| 动画/过渡 | ✅ | ❌ |
| 彩色主题 | ✅ | ❌ 黑白为主 |
| 番茄钟 | ✅ | ❌ |
| E-Ink 优化 | ❌ | ✅ 高对比度、粗边框 |
| 字体 | 无衬线为主 | 衬线字体为主 |
| 底部导航 | 图标+文字 | 纯文字标签 |
| 背景图像 | ✅ | ❌ 纯色背景 |

## 技术栈

原生 HTML / CSS / JavaScript，eSpeak-ng TTS 离线引擎，移动 Capacitor (Android)，数据 localStorage。

## 平台

| 平台 | 状态 |
|------|------|
| Web | ✅ 可用 |
| Android (APK, E-Ink 优化) | ✅ 可用 |

## 项目结构

```
word-eink/
├── css/               # E-Ink 优化样式文件
├── js/                # 应用脚本 (app.js)
├── data/              # 词库数据 (cet6-words.js)
├── phon/              # 发音音频
├── theme-images/      # 主题背景图
├── electron/          # Electron 主进程
├── android/           # Android 工程
├── scripts/           # 辅助脚本
├── public/            # 静态资源 (图标)
├── docs/              # 文档
├── start.ps1          # 开发启动脚本
└── build.ps1          # 构建脚本
```

## 免责声明

本项目仅供学习交流与演示用途，不构成任何形式的商业服务或技术承诺。软件按「现状」提供，不作任何明示或暗示的保证。如您在使用过程中发现缺陷或问题，欢迎通过 [GitHub Issues](../../issues) 反馈，但作者不因使用本软件所直接或间接产生的任何损失承担责任。

## 开源协议

本项目基于 [GNU General Public License v3.0](LICENSE) 开源。

### 协议要点
- ✅ 自由使用、修改、分发
- ⚠️ 衍生作品必须以相同许可证 (GPL v3) 开源
- ❌ 禁止闭源商业化
