// Bug Shot Turbo - 支持多区域标注的截图标注核心功能

class ScreenshotAnnotator {
  constructor() {
    this.isActive = false;
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.overlay = null;
    this.panel = null;
    this.screenshot = null;
    
    // 多区域支持
    this.selections = [];  // 存储所有选区
    this.currentSelection = null;
    this.selectionElements = [];  // 存储所有选区的DOM元素
    
    this.init();
  }

  init() {
    this.setupListeners();
  }

  setupListeners() {
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleAnnotation') {
        this.toggle();
      }
    });

    // 监听键盘事件
    document.addEventListener('keydown', (e) => {
      console.log('BST: Key pressed:', e.key, 'Alt:', e.altKey, 'Active:', this.isActive);
      
      // Alt+S 切换标注工具
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        console.log('BST: Alt+S detected, toggling annotation...');
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
        return false;
      }
      
      // 活动状态下的快捷键
      if (this.isActive) {
        // Esc 退出
        if (e.key === 'Escape') {
          this.cancel();
        }
        
        // Delete 删除最后一个选区
        if (e.key === 'Delete' && this.selections.length > 0) {
          this.removeLastSelection();
        }
        
        // Enter 完成当前截图标注
        if (e.key === 'Enter' && this.selections.length > 0) {
          e.preventDefault();
          this.showAnnotationPanel();
        }
      }
    }, true);
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
    this.selections = [];
    this.selectionElements = [];
    
    // 先截图
    await this.captureScreenshot();
    
    // 创建遮罩层
    this.createOverlay();
    
    // 添加鼠标事件监听
    this.setupMouseEvents();
    
    // 显示提示
    this.showTooltip();
  }

  deactivate() {
    this.isActive = false;
    this.cleanup();
  }

  async captureScreenshot() {
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
    // 创建半透明遮罩
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

  showTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'bst-tooltip';
    tooltip.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 1000000;
        display: flex;
        gap: 20px;
        align-items: center;
      ">
        <span>🖱️ 拖动框选问题区域</span>
        <span>📌 支持多次框选</span>
        <span>⌫ Delete删除上一个</span>
        <span>↵ Enter完成</span>
        <span>⎋ Esc取消</span>
      </div>
    `;
    document.body.appendChild(tooltip);
    
    // 3秒后自动隐藏
    setTimeout(() => {
      tooltip.remove();
    }, 3000);
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
    
    // 创建新的选择框
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
      // 保存选区
      this.saveSelection();
      
      // 显示选区编号
      this.addSelectionLabel();
      
      // 重置当前选区
      this.currentSelection = null;
    } else {
      // 无效选区，移除
      if (this.currentSelection) {
        this.currentSelection.remove();
        this.currentSelection = null;
      }
    }
  }

  createSelectionBox() {
    this.currentSelection = document.createElement('div');
    this.currentSelection.className = 'bst-selection';
    this.currentSelection.style.cssText = `
      position: fixed;
      border: 2px solid #ff6b6b;
      background: transparent !important;
      z-index: 999999;
      pointer-events: none;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5), 0 0 0 1px rgba(255, 107, 107, 0.5);
    `;
    document.body.appendChild(this.currentSelection);
  }

  updateSelectionBox() {
    if (!this.currentSelection || !this.startPoint || !this.endPoint) return;
    
    const left = Math.min(this.startPoint.x, this.endPoint.x);
    const top = Math.min(this.startPoint.y, this.endPoint.y);
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    this.currentSelection.style.left = `${left}px`;
    this.currentSelection.style.top = `${top}px`;
    this.currentSelection.style.width = `${width}px`;
    this.currentSelection.style.height = `${height}px`;
  }

  saveSelection() {
    const rect = {
      x: Math.min(this.startPoint.x, this.endPoint.x),
      y: Math.min(this.startPoint.y, this.endPoint.y),
      width: Math.abs(this.endPoint.x - this.startPoint.x),
      height: Math.abs(this.endPoint.y - this.startPoint.y)
    };
    
    this.selections.push({
      rect: rect,
      element: this.currentSelection,
      tag: null,
      issue: null
    });
    
    this.selectionElements.push(this.currentSelection);
  }

  addSelectionLabel() {
    const index = this.selections.length;
    const selection = this.selections[index - 1];
    
    // 创建标签
    const label = document.createElement('div');
    label.className = 'bst-selection-label';
    label.style.cssText = `
      position: fixed;
      left: ${selection.rect.x}px;
      top: ${selection.rect.y - 25}px;
      background: #ff6b6b;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000000;
      font-weight: bold;
    `;
    label.textContent = `#${index}`;
    document.body.appendChild(label);
    
    selection.labelElement = label;
  }

  removeLastSelection() {
    if (this.selections.length === 0) return;
    
    const lastSelection = this.selections.pop();
    if (lastSelection.element) {
      lastSelection.element.remove();
    }
    if (lastSelection.labelElement) {
      lastSelection.labelElement.remove();
    }
    
    this.showToast(`已删除选区 #${this.selections.length + 1}`, 'info');
  }

  showAnnotationPanel() {
    if (this.selections.length === 0) {
      this.showError('请先框选问题区域');
      return;
    }
    
    // 移除鼠标事件监听
    this.overlay.style.pointerEvents = 'none';
    
    // 创建标注面板
    this.panel = document.createElement('div');
    this.panel.className = 'bst-panel';
    this.panel.innerHTML = `
      <div class="bst-panel-container">
        <div class="bst-panel-header">
          <h3>标注 ${this.selections.length} 个问题区域</h3>
          <button class="bst-close" title="关闭 (Esc)">×</button>
        </div>
        <div class="bst-panel-body">
          <div class="bst-selections-info">
            <p style="margin-bottom: 15px; color: #666; font-size: 13px;">
              已选择 ${this.selections.length} 个区域，请为每个区域添加问题描述
            </p>
          </div>
          ${this.selections.map((sel, index) => `
            <div class="bst-selection-item" data-index="${index}">
              <div class="bst-selection-header">
                <span class="bst-selection-number">#${index + 1}</span>
                <span class="bst-selection-preview">区域 ${index + 1}</span>
              </div>
              <div class="bst-tags">
                <div class="bst-tag-list">
                  <button class="bst-tag" data-index="${index}" data-tag="按钮失效">按钮失效</button>
                  <button class="bst-tag" data-index="${index}" data-tag="表单校验">表单校验</button>
                  <button class="bst-tag" data-index="${index}" data-tag="样式错位">样式错位</button>
                  <button class="bst-tag" data-index="${index}" data-tag="接口报错">接口报错</button>
                  <button class="bst-tag" data-index="${index}" data-tag="其他">其他</button>
                </div>
              </div>
              <div class="bst-input">
                <input type="text" class="bst-issue-input" data-index="${index}" 
                       placeholder="请输入问题描述..." ${index === 0 ? 'autofocus' : ''}>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="bst-panel-footer">
          <button class="bst-btn bst-btn-cancel">取消 (Esc)</button>
          <button class="bst-btn bst-btn-primary" id="bst-submit">完成提交 (Alt+Enter)</button>
        </div>
      </div>
    `;
    
    // 添加样式
    this.addPanelStyles();
    
    document.body.appendChild(this.panel);
    
    // 绑定面板事件
    this.bindPanelEvents();
  }

  addPanelStyles() {
    // 检查是否已经添加过样式
    if (document.getElementById('bst-panel-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'bst-panel-styles';
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
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .bst-panel-container {
        width: 600px;
        max-width: 90vw;
        display: flex;
        flex-direction: column;
        height: 100%;
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
        overflow-y: auto;
        flex: 1;
      }
      
      .bst-selection-item {
        margin-bottom: 25px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 6px;
        border: 1px solid #e0e0e0;
      }
      
      .bst-selection-header {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .bst-selection-number {
        background: #ff6b6b;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        margin-right: 10px;
      }
      
      .bst-selection-preview {
        font-size: 14px;
        color: #666;
      }
      
      .bst-tags {
        margin-bottom: 10px;
      }
      
      .bst-tag-list {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      
      .bst-tag {
        padding: 6px 12px;
        border: 1px solid #d0d0d0;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
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
      
      .bst-input input {
        width: 100%;
        padding: 8px 12px;
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
        const index = parseInt(tag.dataset.index);
        const tagValue = tag.dataset.tag;
        
        // 移除同一组的其他选中状态
        this.panel.querySelectorAll(`.bst-tag[data-index="${index}"]`).forEach(t => {
          t.classList.remove('active');
        });
        
        // 设置当前选中
        tag.classList.add('active');
        this.selections[index].tag = tagValue;
        
        this.updateSubmitButton();
      });
    });
    
    // 输入框变化
    const inputs = this.panel.querySelectorAll('.bst-issue-input');
    inputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt(input.dataset.index);
        this.selections[index].issue = e.target.value.trim();
        this.updateSubmitButton();
      });
    });
    
    // 快捷键
    document.addEventListener('keydown', (e) => {
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
  }

  updateSubmitButton() {
    const submitBtn = document.getElementById('bst-submit');
    
    // 检查所有选区是否都填写完整
    const allComplete = this.selections.every(sel => sel.tag && sel.issue);
    
    submitBtn.disabled = !allComplete;
  }

  async submit() {
    // 验证所有选区都填写完整
    const incomplete = this.selections.findIndex(sel => !sel.tag || !sel.issue);
    if (incomplete !== -1) {
      this.showError(`请完成区域 #${incomplete + 1} 的标注`);
      return;
    }
    
    // 收集页面信息
    const pageURL = window.location.href;
    const urlParts = window.location.pathname.split('/').filter(p => p);
    const pathLast1 = urlParts[urlParts.length - 1] || 'index';
    
    // 准备缺陷数据
    const bugData = {
      pageURL: pageURL,
      pathLast1: pathLast1,
      selections: this.selections.map(sel => ({
        rect: sel.rect,
        tag: sel.tag,
        issue: sel.issue
      }))
    };
    
    // 合成截图
    await this.compositeScreenshot(bugData);
    
    // 保存数据
    await this.saveBugData(bugData);
    
    // 写入剪贴板
    await this.copyToClipboard(bugData);
    
    // 显示成功提示
    this.showSuccess('缺陷包已生成，请切换到TAPD页面提交');
    
    // 关闭标注工具
    setTimeout(() => {
      this.deactivate();
    }, 1500);
  }

  async compositeScreenshot(bugData) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      
      // 加载原始截图
      const img = new Image();
      img.onload = () => {
        // 设置canvas尺寸
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 绘制原始截图
        ctx.drawImage(img, 0, 0);
        
        // 添加半透明遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 处理每个选区
        this.selections.forEach((sel, index) => {
          const rect = sel.rect;
          
          // 清除选区遮罩（使选区清晰）
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0, 0, 0, 1)';
          ctx.fillRect(rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr);
          
          // 恢复绘制模式
          ctx.globalCompositeOperation = 'source-over';
          
          // 绘制选区边框
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr);
          
          // 添加编号标签
          const labelY = rect.y * dpr - 10;
          const labelX = rect.x * dpr;
          
          // 绘制编号背景
          ctx.fillStyle = '#ff6b6b';
          const labelText = `#${index + 1}`;
          ctx.font = `bold ${12 * dpr}px Arial`;
          const labelWidth = ctx.measureText(labelText).width;
          
          ctx.fillRect(labelX, labelY - 20 * dpr, labelWidth + 10 * dpr, 22 * dpr);
          
          // 绘制编号文本
          ctx.fillStyle = 'white';
          ctx.fillText(labelText, labelX + 5 * dpr, labelY - 3 * dpr);
          
          // 绘制问题描述标签
          const descText = `[${sel.tag}] ${sel.issue}`;
          ctx.font = `${14 * dpr}px Arial`;
          const descWidth = ctx.measureText(descText).width;
          
          // 标签位置（右侧或底部）
          let descX = rect.x * dpr + rect.width * dpr + 10 * dpr;
          let descY = rect.y * dpr + 20 * dpr;
          
          // 如果右侧空间不够，放在底部
          if (descX + descWidth + 20 * dpr > canvas.width) {
            descX = rect.x * dpr;
            descY = rect.y * dpr + rect.height * dpr + 25 * dpr;
          }
          
          // 绘制描述背景
          ctx.fillStyle = 'rgba(255, 107, 107, 0.95)';
          const padding = 8 * dpr;
          ctx.fillRect(descX - padding/2, descY - 18 * dpr, descWidth + padding, 24 * dpr);
          
          // 绘制描述文本
          ctx.fillStyle = 'white';
          ctx.fillText(descText, descX, descY);
        });
        
        // 保存合成后的图片
        bugData.screenshot = canvas.toDataURL('image/png');
        
        // 生成问题汇总文本
        bugData.issuesSummary = this.selections.map((sel, index) => 
          `${index + 1}. [${sel.tag}] ${sel.issue}`
        ).join('\n');
        
        bugData.firstTag = this.selections[0].tag;
        
        // 修复标题生成逻辑：使用第一个问题描述而不是"X个问题"
        if (this.selections.length > 1) {
          // 多个问题时，显示第一个问题描述 + 问题数量
          bugData.issue = `${this.selections[0].issue}等${this.selections.length}个问题`;
        } else {
          // 单个问题时，直接使用问题描述
          bugData.issue = this.selections[0].issue;
        }
        
        resolve();
      };
      
      img.src = this.screenshot;
    });
  }

  async saveBugData(bugData) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveBugData',
        data: bugData
      });
      
      if (!response.success) {
        console.error('Failed to save bug data:', response.error);
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  }

  async copyToClipboard(bugData) {
    try {
      // 转换dataURL为blob
      const response = await fetch(bugData.screenshot);
      const blob = await response.blob();
      
      // 尝试使用新的Clipboard API
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
      } else {
        // 降级方案
        this.fallbackCopyImage(bugData);
      }
    } catch (error) {
      console.error('Clipboard error:', error);
      this.fallbackCopyImage(bugData);
    }
  }

  fallbackCopyImage(bugData) {
    // 创建临时图片元素用于复制
    const img = document.createElement('img');
    img.src = bugData.screenshot;
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
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    // 清理所有选区元素
    this.selectionElements.forEach(el => el.remove());
    this.selectionElements = [];
    
    // 清理标签元素
    document.querySelectorAll('.bst-selection-label').forEach(el => el.remove());
    
    // 清理提示框
    document.querySelectorAll('.bst-tooltip').forEach(el => el.remove());
    
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    
    // 重置状态
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.screenshot = null;
    this.selections = [];
    this.currentSelection = null;
  }
}

// 初始化标注工具
console.log('BST: Loading Multi-Selection ScreenshotAnnotator...');
const annotator = new ScreenshotAnnotator();
console.log('BST: Multi-Selection ScreenshotAnnotator loaded');

// 将annotator暴露到window对象，供调试和直接调用
window.annotator = annotator;

// 确认扩展已加载
console.log('BST: Multi-Selection Annotator initialized. Use Alt+S to toggle.');