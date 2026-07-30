# CET-6 词汇学习系统 — 开发规范

> 本规范基于项目实际开发经验总结，所有开发者必须遵守。

---

## 一、版本管理

### 1.1 版本号格式
```
1.0.YYYYMMDD.NNN
```
- `1.0` — 主版本号（手动管理）
- `YYYYMMDD` — 日期
- `NNN` — 当日构建序号，由构建脚本自动递增
- 示例：`1.0.20260607.007`

### 1.2 版本号写入位置
- `android/app/build.gradle` → `versionCode` / `versionName`
- `android-eink/app/build.gradle` → `versionCode` / `versionName`
- APK 文件名：`cet6-regular-v{版本号}.apk` / `cet6-eink-v{版本号}.apk`

### 1.3 versionCode 注意事项
- `versionCode` 必须是十进制整数（如 `19`）
- **不能以 0 开头**（如 `019`），否则 Groovy 解析为八进制导致构建失败
- 构建脚本已自动处理（`[int]$seq`）

---

## 二、构建流程

### 2.1 必须使用构建脚本
```powershell
.\scripts\build.ps1 all "更新说明"       # 构建两个版本
.\scripts\build.ps1 eink "更新说明"      # 只构建墨水屏版
.\scripts\build.ps1 regular "更新说明"   # 只构建普通版
```
**禁止**手动执行 `capacitor sync` + `gradlew`，否则普通版资源会丢失。

### 2.2 两个版本完全独立
- **墨水屏版**：直接从 `www-eink/` 复制到 `android-eink/`，不用 capacitor sync
- **普通版**：用 capacitor sync 从 `www/` 同步到 `android/`
- 两个版本互不污染

### 2.3 构建后检查
- [ ] 两个 APK 都生成到 `dist/` 目录
- [ ] 两个 APK 时间戳一致（同一次构建）
- [ ] 备份文件夹 `dist/backup/YYYYMMDD/NNN/` 包含两个 APK + changelog.txt

### 2.4 备份规范
- 每次构建自动创建备份文件夹：`dist/backup/YYYYMMDD/NNN/`
- 文件夹内容：`cet6-regular-v*.apk` + `cet6-eink-v*.apk` + `changelog.txt`
- changelog.txt 格式：
  ```
  v版本号 (日期 时间)
  简短更新说明
  ```
- 所有历史版本保留，不覆盖

---

## 三、代码同步规则

### 3.1 双版本同步
`www/` 和 `www-eink/` 的 JS 逻辑**必须保持同步**（除平台专属代码）。

修改通用功能时，**两个版本都要改**。

### 3.2 平台专属代码

| 归属 | 内容 |
|------|------|
| 墨水屏专属 | 按键处理、eink-mode CSS、initSwipeGestures 禁用、无动画/渐变 |
| 普通版专属 | 滑动手势、长按菜单、动画效果、深色模式 |

### 3.3 同步检查清单
修改完代码后，必须确认：
- [ ] `www/index.html` 和 `www-eink/index.html` 的通用功能一致
- [ ] 变量声明、函数定义在两个版本中都存在
- [ ] HTML 结构（标签页、按钮、输入框）在两个版本中一致

---

## 四、代码质量

### 4.1 修改后必须检查

#### JavaScript 语法检查
```bash
# 提取 script 块并检查语法
node -e "
const fs = require('fs');
const content = fs.readFileSync('www/index.html', 'utf8');
const match = content.match(/<script>([\s\S]*?)<\/script>/g);
// 对第二个 script 块检查
fs.writeFileSync('/tmp/check.js', match[1].replace(/<\/?script>/g,''));
"
node --check /tmp/check.js
```

#### HTML div 标签配对检查
```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('www/index.html', 'utf8');
const body = content.substring(content.indexOf('<body>'), content.indexOf('</body>'));
const opens = (body.match(/<div[\s>]/g) || []).length;
const closes = (body.match(/<\/div>/g) || []).length;
console.log('Open:', opens, 'Close:', closes, 'Diff:', opens - closes);
"
```
**开闭标签数量必须一致**，差异为 0。

### 4.2 禁止的操作
- 不添加无意义注释（除非被要求）
- 不引入未确认可用的第三方库
- 不提交密钥/密码到代码库
- 不在代码中输出敏感信息

