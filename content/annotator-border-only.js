// Bug Shot Turbo - 标注工具（纯边框版）

class ScreenshotAnnotator {
  constructor() {
    this.isActive = false;
    this.overlay = null;
    this.screenshot = null;
    this.selections = [];
    this.currentSelection = null;
    this.currentSelectionRect = null;
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.inputPanel = null;
  }

  async toggle() {
    if (this.isActive) {
      this.cancel();
    } else {
      await this.start();
    }
  }

  async start() {
    console.log('BST: Starting annotation mode');
    this.isActive = true;
    this.selections = [];
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'captureVisibleTab' });
      if (!response.success) {
        throw new Error(response.error);
      }
      
      this.screenshot = response.dataUrl;
      this.createOverlay();
      this.showGuideTip();
      this.setupMouseEvents();
    } catch (error) {
      console.error('BST: Failed to capture screenshot:', error);
      this.showError('截图失败，请重试');
      this.cancel();
    }
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'bst-overlay';
    this.overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(0, 0, 0, 0.3) !important;
      z-index: 999998 !important;
      cursor: crosshair !important;
    `;
    
    document.addEventListener('keydown', this.onKeyDown.bind(this), true);
    document.body.appendChild(this.overlay);
  }

  onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.cancel();
    }
  }

  showGuideTip() {
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 1000000;
      text-align: center;
    `;
    tooltip.innerHTML = `
      <div>🖱️ 拖动鼠标框选第一个问题区域</div>
      <div style="margin-top: 5px; font-size: 12px; opacity: 0.8;">按 Esc 键取消</div>
    `;
    document.body.appendChild(tooltip);
    
    setTimeout(() => tooltip.remove(), 3000);
  }

  setupMouseEvents() {
    this.overlay.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.overlay.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.overlay.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  onMouseDown(e) {
    if (e.button !== 0 || this.inputPanel) return;
    
    this.isDrawing = true;
    this.startPoint = { x: e.clientX, y: e.clientY };
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
    
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    if (width > 10 && height > 10) {
      this.currentSelectionRect = {
        x: Math.min(this.startPoint.x, this.endPoint.x),
        y: Math.min(this.startPoint.y, this.endPoint.y),
        width: width,
        height: height
      };
      
      this.showInputPanel();
    } else {
      if (this.currentSelection) {
        this.removeSelectionBox(this.currentSelection);
        this.currentSelection = null;
      }
    }
  }

  createSelectionBox() {
    // 使用单个div + box-shadow实现纯边框效果
    const box = document.createElement('div');
    box.className = 'bst-selection-box-pure-border';
    box.style.cssText = `
      position: fixed !important;
      border: none !important;
      background: transparent !important;
      box-shadow: 0 0 0 2px #ff6b6b !important;
      pointer-events: none !important;
      z-index: 999999 !important;
    `;
    
    document.body.appendChild(box);
    this.currentSelection = box;
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

  removeSelectionBox(selection) {
    if (selection) {
      selection.remove();
    }
  }

  showInputPanel() {
    this.overlay.style.pointerEvents = 'none';
    
    const index = this.selections.length + 1;
    
    this.inputPanel = document.createElement('div');
    this.inputPanel.className = 'bst-input-panel';
    this.inputPanel.innerHTML = `
      <div class="bst-input-container">
        <div class="bst-input-header">
          <span class="bst-input-title">标注问题 #${index}</span>
          <button class="bst-input-close" title="取消">×</button>
        </div>
        <div class="bst-input-body">
          <div class="bst-tags">
            <label>选择标签：</label>
            <div class="bst-tag-list">
              <button class="bst-tag" data-tag="按钮失效">按钮失效</button>
              <button class="bst-tag" data-tag="表单校验">表单校验</button>
              <button class="bst-tag" data-tag="样式错位">样式错位</button>
              <button class="bst-tag" data-tag="接口报错">接口报错</button>
              <button class="bst-tag" data-tag="其他">其他</button>
            </div>
          </div>
          <div class="bst-input-field">
            <label>问题描述：</label>
            <input type="text" id="bst-issue-input" placeholder="请输入问题描述..." autofocus>
          </div>
          <div class="bst-status-info">
            <span>已标注 ${this.selections.length} 个问题</span>
          </div>
        </div>
        <div class="bst-input-footer">
          <button class="bst-btn bst-btn-secondary" id="bst-continue">继续框选</button>
          <button class="bst-btn bst-btn-primary" id="bst-finish">完成提交</button>
        </div>
      </div>
    `;
    
    this.addInputPanelStyles();
    this.positionInputPanel();
    document.body.appendChild(this.inputPanel);
    this.bindInputPanelEvents();
    
    setTimeout(() => {
      document.getElementById('bst-issue-input').focus();
    }, 100);
  }

  positionInputPanel() {
    if (!this.inputPanel || !this.currentSelectionRect) return;
    
    const rect = this.currentSelectionRect;
    const panelWidth = 400;
    const panelHeight = 280;
    const padding = 20;
    
    let left = rect.x + rect.width + padding;
    let top = rect.y;
    
    if (left + panelWidth > window.innerWidth) {
      left = rect.x - panelWidth - padding;
    }
    
    if (left < 0) {
      left = (window.innerWidth - panelWidth) / 2;
    }
    
    if (top + panelHeight > window.innerHeight) {
      top = window.innerHeight - panelHeight - padding;
    }
    
    this.inputPanel.style.position = 'fixed';
    this.inputPanel.style.left = `${left}px`;
    this.inputPanel.style.top = `${top}px`;
    this.inputPanel.style.zIndex = '1000001';
  }

  addInputPanelStyles() {
    if (document.querySelector('#bst-input-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'bst-input-styles';
    style.textContent = `
      .bst-input-panel {
        width: 400px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
        overflow: hidden;
      }
      
      .bst-input-container {
        display: flex;
        flex-direction: column;
      }
      
      .bst-input-header {
        padding: 12px 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .bst-input-title {
        font-weight: bold;
        font-size: 16px;
      }
      
      .bst-input-close {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .bst-input-close:hover {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      
      .bst-input-body {
        padding: 16px;
      }
      
      .bst-tags {
        margin-bottom: 16px;
      }
      
      .bst-tags label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        color: #666;
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
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .bst-tag:hover {
        border-color: #667eea;
        background: #f5f7ff;
      }
      
      .bst-tag.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-color: transparent;
      }
      
      .bst-input-field {
        margin-bottom: 12px;
      }
      
      .bst-input-field label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        color: #666;
      }
      
      .bst-input-field input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d0d0d0;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
      }
      
      .bst-input-field input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      
      .bst-status-info {
        font-size: 12px;
        color: #999;
        text-align: center;
        margin-bottom: 8px;
      }
      
      .bst-input-footer {
        padding: 12px 16px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }
      
      .bst-btn {
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        flex: 1;
      }
      
      .bst-btn-secondary {
        background: white;
        border: 1px solid #d0d0d0;
        color: #666;
      }
      
      .bst-btn-secondary:hover {
        background: #f5f5f5;
      }
      
      .bst-btn-secondary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .bst-btn-primary {
        background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
        border: none;
        color: white;
      }
      
      .bst-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
      }
      
      .bst-btn-primary:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
    `;
    
    document.head.appendChild(style);
  }

  bindInputPanelEvents() {
    let selectedTag = null;
    let issueText = '';
    
    const tags = this.inputPanel.querySelectorAll('.bst-tag');
    tags.forEach(tag => {
      tag.addEventListener('click', () => {
        tags.forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        selectedTag = tag.dataset.tag;
        this.updateButtons(selectedTag, issueText);
      });
    });
    
    const input = document.getElementById('bst-issue-input');
    input.addEventListener('input', (e) => {
      issueText = e.target.value.trim();
      this.updateButtons(selectedTag, issueText);
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && selectedTag && issueText) {
        e.preventDefault();
        this.saveCurrentSelection(selectedTag, issueText);
      }
    });
    
    this.inputPanel.querySelector('.bst-input-close').addEventListener('click', () => {
      this.cancelCurrentSelection();
    });
    
    document.getElementById('bst-continue').addEventListener('click', () => {
      if (selectedTag && issueText) {
        this.saveCurrentSelection(selectedTag, issueText);
        this.continueSelection();
      }
    });
    
    document.getElementById('bst-finish').addEventListener('click', () => {
      if (selectedTag && issueText) {
        this.saveCurrentSelection(selectedTag, issueText);
      }
      this.finishAnnotation();
    });
  }

  updateButtons(selectedTag, issueText) {
    const continueBtn = document.getElementById('bst-continue');
    const finishBtn = document.getElementById('bst-finish');
    
    const hasValidInput = selectedTag && issueText;
    
    if (continueBtn) {
      continueBtn.disabled = !hasValidInput;
    }
    
    if (finishBtn) {
      finishBtn.disabled = this.selections.length === 0 && !hasValidInput;
    }
  }

  saveCurrentSelection(tag, issue) {
    if (this.currentSelectionRect) {
      this.selections.push({
        rect: this.currentSelectionRect,
        tag: tag,
        issue: issue
      });
      
      const savedBox = document.createElement('div');
      savedBox.className = 'bst-saved-selection';
      savedBox.style.cssText = `
        position: fixed !important;
        left: ${this.currentSelectionRect.x}px !important;
        top: ${this.currentSelectionRect.y}px !important;
        width: ${this.currentSelectionRect.width}px !important;
        height: ${this.currentSelectionRect.height}px !important;
        border: none !important;
        background: transparent !important;
        box-shadow: 0 0 0 2px #52c41a !important;
        pointer-events: none !important;
        z-index: 999997 !important;
      `;
      document.body.appendChild(savedBox);
    }
    
    if (this.currentSelection) {
      this.removeSelectionBox(this.currentSelection);
      this.currentSelection = null;
    }
    
    this.currentSelectionRect = null;
  }

  cancelCurrentSelection() {
    if (this.currentSelection) {
      this.removeSelectionBox(this.currentSelection);
      this.currentSelection = null;
    }
    
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    this.overlay.style.pointerEvents = 'auto';
    this.currentSelectionRect = null;
  }

  continueSelection() {
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    this.overlay.style.pointerEvents = 'auto';
    
    this.showToast('问题已保存，继续框选下一个问题', 'success');
  }

  async finishAnnotation() {
    console.log('BST: Finishing annotation with selections:', this.selections);
    
    if (this.selections.length === 0) {
      this.showError('请至少标注一个问题');
      return;
    }
    
    this.showToast('正在生成带标注的截图...', 'info');
    
    const bugData = {
      pageURL: window.location.href,
      pathLast1: window.location.pathname.split('/').filter(p => p).pop() || 'index',
      timestamp: new Date().toLocaleString('zh-CN'),
      selections: this.selections
    };
    
    await this.createAnnotatedScreenshot(bugData);
    await this.saveBugData(bugData);
    await this.copyToClipboard(bugData);
    
    this.showSuccess('截图已复制到剪贴板，可在TAPD中粘贴');
    this.cleanup();
  }

  async createAnnotatedScreenshot(bugData) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        this.selections.forEach((sel, index) => {
          const rect = sel.rect;
          
          // 绘制边框
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(
            rect.x * dpr, 
            rect.y * dpr, 
            rect.width * dpr, 
            rect.height * dpr
          );
          
          // 绘制序号标签
          const labelX = rect.x * dpr;
          const labelY = rect.y * dpr;
          
          ctx.fillStyle = '#ff6b6b';
          const labelText = `#${index + 1}`;
          ctx.font = `bold ${12 * dpr}px Arial`;
          const labelWidth = ctx.measureText(labelText).width;
          
          ctx.fillRect(labelX, labelY - 20 * dpr, labelWidth + 10 * dpr, 22 * dpr);
          
          ctx.fillStyle = 'white';
          ctx.fillText(labelText, labelX + 5 * dpr, labelY - 3 * dpr);
          
          // 绘制问题描述
          const descText = `[${sel.tag}] ${sel.issue}`;
          ctx.font = `${14 * dpr}px Arial`;
          const descWidth = ctx.measureText(descText).width;
          
          let descX = rect.x * dpr + rect.width * dpr + 10 * dpr;
          let descY = rect.y * dpr + 20 * dpr;
          
          if (descX + descWidth + 20 * dpr > canvas.width) {
            descX = rect.x * dpr;
            descY = rect.y * dpr + rect.height * dpr + 25 * dpr;
          }
          
          ctx.fillStyle = 'rgba(255, 107, 107, 0.95)';
          const padding = 8 * dpr;
          ctx.fillRect(descX - padding/2, descY - 18 * dpr, descWidth + padding, 24 * dpr);
          
          ctx.fillStyle = 'white';
          ctx.fillText(descText, descX, descY);
        });
        
        bugData.screenshot = canvas.toDataURL('image/png');
        
        // 生成问题摘要
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
      console.log('BST: Saving bug data to background:', bugData);
      const response = await chrome.runtime.sendMessage({
        action: 'saveBugData',
        data: bugData
      });
      
      console.log('BST: Save response:', response);
      if (!response.success) {
        console.error('BST: Failed to save bug data:', response.error);
      } else {
        console.log('BST: Bug data saved successfully with ID:', response.data?.id);
      }
    } catch (error) {
      console.error('BST: Save error:', error);
    }
  }

  async copyToClipboard(bugData) {
    try {
      const response = await fetch(bugData.screenshot);
      const blob = await response.blob();
      
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
      } else {
        this.fallbackCopyImage(bugData);
      }
    } catch (error) {
      console.error('Clipboard error:', error);
      this.fallbackCopyImage(bugData);
    }
  }

  fallbackCopyImage(bugData) {
    const img = document.createElement('img');
    img.src = bugData.screenshot;
    img.style.position = 'fixed';
    img.style.left = '-9999px';
    img.style.top = '0';
    document.body.appendChild(img);
    
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
      z-index: 1000002;
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
    this.cleanup();
  }

  cleanup() {
    this.isActive = false;
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    // Remove all selection boxes
    document.querySelectorAll('.bst-selection-box-pure-border, .bst-saved-selection').forEach(el => el.remove());
    
    document.removeEventListener('keydown', this.onKeyDown.bind(this), true);
    
    this.selections = [];
    this.currentSelection = null;
    this.currentSelectionRect = null;
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('BST Content: Received message:', request);
  
  if (request.action === 'toggleAnnotation') {
    if (!window.annotator) {
      window.annotator = new ScreenshotAnnotator();
    }
    window.annotator.toggle();
    sendResponse({ success: true });
  }
  
  return true;
});

// 初始化
console.log('BST: Screenshot annotator (border-only version) loaded');
if (!window.annotator) {
  window.annotator = new ScreenshotAnnotator();
}