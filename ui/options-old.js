// Bug Shot Turbo - Options脚本

class OptionsManager {
  constructor() {
    this.config = null;
    this.init();
  }

  async init() {
    // 加载当前配置
    await this.loadConfig();
    
    // 显示配置
    this.displayConfig();
    
    // 绑定事件
    this.bindEvents();
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
    if (this.config.tapd) {
      document.getElementById('tapdProjectIds').value = this.config.tapd.projectIds ? this.config.tapd.projectIds.join(', ') : '47910877';
      document.getElementById('tapdDomains').value = this.config.tapd.domains ? this.config.tapd.domains.join(', ') : 'tapd.cn, tapd.tencent.com';
    }
    
    // 显示选择器配置
    document.getElementById('titleSelector').value = this.config.selectors.title;
    document.getElementById('descIframeSelector').value = this.config.selectors.descIframe;
    document.getElementById('descBodySelector').value = this.config.selectors.descBody;
    
    // 显示模板配置
    document.getElementById('titleTemplate').value = this.config.templates.title;
    document.getElementById('descTemplate').value = this.config.templates.description;
    
    // 显示标签配置
    const tagInputs = document.querySelectorAll('.tag-input');
    this.config.tags.forEach((tag, index) => {
      if (tagInputs[index]) {
        tagInputs[index].value = tag;
      }
    });
  }

  bindEvents() {
    // 保存设置
    document.getElementById('saveOptions').addEventListener('click', () => {
      this.saveConfig();
    });
    
    // 导出配置
    document.getElementById('exportData').addEventListener('click', () => {
      this.exportConfig();
    });
    
    // 导入配置
    document.getElementById('importData').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    
    // 文件选择
    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.importConfig(e.target.files[0]);
    });
    
    // 恢复默认
    document.getElementById('resetDefaults').addEventListener('click', () => {
      if (confirm('确定要恢复默认设置吗？')) {
        this.resetToDefaults();
      }
    });
    
    // 清除历史
    document.getElementById('clearHistory').addEventListener('click', () => {
      if (confirm('确定要清除所有历史记录吗？此操作不可恢复。')) {
        this.clearHistory();
      }
    });
  }

  async saveConfig() {
    try {
      // 收集TAPD项目配置
      if (!this.config.tapd) {
        this.config.tapd = {};
      }
      const projectIdsStr = document.getElementById('tapdProjectIds').value;
      const domainsStr = document.getElementById('tapdDomains').value;
      
      this.config.tapd.projectIds = projectIdsStr
        .split(',')
        .map(id => id.trim())
        .filter(id => id);
      
      this.config.tapd.domains = domainsStr
        .split(',')
        .map(domain => domain.trim())
        .filter(domain => domain);
      
      // 收集选择器配置
      this.config.selectors.title = document.getElementById('titleSelector').value;
      this.config.selectors.descIframe = document.getElementById('descIframeSelector').value;
      this.config.selectors.descBody = document.getElementById('descBodySelector').value;
      
      this.config.templates.title = document.getElementById('titleTemplate').value;
      this.config.templates.description = document.getElementById('descTemplate').value;
      
      // 收集标签
      const tagInputs = document.querySelectorAll('.tag-input');
      this.config.tags = Array.from(tagInputs).map(input => input.value || '未定义');
      
      // 保存到storage
      await chrome.storage.local.set({ config: this.config });
      
      // 显示成功提示
      this.showSaveStatus('设置已保存');
    } catch (error) {
      console.error('Save config error:', error);
      this.showSaveStatus('保存失败', 'error');
    }
  }

  exportConfig() {
    try {
      // 创建配置对象
      const exportData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        config: this.config
      };
      
      // 转换为JSON
      const jsonStr = JSON.stringify(exportData, null, 2);
      
      // 创建下载链接
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bug-shot-turbo-config-${Date.now()}.json`;
      a.click();
      
      // 清理
      URL.revokeObjectURL(url);
      
      this.showSaveStatus('配置已导出');
    } catch (error) {
      console.error('Export error:', error);
      this.showSaveStatus('导出失败', 'error');
    }
  }

  async importConfig(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      // 验证数据结构
      if (!importData.config) {
        throw new Error('无效的配置文件');
      }
      
      // 更新配置
      this.config = importData.config;
      
      // 保存并显示
      await chrome.storage.local.set({ config: this.config });
      this.displayConfig();
      
      this.showSaveStatus('配置已导入');
    } catch (error) {
      console.error('Import error:', error);
      this.showSaveStatus('导入失败：' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    try {
      this.config = this.getDefaultConfig();
      await chrome.storage.local.set({ config: this.config });
      this.displayConfig();
      this.showSaveStatus('已恢复默认设置');
    } catch (error) {
      console.error('Reset error:', error);
      this.showSaveStatus('重置失败', 'error');
    }
  }

  async clearHistory() {
    try {
      // 清除历史记录和统计数据
      await chrome.storage.local.remove(['history', 'lastPackage', 'metrics']);
      
      // 重置统计数据
      await chrome.storage.local.set({
        metrics: {
          totalBugs: 0,
          autoFillSuccess: 0,
          clipboardSuccess: 0,
          averageTime: []
        }
      });
      
      this.showSaveStatus('历史记录已清除');
    } catch (error) {
      console.error('Clear history error:', error);
      this.showSaveStatus('清除失败', 'error');
    }
  }

  showSaveStatus(message, type = 'success') {
    const statusEl = document.getElementById('saveStatus');
    statusEl.textContent = message;
    statusEl.style.color = type === 'error' ? '#f5222d' : '#52c41a';
    statusEl.classList.add('show');
    
    setTimeout(() => {
      statusEl.classList.remove('show');
    }, 3000);
  }
}

// 初始化选项管理器
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});