// Bug Shot Turbo - 微信风格截图标注
// 模仿微信截图的优雅UI设计

class WeChatStyleAnnotator {
  constructor() {
    this.isActive = false;
    this.isDrawing = false;
    this.isDragging = false;
    this.dragHandle = null; // 拖拽的控制点
    this.startPoint = null;
    this.endPoint = null;
    this.overlay = null;
    this.selectionBox = null;
    this.toolbar = null;
    this.sizeIndicator = null;
    this.screenshot = null;
    this.frozenBackground = null;

    // 当前标注数据
    this.currentBug = {
      selections: [],
      issue: '',
      tag: '',
      bugNumber: 1
    };

    this.init();
  }

  init() {
    this.setupListeners();
    console.log('BST: WeChat-style Annotator initialized');
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleAnnotation') {
        this.toggle();
        sendResponse({ success: true });
      }
      return true;
    });

    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
        return false;
      }

      if (this.isActive && e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
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

    // 截图并冻结背景
    await this.captureAndFreezeScreen();
    this.createOverlay();
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

      if (response?.success) {
        this.screenshot = response.dataUrl;
        this.createFrozenBackground();
      } else {
        console.error('截图失败:', response?.error);
        this.showToast('截图失败，请重试', 'error');
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      this.showToast('截图失败: ' + error.message, 'error');
    }
  }

  createFrozenBackground() {
    if (!this.screenshot) return;

    this.frozenBackground = document.createElement('div');
    this.frozenBackground.className = 'bst-wechat-frozen-bg';
    this.frozenBackground.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-image: url(${this.screenshot});
      background-size: 100% 100%;
      background-repeat: no-repeat;
      z-index: 2147483640;
      pointer-events: none;
    `;

    document.body.appendChild(this.frozenBackground);
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'bst-wechat-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      z-index: 2147483641;
      cursor: crosshair;
      transition: background 0.2s;
    `;
    document.body.appendChild(this.overlay);
  }

  setupMouseEvents() {
    this.overlay.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.overlay.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.overlay.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  onMouseDown(e) {
    if (e.button !== 0) return;

    this.isDrawing = true;
    this.startPoint = { x: e.clientX, y: e.clientY };

    // 移除旧的选择框
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }

    this.createSelectionBox();
  }

  onMouseMove(e) {
    if (!this.isDrawing) return;

    this.endPoint = { x: e.clientX, y: e.clientY };
    this.updateSelectionBox();
    this.updateSizeIndicator();
  }

  onMouseUp(e) {
    if (!this.isDrawing) return;

    this.isDrawing = false;
    this.endPoint = { x: e.clientX, y: e.clientY };

    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);

    if (width > 20 && height > 20) {
      // 显示工具栏和操作按钮
      this.showToolbar();
      this.showActionButtons();
      this.addResizeHandles();
    } else {
      this.resetSelection();
    }
  }

  createSelectionBox() {
    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'bst-wechat-selection';
    this.selectionBox.style.cssText = `
      position: fixed;
      border: 1px solid #1aad19;
      background: transparent;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
      z-index: 2147483642;
      pointer-events: none;
    `;
    document.body.appendChild(this.selectionBox);

    // 创建尺寸指示器
    this.sizeIndicator = document.createElement('div');
    this.sizeIndicator.className = 'bst-wechat-size';
    this.sizeIndicator.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-family: Arial, sans-serif;
      z-index: 2147483643;
      pointer-events: none;
    `;
    document.body.appendChild(this.sizeIndicator);
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

  updateSizeIndicator() {
    if (!this.sizeIndicator || !this.startPoint || !this.endPoint) return;

    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);

    this.sizeIndicator.textContent = `${Math.round(width)} × ${Math.round(height)}`;

    // 位置在鼠标右上方
    this.sizeIndicator.style.left = `${this.endPoint.x + 10}px`;
    this.sizeIndicator.style.top = `${this.endPoint.y - 25}px`;
  }

  addResizeHandles() {
    // 移除旧的控制点
    document.querySelectorAll('.bst-wechat-handle').forEach(el => el.remove());

    const rect = this.selectionBox.getBoundingClientRect();
    const positions = [
      { name: 'nw', x: rect.left, y: rect.top, cursor: 'nwse-resize' },
      { name: 'n', x: rect.left + rect.width / 2, y: rect.top, cursor: 'ns-resize' },
      { name: 'ne', x: rect.right, y: rect.top, cursor: 'nesw-resize' },
      { name: 'e', x: rect.right, y: rect.top + rect.height / 2, cursor: 'ew-resize' },
      { name: 'se', x: rect.right, y: rect.bottom, cursor: 'nwse-resize' },
      { name: 's', x: rect.left + rect.width / 2, y: rect.bottom, cursor: 'ns-resize' },
      { name: 'sw', x: rect.left, y: rect.bottom, cursor: 'nesw-resize' },
      { name: 'w', x: rect.left, y: rect.top + rect.height / 2, cursor: 'ew-resize' }
    ];

    positions.forEach(pos => {
      const handle = document.createElement('div');
      handle.className = 'bst-wechat-handle';
      handle.dataset.position = pos.name;
      handle.style.cssText = `
        position: fixed;
        width: 6px;
        height: 6px;
        background: #1aad19;
        border: 1px solid white;
        border-radius: 1px;
        left: ${pos.x - 3}px;
        top: ${pos.y - 3}px;
        cursor: ${pos.cursor};
        z-index: 2147483644;
        pointer-events: auto;
      `;
      document.body.appendChild(handle);
    });
  }

  showToolbar() {
    // 移除旧工具栏
    if (this.toolbar) {
      this.toolbar.remove();
    }

    const rect = this.selectionBox.getBoundingClientRect();

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'bst-wechat-toolbar';
    this.toolbar.innerHTML = `
      <div class="bst-wechat-tool-btn" data-tool="rect" title="矩形">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="bst-wechat-tool-btn" data-tool="arrow" title="箭头">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <path d="M4 16 L16 4 M16 4 L10 4 M16 4 L16 10" fill="none" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="bst-wechat-tool-btn" data-tool="text" title="文字">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <path d="M5 5 L15 5 M10 5 L10 15 M7 15 L13 15" fill="none" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </div>
      <div class="bst-wechat-tool-divider"></div>
      <div class="bst-wechat-tool-btn" data-tool="tag" title="标签">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <path d="M4 4 L10 4 L16 10 L10 16 L4 10 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
        </svg>
      </div>
    `;

    // 计算工具栏位置（选择框上方或下方）
    let top = rect.top - 45;
    if (top < 10) {
      top = rect.bottom + 10;
    }

    this.toolbar.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${top}px;
      display: flex;
      align-items: center;
      gap: 2px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(10px);
      padding: 6px 8px;
      border-radius: 4px;
      z-index: 2147483645;
    `;

    document.body.appendChild(this.toolbar);

    // 绑定工具按钮事件
    this.toolbar.querySelectorAll('.bst-wechat-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool === 'tag') {
          this.showInputPanel();
        }
      });
    });
  }

  showActionButtons() {
    // 移除旧按钮
    document.querySelectorAll('.bst-wechat-actions').forEach(el => el.remove());

    const rect = this.selectionBox.getBoundingClientRect();

    const actions = document.createElement('div');
    actions.className = 'bst-wechat-actions';
    actions.innerHTML = `
      <button class="bst-wechat-btn bst-wechat-btn-cancel">取消</button>
      <button class="bst-wechat-btn bst-wechat-btn-finish">完成</button>
    `;

    actions.style.cssText = `
      position: fixed;
      right: ${window.innerWidth - rect.right}px;
      top: ${rect.bottom + 10}px;
      display: flex;
      gap: 8px;
      z-index: 2147483645;
    `;

    document.body.appendChild(actions);

    // 绑定按钮事件
    actions.querySelector('.bst-wechat-btn-cancel').addEventListener('click', () => {
      this.cancel();
    });

    actions.querySelector('.bst-wechat-btn-finish').addEventListener('click', () => {
      this.showInputPanel();
    });
  }

  showInputPanel() {
    const rect = this.selectionBox.getBoundingClientRect();

    const panel = document.createElement('div');
    panel.className = 'bst-wechat-input-panel';
    panel.innerHTML = `
      <div class="bst-wechat-panel-header">
        <span>标注问题</span>
        <button class="bst-wechat-close">×</button>
      </div>
      <div class="bst-wechat-panel-body">
        <div class="bst-wechat-tags" id="bst-wechat-tags-container">
          <button class="bst-wechat-tag" data-tag="按钮失效">按钮失效</button>
          <button class="bst-wechat-tag" data-tag="表单校验">表单校验</button>
          <button class="bst-wechat-tag" data-tag="样式错位">样式错位</button>
          <button class="bst-wechat-tag" data-tag="接口报错">接口报错</button>
          <button class="bst-wechat-tag" data-tag="其他">其他</button>
        </div>
        <input type="text"
               class="bst-wechat-input"
               id="bst-wechat-issue-input"
               placeholder="请描述问题..."
               autofocus>
      </div>
      <div class="bst-wechat-panel-footer">
        <button class="bst-wechat-btn bst-wechat-btn-cancel">取消</button>
        <button class="bst-wechat-btn bst-wechat-btn-primary" id="bst-wechat-submit">提交</button>
      </div>
    `;

    this.addWeChatStyles();

    // 居中显示
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483646;
    `;

    document.body.appendChild(panel);

    // 绑定事件
    panel.querySelector('.bst-wechat-close').addEventListener('click', () => {
      panel.remove();
    });

    panel.querySelectorAll('.bst-wechat-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        panel.querySelectorAll('.bst-wechat-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        this.currentBug.tag = tag.dataset.tag;
      });
    });

    panel.querySelector('.bst-wechat-btn-cancel').addEventListener('click', () => {
      panel.remove();
    });

    panel.querySelector('#bst-wechat-submit').addEventListener('click', () => {
      this.submitAnnotation(panel);
    });

    panel.querySelector('#bst-wechat-issue-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.submitAnnotation(panel);
      }
    });

    // 聚焦输入框
    setTimeout(() => {
      panel.querySelector('#bst-wechat-issue-input').focus();
    }, 100);
  }

  async submitAnnotation(panel) {
    const input = panel.querySelector('#bst-wechat-issue-input');
    const issue = input.value.trim();

    if (!issue) {
      this.showToast('请输入问题描述', 'warning');
      return;
    }

    if (!this.currentBug.tag) {
      this.showToast('请选择问题标签', 'warning');
      return;
    }

    // 保存选择区域
    const rect = this.selectionBox.getBoundingClientRect();
    this.currentBug.selections.push({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      order: 1
    });

    this.currentBug.issue = issue;

    // 生成截图
    await this.compositeScreenshot();

    // 保存数据
    await this.saveBugData();

    // 复制到剪贴板
    await this.copyToClipboard();

    panel.remove();
    this.showToast('截图已生成，可前往 TAPD 提交', 'success');

    setTimeout(() => {
      this.deactivate();
    }, 1500);
  }

  async compositeScreenshot() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        // 绘制原始截图
        ctx.drawImage(img, 0, 0);

        // 绘制遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 清除选区遮罩
        this.currentBug.selections.forEach(sel => {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillRect(sel.x * dpr, sel.y * dpr, sel.width * dpr, sel.height * dpr);
          ctx.globalCompositeOperation = 'source-over';

          // 绘制绿色边框
          ctx.strokeStyle = '#1aad19';
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(sel.x * dpr, sel.y * dpr, sel.width * dpr, sel.height * dpr);

          // 绘制标注文字
          const text = `[${this.currentBug.tag}] ${this.currentBug.issue}`;
          ctx.font = `${14 * dpr}px Arial`;
          const textWidth = ctx.measureText(text).width;

          const labelX = sel.x * dpr;
          const labelY = sel.y * dpr - 10;

          // 文字背景
          ctx.fillStyle = 'rgba(26, 173, 25, 0.9)';
          ctx.fillRect(labelX, labelY - 22 * dpr, textWidth + 16 * dpr, 28 * dpr);

          // 文字
          ctx.fillStyle = 'white';
          ctx.fillText(text, labelX + 8 * dpr, labelY - 5 * dpr);
        });

        this.currentBug.screenshot = canvas.toDataURL('image/png');
        resolve();
      };

      img.src = this.screenshot;
    });
  }

  async saveBugData() {
    try {
      const bugData = {
        pageURL: window.location.href,
        pathLast1: window.location.pathname.split('/').pop() || 'page',
        selections: this.currentBug.selections,
        issue: this.currentBug.issue,
        firstTag: this.currentBug.tag,
        screenshot: this.currentBug.screenshot,
        timestamp: new Date().toLocaleString('zh-CN')
      };

      const response = await chrome.runtime.sendMessage({
        action: 'saveBugData',
        data: bugData
      });

      if (!response?.success) {
        console.error('保存失败:', response?.error);
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  }

  async copyToClipboard() {
    try {
      const response = await fetch(this.currentBug.screenshot);
      const blob = await response.blob();

      if (navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
      }
    } catch (error) {
      console.error('Clipboard error:', error);
    }
  }

  addWeChatStyles() {
    if (document.getElementById('bst-wechat-styles')) return;

    const style = document.createElement('style');
    style.id = 'bst-wechat-styles';
    style.textContent = `
      .bst-wechat-tool-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border-radius: 3px;
        color: white;
        transition: background 0.2s;
      }

      .bst-wechat-tool-btn:hover {
        background: rgba(255, 255, 255, 0.15);
      }

      .bst-wechat-tool-btn.active {
        background: rgba(255, 255, 255, 0.25);
      }

      .bst-wechat-tool-divider {
        width: 1px;
        height: 20px;
        background: rgba(255, 255, 255, 0.2);
        margin: 0 4px;
      }

      .bst-wechat-btn {
        padding: 6px 16px;
        border-radius: 3px;
        font-size: 13px;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      }

      .bst-wechat-btn-cancel {
        background: rgba(0, 0, 0, 0.5);
        color: white;
      }

      .bst-wechat-btn-cancel:hover {
        background: rgba(0, 0, 0, 0.65);
      }

      .bst-wechat-btn-finish {
        background: #1aad19;
        color: white;
      }

      .bst-wechat-btn-finish:hover {
        background: #179b16;
      }

      .bst-wechat-btn-primary {
        background: #1aad19;
        color: white;
      }

      .bst-wechat-btn-primary:hover {
        background: #179b16;
      }

      .bst-wechat-input-panel {
        width: 400px;
        background: white;
        border-radius: 6px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        pointer-events: auto !important;
      }

      .bst-wechat-panel-header {
        padding: 14px 16px;
        background: #f7f7f7;
        border-bottom: 1px solid #e5e5e5;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
        color: #333;
        font-weight: 500;
      }

      .bst-wechat-close {
        background: none;
        border: none;
        font-size: 20px;
        color: #999;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
      }

      .bst-wechat-close:hover {
        background: #e5e5e5;
        color: #333;
      }

      .bst-wechat-panel-body {
        padding: 16px;
      }

      .bst-wechat-tags {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 12px;
      }

      .bst-wechat-tag {
        padding: 6px 12px;
        border: 1px solid #d9d9d9;
        background: white;
        border-radius: 3px;
        cursor: pointer;
        font-size: 13px;
        color: #333;
        transition: all 0.2s;
      }

      .bst-wechat-tag:hover {
        border-color: #1aad19;
        color: #1aad19;
      }

      .bst-wechat-tag.active {
        background: #1aad19;
        border-color: #1aad19;
        color: white;
      }

      .bst-wechat-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d9d9d9;
        border-radius: 3px;
        font-size: 14px;
        box-sizing: border-box;
        transition: border-color 0.2s;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        pointer-events: auto !important;
        user-select: text !important;
      }

      .bst-wechat-input:focus {
        outline: none;
        border-color: #1aad19;
      }

      .bst-wechat-panel-footer {
        padding: 12px 16px;
        background: #f7f7f7;
        border-top: 1px solid #e5e5e5;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `;

    document.head.appendChild(style);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    if (type === 'success') {
      toast.style.background = '#1aad19';
    } else if (type === 'error') {
      toast.style.background = '#fa5151';
    } else if (type === 'warning') {
      toast.style.background = '#ff976a';
    } else {
      toast.style.background = '#10aeff';
    }

    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  resetSelection() {
    if (this.selectionBox) {
      this.selectionBox.remove();
      this.selectionBox = null;
    }
    if (this.sizeIndicator) {
      this.sizeIndicator.remove();
      this.sizeIndicator = null;
    }
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
    document.querySelectorAll('.bst-wechat-handle').forEach(el => el.remove());
    document.querySelectorAll('.bst-wechat-actions').forEach(el => el.remove());
  }

  cancel() {
    this.deactivate();
  }

  cleanup() {
    console.log('BST: Cleaning up WeChat-style annotator...');

    if (this.frozenBackground) {
      this.frozenBackground.remove();
      this.frozenBackground = null;
    }

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    this.resetSelection();

    document.querySelectorAll('.bst-wechat-input-panel').forEach(el => el.remove());
    document.querySelectorAll('.bst-wechat-handle').forEach(el => el.remove());
    document.querySelectorAll('.bst-wechat-actions').forEach(el => el.remove());

    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.screenshot = null;
    this.currentBug = {
      selections: [],
      issue: '',
      tag: '',
      bugNumber: 1
    };
  }
}

// 初始化
console.log('BST: Loading WeChat-style Annotator...');
const wechatAnnotator = new WeChatStyleAnnotator();
window.annotator = wechatAnnotator;
console.log('BST: WeChat-style Annotator loaded. Use Alt+S to toggle.');
