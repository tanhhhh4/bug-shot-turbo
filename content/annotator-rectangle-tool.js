// Bug Shot Turbo - 矩形标注工具版（微信风格）
// 功能：主截图 + 多个矩形标注 + 每个矩形独立文字

class RectangleAnnotator {
  constructor() {
    this.isActive = false;
    this.currentTool = 'select'; // select, rectangle
    this.currentPhase = 'main-selection'; // main-selection, annotation, completed

    // 主截图区域
    this.mainSelection = null;
    this.isDrawingMain = false;
    this.mainStartPoint = null;
    this.mainEndPoint = null;

    // 矩形标注
    this.rectangles = [];
    this.isDrawingRect = false;
    this.rectStartPoint = null;
    this.rectEndPoint = null;
    this.currentRect = null;

    // UI 元素
    this.overlay = null;
    this.frozenBackground = null;
    this.screenshot = null;
    this.toolbar = null;
    this.sizeIndicator = null;

    // Bug 数据
    this.bugData = {
      tag: '',
      issue: '',
      rectangles: [],
      pageURL: '',
      timestamp: ''
    };

    this.init();
  }

  init() {
    this.setupListeners();
    console.log('BST: Rectangle Annotator initialized');
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
    this.currentPhase = 'main-selection';

    // 截图并冻结背景
    await this.captureAndFreezeScreen();
    this.createOverlay();
    this.setupMainSelectionEvents();

    this.showToast('请框选主截图区域', 'info');
  }

  deactivate() {
    this.isActive = false;
    this.cleanup();
  }

  async captureAndFreezeScreen() {
    try {
      // 检查 chrome.runtime 是否可用
      if (!chrome?.runtime?.id) {
        throw new Error('扩展已重新加载，请刷新页面（按 F5）');
      }

      const response = await chrome.runtime.sendMessage({
        action: 'captureVisibleTab'
      });

      if (response?.success) {
        this.screenshot = response.dataUrl;
        this.createFrozenBackground();
      } else {
        this.showToast('截图失败，请重试', 'error');
      }
    } catch (error) {
      console.error('Screenshot error:', error);

      // 特殊处理扩展上下文失效错误
      if (error.message?.includes('Extension context invalidated') ||
          error.message?.includes('扩展已重新加载')) {
        this.showToast('⚠️ 扩展已更新，请刷新页面（按 F5）后重试', 'warning');
      } else {
        this.showToast('截图失败: ' + error.message, 'error');
      }

      // 自动清理
      this.deactivate();
    }
  }