### 4.3 代码风格
- 遵循项目现有代码风格
- 使用 `var` 而非 `let/const`（保持兼容性）
- 函数命名使用驼峰命名
- CSS 类名使用连字符命名

---

## 五、设计语言

### 5.1 普通版 — 透明简洁风
- 卡片：`rgba(255,255,255,0.4)` 纯透明背景
- 按钮：纯色填充，无渐变无阴影
- 色板：紫色主色 `#6366F1`
- 导航栏：半透明 `rgba(255,255,255,0.92)`
- 字体大小范围：14-20px

### 5.2 墨水屏版 — 纯线条风
- 所有卡片：透明背景 + 黑色边框线
- 按钮：描边为主，仅主要操作填充黑色
- 无阴影、无动画、无渐变、无模糊
- 字号放大，提升可读性

### 5.3 通用原则
- **不使用表情符号**（发音按钮 🔊 除外）
- 不使用 AI 风格的渐变、光晕、浮动元素
- 所有显示的模块都必须可交互
- 预留板块接口，后续可无痛扩展
- **按钮文字不能换行**（添加 `white-space:nowrap`）
- **输入框搜索框不加 readonly**（搜索框需直接可输入）

---

## 六、功能开发流程

### 6.1 开发步骤
1. 读取 ROADMAP.md 确认下一个待开发功能
2. 在 `www/index.html` 中实现功能
3. 同步到 `www-eink/index.html`
4. 检查 JavaScript 语法
5. 检查 div 标签配对
6. 使用构建脚本构建
7. 验证两个 APK 都生成
8. 更新 ROADMAP.md 进度

### 6.2 UI 开发注意事项
- 底部导航栏标签数量控制在 7 个以内
- 按钮布局使用 `flex-wrap:nowrap` 防止换行
- 长列表使用懒加载（首屏 50 条，滚动加载更多）
- 图表/日历区域添加 `overflow-x:auto` 防止撑坏布局
- 成就/设置等列表使用折叠展开格式

### 6.3 功能开发顺序
按 ROADMAP.md 中的优先级：
- **P0** — 核心功能，优先开发
- **P1** — 重要功能，次优先
- **P2** — 增强功能，有空再做
- **P3** — 远期规划

---

## 七、已知技术债务

| 项目 | 说明 |
|------|------|
| 前端模块化 | 当前单文件 index.html 约 3900 行，待拆分 |
| Capacitor 升级 | 当前 v5，待升级到 v6 |
| Gradle 升级 | 当前 8.0.0，待升级 |
| ESLint | 待添加代码规范检查 |
| 单元测试 | 待添加测试框架 |
| 构建脚本 | regular 版本 APK 需手动复制到 dist（脚本有时未自动复制） |

---

## 八、目录结构

```
word/
├── www/                          # 普通版前端源码
│   └── index.html                # 单文件，~3900行
├── www-eink/                     # 墨水屏版前端源码
│   └── index.html                # 单文件，~4100行
├── android/                      # 普通版 Android 工程
├── android-eink/                 # 墨水屏版 Android 工程
├── electron/                     # Windows Electron 工程
├── capacitor.config.json         # 普通版配置（webDir: www）
├── capacitor.config.eink.json    # 墨水屏版配置（webDir: www-eink）
├── scripts/
│   ├── build.ps1                 # 构建脚本
│   └── ...
├── dist/                         # APK 输出目录
│   ├── cet6-regular-v*.apk
│   ├── cet6-eink-v*.apk
│   └── backup/YYYYMMDD/NNN/     # 每日备份
├── ROADMAP.md                    # 产品规划书
├── DEVELOPMENT.md                # 本文件
└── package.json
```

---

## 九、快速参考

### 常用命令
```powershell
# 构建
.\scripts\build.ps1 all "更新说明"

# 检查语法
node --check /tmp/script.js

# 同步 capacitor
npx cap sync android

# 设置 JAVA_HOME（构建需要）
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

### 关键文件
| 文件 | 用途 |
|------|------|
| `www/index.html` | 普通版全部代码 |
| `www-eink/index.html` | 墨水屏版全部代码 |
| `scripts/build.ps1` | 构建脚本 |
| `ROADMAP.md` | 产品规划书 |
| `DEVELOPMENT.md` | 开发规范（本文件） |
