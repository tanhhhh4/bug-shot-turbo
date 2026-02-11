// Bug Shot Turbo - 截图标注核心功能

class ScreenshotAnnotator {
  constructor() {
    this.isActive = false;
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.overlay = null;
    this.selectionBox = null;
    this.panel = null;
    this.frozenBackground = null;
    this.screenshot = null;
    this.bugData = {};
    
    this.init();
  }

  init() {
    console.log('BST: ScreenshotAnnotator initialized');
    // 监听快捷键和消息
    this.setupListeners();
    console.log('BST: Event listeners setup completed');
  }

  setupListeners() {
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('BST Content: Message received:', request);
      
      if (request.action === 'toggleAnnotation') {
        console.log('BST Content: Toggling annotation via message...');
        this.toggle();
        sendResponse({ success: true });
      }
      
      return true; // 保持消息通道开放
    });

    // 监听键盘事件 - 添加调试日志
    document.addEventListener('keydown', (e) => {
      // 调试日志
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        console.log('BST: Alt+S detected, toggling annotation...', e);
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
        return false;
      }
      
      if (this.isActive && e.key === 'Escape') {
        console.log('BST: Escape detected, canceling annotation...');
        e.preventDefault();
        this.cancel();
      }
    }, true); // 使用capture模式确保优先处理
  }

  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  async activate() {
    this.isActive = true;
    
    // 立即截图并创建静态背景
    await this.captureAndFreezeScreen();
    
    // 创建遮罩层
    this.createOverlay();
    
    // 添加鼠标事件监听
    this.setupMouseEvents();
  }

  deactivate() {
    this.isActive = false;
    this.cleanup();
  }

  async captureAndFreezeScreen() {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'captureVisibleTab' 
      });
      
      if (response.success) {
        this.screenshot = response.dataUrl;
        // 创建静态截图背景层，完全覆盖原始页面
        this.createFrozenBackground();
      } else {
        console.error('Failed to capture screenshot:', response.error);
        this.showError('截图失败，请重试');
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      this.showError('截图失败: ' + error.message);
    }
  }

  createFrozenBackground() {
    if (!this.screenshot) return;
    
    // 创建全屏静态背景层
    this.frozenBackground = document.createElement('div');
    this.frozenBackground.className = 'bst-frozen-background';
    this.frozenBackground.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-image: url(${this.screenshot});
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: center;
      z-index: 999997;
      pointer-events: none;
    `;
    
    document.body.appendChild(this.frozenBackground);
    console.log('BST: Frozen background created');
  }

  async captureScreenshot() {
    // 保留原方法供其他功能使用
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'captureVisibleTab' 
      });
      
      if (response.success) {
        this.screenshot = response.dataUrl;
      } else {
        console.error('Failed to capture screenshot:', response.error);
        this.showError('截图失败，请重试');
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      this.showError('截图失败: ' + error.message);
    }
  }

  createOverlay() {
    // 创建半透明遮罩层，在冻结背景之上
    this.overlay = document.createElement('div');
    this.overlay.className = 'bst-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999998;
      cursor: crosshair;
    `;
    document.body.appendChild(this.overlay);
  }

  setupMouseEvents() {
    this.overlay.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.overlay.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.overlay.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  onMouseDown(e) {
    if (e.button !== 0) return; // 只处理左键
    
    this.isDrawing = true;
    this.startPoint = { x: e.clientX, y: e.clientY };
    
    // 创建选择框
    this.createSelectionBox();
  }

  onMouseMove(e) {
    if (!this.isDrawing) return;
    
    this.endPoint = { x: e.clientX, y: e.clientY };
    this.updateSelectionBox();
  }

  onMouseUp(e) {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.endPoint = { x: e.clientX, y: e.clientY };
    
    // 检查是否有有效的选择区域
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    if (width > 10 && height > 10) {
      this.showAnnotationPanel();
    } else {
      this.cancel();
    }
  }

  createSelectionBox() {
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'bst-selection';
    this.selectionBox.style.cssText = `
      position: fixed;
      border: 2px solid #ff6b6b;
      background: transparent !important;
      z-index: 999999;
      pointer-events: none;
      box-shadow: none;
    `;
    document.body.appendChild(this.selectionBox);
  }

  updateSelectionBox() {
    if (!this.selectionBox || !this.startPoint || !this.endPoint) return;
    
    const left = Math.min(this.startPoint.x, this.endPoint.x);
    const top = Math.min(this.startPoint.y, this.endPoint.y);
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    this.selectionBox.style.left = `${left}px`;
    this.selectionBox.style.top = `${top}px`;
    this.selectionBox.style.width = `${width}px`;
    this.selectionBox.style.height = `${height}px`;
  }

  showAnnotationPanel() {
    // 移除鼠标事件监听
    this.overlay.style.pointerEvents = 'none';
    
    // 创建标注面板
    this.panel = document.createElement('div');
    this.panel.className = 'bst-panel';
    this.panel.innerHTML = `
      <div class="bst-panel-container">
        <div class="bst-panel-header">
          <h3>快速标注缺陷</h3>
          <button class="bst-close" title="关闭 (Esc)">×</button>
        </div>
        <div class="bst-panel-body">
          <div class="bst-tags">
            <label>选择标签 (快捷键 1-5)：</label>
            <div class="bst-tag-list">
              <button class="bst-tag" data-tag="按钮失效" data-key="1">1.按钮失效</button>
              <button class="bst-tag" data-tag="表单校验" data-key="2">2.表单校验</button>
              <button class="bst-tag" data-tag="样式错位" data-key="3">3.样式错位</button>
              <button class="bst-tag" data-tag="接口报错" data-key="4">4.接口报错</button>
              <button class="bst-tag" data-tag="其他" data-key="5">5.其他</button>
            </div>
          </div>
          <div class="bst-input">
            <label>问题描述 <span style="color: red;">*</span>：</label>
            <input type="text" id="bst-issue" placeholder="请输入问题的简短描述..." autofocus>
          </div>
        </div>
        <div class="bst-panel-footer">
          <button class="bst-btn bst-btn-cancel">取消 (Esc)</button>
          <button class="bst-btn bst-btn-primary" id="bst-submit">完成 (Alt+Enter)</button>
        </div>
      </div>
    `;
    
    // 添加样式
    this.addPanelStyles();
    
    document.body.appendChild(this.panel);
    
    // 绑定面板事件
    this.bindPanelEvents();
    
    // 自动聚焦到输入框
    document.getElementById('bst-issue').focus();
  }

  addPanelStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .bst-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 1000000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      
      .bst-panel-container {
        width: 500px;
        max-width: 90vw;
      }
      
      .bst-panel-header {
        padding: 16px 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .bst-panel-header h3 {
        margin: 0;
        font-size: 18px;
        color: #333;
      }
      
      .bst-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #999;
        padding: 0;
        width: 30px;
        height: 30px;
      }
      
      .bst-close:hover {
        color: #333;
      }
      
      .bst-panel-body {
        padding: 20px;
      }
      
      .bst-tags {
        margin-bottom: 20px;
      }
      
      .bst-tags label {
        display: block;
        margin-bottom: 10px;
        font-size: 14px;
        color: #666;
      }
      
      .bst-tag-list {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      
      .bst-tag {
        padding: 8px 16px;
        border: 1px solid #d0d0d0;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .bst-tag:hover {
        background: #f5f5f5;
        border-color: #ff6b6b;
      }
      
      .bst-tag.active {
        background: #ff6b6b;
        color: white;
        border-color: #ff6b6b;
      }
      
      .bst-input label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        color: #666;
      }
      
      .bst-input input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
      }
      
      .bst-input input:focus {
        outline: none;
        border-color: #ff6b6b;
      }
      
      .bst-panel-footer {
        padding: 16px 20px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }
      
      .bst-btn {
        padding: 8px 20px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .bst-btn-cancel {
        background: white;
        border: 1px solid #d0d0d0;
        color: #666;
      }
      
      .bst-btn-cancel:hover {
        background: #f5f5f5;
      }
      
      .bst-btn-primary {
        background: #ff6b6b;
        border: 1px solid #ff6b6b;
        color: white;
      }
      
      .bst-btn-primary:hover {
        background: #ff5252;
      }
      
      .bst-btn-primary:disabled {
        background: #ccc;
        border-color: #ccc;
        cursor: not-allowed;
      }
    `;
    
    document.head.appendChild(style);
  }

  bindPanelEvents() {
    // 标签选择
    const tags = this.panel.querySelectorAll('.bst-tag');
    tags.forEach(tag => {
      tag.addEventListener('click', () => {
        tags.forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        this.bugData.firstTag = tag.dataset.tag;
      });
    });
    
    // 快捷键选择标签
    document.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= '5') {
        const tag = this.panel.querySelector(`.bst-tag[data-key="${e.key}"]`);
        if (tag) {
          tag.click();
        }
      }
      
      // Alt+Enter 提交
      if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        this.submit();
      }
    });
    
    // 关闭按钮
    this.panel.querySelector('.bst-close').addEventListener('click', () => {
      this.cancel();
    });
    
    // 取消按钮
    this.panel.querySelector('.bst-btn-cancel').addEventListener('click', () => {
      this.cancel();
    });
    
    // 提交按钮
    document.getElementById('bst-submit').addEventListener('click', () => {
      this.submit();
    });
    
    // 输入框变化
    document.getElementById('bst-issue').addEventListener('input', (e) => {
      this.bugData.issue = e.target.value.trim();
      this.updateSubmitButton();
    });
  }

  updateSubmitButton() {
    const submitBtn = document.getElementById('bst-submit');
    const hasTag = this.bugData.firstTag;
    const hasIssue = this.bugData.issue && this.bugData.issue.length > 0;
    
    submitBtn.disabled = !hasTag || !hasIssue;
  }

  async submit() {
    // 验证必填项
    if (!this.bugData.firstTag) {
      this.showError('请选择一个标签');
      return;
    }
    
    if (!this.bugData.issue) {
      this.showError('请输入问题描述');
      document.getElementById('bst-issue').focus();
      return;
    }
    
    // 收集页面信息
    this.bugData.pageURL = window.location.href;
    const urlParts = window.location.pathname.split('/').filter(p => p);
    this.bugData.pathLast1 = urlParts[urlParts.length - 1] || 'index';
    
    // 合成截图
    await this.compositeScreenshot();
    
    // 保存数据
    await this.saveBugData();
    
    // 写入剪贴板
    await this.copyToClipboard();
    
    // 显示成功提示
    this.showSuccess('缺陷包已生成，请切换到TAPD页面提交');
    
    // 关闭标注工具
    setTimeout(() => {
      this.deactivate();
    }, 1500);
  }

  async compositeScreenshot() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      
      // 获取选区信息
      const rect = {
        x: Math.min(this.startPoint.x, this.endPoint.x),
        y: Math.min(this.startPoint.y, this.endPoint.y),
        width: Math.abs(this.endPoint.x - this.startPoint.x),
        height: Math.abs(this.endPoint.y - this.startPoint.y)
      };
      
      // 加载原始截图
      const img = new Image();
      img.onload = () => {
        // 设置canvas尺寸
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 绘制原始截图
        ctx.drawImage(img, 0, 0);
        
        // 添加半透明遮罩（除了选区）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 清除选区遮罩
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fillRect(rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr);
        
        // 恢复绘制模式
        ctx.globalCompositeOperation = 'source-over';
        
        // 绘制选区边框
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2 * dpr;
        ctx.strokeRect(rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr);
        
        // 添加标签和问题描述
        const labelY = rect.y * dpr - 10;
        const labelX = rect.x * dpr;
        
        // 绘制标签背景
        ctx.fillStyle = '#ff6b6b';
        const labelText = `[${this.bugData.firstTag}] ${this.bugData.issue}`;
        ctx.font = `${14 * dpr}px Arial`;
        const textWidth = ctx.measureText(labelText).width;
        
        // 绘制标签气泡
        const padding = 8 * dpr;
        const bubbleHeight = 28 * dpr;
        const bubbleY = labelY - bubbleHeight;
        
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.roundRect(labelX, bubbleY, textWidth + padding * 2, bubbleHeight, 4 * dpr);
        ctx.fill();
        
        // 绘制标签文本
        ctx.fillStyle = 'white';
        ctx.fillText(labelText, labelX + padding, bubbleY + 20 * dpr);
        
        // 保存合成后的图片
        this.bugData.screenshot = canvas.toDataURL('image/png');
        resolve();
      };
      
      img.src = this.screenshot;
    });
  }

  async saveBugData() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveBugData',
        data: this.bugData
      });
      
      if (!response.success) {
        console.error('Failed to save bug data:', response.error);
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  }

  async copyToClipboard() {
    try {
      // 转换dataURL为blob
      const response = await fetch(this.bugData.screenshot);
      const blob = await response.blob();
      
      // 尝试使用新的Clipboard API
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
      } else {
        // 降级方案
        this.fallbackCopyImage();
      }
    } catch (error) {
      console.error('Clipboard error:', error);
      this.fallbackCopyImage();
    }
  }

  fallbackCopyImage() {
    // 创建临时图片元素用于复制
    const img = document.createElement('img');
    img.src = this.bugData.screenshot;
    img.style.position = 'fixed';
    img.style.left = '-9999px';
    img.style.top = '0';
    document.body.appendChild(img);
    
    // 选择图片
    const range = document.createRange();
    range.selectNode(img);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    
    try {
      document.execCommand('copy');
      console.log('Image copied using fallback method');
    } catch (err) {
      console.error('Fallback copy failed:', err);
    } finally {
      document.body.removeChild(img);
      window.getSelection().removeAllRanges();
    }
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `bst-toast bst-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 1000001;
      animation: slideIn 0.3s ease;
    `;
    
    if (type === 'success') {
      toast.style.background = '#52c41a';
    } else if (type === 'error') {
      toast.style.background = '#f5222d';
    } else {
      toast.style.background = '#1890ff';
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  cancel() {
    this.deactivate();
  }

  cleanup() {
    // 清理所有创建的元素
    if (this.frozenBackground) {
      this.frozenBackground.remove();
      this.frozenBackground = null;
    }
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
    
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    
    // 重置状态
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.screenshot = null;
    this.bugData = {};
  }
}

// 初始化标注工具
console.log('BST: Loading ScreenshotAnnotator...');
const annotator = new ScreenshotAnnotator();
console.log('BST: ScreenshotAnnotator loaded, instance:', annotator);

// 将annotator暴露到window对象，供调试和直接调用
window.annotator = annotator;

// 确认扩展已加载
console.log('BST: Screenshot Annotator initialized. Use Alt+S to toggle or call window.annotator.toggle()');