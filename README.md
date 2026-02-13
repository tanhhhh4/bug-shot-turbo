# 缺陷快照助手

一个面向 TAPD 的 Chrome 扩展：在业务页面截图标注并生成缺陷内容，自动跳转到 TAPD 新建页完成标题/描述和下拉字段填充。

## 当前功能

- 截图标注：主选区 + 多个问题框，支持逐条输入描述。
- 自动生成缺陷数据：问题列表、页面地址、时间、截图。
- 自动跳转 TAPD：根据配置的项目 ID 与域名打开新建缺陷页。
- TAPD 自动填充：标题、描述、部分下拉字段自动匹配。
- AI 增强（可选）：
  - 文案优化：优化标题、逐条描述、详细描述。
  - 下拉建议：从候选值中选择最可能项。
- 特殊字段专用处理：
  - `处理人`、`迭代` 在标注面板中先选好。
  - 到 TAPD 后按顺序执行：先处理人，再迭代。
  - 仅尝试一次，优先选联想候选第一项；无候选则跳过。

## 快速开始

1. 在 `chrome://extensions/` 打开开发者模式。
2. 点击“加载已解压的扩展程序”，选择本项目目录。
3. 打开扩展设置页，至少配置：
   - TAPD 项目 ID
   - TAPD 域名（如 `tapd.cn`）
4. 在业务页面按 `Alt+S` 开始标注，完成后会自动跳转 TAPD。

## 配置说明（设置页）

### 1) TAPD 配置

- `项目 ID 列表`：支持多个，逗号分隔。
- `TAPD 域名`：支持多个，逗号分隔。
- `高级选择器`：仅在 TAPD 页面结构变化时调整。

### 2) 标注面板下拉值

- `处理人候选（每行一个）`
- `迭代候选（每行一个）`

这两个不是通用“下拉规则”逻辑，而是专用流程使用的输入值来源。

### 3) 模板设置

标题模板和描述模板支持变量替换。常用变量：

- `${issue}`：问题摘要（AI 开启且有结果时，会优先使用 AI 优化标题）
- `${rectangleList}`：多条问题描述（按编号拼接）
- `${aiDetail}`：AI 生成的完整详细描述（AI 不可用时自动降级）
- `${pageURL}`：页面 URL
- `${timestamp}`：时间戳
- `${pathLast1}`：URL 最后一段
- `${tag}`：标签文本（若有）
- `${secondMenuName}`：菜单匹配得到的二级菜单名（若配置了菜单规则）

说明：模板引擎按字段名直接取值，以上为实际最常用字段。

### 4) 下拉配置（通用）

用于优先级、严重程度、Bug 类型等普通字段。

每条规则可配置：
- 下拉名称
- CSS/XPath 选择器
- 展开选择器、选项选择器（自定义组件时）
- 候选值列表（每行一个）

匹配优先级：
1. 手工值（若字段有专用来源）
2. mapping 命中
3. AI 建议
4. 描述文本与候选文本/值匹配

注意：`处理人`、`迭代` 已走专用流程，通用下拉阶段会跳过这两个字段。

### 5) AI 助手

需要配置：
- Endpoint（兼容 Chat Completions）
- API Key
- Model
- Timeout(ms)

AI 在自动填充阶段有两类请求：
- 文案优化请求（标题、descriptions、detail）
- 下拉建议请求（仅从候选值里选）

任一请求失败会自动降级，不阻塞基础填充。

## 运行流程（实际顺序）

1. 标注完成并提交，保存 bugData。
2. 自动打开 TAPD 新建页。
3. TAPD 检测到待处理数据后开始填充：
   - 标题/描述
   - 专用字段：处理人 -> 迭代
   - 通用下拉匹配
   - 收起下拉面板（避免悬浮菜单残留）
4. 标记数据为 consumed，防止重复填充。

## 调试

在 TAPD 新建页控制台可用：

```js
window.bstTapdDebug.testPageDetection()
window.bstTapdDebug.checkAndFill()
window.bstTapdDebug.isTapdPage()
```

常见日志前缀：
- `BST TAPD Filler:` 自动填充
- `BST Background:` 后台消息与跳转
- `BST:` 标注流程

## 常见问题

### 1) 只填了标题/描述，下拉没填

- 先确认对应规则的候选值是否完整。
- 检查选择器是否定位到真实控件。
- 对自定义下拉补充 `展开选择器/选项选择器`。

### 2) 处理人/迭代没命中

- 检查“标注面板下拉值”是否配置。
- 确认 TAPD 页面对应字段仍是 `current_owner` / `iteration_id` 结构。
- 专用流程不重试：无值或无候选会直接跳过。

### 3) AI 看起来经常失败

- 先在设置页点“测试连接”。
- 检查 endpoint/model 是否与供应商兼容。
- 适当提高 timeout（例如 10000ms）。

## 项目结构

```txt
manifest.json
background/service-worker.js
content/annotator-rectangle-tool.js
content/tapd-filler.js
ui/popup.html
ui/options.html
ui/options.js
config/default-tags.js
config/tags-manager.js
```

## 备注

- 快捷键默认 `Alt+S`（macOS 也是 `Option+S`）。
- 扩展名称：`缺陷快照助手`。
