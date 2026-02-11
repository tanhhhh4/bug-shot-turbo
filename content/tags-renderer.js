// Bug Shot Turbo - 动态标签渲染组件
// 为标注面板提供可扩展的标签选择界面

class TagsRenderer {
  constructor() {
    this.tagsManager = null;
    this.currentTags = [];
    this.selectedTag = null;
    this.searchTerm = '';
    this.onTagSelected = null;
    this.settings = {
      showSearch: true,
      allowQuickCreate: true,
      showRecent: true,
      showFavorites: true,
      maxRecent: 6,
      compactView: false
    };
  }

  async init() {
    try {
      if (window.BST_TagsManager) {
        this.tagsManager = window.BST_TagsManager;
        await this.tagsManager.init();
        this.settings = { ...this.settings, ...this.tagsManager.getSettings() };
        console.log('BST TagsRenderer: Initialized with', this.tagsManager.getAllTags().length, 'tags');
      } else {
        console.warn('BST TagsRenderer: TagsManager not available, using fallback');
        this.initFallback();
      }
    } catch (error) {
      console.error('BST TagsRenderer: Initialization failed, using fallback:', error);
      this.initFallback();
    }
  }

  initFallback() {
    // 回退到固定标签列表
    this.currentTags = [
      { id: 'fallback_1', name: '按钮失效', category: '功能', color: '#ff6b6b', hotkey: '1' },
      { id: 'fallback_2', name: '表单校验', category: '功能', color: '#ff6b6b', hotkey: '2' },
      { id: 'fallback_3', name: '样式错位', category: '界面', color: '#4ecdc4', hotkey: '3' },
      { id: 'fallback_4', name: '接口报错', category: '数据', color: '#e74c3c', hotkey: '4' },
      { id: 'fallback_5', name: '其他', category: '其他', color: '#95a5a6', hotkey: '5' }
    ];
  }

  // 渲染标签选择器
  renderTagSelector(options = {}) {
    try {
      const opts = { ...this.settings, ...options };
      
      let html = '<div class="bst-tags-container">';
      
      // 搜索框
      if (opts.showSearch && this.tagsManager) {
        html += this.renderSearchBox();
      }
      
      // 标签分组
      html += '<div class="bst-tags-groups">';
      
      if (opts.showFavorites && this.tagsManager) {
        html += this.renderFavoriteTags();
      }
      
      if (opts.showRecent && this.tagsManager) {
        html += this.renderRecentTags(opts.maxRecent);
      }
      
      html += this.renderAllTags();
      html += '</div>';
      
      // 快速创建
      if (opts.allowQuickCreate && this.tagsManager) {
        html += this.renderQuickCreate();
      }
      
      html += '</div>';
      
      return html;
    } catch (error) {
      console.error('BST TagsRenderer: Render failed, using simple fallback:', error);
      return this.renderSimpleFallback();
    }
  }

