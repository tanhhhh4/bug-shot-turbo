// Bug Shot Turbo - Options脚本 - 可扩展标签版本

class OptionsManager {
  constructor() {
    this.config = null;
    this.currentEditingTag = null;
    this.selectedTags = new Set();
    this.searchTimeout = null;
    this.init();
  }

  async init() {
    console.log('BST Options: Initializing...');
    
    // 等待标签管理器初始化
    await this.initTagsManager();
    
    // 加载当前配置
    await this.loadConfig();
    
    // 显示配置
    this.displayConfig();
    
    // 绑定事件
    this.bindEvents();
    
    console.log('BST Options: Initialized successfully');
  }

  async initTagsManager() {
    if (window.BST_TagsManager) {
      await window.BST_TagsManager.init();
    } else {
      console.error('BST Options: TagsManager not found');
    }
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['config']);
      this.config = result.config || this.getDefaultConfig();
    } catch (error) {
      console.error('Load config error:', error);
      this.config = this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      tapd: {
        projectIds: ["47910877"],
        domains: ["tapd.cn", "tapd.tencent.com"]
      },
      selectors: {
        title: "input#BugTitle, input[name='data[Bug][title]']",
        descIframe: "iframe#BugDescription_ifr, iframe[id*='Description']",
        descBody: "body#tinymce, body.mce-content-body"
      },
      templates: {
        title: "${issue}（${pathLast1}）",
        description: "【问题】${firstTag} - ${issue}\n【页面】${pageURL}\n【时间】${timestamp}\n【期望】<在此补充>\n【实际】<在此补充>\n（截图：粘贴后见下）"
      },
      tags: ["按钮失效", "表单校验", "样式错位", "接口报错", "其他"]
    };
  }

  displayConfig() {
    // 显示TAPD项目配置
    this.displayTapdConfig();
    
    // 显示标签管理
    this.displayTagsManagement();
  }

  displayTapdConfig() {
    document.getElementById('tapdProjectIds').value = this.config.tapd.projectIds.join(', ');
    document.getElementById('tapdDomains').value = this.config.tapd.domains.join(', ');
    document.getElementById('titleSelector').value = this.config.selectors.title;
    document.getElementById('descIframeSelector').value = this.config.selectors.descIframe;
    document.getElementById('descBodySelector').value = this.config.selectors.descBody;
    document.getElementById('titleTemplate').value = this.config.templates.title;
    document.getElementById('descTemplate').value = this.config.templates.description;
  }

  async displayTagsManagement() {
    if (!window.BST_TagsManager) return;

    // 显示标签设置
    const settings = window.BST_TagsManager.getSettings();
    document.getElementById('maxRecent').value = settings.maxRecent || 8;
    document.getElementById('showCategories').checked = settings.showCategories !== false;
    document.getElementById('showColors').checked = settings.showColors !== false;
    document.getElementById('allowQuickCreate').checked = settings.allowQuickCreate !== false;

    // 显示分类列表
    await this.renderCategories();

    // 显示标签列表
    await this.renderTagsList();

    // 更新统计信息
    this.updateStats();
  }

  async renderCategories() {
    const categoriesList = document.getElementById('categoriesList');
    const categories = window.BST_TagsManager.categories || [];
    
    categoriesList.innerHTML = categories.map(category => `
      <div class="category-chip" data-category-id="${category.id}">
        <div class="color-dot" style="background: ${category.color}"></div>
        <span>${category.name}</span>
        <button class="edit-btn" onclick="editCategory('${category.id}')">✏️</button>
      </div>
    `).join('');
  }

  async renderTagsList(searchTerm = '', sortBy = 'category') {
    const tagsList = document.getElementById('tagsList');
    const tags = window.BST_TagsManager.getAllTags();
    const tagUsage = window.BST_TagsManager.getTagUsageStats();

    let filteredTags = tags;
    
    // 搜索过滤
    if (searchTerm) {
      filteredTags = window.BST_TagsManager.searchTags(searchTerm);
    }

    // 排序
    switch (sortBy) {
      case 'usage':
        filteredTags.sort((a, b) => (tagUsage[b.id]?.count || 0) - (tagUsage[a.id]?.count || 0));
        break;
      case 'name':
        filteredTags.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        filteredTags.sort((a, b) => (tagUsage[b.id]?.lastUsedAt || 0) - (tagUsage[a.id]?.lastUsedAt || 0));
        break;
      case 'category':
      default:
        filteredTags.sort((a, b) => {
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.name.localeCompare(b.name);
        });
        break;
    }

    tagsList.innerHTML = filteredTags.map(tag => {
      const usage = tagUsage[tag.id] || { count: 0, lastUsedAt: 0 };
      const isSelected = this.selectedTags.has(tag.id);
      
      return `
        <div class="tag-row ${isSelected ? 'selected' : ''}" data-tag-id="${tag.id}">
          <input type="checkbox" class="tag-checkbox" ${isSelected ? 'checked' : ''}>
          <div class="tag-info">
            <div class="tag-color" style="background: ${tag.color}"></div>
            <span class="tag-name">${tag.name}</span>
            <span class="tag-category">${tag.category}</span>
            ${tag.hotkey ? `<span class="tag-hotkey">${tag.hotkey}</span>` : ''}
            ${tag.favorite ? '<span class="tag-favorite">★</span>' : ''}
          </div>
          <div class="tag-stats">
            <span>使用 ${usage.count}</span>
            ${usage.lastUsedAt ? `<span>${this.formatDate(usage.lastUsedAt)}</span>` : ''}
          </div>
          <div class="tag-actions">
            <button class="tag-action-btn" onclick="optionsManager.editTag('${tag.id}')" title="编辑">✏️</button>
            <button class="tag-action-btn" onclick="optionsManager.duplicateTag('${tag.id}')" title="复制">📋</button>
          </div>
        </div>
      `;
    }).join('');
  }

  formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  updateStats() {
    const tags = window.BST_TagsManager.getAllTags();
    const categories = new Set(tags.map(tag => tag.category));
    
    document.getElementById('tagsCount').textContent = `总计: ${tags.length} 个标签`;
    document.getElementById('categoriesCount').textContent = `分类: ${categories.size} 个`;
  }

  bindEvents() {
    // Tab切换
    this.bindTabNavigation();
    
    // 保存配置按钮
    document.getElementById('saveOptions').addEventListener('click', () => {
      this.saveConfig();
    });
    
    // 重置按钮
    const resetBtn = document.getElementById('resetOptions');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetConfig();
      });
    }

    // 数据管理按钮
    document.getElementById('exportData').addEventListener('click', () => {
      this.exportConfig();
    });

    document.getElementById('importData').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('resetDefaults').addEventListener('click', () => {
      this.resetToDefaults();
    });

    document.getElementById('clearHistory').addEventListener('click', () => {
      this.clearHistory();
    });

    // 文件导入
    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.importConfig(e.target.files[0]);
    });

    // 标签管理事件
    this.bindTagsEvents();
  }
  
  bindTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.option-section');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetSection = tab.dataset.section;
        
        // 移除所有活动状态
        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        // 添加活动状态
        tab.classList.add('active');
        const section = document.getElementById(`${targetSection}-section`);
        if (section) {
          section.classList.add('active');
        }
        
        // 保存当前标签页到localStorage
        localStorage.setItem('bst-active-tab', targetSection);
      });
    });
    
    // 恢复上次的标签页
    const lastTab = localStorage.getItem('bst-active-tab');
    if (lastTab) {
      const tab = document.querySelector(`[data-section="${lastTab}"]`);
      if (tab) {
        tab.click();
      }
    }
  }

  bindTagsEvents() {
    // 搜索标签
    document.getElementById('tagSearch').addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.renderTagsList(e.target.value, document.getElementById('tagsSortBy').value);
      }, 300);
    });

    // 排序变化
    document.getElementById('tagsSortBy').addEventListener('change', (e) => {
      this.renderTagsList(document.getElementById('tagSearch').value, e.target.value);
    });

    // 新增标签按钮
    document.getElementById('addTagBtn').addEventListener('click', () => {
      this.showTagEditModal();
    });

    // 新增分类按钮
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
      this.showCategoryEditModal();
    });

    // 标签列表事件代理
    document.getElementById('tagsList').addEventListener('click', (e) => {
      const tagRow = e.target.closest('.tag-row');
      if (!tagRow) return;

      const tagId = tagRow.dataset.tagId;
      
      if (e.target.classList.contains('tag-checkbox')) {
        this.toggleTagSelection(tagId);
      } else if (!e.target.closest('.tag-actions')) {
        // 点击行选择/取消选择
        this.toggleTagSelection(tagId);
      }
    });

    // 批量操作按钮
    document.getElementById('selectAllTags').addEventListener('click', () => {
      this.selectAllTags();
    });

    document.getElementById('deleteSelectedTags').addEventListener('click', () => {
      this.deleteSelectedTags();
    });

    document.getElementById('exportSelectedTags').addEventListener('click', () => {
      this.exportSelectedTags();
    });

    // 模态框事件
    document.getElementById('closeModal').addEventListener('click', () => {
      this.hideTagEditModal();
    });

    document.getElementById('cancelTagBtn').addEventListener('click', () => {
      this.hideTagEditModal();
    });

    document.getElementById('saveTagBtn').addEventListener('click', () => {
      this.saveTag();
    });

    document.getElementById('deleteTagBtn').addEventListener('click', () => {
      this.deleteCurrentTag();
    });

    // 标签设置变化
    ['maxRecent', 'showCategories', 'showColors', 'allowQuickCreate'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => {
        this.saveTagSettings();
      });
    });

    // 颜色预设点击
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('color-preset')) {
        this.selectColorPreset(e.target.dataset.color);
      }
    });
  }

  toggleTagSelection(tagId) {
    const checkbox = document.querySelector(`[data-tag-id="${tagId}"] .tag-checkbox`);
    const row = document.querySelector(`[data-tag-id="${tagId}"]`);
    
    if (this.selectedTags.has(tagId)) {
      this.selectedTags.delete(tagId);
      checkbox.checked = false;
      row.classList.remove('selected');
    } else {
      this.selectedTags.add(tagId);
      checkbox.checked = true;
      row.classList.add('selected');
    }
    
    this.updateBatchButtons();
  }

  selectAllTags() {
    const allRows = document.querySelectorAll('.tag-row');
    const allSelected = allRows.length > 0 && this.selectedTags.size === allRows.length;
    
    if (allSelected) {
      // 取消全选
      this.selectedTags.clear();
      allRows.forEach(row => {
        row.classList.remove('selected');
        row.querySelector('.tag-checkbox').checked = false;
      });
    } else {
      // 全选
      allRows.forEach(row => {
        const tagId = row.dataset.tagId;
        this.selectedTags.add(tagId);
        row.classList.add('selected');
        row.querySelector('.tag-checkbox').checked = true;
      });
    }
    
    this.updateBatchButtons();
  }

  updateBatchButtons() {
    const hasSelected = this.selectedTags.size > 0;
    document.getElementById('deleteSelectedTags').disabled = !hasSelected;
    document.getElementById('exportSelectedTags').disabled = !hasSelected;
    
    const selectAllBtn = document.getElementById('selectAllTags');
    const allRows = document.querySelectorAll('.tag-row');
    selectAllBtn.textContent = this.selectedTags.size === allRows.length ? '取消全选' : '全选';
  }

  showTagEditModal(tagId = null) {
    this.currentEditingTag = tagId;
    const modal = document.getElementById('tagEditModal');
    const title = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deleteTagBtn');
    
    if (tagId) {
      const tag = window.BST_TagsManager.getTagById(tagId);
      title.textContent = '编辑标签';
      deleteBtn.style.display = 'block';
      
      document.getElementById('tagName').value = tag.name;
      document.getElementById('tagCategory').value = tag.category;
      document.getElementById('tagColor').value = tag.color;
      document.getElementById('tagHotkey').value = tag.hotkey || '';
      document.getElementById('tagFavorite').checked = tag.favorite;
    } else {
      title.textContent = '新增标签';
      deleteBtn.style.display = 'none';
      
      document.getElementById('tagName').value = '';
      document.getElementById('tagCategory').value = '功能';
      document.getElementById('tagColor').value = window.BST_TagsConfig.getNextColor(window.BST_TagsManager.getAllTags());
      document.getElementById('tagHotkey').value = '';
      document.getElementById('tagFavorite').checked = false;
    }

    this.renderCategoryOptions();
    this.renderColorPresets();
    modal.classList.add('show');
  }

  hideTagEditModal() {
    const modal = document.getElementById('tagEditModal');
    modal.classList.remove('show');
    this.currentEditingTag = null;
  }

  renderCategoryOptions() {
    const select = document.getElementById('tagCategory');
    const categories = window.BST_TagsManager.categories || [];
    
    select.innerHTML = categories.map(category => 
      `<option value="${category.name}">${category.name}</option>`
    ).join('');
  }

  renderColorPresets() {
    const container = document.getElementById('colorPresets');
    const colors = window.BST_TagsConfig.COLOR_PALETTE;
    
    container.innerHTML = colors.map(color => 
      `<div class="color-preset" style="background: ${color}" data-color="${color}"></div>`
    ).join('');
  }

  selectColorPreset(color) {
    document.getElementById('tagColor').value = color;
    
    // 更新选中状态
    document.querySelectorAll('.color-preset').forEach(preset => {
      preset.classList.remove('selected');
    });
    document.querySelector(`[data-color="${color}"]`).classList.add('selected');
  }

  async saveTag() {
    const name = document.getElementById('tagName').value.trim();
    const category = document.getElementById('tagCategory').value;
    const color = document.getElementById('tagColor').value;
    const hotkey = document.getElementById('tagHotkey').value.trim();
    const favorite = document.getElementById('tagFavorite').checked;

    if (!name) {
      alert('请输入标签名称');
      return;
    }

    try {
      const tagData = { name, category, color, hotkey, favorite };
      
      if (this.currentEditingTag) {
        await window.BST_TagsManager.updateTag(this.currentEditingTag, tagData);
      } else {
        await window.BST_TagsManager.addTag(tagData);
      }

      this.hideTagEditModal();
      await this.displayTagsManagement();
      this.showStatus('标签保存成功', 'success');
    } catch (error) {
      alert('保存失败: ' + error.message);
    }
  }

  async deleteCurrentTag() {
    if (!this.currentEditingTag) return;
    
    if (confirm('确定要删除这个标签吗？')) {
      try {
        await window.BST_TagsManager.deleteTag(this.currentEditingTag);
        this.hideTagEditModal();
        await this.displayTagsManagement();
        this.showStatus('标签删除成功', 'success');
      } catch (error) {
        alert('删除失败: ' + error.message);
      }
    }
  }

  async editTag(tagId) {
    this.showTagEditModal(tagId);
  }

  async duplicateTag(tagId) {
    const tag = window.BST_TagsManager.getTagById(tagId);
    if (!tag) return;

    try {
      const newTag = {
        ...tag,
        name: tag.name + ' (副本)',
        hotkey: '', // 清空快捷键避免冲突
        favorite: false
      };
      delete newTag.id;
      
      await window.BST_TagsManager.addTag(newTag);
      await this.displayTagsManagement();
      this.showStatus('标签复制成功', 'success');
    } catch (error) {
      alert('复制失败: ' + error.message);
    }
  }

  async deleteSelectedTags() {
    if (this.selectedTags.size === 0) return;
    
    if (confirm(`确定要删除选中的 ${this.selectedTags.size} 个标签吗？`)) {
      try {
        const deletePromises = Array.from(this.selectedTags).map(tagId => 
          window.BST_TagsManager.deleteTag(tagId)
        );
        
        await Promise.all(deletePromises);
        this.selectedTags.clear();
        await this.displayTagsManagement();
        this.showStatus('批量删除成功', 'success');
      } catch (error) {
        alert('批量删除失败: ' + error.message);
      }
    }
  }

  exportSelectedTags() {
    if (this.selectedTags.size === 0) return;
    
    const allTags = window.BST_TagsManager.getAllTags();
    const selectedTagsData = allTags.filter(tag => this.selectedTags.has(tag.id));
    
    const exportData = {
      tagsV2: selectedTagsData,
      exportTime: new Date().toISOString(),
      version: '2.0',
      type: 'partial'
    };

    this.downloadJSON(exportData, `bug-shot-turbo-tags-${new Date().toISOString().split('T')[0]}.json`);
  }

  async saveTagSettings() {
    const settings = {
      maxRecent: parseInt(document.getElementById('maxRecent').value),
      showCategories: document.getElementById('showCategories').checked,
      showColors: document.getElementById('showColors').checked,
      allowQuickCreate: document.getElementById('allowQuickCreate').checked
    };

    try {
      await window.BST_TagsManager.updateSettings(settings);
      this.showStatus('设置保存成功', 'success');
    } catch (error) {
      console.error('Save tag settings error:', error);
    }
  }

  async saveConfig() {
    try {
      // 显示加载状态
      const saveBtn = document.getElementById('saveOptions');
      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span class="loading"></span> 保存中...';
      saveBtn.disabled = true;
      
      const newConfig = {
        tapd: {
          projectIds: document.getElementById('tapdProjectIds').value.split(',').map(s => s.trim()).filter(s => s),
          domains: document.getElementById('tapdDomains').value.split(',').map(s => s.trim()).filter(s => s)
        },
        selectors: {
          title: document.getElementById('titleSelector').value,
          descIframe: document.getElementById('descIframeSelector').value,
          descBody: document.getElementById('descBodySelector').value
        },
        templates: {
          title: document.getElementById('titleTemplate').value,
          description: document.getElementById('descTemplate').value
        }
      };

      await chrome.storage.local.set({ config: newConfig });
      this.config = newConfig;
      
      // 恢复按钮状态
      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }, 1000);
      
      this.showStatus('✅ 配置已成功保存', 'success');
    } catch (error) {
      console.error('Save config error:', error);
      this.showStatus('❌ 保存失败: ' + error.message, 'error');
      
      // 恢复按钮状态
      const saveBtn = document.getElementById('saveOptions');
      saveBtn.innerHTML = '<span class="btn-icon">💾</span><span class="btn-text">保存设置</span>';
      saveBtn.disabled = false;
    }
  }
  
  async resetConfig() {
    if (confirm('确定要重置所有设置为默认值吗？\n\n此操作将清除所有自定义配置。')) {
      try {
        this.config = this.getDefaultConfig();
        await chrome.storage.local.set({ config: this.config });
        this.displayConfig();
        this.showStatus('✅ 设置已重置为默认值', 'success');
      } catch (error) {
        console.error('Reset config error:', error);
        this.showStatus('❌ 重置失败: ' + error.message, 'error');
      }
    }
  }

  exportConfig() {
    const exportData = {
      config: this.config,
      ...window.BST_TagsManager.exportConfig(),
      exportTime: new Date().toISOString()
    };

    this.downloadJSON(exportData, `bug-shot-turbo-config-${new Date().toISOString().split('T')[0]}.json`);
  }

  async importConfig(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.config) {
        this.config = data.config;
        await chrome.storage.local.set({ config: this.config });
      }

      if (data.tagsV2) {
        const result = await window.BST_TagsManager.importConfig(data);
        if (result.success) {
          this.showStatus(`导入成功，共导入 ${result.imported} 个标签`, 'success');
        } else {
          throw new Error(result.error);
        }
      }

      this.displayConfig();
    } catch (error) {
      console.error('Import error:', error);
      this.showStatus('导入失败: ' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    if (confirm('确定要恢复默认配置吗？这将清除所有自定义设置。')) {
      try {
        this.config = this.getDefaultConfig();
        await chrome.storage.local.set({ config: this.config });
        await window.BST_TagsManager.resetToDefaults();
        
        this.displayConfig();
        this.showStatus('已恢复默认配置', 'success');
      } catch (error) {
        console.error('Reset error:', error);
        this.showStatus('重置失败', 'error');
      }
    }
  }

  async clearHistory() {
    if (confirm('确定要清除所有历史记录吗？')) {
      try {
        await chrome.storage.local.remove(['history', 'lastPackage', 'tagUsage']);
        this.showStatus('历史记录已清除', 'success');
        await this.displayTagsManagement(); // 刷新使用统计
      } catch (error) {
        console.error('Clear history error:', error);
        this.showStatus('清除失败', 'error');
      }
    }
  }

  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  showStatus(message, type = 'success') {
    const status = document.getElementById('saveStatus');
    status.innerHTML = message;
    status.className = `save-status ${type} show`;
    
    // 自动隐藏
    clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => {
      status.classList.remove('show');
    }, 5000);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  window.optionsManager = new OptionsManager();
});

console.log('BST: Options script loaded');