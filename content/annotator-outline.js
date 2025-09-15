// Bug Shot Turbo - 纯边框版本（只显示四条线）

class ScreenshotAnnotator {
  constructor() {
    this.isActive = false;
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.overlay = null;
    this.inputPanel = null;
    this.frozenBackground = null;
    this.screenshot = null;
    
    // 单区域逐个模式的存储
    this.selections = [];  // 所有已保存的BUG数据
    this.currentSelectionRect = null;
    this.currentSelection = null;
    
    // 多区域统一模式的存储
    this.currentBug = {
      selections: [],  // 多个框选区域
      issue: '',       // 统一问题描述
      tag: '',         // 统一问题标签
      status: 'selecting', // selecting, describing, completed
      bugNumber: 1     // 当前BUG编号
    };
    this.selectionElements = [];
    this.statusIndicator = null;
    
    this.init();
  }

  init() {
    this.setupListeners();
  }

  async initTagsRenderer() {
    try {
      // 检查TagsRenderer是否可用
      if (!window.BST_TagsRenderer) {
        console.warn('BST Annotator: Tags renderer not available, will use fallback');
        return;
      }

      // 只有TagsRenderer可用时才初始化
      await window.BST_TagsRenderer.init();
      console.log('BST Annotator: Tags renderer initialized');
    } catch (error) {
      console.error('BST Annotator: Tags system initialization failed:', error);
      console.warn('BST Annotator: Will use fallback tags');
    }
  }

  async renderUnifiedTags() {
    const container = this.inputPanel.querySelector('#bst-unified-tags-container');
    if (!container) return;

    // 检查TagsRenderer可用性
    if (!window.BST_TagsRenderer || typeof window.BST_TagsRenderer.renderTagSelector !== 'function') {
      console.warn('BST Annotator: TagsRenderer not available, using fallback');
      this.renderFallbackTags(container);
      this.bindFallbackTagEvents(container, 'unified');
      return;
    }

    try {
      // 确保TagsRenderer已初始化
      if (typeof window.BST_TagsRenderer.init === 'function') {
        await window.BST_TagsRenderer.init();
      }

      const tagsHtml = window.BST_TagsRenderer.renderTagSelector({
        showSearch: true,
        allowQuickCreate: false,
        showRecent: false,
        showFavorites: false,
        maxRecent: 0,
        compactView: false
      });
      
      if (!tagsHtml || tagsHtml.trim() === '') {
        throw new Error('Empty tags HTML returned from renderer');
      }

      container.innerHTML = tagsHtml;
      
      // 添加动态样式
      this.addTagsRendererStyles();
      
      // 绑定事件 - 延迟到 setupUnifiedPanelButtonStates 中处理，以包含按钮状态更新
      if (typeof window.BST_TagsRenderer.bindEvents !== 'function') {
        console.warn('BST Annotator: bindEvents not available, using fallback events');
        this.bindFallbackTagEvents(container, 'unified');
      }
      
      console.log('BST Annotator: Unified tags rendered successfully');
    } catch (error) {
      console.error('BST Annotator: Failed to render unified tags:', error);
      console.warn('BST Annotator: Falling back to static tags');
      // 回退到硬编码标签
      this.renderFallbackTags(container);
      this.bindFallbackTagEvents(container, 'unified');
    }
  }

  async renderSingleTags() {
    const container = this.inputPanel.querySelector('#bst-single-tags-container');
    if (!container) return;

    if (!window.BST_TagsRenderer) {
      console.warn('BST Annotator: TagsRenderer not available, using fallback');
      this.renderFallbackTags(container);
      this.bindFallbackTagEvents(container, 'single');
      return;
    }

    try {
      const tagsHtml = window.BST_TagsRenderer.renderTagSelector({
        showSearch: false,
        allowQuickCreate: false,
        showRecent: true,
        showFavorites: true,
        maxRecent: 6,
        compactView: true
      });
      
      container.innerHTML = tagsHtml;
      
      // 添加动态样式
      this.addTagsRendererStyles();
      
      // 绑定事件
      window.BST_TagsRenderer.bindEvents(container, (selectedTag) => {
        // 单个标注时使用 selectedTag 变量
        this.currentSelectedTag = selectedTag.name;
        console.log('BST Annotator: Selected tag for single annotation:', selectedTag);
      });
      
      console.log('BST Annotator: Single tags rendered');
    } catch (error) {
      console.error('BST Annotator: Failed to render single tags:', error);
      // 回退到硬编码标签
      this.renderFallbackTags(container);
      this.bindFallbackTagEvents(container, 'single');
    }
  }

  renderFallbackTags(container) {
    // 回退到硬编码标签列表
    container.innerHTML = `
      <button class="bst-tag" data-tag="按钮失效">按钮失效</button>
      <button class="bst-tag" data-tag="表单校验">表单校验</button>
      <button class="bst-tag" data-tag="样式错位">样式错位</button>
      <button class="bst-tag" data-tag="接口报错">接口报错</button>
      <button class="bst-tag" data-tag="其他">其他</button>
    `;
    console.log('BST Annotator: Using fallback tags');
  }

  bindFallbackTagEvents(container, type) {
    // 简单的标签选择事件回退
    const tags = container.querySelectorAll('.bst-tag');
    tags.forEach(tag => {
      tag.addEventListener('click', (e) => {
        // 清除其他选择
        tags.forEach(t => t.classList.remove('active'));
        // 选择当前标签
        e.target.classList.add('active');
        
        if (type === 'unified') {
          this.currentBug.tag = e.target.dataset.tag;
        } else if (type === 'single') {
          this.currentSelectedTag = e.target.dataset.tag;
        }
        
        console.log('BST Annotator: Fallback tag selected:', e.target.dataset.tag);
      });
    });
    console.log('BST Annotator: Fallback tag events bound for', type);
  }

  addTagsRendererStyles() {
    const styleId = 'bst-tags-renderer-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = window.BST_TagsRenderer ? window.BST_TagsRenderer.getStyles() : '';
    document.head.appendChild(style);
  }

