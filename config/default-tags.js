// Bug Shot Turbo - 默认标签配置
// 可扩展标签体系的默认数据和工具函数

// 默认标签体系
const DEFAULT_TAGS_V2 = [
  // 功能类
  { id: 'func_001', name: '按钮失效', category: '功能', color: '#ff6b6b', hotkey: '1', favorite: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'func_002', name: '表单校验', category: '功能', color: '#ff6b6b', hotkey: '2', favorite: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'func_003', name: '权限错误', category: '功能', color: '#ff6b6b', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'func_004', name: '跳转异常', category: '功能', color: '#ff6b6b', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'func_005', name: '功能缺失', category: '功能', color: '#ff6b6b', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },

  // 界面样式类
  { id: 'ui_001', name: '样式错位', category: '界面样式', color: '#4ecdc4', hotkey: '3', favorite: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ui_002', name: '遮挡层级', category: '界面样式', color: '#4ecdc4', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ui_003', name: '适配问题', category: '界面样式', color: '#4ecdc4', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ui_004', name: '图标缺失', category: '界面样式', color: '#4ecdc4', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ui_005', name: '排版混乱', category: '界面样式', color: '#4ecdc4', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },

  // 交互体验类
  { id: 'ux_001', name: '点击无响应', category: '交互体验', color: '#45b7d1', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ux_002', name: '提示不清晰', category: '交互体验', color: '#45b7d1', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ux_003', name: '流程阻断', category: '交互体验', color: '#45b7d1', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'ux_004', name: '可用性差', category: '交互体验', color: '#45b7d1', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },

  // 性能类
  { id: 'perf_001', name: '响应慢', category: '性能', color: '#f39c12', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'perf_002', name: '页面卡顿', category: '性能', color: '#f39c12', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'perf_003', name: '内存泄漏', category: '性能', color: '#f39c12', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'perf_004', name: '白屏', category: '性能', color: '#f39c12', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },

  // 兼容性类
  { id: 'compat_001', name: '浏览器兼容', category: '兼容性', color: '#9b59b6', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'compat_002', name: '移动端适配', category: '兼容性', color: '#9b59b6', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'compat_003', name: '分辨率适配', category: '兼容性', color: '#9b59b6', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },

  // 数据与接口类
  { id: 'data_001', name: '接口报错', category: '数据与接口', color: '#e74c3c', hotkey: '4', favorite: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'data_002', name: '数据错乱', category: '数据与接口', color: '#e74c3c', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'data_003', name: '字段缺失', category: '数据与接口', color: '#e74c3c', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'data_004', name: '请求超时', category: '数据与接口', color: '#e74c3c', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },

  // 文案类
  { id: 'text_001', name: '错别字', category: '文案', color: '#2ecc71', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'text_002', name: '翻译错误', category: '文案', color: '#2ecc71', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'text_003', name: '术语不一致', category: '文案', color: '#2ecc71', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },

  // 其他类
  { id: 'other_001', name: '其他', category: '其他', color: '#95a5a6', hotkey: '5', favorite: true, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'other_002', name: '复现困难', category: '其他', color: '#95a5a6', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() },
  { id: 'other_003', name: '偶现问题', category: '其他', color: '#95a5a6', hotkey: '', favorite: false, createdAt: Date.now(), updatedAt: Date.now() }
];

// 默认标签设置
const DEFAULT_TAG_SETTINGS = {
  maxRecent: 8,                    // 最近使用显示数量
  showCategories: true,            // 是否启用分类视图
  showColors: true,                // 是否显示标签色
  allowQuickCreate: true,          // 是否允许快速创建标签
  sortBy: 'usage',                 // 排序方式: usage|name|category|recent
  compactView: false               // 紧凑视图模式
};

// 默认分类配置
const DEFAULT_CATEGORIES = [
  { id: 'func', name: '功能', color: '#ff6b6b', order: 1 },
  { id: 'ui', name: '界面样式', color: '#4ecdc4', order: 2 },
  { id: 'ux', name: '交互体验', color: '#45b7d1', order: 3 },
  { id: 'perf', name: '性能', color: '#f39c12', order: 4 },
  { id: 'compat', name: '兼容性', color: '#9b59b6', order: 5 },
  { id: 'data', name: '数据与接口', color: '#e74c3c', order: 6 },
  { id: 'text', name: '文案', color: '#2ecc71', order: 7 },
  { id: 'other', name: '其他', color: '#95a5a6', order: 8 }
];

// 颜色调色板
const COLOR_PALETTE = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#f39c12', '#9b59b6', 
  '#e74c3c', '#2ecc71', '#95a5a6', '#3498db', '#e67e22',
  '#1abc9c', '#34495e', '#f1c40f', '#8e44ad', '#27ae60'
];

// 工具函数：生成唯一ID
function generateTagId() {
  return 'tag_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 工具函数：获取下一个可用颜色
function getNextColor(existingTags = []) {
  const usedColors = existingTags.map(tag => tag.color);
  return COLOR_PALETTE.find(color => !usedColors.includes(color)) || COLOR_PALETTE[0];
}

// 工具函数：数据迁移 - 从旧格式到新格式
function migrateTagsFromV1(oldTags = []) {
  if (!Array.isArray(oldTags) || oldTags.length === 0) {
    return DEFAULT_TAGS_V2;
  }

  const migratedTags = oldTags.map((tagName, index) => ({
    id: generateTagId(),
    name: tagName,
    category: '未分组',
    color: COLOR_PALETTE[index % COLOR_PALETTE.length],
    hotkey: index < 9 ? String(index + 1) : '',
    favorite: index < 5, // 前5个设为收藏
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));

  // 合并默认标签（避免重复）
  const existingNames = migratedTags.map(t => t.name);
  const additionalDefaults = DEFAULT_TAGS_V2.filter(t => !existingNames.includes(t.name));
  
  return [...migratedTags, ...additionalDefaults];
}

// 工具函数：验证标签数据
function validateTag(tag) {
  if (!tag || typeof tag !== 'object') return false;
  if (!tag.name || typeof tag.name !== 'string' || tag.name.trim().length === 0) return false;
  if (!tag.id || typeof tag.id !== 'string') return false;
  return true;
}

// 工具函数：标签搜索过滤
function filterTags(tags, searchTerm) {
  if (!searchTerm || searchTerm.trim().length === 0) return tags;
  
  const term = searchTerm.toLowerCase().trim();
  return tags.filter(tag => 
    tag.name.toLowerCase().includes(term) ||
    tag.category.toLowerCase().includes(term)
  );
}

// 工具函数：按分类分组标签
function groupTagsByCategory(tags) {
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

// 工具函数：获取最近使用的标签
function getRecentTags(tags, tagUsage, maxCount = 8) {
  if (!tagUsage || Object.keys(tagUsage).length === 0) {
    return tags.filter(tag => tag.favorite).slice(0, maxCount);
  }

  const tagsWithUsage = tags
    .map(tag => ({
      ...tag,
      usage: tagUsage[tag.id] || { count: 0, lastUsedAt: 0 }
    }))
    .filter(tag => tag.usage.count > 0)
    .sort((a, b) => b.usage.lastUsedAt - a.usage.lastUsedAt);

  return tagsWithUsage.slice(0, maxCount);
}

// 导出
window.BST_TagsConfig = {
  DEFAULT_TAGS_V2,
  DEFAULT_TAG_SETTINGS,
  DEFAULT_CATEGORIES,
  COLOR_PALETTE,
  generateTagId,
  getNextColor,
  migrateTagsFromV1,
  validateTag,
  filterTags,
  groupTagsByCategory,
  getRecentTags
};

console.log('BST: Default tags configuration loaded');