  createFrozenBackground() {
    if (!this.screenshot) return;

    this.frozenBackground = document.createElement('div');
    this.frozenBackground.className = 'bst-frozen-bg';
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
    this.overlay.className = 'bst-overlay';
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

  // ========== 主截图区域选择 ==========

  setupMainSelectionEvents() {
    this.overlay.addEventListener('mousedown', this.onMainMouseDown.bind(this));
    this.overlay.addEventListener('mousemove', this.onMainMouseMove.bind(this));
    this.overlay.addEventListener('mouseup', this.onMainMouseUp.bind(this));
  }

  onMainMouseDown(e) {
    if (e.button !== 0 || this.currentPhase !== 'main-selection') return;

    this.isDrawingMain = true;
    this.mainStartPoint = { x: e.clientX, y: e.clientY };

    this.createMainSelectionBox();
  }

  onMainMouseMove(e) {
    if (!this.isDrawingMain || this.currentPhase !== 'main-selection') return;

    this.mainEndPoint = { x: e.clientX, y: e.clientY };
    this.updateMainSelectionBox();
  }

  onMainMouseUp(e) {
    if (!this.isDrawingMain || this.currentPhase !== 'main-selection') return;

    this.isDrawingMain = false;
    this.mainEndPoint = { x: e.clientX, y: e.clientY };

    const width = Math.abs(this.mainEndPoint.x - this.mainStartPoint.x);
    const height = Math.abs(this.mainEndPoint.y - this.mainStartPoint.y);

    if (width > 20 && height > 20) {
      // 确定主截图区域
      this.confirmMainSelection();
    } else {
      this.resetMainSelection();
    }
  }

  createMainSelectionBox() {
    this.mainSelection = document.createElement('div');
    this.mainSelection.className = 'bst-main-selection';
    this.mainSelection.style.cssText = `
      position: fixed;
      border: 2px solid #1aad19;
      background: transparent;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.4);
      z-index: 2147483642;
      pointer-events: none;
    `;

    document.body.appendChild(this.mainSelection);

    // 创建尺寸指示器
    this.createSizeIndicator();
  }

  createSizeIndicator() {
    if (this.sizeIndicator) {
      this.sizeIndicator.remove();
    }

    this.sizeIndicator = document.createElement('div');
    this.sizeIndicator.className = 'bst-size-indicator';
    this.sizeIndicator.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      z-index: 2147483643;
      pointer-events: none;
      display: none;
    `;

    document.body.appendChild(this.sizeIndicator);
  }

  updateMainSelectionBox() {
    if (!this.mainSelection || !this.mainStartPoint || !this.mainEndPoint) return;

    const left = Math.min(this.mainStartPoint.x, this.mainEndPoint.x);
    const top = Math.min(this.mainStartPoint.y, this.mainEndPoint.y);
    const width = Math.abs(this.mainEndPoint.x - this.mainStartPoint.x);
    const height = Math.abs(this.mainEndPoint.y - this.mainStartPoint.y);

    this.mainSelection.style.left = `${left}px`;
    this.mainSelection.style.top = `${top}px`;
    this.mainSelection.style.width = `${width}px`;
    this.mainSelection.style.height = `${height}px`;

    // 更新尺寸指示器
    if (this.sizeIndicator) {
      this.sizeIndicator.textContent = `${Math.round(width)} × ${Math.round(height)}`;
      this.sizeIndicator.style.display = 'block';
      this.sizeIndicator.style.left = `${this.mainEndPoint.x + 10}px`;
      this.sizeIndicator.style.top = `${this.mainEndPoint.y - 25}px`;
    }
  }

  confirmMainSelection() {
    // 进入标注阶段
    this.currentPhase = 'annotation';

    // 隐藏尺寸指示器
    if (this.sizeIndicator) {
      this.sizeIndicator.style.display = 'none';
    }

    // 移除主选择的事件监听
    this.overlay.removeEventListener('mousedown', this.onMainMouseDown);
    this.overlay.removeEventListener('mousemove', this.onMainMouseMove);
    this.overlay.removeEventListener('mouseup', this.onMainMouseUp);

    // 显示工具栏
    this.showToolbar();

    // 提示用户
    this.showToast('点击"矩形"工具开始标注问题位置', 'info');
  }

  resetMainSelection() {
    if (this.mainSelection) {
      this.mainSelection.remove();
      this.mainSelection = null;
    }
    if (this.sizeIndicator) {
      this.sizeIndicator.remove();
      this.sizeIndicator = null;
    }
  }

  // ========== 工具栏 ==========

  showToolbar() {
    if (!this.mainSelection) return;

    const rect = this.mainSelection.getBoundingClientRect();

    // 添加工具栏样式
    this.addToolbarStyles();

    this.toolbar = document.createElement('div');
    this.toolbar.className = 'bst-toolbar';
    this.toolbar.innerHTML = `
      <button class="bst-tool-btn bst-tool-icon" data-tool="rectangle" title="矩形标注">
        <svg width="18" height="18" viewBox="0 0 20 20">
          <rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
      <div class="bst-tool-divider"></div>
      <button class="bst-tool-btn bst-tool-text" data-tool="cancel" title="取消">取消</button>
      <button class="bst-tool-btn bst-tool-primary" data-tool="finish" title="完成">完成</button>
    `;

    // 智能定位工具栏（确保始终可见）
    const position = this.calculateToolbarPosition(rect);

    this.toolbar.style.cssText = `
      position: fixed;
      left: ${position.left}px;
      top: ${position.top}px;
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      padding: 6px 10px;
      border-radius: 6px;
      z-index: 2147483644;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(this.toolbar);

    // 绑定工具栏事件
    this.bindToolbarEvents();
  }

  calculateToolbarPosition(selectionRect) {
    const toolbarWidth = 200; // 预估工具栏宽度
    const toolbarHeight = 40; // 预估工具栏高度
    const padding = 12;

    let left = selectionRect.left;
    let top = selectionRect.top - toolbarHeight - padding;

    // 策略 1: 尝试放在选区上方
    if (top < padding) {
      // 上方空间不足，尝试下方
      top = selectionRect.bottom + padding;
    }

    // 策略 2: 如果下方也不足（选区太大），固定在屏幕顶部
    if (top + toolbarHeight > window.innerHeight - padding) {
      top = padding;
    }

    // 策略 3: 水平居中对齐选区，但不超出屏幕
    left = selectionRect.left + (selectionRect.width - toolbarWidth) / 2;

    // 确保不超出左边界
    if (left < padding) {
      left = padding;
    }

    // 确保不超出右边界
    if (left + toolbarWidth > window.innerWidth - padding) {
      left = window.innerWidth - toolbarWidth - padding;
    }

    return { left, top };
  }

  bindToolbarEvents() {
    this.toolbar.querySelectorAll('.bst-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;

        if (tool === 'rectangle') {
          this.activateRectangleTool();
        } else if (tool === 'cancel') {
          this.cancel();
        } else if (tool === 'finish') {
          this.finishAnnotation();
        }
      });
    });
  }

  // ========== 矩形标注工具 ==========

  activateRectangleTool() {
    this.currentTool = 'rectangle';

    // 高亮矩形按钮
    this.toolbar.querySelectorAll('.bst-tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    this.toolbar.querySelector('[data-tool="rectangle"]').classList.add('active');

    // 改变光标
    this.overlay.style.cursor = 'crosshair';

    // 绑定矩形绘制事件
    this.setupRectangleEvents();

    this.showToast('拖拽画矩形框标注问题位置', 'info');
  }

  setupRectangleEvents() {
    this.overlay.addEventListener('mousedown', this.onRectMouseDown.bind(this));
    this.overlay.addEventListener('mousemove', this.onRectMouseMove.bind(this));
    this.overlay.addEventListener('mouseup', this.onRectMouseUp.bind(this));
  }

  onRectMouseDown(e) {
    if (e.button !== 0 || this.currentTool !== 'rectangle') return;

    this.isDrawingRect = true;
    this.rectStartPoint = { x: e.clientX, y: e.clientY };

    this.createCurrentRect();
  }

  onRectMouseMove(e) {
    if (!this.isDrawingRect) return;

    this.rectEndPoint = { x: e.clientX, y: e.clientY };
    this.updateCurrentRect();
  }

  onRectMouseUp(e) {
    if (!this.isDrawingRect) return;

    this.isDrawingRect = false;
    this.rectEndPoint = { x: e.clientX, y: e.clientY };

    const width = Math.abs(this.rectEndPoint.x - this.rectStartPoint.x);
    const height = Math.abs(this.rectEndPoint.y - this.rectStartPoint.y);

    if (width > 10 && height > 10) {
      // 保存矩形数据
      this.saveCurrentRect();
      // 弹出输入框
      this.showRectTextInput();
    } else {
      // 太小，丢弃
      if (this.currentRect) {
        this.currentRect.remove();
        this.currentRect = null;
      }
    }
  }

  createCurrentRect() {
    this.currentRect = document.createElement('div');
    this.currentRect.className = 'bst-temp-rect';
    this.currentRect.style.cssText = `
      position: fixed;
      border: 2px solid #1aad19;
      background: transparent;
      z-index: 2147483643;
      pointer-events: none;
    `;

    document.body.appendChild(this.currentRect);
  }

  updateCurrentRect() {
    if (!this.currentRect || !this.rectStartPoint || !this.rectEndPoint) return;

    const left = Math.min(this.rectStartPoint.x, this.rectEndPoint.x);
    const top = Math.min(this.rectStartPoint.y, this.rectEndPoint.y);
    const width = Math.abs(this.rectEndPoint.x - this.rectStartPoint.x);
    const height = Math.abs(this.rectEndPoint.y - this.rectStartPoint.y);

    this.currentRect.style.left = `${left}px`;
    this.currentRect.style.top = `${top}px`;
    this.currentRect.style.width = `${width}px`;
    this.currentRect.style.height = `${height}px`;
  }

  saveCurrentRect() {
    const left = Math.min(this.rectStartPoint.x, this.rectEndPoint.x);
    const top = Math.min(this.rectStartPoint.y, this.rectEndPoint.y);
    const width = Math.abs(this.rectEndPoint.x - this.rectStartPoint.x);
    const height = Math.abs(this.rectEndPoint.y - this.rectStartPoint.y);

    const rectData = {
      order: this.rectangles.length + 1,
      x: left,
      y: top,
      width: width,
      height: height,
      text: '', // 待输入
      element: this.currentRect
    };

    this.rectangles.push(rectData);
  }

  // ========== 矩形文字输入 ==========

  showRectTextInput() {
    const currentRectData = this.rectangles[this.rectangles.length - 1];

    const inputBox = document.createElement('div');
    inputBox.className = 'bst-rect-input';
    inputBox.innerHTML = `
      <div class="bst-rect-input-container">
        <div class="bst-rect-input-header">
          <span class="bst-rect-number">${currentRectData.order}</span>
          <span>请输入问题描述</span>
        </div>
        <input type="text"
               class="bst-rect-input-field"
               placeholder="输入此处的问题..."
               autofocus>
        <div class="bst-rect-input-footer">
          <button class="bst-rect-btn bst-rect-btn-cancel">取消</button>
          <button class="bst-rect-btn bst-rect-btn-ok">确定</button>
        </div>
      </div>
    `;

    // 定位在矩形旁边
    const rect = this.currentRect.getBoundingClientRect();
    let inputLeft = rect.right + 10;
    let inputTop = rect.top;

    // 边界检查
    if (inputLeft + 300 > window.innerWidth) {
      inputLeft = rect.left - 310;
    }
    if (inputLeft < 10) {
      inputLeft = 10;
      inputTop = rect.bottom + 10;
    }

    inputBox.style.cssText = `
      position: fixed;
      left: ${inputLeft}px;
      top: ${inputTop}px;
      z-index: 2147483645;
    `;

    this.addRectInputStyles();
    document.body.appendChild(inputBox);

    // 绑定事件
    const inputField = inputBox.querySelector('.bst-rect-input-field');
    const cancelBtn = inputBox.querySelector('.bst-rect-btn-cancel');
    const okBtn = inputBox.querySelector('.bst-rect-btn-ok');

    inputField.focus();

    inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.confirmRectText(inputField.value, inputBox);
      }
    });

    cancelBtn.addEventListener('click', () => {
      this.cancelRectText(inputBox);
    });

    okBtn.addEventListener('click', () => {
      this.confirmRectText(inputField.value, inputBox);
    });
  }

  confirmRectText(text, inputBox) {
    if (!text || !text.trim()) {
      this.showToast('请输入问题描述', 'warning');
      return;
    }

    const currentRectData = this.rectangles[this.rectangles.length - 1];
    currentRectData.text = text.trim();

    // 移除临时矩形
    if (this.currentRect) {
      this.currentRect.remove();
      this.currentRect = null;
    }

    // 创建持久化的矩形（带编号和文字）
    this.createPersistentRect(currentRectData);

    // 移除输入框
    inputBox.remove();

    // 重置绘制状态
    this.rectStartPoint = null;
    this.rectEndPoint = null;

    this.showToast(`已标注问题 ${currentRectData.order}`, 'success');
  }

  cancelRectText(inputBox) {
    // 删除当前矩形
    if (this.currentRect) {
      this.currentRect.remove();
      this.currentRect = null;
    }

    // 从列表中移除
    this.rectangles.pop();

    // 移除输入框
    inputBox.remove();

    // 重置状态
    this.rectStartPoint = null;
    this.rectEndPoint = null;
  }

  createPersistentRect(rectData) {
    const rect = document.createElement('div');
    rect.className = 'bst-persistent-rect';
    rect.style.cssText = `
      position: fixed;
      left: ${rectData.x}px;
      top: ${rectData.y}px;
      width: ${rectData.width}px;
      height: ${rectData.height}px;
      border: 2px solid #1aad19;
      background: transparent;
      z-index: 2147483643;
      pointer-events: none;
    `;

    // 添加编号标签
    const label = document.createElement('div');
    label.className = 'bst-rect-label';
    label.textContent = rectData.order;
    label.style.cssText = `
      position: absolute;
      top: -14px;
      left: -2px;
      background: #1aad19;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    // 添加文字标签（简短显示）
    const textLabel = document.createElement('div');
    textLabel.className = 'bst-rect-text';
    const shortText = rectData.text.length > 15 ? rectData.text.substring(0, 15) + '...' : rectData.text;
    textLabel.textContent = shortText;
    textLabel.title = rectData.text; // 完整文字显示在title
    textLabel.style.cssText = `
      position: absolute;
      bottom: -30px;
      left: 0;
      background: rgba(26, 173, 25, 0.9);
      color: white;
      padding: 6px 10px;
      border-radius: 3px;
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    rect.appendChild(label);
    rect.appendChild(textLabel);
    document.body.appendChild(rect);

    rectData.element = rect;
  }

  // ========== 完成标注 ==========

  async finishAnnotation() {
    if (this.rectangles.length === 0) {
      this.showToast('请至少标注一个问题位置', 'warning');
      return;
    }

    // 显示最终输入面板
    this.showFinalInputPanel();
  }

  showFinalInputPanel() {
    const panel = document.createElement('div');
    panel.className = 'bst-final-panel';
    panel.innerHTML = `
      <div class="bst-final-container">
        <div class="bst-final-header">
          <span>标注完成</span>
          <button class="bst-final-close">×</button>
        </div>
        <div class="bst-final-body">
          <div class="bst-final-summary">
            <label>已标注问题：</label>
            <div class="bst-rect-list">
              ${this.rectangles.map(r => `
                <div class="bst-rect-item">
                  <span class="bst-rect-item-num">${r.order}</span>
                  <span class="bst-rect-item-text">${r.text}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="bst-final-tags" id="bst-final-tags-container">
            <label>选择问题标签：</label>
            <div class="bst-tag-list">
              <button class="bst-tag" data-tag="按钮失效">按钮失效</button>
              <button class="bst-tag" data-tag="表单校验">表单校验</button>
              <button class="bst-tag" data-tag="样式错位">样式错位</button>
              <button class="bst-tag" data-tag="接口报错">接口报错</button>
              <button class="bst-tag" data-tag="其他">其他</button>
            </div>
          </div>
        </div>
        <div class="bst-final-footer">
          <button class="bst-btn bst-btn-secondary">取消</button>
          <button class="bst-btn bst-btn-primary" id="bst-final-submit">提交</button>
        </div>
      </div>
    `;

    this.addFinalPanelStyles();

    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483646;
    `;

    document.body.appendChild(panel);

    // 绑定事件
    this.bindFinalPanelEvents(panel);
  }

  bindFinalPanelEvents(panel) {
    // 标签选择
    panel.querySelectorAll('.bst-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        panel.querySelectorAll('.bst-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        this.bugData.tag = tag.dataset.tag;
      });
    });

    // 关闭
    panel.querySelector('.bst-final-close').addEventListener('click', () => {
      panel.remove();
    });

    // 取消
    panel.querySelector('.bst-btn-secondary').addEventListener('click', () => {
      panel.remove();
    });

    // 提交
    panel.querySelector('#bst-final-submit').addEventListener('click', () => {
      this.submitBugData(panel);
    });

  }

  async submitBugData(panel) {
    if (!this.bugData.tag) {
      this.showToast('请选择问题标签', 'warning');
      return;
    }

    // 自动生成 issue：所有矩形框描述按 "1、2、3、" 格式
    this.bugData.issue = this.rectangles.map(r => `${r.order}、${r.text}`).join(' ');
    this.bugData.pageURL = window.location.href;
    this.bugData.timestamp = new Date().toLocaleString('zh-CN');
    this.bugData.pathLast1 = window.location.pathname.split('/').pop() || 'page';

    // 保存矩形数据
    this.bugData.rectangles = this.rectangles.map(r => ({
      order: r.order,
      text: r.text,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height
    }));

    // 生成合成截图
    await this.compositeScreenshot();

    // 保存到 storage
    await this.saveBugData();

    // 复制到剪贴板
    await this.copyToClipboard();

    panel.remove();
    this.showToast('Bug 已生成，准备跳转到 TAPD', 'success');

    setTimeout(() => {
      this.deactivate();
      this.redirectToTAPD();
    }, 1500);
  }

  async compositeScreenshot() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;

      // 获取主选区位置
      const mainRect = this.mainSelection.getBoundingClientRect();

      const img = new Image();
      img.onload = () => {
        // 设置canvas为主选区大小
        canvas.width = mainRect.width * dpr;
        canvas.height = mainRect.height * dpr;

        // 裁剪主选区图像
        ctx.drawImage(
          img,
          mainRect.left * dpr,
          mainRect.top * dpr,
          mainRect.width * dpr,
          mainRect.height * dpr,
          0,
          0,
          canvas.width,
          canvas.height
        );

        // 绘制矩形标注
        this.rectangles.forEach(rect => {
          // 计算相对于主选区的坐标
          const relX = (rect.x - mainRect.left) * dpr;
          const relY = (rect.y - mainRect.top) * dpr;
          const relW = rect.width * dpr;
          const relH = rect.height * dpr;

          // 绘制矩形边框
          ctx.strokeStyle = '#1aad19';
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(relX, relY, relW, relH);

          // 绘制编号标签
          const labelSize = 24 * dpr;
          ctx.fillStyle = '#1aad19';
          ctx.beginPath();
          ctx.arc(relX + labelSize/2, relY - labelSize/2, labelSize/2, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2 * dpr;
          ctx.stroke();

          ctx.fillStyle = 'white';
          ctx.font = `bold ${12 * dpr}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(rect.order.toString(), relX + labelSize/2, relY - labelSize/2);

          // 绘制文字标签
          ctx.fillStyle = 'rgba(26, 173, 25, 0.9)';
          ctx.font = `${12 * dpr}px Arial`;
          const textWidth = ctx.measureText(rect.text).width;
          ctx.fillRect(relX, relY + relH + 2 * dpr, textWidth + 16 * dpr, 20 * dpr);

          ctx.fillStyle = 'white';
          ctx.fillText(rect.text, relX + 8 * dpr, relY + relH + 12 * dpr);
        });

        this.bugData.screenshot = canvas.toDataURL('image/png');
        resolve();
      };

      img.src = this.screenshot;
    });
  }

  async saveBugData() {
    try {
      if (!chrome?.runtime?.id) {
        console.warn('扩展上下文已失效，数据可能无法保存');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'saveBugData',
        data: this.bugData
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
      const response = await fetch(this.bugData.screenshot);
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

  async redirectToTAPD() {
    let tapdUrl = 'https://www.tapd.cn/47910877/bugtrace/bugs/add';

    try {
      const result = await chrome.storage.local.get(['config']);
      if (result.config?.tapd?.projectIds?.length > 0) {
        const projectId = result.config.tapd.projectIds[0];
        const domain = result.config.tapd.domains?.[0] || 'tapd.cn';
        tapdUrl = `https://www.${domain}/${projectId}/bugtrace/bugs/add`;
      }
    } catch (error) {
      console.warn('Failed to load config:', error);
    }

    try {
      if (chrome?.runtime?.id) {
        const response = await chrome.runtime.sendMessage({
          action: 'openTapdPage'
        });

        if (response?.success) {
          return;
        }
      }
    } catch (error) {
      console.log('Background service failed:', error);
    }

    // 降级方案：直接打开
    window.open(tapdUrl, '_blank');
  }

  // ========== 样式 ==========

  addToolbarStyles() {
    if (document.getElementById('bst-toolbar-styles')) return;

    const style = document.createElement('style');
    style.id = 'bst-toolbar-styles';
    style.textContent = `
      .bst-toolbar {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      }

      .bst-tool-btn {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        font-size: 13px;
        height: 32px;
        border-radius: 4px;
      }

      /* 图标按钮 */
      .bst-tool-icon {
        width: 32px;
        padding: 0;
      }

      .bst-tool-icon:hover {
        background: rgba(255,255,255,0.2);
      }

      .bst-tool-icon.active {
        background: #1aad19;
      }

      /* 文字按钮 */
      .bst-tool-text {
        padding: 0 12px;
        color: rgba(255,255,255,0.9);
      }

      .bst-tool-text:hover {
        background: rgba(255,255,255,0.15);
        color: white;
      }

      /* 主要按钮（完成） */
      .bst-tool-primary {
        padding: 0 16px;
        background: #1aad19;
        color: white;
        font-weight: 500;
      }

      .bst-tool-primary:hover {
        background: #179b16;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(26,173,25,0.4);
      }

      .bst-tool-divider {
        width: 1px;
        height: 18px;
        background: rgba(255,255,255,0.15);
        margin: 0 2px;
      }
    `;

    document.head.appendChild(style);
  }

  addRectInputStyles() {
    if (document.getElementById('bst-rect-input-styles')) return;

    const style = document.createElement('style');
    style.id = 'bst-rect-input-styles';
    style.textContent = `
      .bst-rect-input-container {
        width: 300px;
        background: white;
        border-radius: 6px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        overflow: hidden;
        pointer-events: auto !important;
      }

      .bst-rect-input-header {
        padding: 10px 12px;
        background: #f7f7f7;
        border-bottom: 1px solid #e5e5e5;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #333;
      }

      .bst-rect-number {
        background: #1aad19;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
      }

      .bst-rect-input-field {
        width: 100%;
        padding: 10px 12px;
        border: none;
        border-bottom: 1px solid #e5e5e5;
        font-size: 14px;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        pointer-events: auto !important;
        user-select: text !important;
      }

      .bst-rect-input-field:focus {
        outline: none;
        border-bottom-color: #1aad19;
      }

      .bst-rect-input-footer {
        padding: 10px 12px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        background: #f7f7f7;
      }

      .bst-rect-btn {
        padding: 5px 14px;
        border-radius: 3px;
        font-size: 13px;
        cursor: pointer;
        border: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      }

      .bst-rect-btn-cancel {
        background: white;
        color: #666;
        border: 1px solid #d9d9d9;
      }

      .bst-rect-btn-cancel:hover {
        background: #f5f5f5;
      }

      .bst-rect-btn-ok {
        background: #1aad19;
        color: white;
      }

      .bst-rect-btn-ok:hover {
        background: #179b16;
      }
    `;

    document.head.appendChild(style);
  }

  addFinalPanelStyles() {
    if (document.getElementById('bst-final-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'bst-final-panel-styles';
    style.textContent = `
      .bst-final-container {
        width: 480px;
        background: white;
        border-radius: 6px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        overflow: hidden;
        pointer-events: auto !important;
      }

      .bst-final-header {
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

      .bst-final-close {
        background: none;
        border: none;
        font-size: 20px;
        color: #999;
        cursor: pointer;
        width: 24px;
        height: 24px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .bst-final-close:hover {
        background: #e5e5e5;
        color: #333;
      }

      .bst-final-body {
        padding: 16px;
      }

      .bst-final-summary {
        margin-bottom: 16px;
      }

      .bst-final-summary label {
        display: block;
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
      }

      .bst-rect-list {
        background: #f7f7f7;
        border-radius: 4px;
        padding: 8px;
        max-height: 150px;
        overflow-y: auto;
      }

      .bst-rect-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: 13px;
      }

      .bst-rect-item-num {
        background: #1aad19;
        color: white;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        flex-shrink: 0;
      }

      .bst-rect-item-text {
        color: #333;
      }

      .bst-final-tags {
        margin-bottom: 16px;
      }

      .bst-final-tags label {
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
        border: 1px solid #d9d9d9;
        background: white;
        border-radius: 3px;
        cursor: pointer;
        font-size: 13px;
        color: #333;
        transition: all 0.2s;
      }

      .bst-tag:hover {
        border-color: #1aad19;
        color: #1aad19;
      }

      .bst-tag.active {
        background: #1aad19;
        color: white;
        border-color: #1aad19;
      }

      .bst-final-input label {
        display: block;
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
      }

      .bst-final-input input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #d9d9d9;
        border-radius: 3px;
        font-size: 14px;
        box-sizing: border-box;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        pointer-events: auto !important;
        user-select: text !important;
      }

      .bst-final-input input:focus {
        outline: none;
        border-color: #1aad19;
      }

      .bst-final-footer {
        padding: 12px 16px;
        background: #f7f7f7;
        border-top: 1px solid #e5e5e5;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      .bst-btn {
        padding: 6px 16px;
        border-radius: 3px;
        font-size: 13px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        transition: all 0.2s;
      }

      .bst-btn-secondary {
        background: white;
        color: #666;
        border: 1px solid #d9d9d9;
      }

      .bst-btn-secondary:hover {
        background: #f5f5f5;
      }

      .bst-btn-primary {
        background: #1aad19;
        color: white;
        border: none;
      }

      .bst-btn-primary:hover {
        background: #179b16;
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      z-index: 2147483647;
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

  cancel() {
    this.deactivate();
  }

  cleanup() {
    console.log('BST: Cleaning up Rectangle Annotator...');

    if (this.frozenBackground) {
      this.frozenBackground.remove();
      this.frozenBackground = null;
    }

    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.mainSelection) {
      this.mainSelection.remove();
      this.mainSelection = null;
    }

    if (this.sizeIndicator) {
      this.sizeIndicator.remove();
      this.sizeIndicator = null;
    }

    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }

    if (this.currentRect) {
      this.currentRect.remove();
      this.currentRect = null;
    }

    this.rectangles.forEach(r => {
      if (r.element) {
        r.element.remove();
      }
    });

    document.querySelectorAll('.bst-rect-input').forEach(el => el.remove());
    document.querySelectorAll('.bst-final-panel').forEach(el => el.remove());
    document.querySelectorAll('.bst-persistent-rect').forEach(el => el.remove());

    this.rectangles = [];
    this.isDrawingMain = false;
    this.isDrawingRect = false;
    this.mainStartPoint = null;
    this.mainEndPoint = null;
    this.rectStartPoint = null;
    this.rectEndPoint = null;
    this.currentTool = 'select';
    this.currentPhase = 'main-selection';
    this.bugData = {
      tag: '',
      issue: '',
      rectangles: [],
      pageURL: '',
      timestamp: ''
    };
  }
}

// 初始化
console.log('BST: Loading Rectangle Annotator...');
const rectangleAnnotator = new RectangleAnnotator();
window.annotator = rectangleAnnotator;
console.log('BST: Rectangle Annotator loaded. Use Alt+S to toggle.');
