# Bug Shot Turbo (for TAPD)

> 一款专为测试工程师打造的Chrome扩展，实现"一次输入，处处复用"，显著提升TAPD缺陷提交效率

## 🚀 核心特性

- **快速截图标注**：Alt+S快速启动，框选区域并添加问题描述
- **智能自动填充**：自动识别TAPD页面，填充标题和详情
- **剪贴板集成**：截图自动写入剪贴板，一键粘贴
- **模板渲染**：问题描述自动复用到标题和详情中
- **快捷标签**：数字键1-5快速选择常用标签

## 📦 安装方法

### 开发者模式安装

1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `bug-shot-turbo` 文件夹
5. 扩展安装完成

## 🎯 使用流程

### MVP极简流程

1. **在业务页面**：按 `Alt+S` 启动标注工具
2. **框选问题区域**：拖动鼠标框选
3. **填写信息**：
   - 选择标签（快捷键1-5）
   - 输入问题描述
4. **完成标注**：点击"完成"或 `Alt+Enter`
5. **切换到TAPD**：打开新建缺陷页面
6. **自动填充**：标题和详情自动填充
7. **粘贴截图**：在详情框 `Ctrl/Cmd+V` 粘贴

## ⚙️ 配置说明

### 默认配置

- **标题模板**：`${issue}（${pathLast1}）`
- **详情模板**：
  ```
  【问题】${firstTag} - ${issue}
  【页面】${pageURL}
  【时间】${timestamp}
  【期望】<在此补充>
  【实际】<在此补充>
  （截图：粘贴后见下）
  ```

### 默认标签

1. 按钮失效
2. 表单校验
3. 样式错位
4. 接口报错
5. 其他

### 自定义配置

点击扩展图标 → 设置，可以自定义：
- TAPD选择器
- 标题/详情模板
- 快捷标签

## 🔧 开发说明

### 项目结构

```
bug-shot-turbo/
├── manifest.json           # 扩展配置
├── background/
│   └── service-worker.js  # 后台服务
├── content/
│   ├── annotator.js       # 截图标注
│   ├── annotator.css      # 标注样式
│   └── tapd-filler.js     # TAPD填充
├── ui/
│   ├── popup.html/js/css  # 弹出页面
│   └── options.html/js/css # 设置页面
└── assets/
    └── icons/             # 图标资源
```

### 技术栈

- Chrome Extension Manifest V3
- 原生JavaScript（无框架依赖）
- Chrome Storage API
- Chrome Screenshot API
- Clipboard API

## 📊 性能指标

- 面板呼出时间：< 100ms
- 截图合成时间：< 120ms
- 自动填充延迟：< 150ms
- 内存占用：< 50MB

## 🛠 故障排除

### 截图失败
- 检查是否授予了截图权限
- 尝试刷新页面后重试

### 自动填充无效
- 确认是TAPD新建缺陷页面
- 检查配置中的选择器是否正确
- 查看控制台是否有错误信息

### 剪贴板粘贴失败
- 确保浏览器支持Clipboard API
- 检查是否授予了剪贴板权限
- 尝试使用降级方案（手动复制）

## 📝 版本历史

### v0.1.0 (2024-01-06)
- MVP版本发布
- 核心功能实现
- 支持TAPD自动填充

## 📄 许可证

内部使用工具，请勿外传

## 🤝 贡献

欢迎提交Issue和Pull Request

## 📞 联系支持

- 问题反馈：[创建Issue](https://github.com/your-repo/bug-shot-turbo/issues)
- 使用帮助：查看[Wiki文档](https://github.com/your-repo/bug-shot-turbo/wiki)