  renderSimpleFallback() {
    return `
      <div class="bst-tags-container">
        <div class="bst-tags-groups">
          <div class="bst-tags-group">
            <div class="bst-tags-list">
              ${this.currentTags.map(tag => `
                <button class="bst-tag" data-tag-id="${tag.id}" data-tag-name="${tag.name}" data-tag-category="${tag.category}">
                  <span class="bst-tag-name">${tag.name}</span>
                  ${tag.hotkey ? `<span class="bst-tag-hotkey">${tag.hotkey}</span>` : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderSearchBox() {
    return `
      <div class="bst-tags-search">
        <input type="text" 
               class="bst-tags-search-input" 
               placeholder="搜索标签..." 
               autocomplete="off">
        <div class="bst-search-hint">
          <span>输入关键词搜索，或按数字/字母快捷选择</span>
        </div>
      </div>
    `;
  }

  renderFavoriteTags() {
    const favoriteTags = this.tagsManager ? 
      this.tagsManager.getFavoriteTags() : 
      this.currentTags.filter(tag => tag.favorite);
    
    if (favoriteTags.length === 0) return '';
    
    return `
      <div class="bst-tags-group" data-group="favorites">
        <div class="bst-tags-group-header">
          <span class="bst-tags-group-title">⭐ 收藏标签</span>
          <span class="bst-tags-group-count">${favoriteTags.length}</span>
        </div>
        <div class="bst-tags-list">
          ${favoriteTags.map(tag => this.renderTag(tag)).join('')}
        </div>
      </div>
    `;
  }

  renderRecentTags(maxCount = 6) {
    const recentTags = this.tagsManager ? 
      this.tagsManager.getRecentTags(maxCount) : 
      this.currentTags.slice(0, maxCount);
    
    if (recentTags.length === 0) return '';
    
    return `
      <div class="bst-tags-group" data-group="recent">
        <div class="bst-tags-group-header">
          <span class="bst-tags-group-title">🕒 最近使用</span>
          <span class="bst-tags-group-count">${recentTags.length}</span>
        </div>
        <div class="bst-tags-list">
          ${recentTags.map(tag => this.renderTag(tag)).join('')}
        </div>
      </div>
    `;
  }

  renderAllTags() {
    const allTags = this.tagsManager ? 
      this.tagsManager.getAllTags() : 
      this.currentTags;
    
    if (this.settings.showCategories && this.tagsManager) {
      return this.renderTagsByCategory(allTags);
    } else {
      return this.renderTagsFlat(allTags);
    }
  }

  renderTagsByCategory(tags) {
    const grouped = this.groupTagsByCategory(tags);
    
    return Object.entries(grouped).map(([category, categoryTags]) => {
      // 只有一个标签时隐藏展开按钮
      const hasMultipleTags = categoryTags.length > 1;
      const headerClass = hasMultipleTags ? 'bst-tags-group-header collapsible' : 'bst-tags-group-header';
      const toggleIcon = hasMultipleTags ? '<span class="bst-tags-group-toggle">▼</span>' : '';
      
      return `
        <div class="bst-tags-group" data-group="category" data-category="${category}">
          <div class="${headerClass}" data-toggle-group="true">
            <span class="bst-tags-group-title">📁 ${category}</span>
            <span class="bst-tags-group-count">${categoryTags.length}</span>
            ${toggleIcon}
          </div>
          <div class="bst-tags-list">
            ${categoryTags.map(tag => this.renderTag(tag)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderTagsFlat(tags) {
    return `
      <div class="bst-tags-group" data-group="all">
        <div class="bst-tags-group-header">
          <span class="bst-tags-group-title">📋 所有标签</span>
          <span class="bst-tags-group-count">${tags.length}</span>
        </div>
        <div class="bst-tags-list">
          ${tags.map(tag => this.renderTag(tag)).join('')}
        </div>
      </div>
    `;
  }

  renderTag(tag) {
    const isSelected = this.selectedTag === tag.id;
    const hotkeyDisplay = tag.hotkey ? `<span class="bst-tag-hotkey">${tag.hotkey}</span>` : '';
    const colorStyle = this.settings.showColors ? `style="border-left: 3px solid ${tag.color}"` : '';
    
    return `
      <button class="bst-tag ${isSelected ? 'active' : ''}" 
              data-tag-id="${tag.id}" 
              data-tag-name="${tag.name}"
              data-tag-category="${tag.category}"
              data-hotkey="${tag.hotkey || ''}"
              ${colorStyle}
              title="${tag.category} - ${tag.name}">
        <span class="bst-tag-name">${tag.name}</span>
        ${hotkeyDisplay}
      </button>
    `;
  }

  renderQuickCreate() {
    return `
      <div class="bst-tags-quick-create">
        <div class="bst-quick-create-hint">
          💡 没找到合适的标签？<button class="bst-quick-create-btn">快速创建</button>
        </div>
      </div>
    `;
  }

  // 绑定事件
  bindEvents(container, onTagSelected) {
    this.onTagSelected = onTagSelected;
    
    try {
      // 标签选择
      container.addEventListener('click', (e) => {
        const tagButton = e.target.closest('.bst-tag');
        if (tagButton) {
          this.selectTag(tagButton, container);
        }
        
        // 分类展开/收起
        const groupHeader = e.target.closest('.bst-tags-group-header.collapsible');
        if (groupHeader && groupHeader.dataset.toggleGroup === 'true') {
          const group = groupHeader.closest('.bst-tags-group');
          if (group) {
            group.classList.toggle('collapsed');
          }
        }
        
        // 快速创建
        if (e.target.classList.contains('bst-quick-create-btn')) {
          this.showQuickCreateModal(container);
        }
      });
    
    // 搜索
    const searchInput = container.querySelector('.bst-tags-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value, container);
      });
      
      searchInput.addEventListener('keydown', (e) => {
        this.handleSearchKeydown(e, container);
      });
    }
    
      // 快捷键
      container.addEventListener('keydown', (e) => {
        this.handleHotkey(e, container);
      });
      
      console.log('BST TagsRenderer: Events bound successfully');
    } catch (error) {
      console.error('BST TagsRenderer: Event binding failed:', error);
      // 基础事件回退
      this.bindFallbackEvents(container, onTagSelected);
    }
  }

  bindFallbackEvents(container, onTagSelected) {
    // 最简单的标签选择事件
    container.addEventListener('click', (e) => {
      const tagButton = e.target.closest('.bst-tag');
      if (tagButton) {
        // 清除其他选择
        container.querySelectorAll('.bst-tag').forEach(tag => {
          tag.classList.remove('active');
        });
        
        // 选择当前标签
        tagButton.classList.add('active');
        
        if (onTagSelected) {
          onTagSelected({
            id: tagButton.dataset.tagId,
            name: tagButton.dataset.tagName,
            category: tagButton.dataset.tagCategory
          });
        }
      }
    });
    console.log('BST TagsRenderer: Fallback events bound');
  }

  selectTag(tagButton, container) {
    // 清除之前的选择
    container.querySelectorAll('.bst-tag').forEach(tag => {
      tag.classList.remove('active');
    });
    
    // 选择当前标签
    tagButton.classList.add('active');
    const tagId = tagButton.dataset.tagId;
    const tagName = tagButton.dataset.tagName;
    
    this.selectedTag = tagId;
    
    // 记录使用
    if (this.tagsManager) {
      this.tagsManager.recordTagUsage(tagId);
    }
    
    // 触发回调
    if (this.onTagSelected) {
      this.onTagSelected({
        id: tagId,
        name: tagName,
        category: tagButton.dataset.tagCategory
      });
    }
  }

  handleSearch(searchTerm, container) {
    this.searchTerm = searchTerm.toLowerCase().trim();
    
    if (!this.searchTerm) {
      // 显示所有标签
      this.showAllGroups(container);
      return;
    }
    
    // 过滤标签
    const allTags = this.tagsManager ? 
      this.tagsManager.getAllTags() : 
      this.currentTags;
    
    const filteredTags = allTags.filter(tag => 
      tag.name.toLowerCase().includes(this.searchTerm) ||
      tag.category.toLowerCase().includes(this.searchTerm)
    );
    
    // 更新显示
    this.updateSearchResults(filteredTags, container);
  }

  handleSearchKeydown(e, container) {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // 如果有搜索结果，选择第一个
      const firstTag = container.querySelector('.bst-tag:not(.hidden)');
      if (firstTag) {
        this.selectTag(firstTag, container);
      } else if (this.settings.allowQuickCreate && this.searchTerm) {
        // 快速创建新标签
        this.quickCreateTag(this.searchTerm, container);
      }
    } else if (e.key === 'Escape') {
      e.target.value = '';
      this.handleSearch('', container);
    }
  }

  handleHotkey(e, container) {
    // 只处理数字和字母键
    const key = e.key.toLowerCase();
    if (!/^[0-9a-z]$/.test(key)) return;
    
    // 查找对应快捷键的标签
    const tagButton = container.querySelector(`[data-hotkey="${key}"]`);
    if (tagButton && !tagButton.classList.contains('hidden')) {
      e.preventDefault();
      this.selectTag(tagButton, container);
    }
  }

  updateSearchResults(filteredTags, container) {
    // 隐藏所有标签
    container.querySelectorAll('.bst-tag').forEach(tag => {
      tag.classList.add('hidden');
    });
    
    // 显示匹配的标签
    filteredTags.forEach(tag => {
      const tagButton = container.querySelector(`[data-tag-id="${tag.id}"]`);
      if (tagButton) {
        tagButton.classList.remove('hidden');
      }
    });
    
    // 隐藏空的分组
    container.querySelectorAll('.bst-tags-group').forEach(group => {
      const visibleTags = group.querySelectorAll('.bst-tag:not(.hidden)');
      if (visibleTags.length === 0) {
        group.classList.add('hidden');
      } else {
        group.classList.remove('hidden');
        // 更新计数
        const countElement = group.querySelector('.bst-tags-group-count');
        if (countElement) {
          countElement.textContent = visibleTags.length;
        }
      }
    });
  }

  showAllGroups(container) {
    container.querySelectorAll('.bst-tag, .bst-tags-group').forEach(element => {
      element.classList.remove('hidden');
    });
    
    // 恢复原始计数
    container.querySelectorAll('.bst-tags-group').forEach(group => {
      const allTags = group.querySelectorAll('.bst-tag');
      const countElement = group.querySelector('.bst-tags-group-count');
      if (countElement) {
        countElement.textContent = allTags.length;
      }
    });
  }

  async quickCreateTag(tagName, container) {
    if (!this.tagsManager || !this.settings.allowQuickCreate) return;
    
    try {
      const newTag = await this.tagsManager.addTag({
        name: tagName,
        category: '未分组',
        favorite: false
      });
      
      // 重新渲染标签列表
      const tagsContainer = container.querySelector('.bst-tags-groups');
      if (tagsContainer) {
        tagsContainer.innerHTML = this.renderAllTags();
        this.bindEvents(container, this.onTagSelected);
      }
      
      // 自动选择新创建的标签
      const newTagButton = container.querySelector(`[data-tag-id="${newTag.id}"]`);
      if (newTagButton) {
        this.selectTag(newTagButton, container);
      }
      
      console.log('BST TagsRenderer: Quick created tag:', tagName);
    } catch (error) {
      console.error('BST TagsRenderer: Quick create failed:', error);
    }
  }

  groupTagsByCategory(tags) {
    const groups = {};
    tags.forEach(tag => {
      const category = tag.category || '未分组';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(tag);
    });
    return groups;
  }

  // 获取当前选中的标签
  getSelectedTag() {
    if (!this.selectedTag) return null;
    
    const allTags = this.tagsManager ? 
      this.tagsManager.getAllTags() : 
      this.currentTags;
    
    return allTags.find(tag => tag.id === this.selectedTag);
  }

  // 清除选择
  clearSelection(container) {
    this.selectedTag = null;
    if (container) {
      container.querySelectorAll('.bst-tag').forEach(tag => {
        tag.classList.remove('active');
      });
    }
  }

  // 获取标签组件样式
  getStyles() {
    return `
      .bst-tags-container {
        width: 100%;
      }
      
      .bst-tags-search {
        margin-bottom: 16px;
      }
      
      .bst-tags-search-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .bst-search-hint {
        font-size: 11px;
        color: #999;
        margin-top: 4px;
      }
      
      .bst-tags-groups {
        max-height: 300px;
        overflow-y: auto;
      }
      
      .bst-tags-group {
        margin-bottom: 12px;
      }
      
      .bst-tags-group.hidden {
        display: none;
      }
      
      .bst-tags-group-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        background: #f8f9fa;
        border-radius: 4px;
        font-size: 12px;
        color: #666;
        margin-bottom: 6px;
      }
      
      .bst-tags-group-header.collapsible {
        cursor: pointer;
      }
      
      .bst-tags-group-toggle {
        transition: transform 0.2s;
      }
      
      .bst-tags-group.collapsed .bst-tags-group-toggle {
        transform: rotate(-90deg);
      }
      
      .bst-tags-group.collapsed .bst-tags-list {
        display: none;
      }
      
      .bst-tags-list {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      
      .bst-tag {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        border: 1px solid #ddd;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
        position: relative;
      }
      
      .bst-tag.hidden {
        display: none;
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
      
      .bst-tag-name {
        font-weight: 500;
      }
      
      .bst-tag-hotkey {
        font-size: 10px;
        opacity: 0.8;
        background: rgba(0,0,0,0.1);
        padding: 1px 3px;
        border-radius: 2px;
      }
      
      .bst-tag.active .bst-tag-hotkey {
        background: rgba(255,255,255,0.2);
      }
      
      .bst-tags-quick-create {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #eee;
      }
      
      .bst-quick-create-hint {
        font-size: 12px;
        color: #666;
        text-align: center;
      }
      
      .bst-quick-create-btn {
        background: none;
        border: none;
        color: #ff6b6b;
        cursor: pointer;
        text-decoration: underline;
        font-size: 12px;
      }
    `;
  }
}

// 全局函数已移除，改为事件委托方式处理

// 创建全局实例
window.BST_TagsRenderer = new TagsRenderer();

console.log('BST: Tags renderer loaded');