  async saveTagUsage() {
    if (!window.BST_TagsManager || !this.currentBug.tag) return;

    try {
      // 查找选中标签的ID
      const selectedTag = window.BST_TagsManager.getAllTags().find(tag => tag.name === this.currentBug.tag);
      if (selectedTag) {
        await window.BST_TagsManager.recordTagUsage(selectedTag.id);
        await window.BST_TagsManager.flushUsageStats();
        console.log('BST Annotator: Tag usage saved for', this.currentBug.tag);
      }
    } catch (error) {
      console.error('BST Annotator: Failed to save tag usage:', error);
      // 不抛出错误，避免影响主流程
    }
  }

  setupListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleAnnotation') {
        this.toggle();
      }
    });

    document.addEventListener('keydown', (e) => {
      console.log('BST: Key pressed:', e.key, 'Alt:', e.altKey, 'Active:', this.isActive, 'InputPanel:', !!this.inputPanel, 'Selections:', this.currentBug.selections.length);
      
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        console.log('BST: Alt+S detected');
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
        return false;
      }
      
      if (this.isActive && !this.inputPanel) {
        console.log('BST: In active mode, checking key combinations...');
        
        if (e.key === 'Escape') {
          console.log('BST: Escape - canceling');
          this.cancel();
        } else if (e.key === 'Enter' && this.currentBug.selections.length > 0) {
          // Enter: 直接进入描述阶段
          console.log('BST: Enter detected - starting description phase');
          e.preventDefault();
          e.stopPropagation();
          // 异步调用，不阻塞事件处理
          this.startDescriptionPhase().catch(error => {
            console.error('BST: Failed to start description phase:', error);
          });
          return false;
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
    
    // 初始化标签渲染器
    await this.initTagsRenderer();
    
    // 强制编号从1开始
    const bugNumber = 1;
    
    // 重置当前BUG数据
    this.currentBug = {
      selections: [],
      issue: '',
      tag: '',
      status: 'selecting',
      bugNumber: bugNumber
    };
    this.selectionElements = [];
    
    // 立即截图并创建静态背景
    await this.captureAndFreezeScreen();
    this.createOverlay();
    this.setupMouseEvents();
    this.showInitialTooltip();
  }

  deactivate() {
    this.isActive = false;
    this.cleanup();
  }

  async captureAndFreezeScreen() {
    try {
      // 检查Chrome扩展环境
      if (!chrome?.runtime?.sendMessage) {
        throw new Error('Chrome runtime not available');
      }

      const response = await chrome.runtime.sendMessage({ 
        action: 'captureVisibleTab' 
      });
      
      if (response?.success) {
        this.screenshot = response.dataUrl;
        // 创建静态截图背景层，完全覆盖原始页面
        this.createFrozenBackground();
      } else {
        console.error('Failed to capture screenshot:', response?.error);
        this.showError('截图失败，请重试');
      }
    } catch (error) {
      console.error('Screenshot error:', error);
      if (error.message?.includes('Could not establish connection')) {
        this.showError('扩展连接失败，请刷新页面重试');
      } else {
        this.showError('截图失败: ' + error.message);
      }
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

  createPersistentSelectionBox(selection) {
    // 创建持久化的选择框，带序号标签
    const box = document.createElement('div');
    box.className = 'bst-persistent-selection';
    box.style.cssText = `
      position: fixed;
      left: ${selection.x}px;
      top: ${selection.y}px;
      width: ${selection.width}px;
      height: ${selection.height}px;
      border: 2px solid #ff6b6b;
      background: transparent;
      z-index: 999999;
      pointer-events: none;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
    `;
    
    // 添加序号标签
    const label = document.createElement('div');
    label.className = 'bst-selection-label';
    label.textContent = selection.order;
    label.style.cssText = `
      position: absolute;
      top: -12px;
      left: -1px;
      background: #ff6b6b;
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
    `;
    
    box.appendChild(label);
    document.body.appendChild(box);
    
    // 保存到元素列表以便后续清理
    this.selectionElements.push(box);
    selection.displayElement = box;
  }

  updateStatusIndicator() {
    // 移除旧的状态指示器
    if (this.statusIndicator) {
      this.statusIndicator.remove();
    }
    
    // 创建新的状态指示器
    this.statusIndicator = document.createElement('div');
    this.statusIndicator.className = 'bst-status-indicator';
    this.statusIndicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 1000000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    
    this.statusIndicator.innerHTML = `
      <div>📍 已选择 ${this.currentBug.selections.length} 个区域</div>
      <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
        继续框选更多区域 | Enter输入描述 | Esc取消
      </div>
    `;
    
    document.body.appendChild(this.statusIndicator);
  }

  showSelectionHint() {
    // 显示操作提示
    const hint = document.createElement('div');
    hint.className = 'bst-selection-hint';
    hint.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: #4caf50;
      color: white;
      padding: 10px 20px;
      border-radius: 25px;
      font-size: 14px;
      z-index: 1000000;
      animation: fadeInOut 2s ease-in-out;
    `;
    
    hint.textContent = `✓ 区域 ${this.currentBug.selections.length} 已添加`;
    document.body.appendChild(hint);
    
    // 添加淡入淡出动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      hint.remove();
      style.remove();
    }, 2000);
  }


  async startDescriptionPhase() {
    // 当用户按Alt+Enter时，进入描述阶段
    console.log('BST: startDescriptionPhase called, selections:', this.currentBug.selections.length);
    
    if (this.currentBug.selections.length === 0) {
      console.log('BST: No selections, showing warning');
      this.showToast('请先框选至少一个区域', 'warning');
      return;
    }
    
    console.log('BST: Entering description phase...');
    this.currentBug.status = 'describing';
    this.overlay.style.pointerEvents = 'none';
    await this.showUnifiedInputPanel();
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
        <div>🖱️ 框选相关问题区域(支持多个)</div>
        <div style="margin-top: 5px; font-size: 12px; opacity: 0.8;">Enter 输入描述 | Esc 取消</div>
      </div>
    `;
    document.body.appendChild(tooltip);
    
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
    if (e.button !== 0) return;
    if (this.inputPanel) return;
    
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
      // 创建新的框选区域数据
      const selection = {
        x: Math.min(this.startPoint.x, this.endPoint.x),
        y: Math.min(this.startPoint.y, this.endPoint.y),
        width: width,
        height: height,
        order: this.currentBug.bugNumber  // 同一个BUG的所有框选使用相同编号
      };
      
      // 添加到当前BUG的选择列表（支持多个区域）
      this.currentBug.selections.push(selection);
      
      // 创建持久化的选择框显示
      this.createPersistentSelectionBox(selection);
      
      // 更新状态提示
      this.updateStatusIndicator();
      
      // 显示操作提示
      this.showSelectionHint();
      
    } else {
      // 清除临时选择框
      if (this.currentSelection) {
        this.removeSelectionBox(this.currentSelection);
        this.currentSelection = null;
      }
    }
  }

  createSelectionBox() {
    // 使用单个div + CSS outline 实现真正透明的选择框
    const selectionBox = document.createElement('div');
    selectionBox.className = 'bst-selection-box-outline';
    selectionBox.style.cssText = `
      position: fixed !important;
      background: none !important;
      background-color: transparent !important;
      background-image: none !important;
      outline: 2px solid #ff6b6b !important;
      outline-offset: -1px !important;
      border: none !important;
      box-shadow: none !important;
      pointer-events: none !important;
      z-index: 999999 !important;
      opacity: 1 !important;
    `;
    
    document.body.appendChild(selectionBox);
    this.currentSelection = selectionBox;
  }

  updateSelectionBox() {
    if (!this.currentSelection || !this.startPoint || !this.endPoint) return;
    
    const left = Math.min(this.startPoint.x, this.endPoint.x);
    const top = Math.min(this.startPoint.y, this.endPoint.y);
    const width = Math.abs(this.endPoint.x - this.startPoint.x);
    const height = Math.abs(this.endPoint.y - this.startPoint.y);
    
    // 更新选择框位置和尺寸
    this.currentSelection.style.left = `${left}px`;
    this.currentSelection.style.top = `${top}px`;
    this.currentSelection.style.width = `${width}px`;
    this.currentSelection.style.height = `${height}px`;
  }

  removeSelectionBox(selection) {
    if (selection) {
      // 检查是否是新的单个元素选择框
      if (selection.remove && typeof selection.remove === 'function') {
        selection.remove();
      }
      // 检查是否是旧的四边框容器
      else if (selection.top) {
        if (selection.top) selection.top.remove();
        if (selection.right) selection.right.remove();
        if (selection.bottom) selection.bottom.remove();
        if (selection.left) selection.left.remove();
      }
    }
  }

  async showUnifiedInputPanel() {
    // 创建统一的多框选输入面板
    this.inputPanel = document.createElement('div');
    this.inputPanel.className = 'bst-unified-input-panel';
    this.inputPanel.innerHTML = `
      <div class="bst-input-container">
        <div class="bst-input-header">
          <span class="bst-input-title">📍 为 ${this.currentBug.selections.length} 个区域输入问题描述</span>
          <button class="bst-input-close" title="取消">×</button>
        </div>
        <div class="bst-input-body">
          <div class="bst-selections-preview">
            <label>已选择区域：</label>
            <div class="bst-selections-grid">
              ${this.currentBug.selections.map((sel, index) => `
                <div class="bst-selection-item">
                  <span class="bst-selection-number">${sel.order}</span>
                  <span class="bst-selection-info">${sel.width}×${sel.height}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="bst-tags">
            <label>选择标签：</label>
            <div class="bst-tag-list" id="bst-unified-tags-container">
              <!-- 动态生成的标签列表 -->
            </div>
          </div>
          <div class="bst-input-field">
            <label>统一问题描述：</label>
            <input type="text" id="bst-unified-issue-input" placeholder="请输入这${this.currentBug.selections.length}个区域的共同问题..." autofocus>
            <div class="bst-input-hint">这个描述将应用到所有选择的区域</div>
          </div>
        </div>
        <div class="bst-input-footer">
          <button class="bst-btn bst-btn-secondary" id="bst-back-to-select">← 继续框选</button>
          <button class="bst-btn bst-btn-primary" id="bst-submit-unified">提交BUG</button>
        </div>
      </div>
    `;
    
    this.addUnifiedInputPanelStyles();
    this.positionInputPanel();
    document.body.appendChild(this.inputPanel);
    
    // 渲染动态标签
    this.renderUnifiedTags().catch(error => {
      console.error('BST: Failed to render unified tags:', error);
    });
    
    this.bindUnifiedInputPanelEvents();
    
    // 聚焦输入框
    setTimeout(() => {
      const input = this.inputPanel.querySelector('#bst-unified-issue-input');
      if (input) input.focus();
    }, 100);
  }

  addUnifiedInputPanelStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .bst-unified-input-panel {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background: white !important;
        border-radius: 8px !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
        z-index: 1000001 !important;
        min-width: 480px !important;
        max-width: 600px !important;
        font-family: Arial, sans-serif !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
      }
      
      .bst-input-container {
        padding: 0 !important;
        margin: 0 !important;
      }
      
      .bst-input-header {
        padding: 16px 20px !important;
        border-bottom: 1px solid #e0e0e0 !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        background: #f8f9fa !important;
        border-radius: 8px 8px 0 0 !important;
      }
      
      .bst-input-title {
        margin: 0 !important;
        font-size: 16px !important;
        font-weight: bold !important;
        color: #333 !important;
      }
      
      .bst-input-close {
        background: none !important;
        border: none !important;
        font-size: 20px !important;
        cursor: pointer !important;
        color: #999 !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
        width: auto !important;
        height: auto !important;
      }
      
      .bst-input-close:hover {
        background: #f0f0f0 !important;
        color: #333 !important;
      }
      
      .bst-input-body {
        padding: 20px !important;
      }
      
      .bst-selections-preview {
        margin-bottom: 20px !important;
      }
      
      .bst-selections-preview label {
        display: block !important;
        font-weight: bold !important;
        color: #555 !important;
        margin-bottom: 8px !important;
      }
      
      .bst-selections-grid {
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
        margin-top: 8px !important;
      }
      
      .bst-selection-item {
        background: #f5f5f5 !important;
        border: 1px solid #ddd !important;
        border-radius: 4px !important;
        padding: 6px 10px !important;
        font-size: 12px !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
      
      .bst-selection-number {
        background: #ff6b6b !important;
        color: white !important;
        width: 18px !important;
        height: 18px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 11px !important;
        font-weight: bold !important;
      }
      
      .bst-selection-info {
        color: #666 !important;
      }
      
      .bst-tags {
        margin-bottom: 20px !important;
      }
      
      .bst-tags label {
        display: block !important;
        margin-bottom: 8px !important;
        font-weight: bold !important;
        color: #555 !important;
      }
      
      .bst-tag-list {
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
      }
      
      .bst-tag {
        padding: 6px 12px !important;
        border: 1px solid #ddd !important;
        background: white !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        transition: all 0.2s !important;
      }
      
      .bst-tag:hover {
        background: #f5f5f5 !important;
        border-color: #ff6b6b !important;
      }
      
      .bst-tag.active {
        background: #ff6b6b !important;
        color: white !important;
        border-color: #ff6b6b !important;
      }
      
      .bst-input-field {
        margin-bottom: 20px !important;
      }
      
      .bst-input-field label {
        display: block !important;
        margin-bottom: 8px !important;
        font-weight: bold !important;
        color: #555 !important;
      }
      
      .bst-input-field input {
        width: 100% !important;
        padding: 10px 12px !important;
        border: 1px solid #ddd !important;
        border-radius: 4px !important;
        font-size: 14px !important;
        box-sizing: border-box !important;
        font-family: Arial, sans-serif !important;
      }
      
      .bst-input-field input:focus {
        outline: none !important;
        border-color: #ff6b6b !important;
        box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.1) !important;
      }
      
      .bst-input-hint {
        font-size: 12px !important;
        color: #999 !important;
        margin-top: 4px !important;
      }
      
      .bst-input-footer {
        padding: 16px 20px !important;
        border-top: 1px solid #e0e0e0 !important;
        display: flex !important;
        justify-content: flex-end !important;
        gap: 10px !important;
        background: #f8f9fa !important;
        border-radius: 0 0 8px 8px !important;
      }
      
      .bst-btn {
        padding: 8px 16px !important;
        border: 1px solid #ddd !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        font-family: Arial, sans-serif !important;
        transition: all 0.2s !important;
      }
      
      .bst-btn-secondary {
        background: white !important;
        color: #666 !important;
      }
      
      .bst-btn-secondary:hover {
        background: #f5f5f5 !important;
        border-color: #999 !important;
      }
      
      .bst-btn-primary {
        background: #ff6b6b !important;
        color: white !important;
        border-color: #ff6b6b !important;
      }
      
      .bst-btn-primary:hover {
        background: #e55a5a !important;
        border-color: #e55a5a !important;
      }
    `;
    document.head.appendChild(style);
  }

  bindUnifiedInputPanelEvents() {
    // 关闭按钮
    this.inputPanel.querySelector('.bst-input-close').addEventListener('click', () => {
      this.cancel();
    });
    
    // 返回继续框选（保存当前BUG并开始新的BUG）
    this.inputPanel.querySelector('#bst-back-to-select').addEventListener('click', () => {
      // 读取当前输入框的内容
      const issueInput = this.inputPanel.querySelector('#bst-unified-issue-input');
      const issue = issueInput?.value.trim() || '';
      
      // 检查保存条件
      if (!issue) {
        this.showToast('请输入问题描述', 'warning');
        issueInput?.focus();
        return;
      }
      
      if (!this.currentBug.tag) {
        this.showToast('请选择问题标签', 'warning');
        return;
      }
      
      if (this.currentBug.selections.length === 0) {
        this.showToast('请先框选至少一个区域', 'warning');
        return;
      }
      
      // 同步状态
      this.currentBug.issue = issue;
      
      // 保存当前BUG的数据到全局数组
      this.currentBug.selections.forEach(sel => {
        const savedSelection = {
          rect: sel,
          tag: this.currentBug.tag,
          issue: issue, // 使用实际输入的值
          bugNumber: this.currentBug.bugNumber
        };
        this.selections.push(savedSelection);
        console.log('BST: Saved selection to global array:', savedSelection);
      });
      
      // 为已保存的区域创建持久显示
      this.currentBug.selections.forEach((sel, index) => {
        this.createSavedSelectionDisplay({
          rect: sel,
          tag: this.currentBug.tag,
          issue: issue
        }, this.selections.length - this.currentBug.selections.length + index + 1);
      });
      
      // 关闭面板
      this.inputPanel.remove();
      this.inputPanel = null;
      
      // 只有保存成功才清空并开始新的BUG会话
      this.currentBug.bugNumber++;
      this.currentBug.selections = [];
      this.currentBug.issue = '';
      this.currentBug.tag = '';
      this.currentBug.status = 'selecting';
      
      // 不清理已保存的选择框，只清理临时的
      this.selectionElements = [];
      
      this.overlay.style.pointerEvents = 'auto';
      this.showToast(`BUG #${this.currentBug.bugNumber - 1} 已保存，开始新的BUG #${this.currentBug.bugNumber}`, 'success');
    });
    
    // 标签选择由 TagsRenderer 处理，无需额外绑定
    
    // 提交按钮
    this.inputPanel.querySelector('#bst-submit-unified').addEventListener('click', () => {
      this.submitUnifiedBug();
    });
    
    // 回车提交
    this.inputPanel.querySelector('#bst-unified-issue-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.submitUnifiedBug();
      }
    });
    
    // 添加动态按钮状态管理
    this.setupUnifiedPanelButtonStates();
  }
  
  setupUnifiedPanelButtonStates() {
    const issueInput = this.inputPanel.querySelector('#bst-unified-issue-input');
    const backButton = this.inputPanel.querySelector('#bst-back-to-select');
    const submitButton = this.inputPanel.querySelector('#bst-submit-unified');
    
    const updateButtonStates = () => {
      const hasIssue = issueInput?.value.trim();
      const hasTag = this.currentBug.tag;
      const hasSelections = this.currentBug.selections.length > 0;
      
      const canProceed = hasIssue && hasTag && hasSelections;
      
      if (backButton) {
        backButton.disabled = !canProceed;
        backButton.style.opacity = canProceed ? '1' : '0.5';
        backButton.style.cursor = canProceed ? 'pointer' : 'not-allowed';
      }
      
      if (submitButton) {
        submitButton.disabled = !canProceed;
        submitButton.style.opacity = canProceed ? '1' : '0.5';
        submitButton.style.cursor = canProceed ? 'pointer' : 'not-allowed';
      }
    };
    
    // 监听输入框变化
    if (issueInput) {
      issueInput.addEventListener('input', updateButtonStates);
    }
    
    // 监听标签变化 - 修改标签设置逻辑以触发更新
    const originalTagSetter = (selectedTag) => {
      this.currentBug.tag = selectedTag.name;
      console.log('BST Annotator: Selected tag for unified bug:', selectedTag);
      updateButtonStates(); // 标签变化时更新按钮状态
    };
    
    // 重新绑定标签事件以包含按钮状态更新
    if (window.BST_TagsRenderer && typeof window.BST_TagsRenderer.bindEvents === 'function') {
      const container = this.inputPanel.querySelector('#bst-unified-tags-container');
      if (container) {
        window.BST_TagsRenderer.bindEvents(container, originalTagSetter);
      }
    }
    
    // 初始状态更新
    updateButtonStates();
  }

  async submitUnifiedBug() {
    const issueInput = this.inputPanel.querySelector('#bst-unified-issue-input');
    const issue = issueInput.value.trim();
    
    if (!issue) {
      this.showToast('请输入问题描述', 'warning');
      issueInput.focus();
      return;
    }
    
    if (!this.currentBug.tag) {
      this.showToast('请选择问题标签', 'warning');
      return;
    }
    
    // 设置统一的问题描述和标签
    this.currentBug.issue = issue;
    this.currentBug.status = 'completed';
    
    // 保存当前BUG的所有选择区域到全局selections数组
    this.currentBug.selections.forEach(sel => {
      this.selections.push({
        rect: sel,
        tag: this.currentBug.tag,
        issue: this.currentBug.issue,
        bugNumber: this.currentBug.bugNumber
      });
    });
    
    // 关闭输入面板
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    // 使用单区域模式的提交方法，它会正确处理this.selections
    await this.finishAndSubmit();
  }

  async generateUnifiedBugData() {
    try {
      // 构造BUG数据
      const bugData = {
        id: `bug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toLocaleString('zh-CN'),
        pageURL: window.location.href,
        pathLast1: window.location.pathname.split('/').pop() || 'page',
        
        // 多框选相关数据
        selections: this.currentBug.selections,
        issue: this.currentBug.issue,
        firstTag: this.currentBug.tag,
        
        // 兼容原有格式
        selectionCount: this.currentBug.selections.length,
        isMultiSelection: this.currentBug.selections.length > 1,
        
        status: 'pending'
      };
      
      // 生成合成图
      await this.generateCompositeImage(bugData);
      
      // 保存数据
      let response;
      try {
        if (!chrome?.runtime?.sendMessage) {
          throw new Error('Chrome runtime not available');
        }
        
        response = await chrome.runtime.sendMessage({
          action: 'saveBugData',
          data: bugData
        });
      } catch (error) {
        console.error('BST: Failed to save bug data:', error);
        if (error.message?.includes('Could not establish connection')) {
          this.showError('扩展连接失败，数据可能未保存');
        } else {
          this.showError('保存失败: ' + error.message);
        }
        return;
      }
      
      if (response?.success) {
        // 复制到剪贴板
        await this.copyToClipboard(bugData);
        
        // 保存标签使用统计
        await this.saveTagUsage();
        
        // 显示成功消息
        this.showSuccessWithRedirect(`已生成BUG #${this.currentBug.bugNumber}（包含 ${this.currentBug.selections.length} 个区域）`);
        
        // 立即停用，然后尝试跳转
        this.deactivate();
        
        // 尝试自动跳转到TAPD
        this.redirectToTAPD();
      } else {
        this.showError('保存失败: ' + response.error);
      }
      
    } catch (error) {
      console.error('Generate unified bug data failed:', error);
      this.showError('生成缺陷包失败: ' + error.message);
    }
  }

  async generateCompositeImage(bugData) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        // 绘制原始截图
        ctx.drawImage(img, 0, 0);
        
        // 绘制半透明遮罩，避开选择区域
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        
        // 使用路径绘制遮罩，将所有选择区域都镂空
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        
        // 为每个选择区域创建镂空
        bugData.selections.forEach(selection => {
          const x = selection.x * dpr;
          const y = selection.y * dpr;
          const width = selection.width * dpr;
          const height = selection.height * dpr;
          
          ctx.rect(x + width, y, -width, height); // 反向绘制创建镂空
        });
        
        ctx.fill('evenodd'); // 使用evenodd填充规则创建镂空效果
        
        // 绘制所有选择框边框和标签
        bugData.selections.forEach(selection => {
          const x = selection.x * dpr;
          const y = selection.y * dpr;
          const width = selection.width * dpr;
          const height = selection.height * dpr;
          
          // 绘制边框
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 3 * dpr;
          ctx.strokeRect(x, y, width, height);
          
          // 绘制白色外边框
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 1 * dpr;
          ctx.strokeRect(x - 1 * dpr, y - 1 * dpr, width + 2 * dpr, height + 2 * dpr);
          
          // 绘制序号标签
          const labelSize = 24 * dpr;
          const labelX = x;
          const labelY = y - labelSize / 2;
          
          // 标签背景
          ctx.fillStyle = '#ff6b6b';
          ctx.beginPath();
          ctx.arc(labelX + labelSize/2, labelY + labelSize/2, labelSize/2, 0, Math.PI * 2);
          ctx.fill();
          
          // 标签白色边框
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2 * dpr;
          ctx.stroke();
          
          // 标签数字
          ctx.fillStyle = 'white';
          ctx.font = `bold ${12 * dpr}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(selection.order.toString(), labelX + labelSize/2, labelY + labelSize/2);
        });
        
        // 智能定位问题描述文字
        if (bugData.selections.length > 0 && bugData.issue) {
          // 找到面积最大的框选区域作为主框
          let mainSelection = bugData.selections[0];
          let maxArea = mainSelection.width * mainSelection.height;
          bugData.selections.forEach(selection => {
            const area = selection.width * selection.height;
            if (area > maxArea) {
              maxArea = area;
              mainSelection = selection;
            }
          });
          
          // 计算文字区域尺寸
          const textWidth = 320 * dpr;
          const textHeight = 90 * dpr;
          const padding = 12 * dpr;
          const cornerRadius = 8 * dpr;
          
          // 智能选择文字位置（主框右侧或下方）
          const mainX = mainSelection.x * dpr;
          const mainY = mainSelection.y * dpr;
          const mainWidth = mainSelection.width * dpr;
          const mainHeight = mainSelection.height * dpr;
          
          let textX, textY;
          // 优先放在右侧，如果空间不够则放在下方
          if (mainX + mainWidth + textWidth + 20 * dpr <= canvas.width) {
            // 放在右侧
            textX = mainX + mainWidth + 15 * dpr;
            textY = mainY;
          } else {
            // 放在下方
            textX = Math.max(20 * dpr, Math.min(mainX, canvas.width - textWidth - 20 * dpr));
            textY = Math.min(mainY + mainHeight + 15 * dpr, canvas.height - textHeight - 20 * dpr);
          }
          
          // 绘制圆角背景
          ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
          ctx.beginPath();
          ctx.roundRect(textX - padding, textY - padding, textWidth + padding * 2, textHeight + padding * 2, cornerRadius);
          ctx.fill();
          
          // 绘制边框增强可见度
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
          ctx.lineWidth = 2 * dpr;
          ctx.stroke();
          
          // 标签文字（醒目的亮黄色）
          ctx.fillStyle = '#FFD700';
          ctx.font = `bold ${18 * dpr}px Arial`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`🏷️ ${bugData.firstTag}`, textX, textY);
          
          // 问题描述（亮白色）
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `bold ${15 * dpr}px Arial`;
          const maxDescLength = 28;
          let displayDesc = bugData.issue;
          if (displayDesc.length > maxDescLength) {
            displayDesc = displayDesc.substring(0, maxDescLength) + '...';
          }
          ctx.fillText(displayDesc, textX, textY + 25 * dpr);
          
          // 附加信息（浅灰色，精简显示）
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = `${12 * dpr}px Arial`;
          const regionCount = bugData.selections.length;
          const infoText = `BUG #${bugData.bugNumber} · ${regionCount}个区域`;
          ctx.fillText(infoText, textX, textY + 50 * dpr);
          
          // 绘制指向线（连接文字到主框）
          if (textX !== mainX + mainWidth + 15 * dpr) { // 只在文字不在右侧时绘制
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.lineWidth = 2 * dpr;
            ctx.setLineDash([5 * dpr, 3 * dpr]);
            ctx.beginPath();
            
            // 从文字框边缘到主框中心的连线
            const lineStartX = textX + textWidth / 2;
            const lineStartY = textY - padding;
            const lineEndX = mainX + mainWidth / 2;
            const lineEndY = mainY + mainHeight / 2;
            
            ctx.moveTo(lineStartX, lineStartY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.stroke();
            ctx.setLineDash([]); // 重置虚线样式
          }
        }
        
        // 导出图像
        bugData.screenshot = canvas.toDataURL('image/png');
        resolve(bugData);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load screenshot'));
      };
      
      img.src = this.screenshot;
    });
  }

  async showInputPanel() {
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
            <div class="bst-tag-list" id="bst-single-tags-container">
              <!-- 动态生成的标签列表 -->
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
    
    // 渲染动态标签
    this.renderSingleTags().catch(error => {
      console.error('BST: Failed to render single tags:', error);
    });
    
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
      left = Math.max(padding, Math.min(rect.x, window.innerWidth - panelWidth - padding));
      top = rect.y + rect.height + padding;
    }
    
    top = Math.max(padding, Math.min(top, window.innerHeight - panelHeight - padding));
    
    this.inputPanel.style.cssText += `
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      z-index: 1000001;
    `;
  }

  addInputPanelStyles() {
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
        margin-bottom: 16px;
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
    `;
    
    document.head.appendChild(style);
  }

  bindInputPanelEvents() {
    let selectedTag = null;
    let issueText = '';
    
    // 标签选择由 TagsRenderer 处理，监听 currentSelectedTag 变化
    const checkTagSelection = () => {
      if (this.currentSelectedTag !== selectedTag) {
        selectedTag = this.currentSelectedTag;
        this.updateButtons(selectedTag, issueText);
      }
    };
    
    // 定期检查标签选择状态
    this.tagCheckInterval = setInterval(checkTagSelection, 100);
    
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
      this.finishAndSubmit();
    });
  }

  updateButtons(tag, issue) {
    const continueBtn = document.getElementById('bst-continue');
    const finishBtn = document.getElementById('bst-finish');
    
    const hasValidInput = tag && issue;
    
    continueBtn.disabled = !hasValidInput;
    finishBtn.disabled = this.selections.length === 0 && !hasValidInput;
  }

  saveCurrentSelection(tag, issue) {
    if (!this.currentSelectionRect || !this.currentSelection) return;
    
    const selection = {
      rect: this.currentSelectionRect,
      element: this.currentSelection,
      tag: tag,
      issue: issue
    };
    
    this.selections.push(selection);
    
    // 移除当前的选择框元素，避免遮挡内容
    this.removeSelectionBox(this.currentSelection);
    
    // 创建新的纯边框显示（不会遮挡内容）
    this.createSavedSelectionDisplay(selection, this.selections.length);
    
    this.currentSelection = null;
    this.currentSelectionRect = null;
  }

  createSavedSelectionDisplay(selection, index) {
    // 创建一个真正透明的选择框显示
    const savedBox = document.createElement('div');
    savedBox.className = 'bst-saved-selection-outline';
    savedBox.style.cssText = `
      position: fixed !important;
      left: ${selection.rect.x}px !important;
      top: ${selection.rect.y}px !important;
      width: ${selection.rect.width}px !important;
      height: ${selection.rect.height}px !important;
      background: none !important;
      background-color: transparent !important;
      background-image: none !important;
      outline: 2px solid #52c41a !important;
      outline-offset: -2px !important;
      border: none !important;
      box-shadow: none !important;
      pointer-events: none !important;
      z-index: 999997 !important;
      opacity: 1 !important;
    `;
    document.body.appendChild(savedBox);
    
    // 添加序号标签
    this.addSelectionLabel(selection, index, savedBox);
    
    // 保存引用用于清理
    selection.displayElement = savedBox;
  }

  addSelectionLabel(selection, index, parentElement) {
    const label = document.createElement('div');
    label.className = 'bst-selection-label';
    label.style.cssText = `
      position: fixed !important;
      left: ${selection.rect.x}px !important;
      top: ${selection.rect.y - 25}px !important;
      background: #52c41a !important;
      color: white !important;
      padding: 2px 8px !important;
      border-radius: 4px !important;
      font-size: 12px !important;
      z-index: 1000000 !important;
      font-weight: bold !important;
      pointer-events: none !important;
    `;
    label.textContent = `#${index}`;
    document.body.appendChild(label);
    
    selection.labelElement = label;
    label.title = `[${selection.tag}] ${selection.issue}`;
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
    
    if (this.overlay) {
      this.overlay.style.pointerEvents = 'auto';
    }
    
    this.currentSelectionRect = null;
  }

  continueSelection() {
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    if (this.overlay) {
      this.overlay.style.pointerEvents = 'auto';
    }
    
    this.showToast(`已保存问题 #${this.selections.length}，请继续框选下一个问题`, 'success');
  }

  async finishAndSubmit() {
    if (this.selections.length === 0) {
      this.showError('请至少标注一个问题');
      return;
    }
    
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    const pageURL = window.location.href;
    const urlParts = window.location.pathname.split('/').filter(p => p);
    const pathLast1 = urlParts[urlParts.length - 1] || 'index';
    
    const bugData = {
      pageURL: pageURL,
      pathLast1: pathLast1,
      selections: this.selections.map(sel => ({
        rect: sel.rect,
        tag: sel.tag,
        issue: sel.issue,
        bugNumber: sel.bugNumber
      })),
      timestamp: new Date().toLocaleString('zh-CN')
    };
    
    console.log('BST: Final bugData before screenshot:', bugData);
    console.log('BST: Total selections:', bugData.selections.length);
    bugData.selections.forEach((sel, index) => {
      console.log(`BST: Selection ${index + 1}:`, {
        bugNumber: sel.bugNumber,
        tag: sel.tag,
        issue: sel.issue,
        rect: sel.rect
      });
    });
    
    await this.compositeScreenshot(bugData);
    await this.saveBugData(bugData);
    await this.copyToClipboard(bugData);
    
    this.showSuccessWithRedirect(`已生成包含 ${this.selections.length} 个问题的缺陷包`);
    
    // 立即停用，然后尝试跳转
    this.deactivate();
    
    // 尝试多种跳转方法
    this.redirectToTAPD();
  }

  async compositeScreenshot(bugData) {
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
        
        // 使用路径绘制遮罩，避开选择区域
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        
        // 创建整个画布的路径
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        
        // 从整个路径中"挖掉"选择区域（创建洞）
        bugData.selections.forEach((sel, index) => {
          const rect = sel.rect;
          ctx.rect(rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr);
        });
        
        // 使用 evenodd 填充规则，创建带洞的遮罩
        ctx.fill('evenodd');
        ctx.restore();
        
        // 在单区域逐个模式下，每个区域都有独立的标签和描述
        bugData.selections.forEach((sel, index) => {
          const rect = sel.rect;
          
          // 绘制边框
          ctx.strokeStyle = '#ff6b6b';
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr);
          
          const labelY = rect.y * dpr - 10;
          const labelX = rect.x * dpr;
          
          ctx.fillStyle = '#ff6b6b';
          // 使用bugNumber作为标签，相同BUG显示相同编号
          const labelText = `#${sel.bugNumber || 1}`;
          ctx.font = `bold ${12 * dpr}px Arial`;
          const labelWidth = ctx.measureText(labelText).width;
          
          ctx.fillRect(labelX, labelY - 20 * dpr, labelWidth + 10 * dpr, 22 * dpr);
          
          ctx.fillStyle = 'white';
          ctx.fillText(labelText, labelX + 5 * dpr, labelY - 3 * dpr);
          
          // 在单区域逐个模式下，每个区域使用自己的标签和描述
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
        
        // 按BUG分组生成摘要
        const bugGroups = {};
        bugData.selections.forEach(sel => {
          const bugNum = sel.bugNumber || 1;
          if (!bugGroups[bugNum]) {
            bugGroups[bugNum] = {
              tag: sel.tag,
              issue: sel.issue,
              count: 0,
              regions: []
            };
          }
          bugGroups[bugNum].count++;
          bugGroups[bugNum].regions.push(sel);
        });
        
        // 生成详细的问题摘要
        const bugNumbers = Object.keys(bugGroups).sort((a, b) => a - b);
        bugData.issuesSummary = bugNumbers.map(num => {
          const bug = bugGroups[num];
          return `BUG #${num}: [${bug.tag}] ${bug.issue} (${bug.count}个区域)`;
        }).join('\n');
        
        bugData.firstTag = bugData.selections[0].tag;
        
        // 生成标题：如果有多个BUG，显示每个BUG的描述
        if (bugNumbers.length > 1) {
          // 多个BUG时，标题包含所有BUG描述
          bugData.issue = bugNumbers.map(num => {
            const bug = bugGroups[num];
            return `${num}. ${bug.issue}`;
          }).join('；');
        } else if (bugData.selections.length > 1) {
          // 单个BUG多个区域
          bugData.issue = `${bugData.selections[0].issue}（${bugData.selections.length}个区域）`;
        } else {
          // 单个BUG单个区域
          bugData.issue = bugData.selections[0].issue;
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

  showSuccessWithRedirect(message) {
    const toast = document.createElement('div');
    toast.className = 'bst-toast bst-toast-success';
    toast.innerHTML = `
      <div style="margin-bottom: 10px;">${message}</div>
      <div style="display: flex; gap: 10px; align-items: center;">
        <button id="bst-redirect-btn" style="
          padding: 6px 12px;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">跳转到TAPD</button>
        <span style="font-size: 12px; opacity: 0.8;">自动跳转中...</span>
      </div>
    `;
    
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 20px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 1000002;
      background: #52c41a;
      animation: slideIn 0.3s ease;
      max-width: 400px;
    `;
    
    document.body.appendChild(toast);
    
    // 手动跳转按钮
    document.getElementById('bst-redirect-btn').addEventListener('click', () => {
      this.redirectToTAPD();
    });
    
    // 自动移除
    setTimeout(() => {
      toast.remove();
    }, 8000);
  }

  async redirectToTAPD() {
    // Load configuration from storage
    let tapdUrl = 'https://www.tapd.cn/47910877/bugtrace/bugs/add'; // fallback default
    
    try {
      const result = await chrome.storage.local.get(['config']);
      if (result.config && result.config.tapd && result.config.tapd.projectIds && result.config.tapd.projectIds.length > 0) {
        const projectId = result.config.tapd.projectIds[0]; // Use first project ID
        const domain = result.config.tapd.domains && result.config.tapd.domains.length > 0 
          ? result.config.tapd.domains[0] 
          : 'tapd.cn';
        tapdUrl = `https://www.${domain}/${projectId}/bugtrace/bugs/add`;
        console.log('BST: Using configured TAPD URL:', tapdUrl);
      } else {
        console.log('BST: No config found, using default TAPD URL:', tapdUrl);
      }
    } catch (error) {
      console.warn('BST: Failed to load config, using default TAPD URL:', error);
    }
    
    console.log('BST: Attempting to redirect to TAPD...');
    
    try {
      // 方法1: 尝试通过background service打开
      const bgResponse = await chrome.runtime.sendMessage({ 
        action: 'openTapdPage' 
      });
      
      if (bgResponse && bgResponse.success) {
        console.log('BST: Successfully opened via background service');
        this.showToast('已通过后台服务打开TAPD页面', 'success');
        return;
      }
    } catch (bgError) {
      console.log('BST: Background service failed:', bgError);
    }
    
    try {
      // 方法2: 尝试在新标签页打开
      const newWindow = window.open(tapdUrl, '_blank');
      
      if (newWindow) {
        console.log('BST: Successfully opened new tab directly');
        this.showToast('已打开TAPD页面，请检查新标签页', 'success');
      } else {
        // 方法3: 如果弹窗被阻止，询问用户
        this.showRedirectOptions(tapdUrl);
      }
    } catch (error) {
      console.error('BST: Direct redirect failed:', error);
      this.showRedirectOptions(tapdUrl);
    }
  }

  showRedirectOptions(tapdUrl) {
    console.log('BST: Showing redirect options to user');
    
    // 创建确认对话框样式的提示
    const confirmToast = document.createElement('div');
    confirmToast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      color: #333;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 1000004;
      padding: 20px;
      max-width: 400px;
    `;
    
    confirmToast.innerHTML = `
      <div style="font-size: 16px; margin-bottom: 15px;">
        📋 截图数据已复制到剪贴板
      </div>
      <div style="font-size: 14px; color: #666; margin-bottom: 20px;">
        是否跳转到TAPD提交页面？
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="bst-cancel-redirect" style="
          padding: 8px 16px;
          background: #f5f5f5;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          cursor: pointer;
        ">取消</button>
        <button id="bst-confirm-redirect" style="
          padding: 8px 16px;
          background: #1890ff;
          border: none;
          color: white;
          border-radius: 4px;
          cursor: pointer;
        ">跳转</button>
      </div>
    `;
    
    document.body.appendChild(confirmToast);
    
    document.getElementById('bst-confirm-redirect').addEventListener('click', () => {
      window.location.href = tapdUrl;
    });
    
    document.getElementById('bst-cancel-redirect').addEventListener('click', () => {
      confirmToast.remove();
      this.showToast('数据已保存，可手动打开TAPD页面提交', 'info');
    });
    
    // 10秒后自动移除
    setTimeout(() => {
      if (document.body.contains(confirmToast)) {
        confirmToast.remove();
        this.showToast('数据已保存，可手动打开TAPD页面提交', 'info');
      }
    }, 10000);
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
    console.log('BST: Starting cleanup...');
    
    // 1. 清理冻结背景
    if (this.frozenBackground) {
      this.frozenBackground.remove();
      this.frozenBackground = null;
    }
    
    // 2. 清理遮罩层
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    // 3. 清理状态指示器
    if (this.statusIndicator) {
      this.statusIndicator.remove();
      this.statusIndicator = null;
    }
    
    // 4. 清理输入面板
    if (this.inputPanel) {
      this.inputPanel.remove();
      this.inputPanel = null;
    }
    
    // 4.1. 清理标签检查定时器
    if (this.tagCheckInterval) {
      clearInterval(this.tagCheckInterval);
      this.tagCheckInterval = null;
    }
    
    // 5. 清理当前BUG的所有选择框元素
    if (this.currentBug && this.currentBug.selections) {
      this.currentBug.selections.forEach(selection => {
        if (selection.displayElement) {
          selection.displayElement.remove();
        }
      });
    }
    
    // 6. 清理旧版本的选择相关的元素（兼容性）
    if (this.selections) {
      this.selections.forEach(selection => {
        if (selection.displayElement) {
          selection.displayElement.remove();
        }
        if (selection.labelElement) {
          selection.labelElement.remove();
        }
      });
    }
    
    // 7. 清理选择元素数组
    if (this.selectionElements) {
      this.selectionElements.forEach(el => {
        if (el && el.parentNode) {
          el.remove();
        }
      });
      this.selectionElements = [];
    }
    
    // 8. 清理临时选择框
    if (this.currentSelection) {
      if (this.currentSelection.remove) {
        this.currentSelection.remove();
      } else {
        this.removeSelectionBox(this.currentSelection);
      }
      this.currentSelection = null;
    }
    
    // 9. 强制清理所有可能的BST相关元素
    const selectors = [
      '.bst-selection-label', 
      '.bst-saved-selection-outline', 
      '.bst-selection-box-outline', 
      '.bst-selection-border-top', 
      '.bst-selection-border-right', 
      '.bst-selection-border-bottom', 
      '.bst-selection-border-left', 
      '.bst-persistent-selection',
      '.bst-tooltip', 
      '.bst-status-indicator', 
      '.bst-selection-hint',
      '.bst-unified-input-panel',
      '.bst-input-panel',
      '.bst-overlay',
      '.bst-frozen-background'
    ];
    
    let removedCount = 0;
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      console.log(`BST: Found ${elements.length} elements with selector: ${selector}`);
      elements.forEach(el => {
        if (el && el.parentNode) {
          el.remove();
          removedCount++;
        }
      });
    });
    
    console.log(`BST: Removed ${removedCount} visual elements in total`);
    
    this.isDrawing = false;
    this.startPoint = null;
    this.endPoint = null;
    this.screenshot = null;
    this.selections = [];
    this.currentSelectionRect = null;
    
    // 重置当前BUG状态
    this.currentBug = {
      selections: [],
      issue: '',
      tag: '',
      status: 'selecting',
      bugNumber: 1
    };
  }
}

// 初始化
console.log('BST: Loading Outline ScreenshotAnnotator...');
const annotator = new ScreenshotAnnotator();
console.log('BST: Outline ScreenshotAnnotator loaded');

window.annotator = annotator;
console.log('BST: Outline Annotator initialized. Use Alt+S to toggle.');