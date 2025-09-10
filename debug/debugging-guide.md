# Bug Shot Turbo - Alt+S 快捷键调试指南

## 问题描述
用户反馈按Alt+S没有反应，无法启动截图标注工具。

## 可能的原因分析

### 1. 快捷键冲突
- **系统快捷键冲突**: Alt+S可能被其他应用程序占用
- **浏览器快捷键冲突**: Chrome或其他扩展可能占用了该快捷键
- **页面快捷键冲突**: 某些网站可能拦截了键盘事件

### 2. 扩展加载问题
- **Content Script未注入**: 扩展可能在某些页面上无法正确加载
- **权限不足**: 某些特殊页面（如chrome://、file://）可能无法注入脚本
- **事件监听器未注册**: JavaScript错误导致事件监听器注册失败

### 3. 消息通信问题
- **Background Service未启动**: Service Worker可能处于休眠状态
- **消息传递失败**: background与content script之间通信中断
- **Chrome API限制**: 某些页面环境下Chrome API可能受限

## 调试步骤

### 第一步：检查扩展基本状态
1. 打开Chrome扩展管理页面 `chrome://extensions/`
2. 确认"Bug Shot Turbo"已启用
3. 查看是否有错误信息显示
4. 点击"详细信息"查看权限设置

### 第二步：检查Console日志
1. 按F12打开开发者工具
2. 切换到Console选项卡
3. 刷新页面，观察是否有BST相关日志：
   ```
   BST: Loading ScreenshotAnnotator...
   BST: ScreenshotAnnotator initialized
   BST: Event listeners setup completed
   ```
4. 尝试按Alt+S，观察是否有相应日志

### 第三步：手动测试功能
在Console中执行以下代码：
```javascript
// 检查annotator实例
console.log('annotator实例:', typeof annotator);

// 手动触发toggle
if (typeof annotator !== 'undefined') {
  annotator.toggle();
  console.log('手动触发toggle完成');
}

// 测试keyboard事件
const event = new KeyboardEvent('keydown', {
  key: 's',
  altKey: true,
  bubbles: true,
  cancelable: true
});
document.dispatchEvent(event);
```

### 第四步：检查Background Service
1. 打开扩展管理页面的"Bug Shot Turbo"详情
2. 点击"检查视图 service worker"
3. 在Console中查看是否有background相关日志
4. 手动测试命令：
   ```javascript
   // 手动触发toggle命令
   chrome.commands.onCommand.dispatch('toggle-annotation');
   ```

### 第五步：测试不同页面环境
尝试在以下不同类型的页面测试快捷键：
- HTTP/HTTPS网页 ✓ 
- 本地HTML文件 ✗ (file://协议可能受限)
- Chrome内置页面 ✗ (chrome://页面无法注入)
- 扩展页面 ✗ (extension://页面可能受限)

## 常见问题解决方案

### 问题1: Console显示"annotator is not defined"
**原因**: Content script未正确加载
**解决方案**:
1. 检查页面URL是否在content_scripts的matches范围内
2. 刷新页面重新注入脚本
3. 检查是否有JavaScript错误阻止脚本执行

### 问题2: 按Alt+S无任何反应
**原因**: 键盘事件被拦截或冲突
**解决方案**:
1. 关闭其他可能占用Alt+S的程序
2. 尝试在隐身模式下测试（排除其他扩展干扰）
3. 检查页面是否有keyboard event preventDefault

### 问题3: Background service无响应
**原因**: Service Worker休眠或出错
**解决方案**:
1. 在扩展管理页面重新启动扩展
2. 检查service worker的console是否有错误
3. 确认commands API正确注册

### 问题4: 权限不足错误
**原因**: 缺少必要权限或在受限页面
**解决方案**:
1. 检查manifest.json中的permissions配置
2. 确认host_permissions包含当前页面域名
3. 尝试在支持的页面测试

## 修复后的改进

已在代码中添加了以下调试功能：

### Content Script改进 (annotator.js)
```javascript
// 1. 添加加载日志
console.log('BST: Loading ScreenshotAnnotator...');

// 2. 改进键盘事件处理
if (e.altKey && (e.key === 's' || e.key === 'S')) {
  console.log('BST: Alt+S detected, toggling annotation...', e);
  e.preventDefault();
  e.stopPropagation();
  this.toggle();
  return false;
}

// 3. 使用capture模式确保优先处理
document.addEventListener('keydown', handler, true);
```

### Background Service改进 (service-worker.js)
```javascript
// 添加详细的错误处理和日志
async toggleAnnotation() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('BST Background: Toggle command received, active tab:', tab?.id);
    
    if (tab) {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggleAnnotation' });
      console.log('BST Background: Message sent to tab, response:', response);
    }
  } catch (error) {
    console.error('BST Background: Failed to toggle annotation:', error);
  }
}
```

## 快速测试脚本

创建了 `test-events.js` 调试脚本，包含：
- 自动检查扩展加载状态
- 测试keyboard事件
- 测试消息通信
- 手动触发功能

使用方式：
1. 在console中运行脚本
2. 使用 `window.BST_DEBUG` 访问测试函数
3. 查看详细的测试结果

## 联系支持

如果以上步骤都无法解决问题，请提供：
1. Chrome版本信息
2. 出现问题的具体页面URL
3. Console中的完整错误日志
4. 扩展管理页面的截图

这将帮助进一步诊断和解决问题。