// Bug Shot Turbo - 交互式多区域标注（每次框选后立即输入）

class ScreenshotAnnotator {
  constructor() {
    this.isActive = false;
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.overlay = null;
    this.inputPanel = null;
    this.screenshot = null;
    
    // 多区域支持
    this.selections = [];  // 存储所有选区
    this.currentSelection = null;
    this.currentSelectionRect = null;  // 临时存储当前选区信息
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
      if (this.isActive && !this.inputPanel) {
        // Esc 退出
        if (e.key === 'Escape') {
          this.cancel();
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
    this.showInitialTooltip();
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

  showInitialTooltip() {
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
        text-align: center;
      ">
        <div>🖱️ 拖动鼠标框选第一个问题区域</div>
        <div style="margin-top: 5px; font-size: 12px; opacity: 0.8;">按 Esc 键取消</div>
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
    if (this.inputPanel) return; // 如果有输入面板，不响应
    
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
      // 保存当前选区信息
      this.currentSelectionRect = {
        x: Math.min(this.startPoint.x, this.endPoint.x),
        y: Math.min(this.startPoint.y, this.endPoint.y),
        width: width,
        height: height
      };
      
      // 立即显示输入面板
      this.showInputPanel();
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
    // 使用outline而不是border，确保内部完全透明
    this.currentSelection.style.cssText = `
      position: fixed;
      border: none !important;
      outline: 2px solid #ff6b6b !important;
      outline-offset: -2px;
      background: none !important;
      background-color: transparent !important;
      z-index: 999999;
      pointer-events: none;
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

  showInputPanel() {
    // 禁用遮罩层的鼠标事件
    this.overlay.style.pointerEvents = 'none';
    
    const index = this.selections.length + 1;
    
    // 创建输入面板
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
    
    // 添加样式
    this.addInputPanelStyles();
    
    // 设置面板位置（靠近选区）
    this.positionInputPanel();
    
    document.body.appendChild(this.inputPanel);
    
    // 绑定事件
    this.bindInputPanelEvents();
    
    // 聚焦输入框
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
    
    // 计算最佳位置（优先右侧，其次下方）
    let left = rect.x + rect.width + padding;
    let top = rect.y;
    
    // 如果右侧空间不够，放在左侧
    if (left + panelWidth > window.innerWidth) {
      left = rect.x - panelWidth - padding;
    }
    
    // 如果左侧也不够，放在下方
    if (left < 0) {
      left = Math.max(padding, Math.min(rect.x, window.innerWidth - panelWidth - padding));
      top = rect.y + rect.height + padding;
    }
    
    // 确保不超出视口
    top = Math.max(padding, Math.min(top, window.innerHeight - panelHeight - padding));
    
    this.inputPanel.style.cssText += `
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      z-index: 1000001;
    `;
  }

  addInputPanelStyles() {
    // 检查是否已经添加过样式
    if (document.getElementById('bst-input-panel-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'bst-input-panel-styles';
    style.textContent = `
      .bst-input-panel {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .bst-input-container {
        width: 400px;
      }
      
      .bst-input-header {
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px 8px 0 0;
      }
      
      .bst-input-title {
        font-size: 16px;
        font-weight: 500;
        color: white;
      }
      
      .bst-input-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s;
      }
      
      .bst-input-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .bst-input-body {
        padding: 16px;
      }
      
      .bst-tags {
        margin-bottom: 16px;
      }
      
      .bst-tags label {
        display: block;
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
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
      
      .bst-input-field {
        margin-bottom: 16px;
      }
      
      .bst-input-field label {
        display: block;
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
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
      
      .bst-selection-label {
        position: fixed;
        background: #ff6b6b;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000000;
        font-weight: bold;
      }
    `;
    
    document.head.appendChild(style);
  }

  bindInputPanelEvents() {
    let selectedTag = null;
    let issueText = '';
    
    // 标签选择
    const tags = this.inputPanel.querySelectorAll('.bst-tag');
    tags.forEach(tag => {
      tag.addEventListener('click', () => {
        tags.forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        selectedTag = tag.dataset.tag;
        this.updateButtons(selectedTag, issueText);
      });
    });
    
    // 输入框
    const input = document.getElementById('bst-issue-input');
    input.addEventListener('input', (e) => {
      issueText = e.target.value.trim();
      this.updateButtons(selectedTag, issueText);
    });
    
    // Enter键提交
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && selectedTag && issueText) {
        e.preventDefault();
        this.saveCurrentSelection(selectedTag, issueText);
      }
    });
    
    // 关闭按钮
    this.inputPanel.querySelector('.bst-input-close').addEventListener('click', () => {
      this.cancelCurrentSelection();
    });
    
    // 继续框选按钮
    document.getElementById('bst-continue').addEventListener('click', () => {
      if (selectedTag && issueText) {
        this.saveCurrentSelection(selectedTag, issueText);
        this.continueSelection();
      }
    });
    
    // 完成提交按钮
    document.getElementById('bst-finish').addEventListener('click', () => {
      if (selectedTag && issueText) {
        this.saveCurrentSelection(selectedTag, issueText);
      }
      this.finishAndSubmit();
    });
  }

  updateButtons(tag, issue) {
    const continueBtn = document.getElementById('bst-continue');
    const finishBtn = document.getElementById('bst-finish');
    
    const hasValidInput = tag && issue;
    
    // 继续框选按钮：只有填写完整才能点击
    continueBtn.disabled = !hasValidInput;
    
    // 完成提交按钮：至少有一个选区或当前填写完整
    finishBtn.disabled = this.selections.length === 0 && !hasValidInput;
  }

  saveCurrentSelection(tag, issue) {
    if (!this.currentSelectionRect || !this.currentSelection) return;
    
    // 保存选区信息
    const selection = {
      rect: this.currentSelectionRect,
      element: this.currentSelection,
      tag: tag,
      issue: issue
    };
    
    this.selections.push(selection);
    this.selectionElements.push(this.currentSelection);
    
    // 添加标签显示
    this.addSelectionLabel(selection, this.selections.length);
    
    // 清空当前选区引用
    this.currentSelection = null;
    this.currentSelectionRect = null;
  }

  addSelectionLabel(selection, index) {
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
    
    // 添加悬浮提示
    label.title = `[${selection.tag}] ${selection.issue}`;
  }

  cancelCurrentSelection() {
    // 移除当前选区
    if (this.currentSelection) {
      this.currentSelection.remove();
      this.currentSelection = null;
    }
    
    // 关闭输入面板
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    // 恢复遮罩层鼠标事件
    if (this.overlay) {
      this.overlay.style.pointerEvents = 'auto';
    }
    
    this.currentSelectionRect = null;
  }

  continueSelection() {
    // 关闭输入面板
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    // 恢复遮罩层鼠标事件，可以继续框选
    if (this.overlay) {
      this.overlay.style.pointerEvents = 'auto';
    }
    
    // 显示继续框选提示
    this.showToast(`已保存问题 #${this.selections.length}，请继续框选下一个问题`, 'success');
  }

  async finishAndSubmit() {
    if (this.selections.length === 0) {
      this.showError('请至少标注一个问题');
      return;
    }
    
    // 关闭输入面板
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
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
      })),
      timestamp: new Date().toLocaleString('zh-CN')
    };
    
    // 合成截图
    await this.compositeScreenshot(bugData);
    
    // 保存数据
    await this.saveBugData(bugData);
    
    // 写入剪贴板
    await this.copyToClipboard(bugData);
    
    // 显示成功提示
    this.showSuccess(`已生成包含 ${this.selections.length} 个问题的缺陷包，请切换到TAPD页面提交`);
    
    // 关闭标注工具
    setTimeout(() => {
      this.deactivate();
    }, 2000);
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
    this.deactivate();
  }

  cleanup() {
    // 清理所有创建的元素
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    // 清理所有选区元素
    this.selectionElements.forEach(el => {
      if (el && el.parentNode) {
        el.remove();
      }
    });
    this.selectionElements = [];
    
    // 清理标签元素
    document.querySelectorAll('.bst-selection-label').forEach(el => el.remove());
    
    // 清理提示框
    document.querySelectorAll('.bst-tooltip').forEach(el => el.remove());
    
    // 清理输入面板
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    // 清理当前选区
    if (this.currentSelection) {
      this.currentSelection.remove();
      this.currentSelection = null;
    }
    
    // 重置状态
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.screenshot = null;
    this.selections = [];
    this.currentSelectionRect = null;
  }
}

// 初始化标注工具
console.log('BST: Loading Interactive ScreenshotAnnotator...');
const annotator = new ScreenshotAnnotator();
console.log('BST: Interactive ScreenshotAnnotator loaded');

// 将annotator暴露到window对象，供调试和直接调用
window.annotator = annotator;

// 确认扩展已加载
console.log('BST: Interactive Annotator initialized. Use Alt+S to toggle.');