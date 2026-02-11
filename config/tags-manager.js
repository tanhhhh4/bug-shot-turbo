// Bug Shot Turbo - 标签管理器
// 统一的标签数据读写和管理工具

class TagsManager {
  constructor() {
    this.tags = [];
    this.tagSettings = {};
    this.tagUsage = {};
    this.categories = [];
    this.isLoaded = false;
  }

  // 初始化和加载配置
  async init() {
    if (this.isLoaded) return;
    
    try {
      // 检查是否在扩展环境中
      if (typeof chrome === 'undefined' || !chrome.storage) {
        console.warn('BST TagsManager: Not in extension context, using defaults');
        await this.initWithDefaults();
        return;
      }

      await this.loadConfig();
      this.isLoaded = true;
      console.log('BST TagsManager: Initialized successfully');
    } catch (error) {
      console.error('BST TagsManager: Failed to initialize:', error);
      await this.initWithDefaults();
    }
  }

  // 加载配置
  async loadConfig() {
    try {
      const result = await chrome.storage.local.get([
        'tagsV2', 
        'tagSettings', 
        'tagUsage', 
        'categories',
        'tags' // 旧版本兼容
      ]);

    // 检查是否需要迁移
    if (!result.tagsV2 && result.tags) {
      console.log('BST TagsManager: Migrating from V1 tags');
      await this.migrateFromV1(result.tags);
      return;
    }

    // 加载或使用默认配置
    this.tags = result.tagsV2 || window.BST_TagsConfig.DEFAULT_TAGS_V2;
    this.tagSettings = { ...window.BST_TagsConfig.DEFAULT_TAG_SETTINGS, ...result.tagSettings };
    this.tagUsage = result.tagUsage || {};
    this.categories = result.categories || window.BST_TagsConfig.DEFAULT_CATEGORIES;

      // 确保数据完整性
      this.validateAndFixData();
    } catch (error) {
      console.error('BST TagsManager: Failed to load config from storage:', error);
      // 回退到默认配置
      this.tags = window.BST_TagsConfig?.DEFAULT_TAGS_V2 || [];
      this.tagSettings = window.BST_TagsConfig?.DEFAULT_TAG_SETTINGS || {};
      this.tagUsage = {};
      this.categories = window.BST_TagsConfig?.DEFAULT_CATEGORIES || [];
    }
  }

  // 从V1迁移
  async migrateFromV1(oldTags) {
    this.tags = window.BST_TagsConfig.migrateTagsFromV1(oldTags);
    this.tagSettings = window.BST_TagsConfig.DEFAULT_TAG_SETTINGS;
    this.tagUsage = {};
    this.categories = window.BST_TagsConfig.DEFAULT_CATEGORIES;

    // 保存迁移后的数据
    await this.saveConfig();
    
    console.log('BST TagsManager: Migration completed, saved', this.tags.length, 'tags');
  }

  // 使用默认配置初始化
  async initWithDefaults() {
    this.tags = [...window.BST_TagsConfig.DEFAULT_TAGS_V2];
    this.tagSettings = { ...window.BST_TagsConfig.DEFAULT_TAG_SETTINGS };
    this.tagUsage = {};
    this.categories = [...window.BST_TagsConfig.DEFAULT_CATEGORIES];
    
    await this.saveConfig();
    this.isLoaded = true;
    console.log('BST TagsManager: Initialized with defaults');
  }

  // 验证和修复数据
  validateAndFixData() {
    // 验证标签数据
    this.tags = this.tags.filter(tag => window.BST_TagsConfig.validateTag(tag));
    
    // 确保每个标签都有必要字段
    this.tags.forEach(tag => {
      if (!tag.category) tag.category = '未分组';
      if (!tag.color) tag.color = window.BST_TagsConfig.getNextColor(this.tags);
      if (!tag.createdAt) tag.createdAt = Date.now();
      if (!tag.updatedAt) tag.updatedAt = Date.now();
      if (tag.favorite === undefined) tag.favorite = false;
      if (!tag.hotkey) tag.hotkey = '';
    });

    // 清理无效的使用统计
    const validTagIds = new Set(this.tags.map(t => t.id));
    Object.keys(this.tagUsage).forEach(tagId => {
      if (!validTagIds.has(tagId)) {
        delete this.tagUsage[tagId];
      }
    });
  }

  // 保存配置
  async saveConfig() {
    try {
      // 检查chrome.storage是否可用
      if (!chrome?.storage?.local) {
        console.warn('BST TagsManager: Chrome storage not available, skipping save');
        return;
      }

      await chrome.storage.local.set({
        tagsV2: this.tags,
        tagSettings: this.tagSettings,
        tagUsage: this.tagUsage,
        categories: this.categories
      });
      console.log('BST TagsManager: Config saved successfully');
    } catch (error) {
      console.error('BST TagsManager: Failed to save config:', error);
      // 不抛出错误，避免阻塞其他功能
    }
  }

  // 获取所有标签
  getAllTags() {
    return [...this.tags];
  }

  // 根据ID获取标签
  getTagById(id) {
    return this.tags.find(tag => tag.id === id);
  }

  // 获取收藏标签
  getFavoriteTags() {
    return this.tags.filter(tag => tag.favorite);
  }

  // 获取最近使用标签
  getRecentTags(maxCount = null) {
    const count = maxCount || this.tagSettings.maxRecent || 8;
    return window.BST_TagsConfig.getRecentTags(this.tags, this.tagUsage, count);
  }

  // 按分类获取标签
  getTagsByCategory() {
    return window.BST_TagsConfig.groupTagsByCategory(this.tags);
  }

  // 搜索标签
  searchTags(searchTerm) {
    return window.BST_TagsConfig.filterTags(this.tags, searchTerm);
  }

  // 添加新标签
  async addTag(tagData) {
    const newTag = {
      id: window.BST_TagsConfig.generateTagId(),
      name: tagData.name.trim(),
      category: tagData.category || '未分组',
      color: tagData.color || window.BST_TagsConfig.getNextColor(this.tags),
      hotkey: tagData.hotkey || '',
      favorite: tagData.favorite || false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // 验证标签名不重复
    if (this.tags.some(tag => tag.name === newTag.name && tag.category === newTag.category)) {
      throw new Error('该分类下已存在同名标签');
    }

    this.tags.push(newTag);
    await this.saveConfig();
    
    console.log('BST TagsManager: Added new tag:', newTag.name);
    return newTag;
  }

  // 更新标签
  async updateTag(tagId, updates) {
    const tagIndex = this.tags.findIndex(tag => tag.id === tagId);
    if (tagIndex === -1) {
      throw new Error('标签不存在');
    }

    const oldTag = this.tags[tagIndex];
    const updatedTag = {
      ...oldTag,
      ...updates,
      id: tagId, // 确保ID不被修改
      updatedAt: Date.now()
    };

    // 验证更新后的标签名不重复
    if (updates.name && this.tags.some(tag => 
      tag.id !== tagId && 
      tag.name === updates.name && 
      tag.category === (updates.category || oldTag.category)
    )) {
      throw new Error('该分类下已存在同名标签');
    }

    this.tags[tagIndex] = updatedTag;
    await this.saveConfig();
    
    console.log('BST TagsManager: Updated tag:', tagId);
    return updatedTag;
  }

  // 删除标签
  async deleteTag(tagId) {
    const tagIndex = this.tags.findIndex(tag => tag.id === tagId);
    if (tagIndex === -1) {
      throw new Error('标签不存在');
    }

    const deletedTag = this.tags[tagIndex];
    this.tags.splice(tagIndex, 1);
    
    // 清理使用统计
    delete this.tagUsage[tagId];
    
    await this.saveConfig();
    
    console.log('BST TagsManager: Deleted tag:', deletedTag.name);
    return deletedTag;
  }

  // 记录标签使用
  async recordTagUsage(tagId) {
    if (!this.tagUsage[tagId]) {
      this.tagUsage[tagId] = { count: 0, lastUsedAt: 0 };
    }
    
    this.tagUsage[tagId].count++;
    this.tagUsage[tagId].lastUsedAt = Date.now();
    
    // 节流保存：不立即保存，等待批量提交
    this._pendingUsageUpdate = true;
  }

  // 批量保存使用统计
  async flushUsageStats() {
    if (!this._pendingUsageUpdate) return;
    
    try {
      await chrome.storage.local.set({ tagUsage: this.tagUsage });
      this._pendingUsageUpdate = false;
      console.log('BST TagsManager: Usage stats saved');
    } catch (error) {
      console.error('BST TagsManager: Failed to save usage stats:', error);
    }
  }

  // 获取标签使用统计
  getTagUsageStats() {
    return { ...this.tagUsage };
  }

  // 导出配置
  exportConfig() {
    return {
      tagsV2: this.tags,
      tagSettings: this.tagSettings,
      categories: this.categories,
      exportTime: new Date().toISOString(),
      version: '2.0'
    };
  }

  // 导入配置
  async importConfig(configData) {
    try {
      if (configData.version === '2.0' && configData.tagsV2) {
        this.tags = configData.tagsV2.filter(tag => window.BST_TagsConfig.validateTag(tag));
        this.tagSettings = { ...this.tagSettings, ...configData.tagSettings };
        this.categories = configData.categories || this.categories;
      } else {
        throw new Error('不支持的配置文件格式');
      }

      this.validateAndFixData();
      await this.saveConfig();
      
      console.log('BST TagsManager: Config imported successfully');
      return { success: true, imported: this.tags.length };
    } catch (error) {
      console.error('BST TagsManager: Import failed:', error);
      return { success: false, error: error.message };
    }
  }

  // 重置为默认配置
  async resetToDefaults() {
    this.tags = [...window.BST_TagsConfig.DEFAULT_TAGS_V2];
    this.tagSettings = { ...window.BST_TagsConfig.DEFAULT_TAG_SETTINGS };
    this.tagUsage = {};
    this.categories = [...window.BST_TagsConfig.DEFAULT_CATEGORIES];
    
    await this.saveConfig();
    console.log('BST TagsManager: Reset to defaults');
  }

  // 获取设置
  getSettings() {
    return { ...this.tagSettings };
  }

  // 更新设置
  async updateSettings(newSettings) {
    this.tagSettings = { ...this.tagSettings, ...newSettings };
    await this.saveConfig();
    console.log('BST TagsManager: Settings updated');
  }
}

// 创建全局实例
window.BST_TagsManager = new TagsManager();

console.log('BST: Tags manager loaded');