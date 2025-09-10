// Bug Shot Turbo - Popup脚本

class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    // 加载数据
    await this.loadData();
    
    // 绑定事件
    this.bindEvents();
  }

  async loadData() {
    // 加载历史记录
    await this.loadRecentBugs();
    
    // 加载统计数据
    await this.loadStatistics();
  }

  async loadRecentBugs() {
    try {
      const result = await chrome.storage.local.get(['history']);
      const history = result.history || [];
      
      const recentList = document.getElementById('recentList');
      
      if (history.length === 0) {
        recentList.innerHTML = '<div class="empty-state">暂无记录</div>';
        return;
      }
      
      // 显示最近5条
      const recentItems = history.slice(0, 5);
      recentList.innerHTML = recentItems.map(bug => `
        <div class="recent-item" data-id="${bug.id}">
          <span class="recent-item-tag">${bug.firstTag}</span>
          <span class="recent-item-issue">${bug.issue}</span>
          <span class="recent-item-time">${this.formatTime(bug.timestamp)}</span>
        </div>
      `).join('');
      
      // 绑定点击事件
      recentList.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', () => {
          const bugId = item.dataset.id;
          this.viewBugDetail(bugId);
        });
      });
    } catch (error) {
      console.error('Load recent bugs error:', error);
    }
  }

  async loadStatistics() {
    try {
      const result = await chrome.storage.local.get(['metrics']);
      const metrics = result.metrics || {
        totalBugs: 0,
        autoFillSuccess: 0,
        clipboardSuccess: 0
      };
      
      // 更新统计显示
      document.getElementById('totalBugs').textContent = metrics.totalBugs;
      
      // 计算成功率
      const successRate = metrics.totalBugs > 0 
        ? Math.round((metrics.autoFillSuccess / metrics.totalBugs) * 100)
        : 0;
      document.getElementById('successRate').textContent = `${successRate}%`;
    } catch (error) {
      console.error('Load statistics error:', error);
    }
  }

  bindEvents() {
    // 开始截图按钮
    document.getElementById('startCapture').addEventListener('click', async () => {
      try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
          this.showToast('没有找到活动标签页', 'error');
          return;
        }
        
        // 检查是否是特殊页面
        if (!tab.url || 
            tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') || 
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('about:') ||
            tab.url.startsWith('chrome-search://') ||
            tab.url === 'about:blank') {
          this.showToast('请在普通网页上使用此扩展', 'error');
          return;
        }
        
        // 先尝试注入content script（如果还没注入的话）
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/annotator-outline.js']
          });
          console.log('Content script injected successfully');
        } catch (injectError) {
          // 可能已经注入了，忽略错误
          console.log('Content script may already be injected:', injectError.message);
        }
        
        // 发送消息到content script，使用try-catch处理错误
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleAnnotation' });
          // 关闭popup
          window.close();
        } catch (messageError) {
          console.error('Failed to send message:', messageError);
          // 如果消息发送失败，尝试通过background script
          chrome.runtime.sendMessage({ action: 'toggleAnnotationViaBackground', tabId: tab.id });
          window.close();
        }
      } catch (error) {
        console.error('Error in startCapture:', error);
        this.showToast('启动失败: ' + error.message, 'error');
      }
    });
    
    // 设置按钮
    document.getElementById('openOptions').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    
    // 清除数据按钮
    document.getElementById('clearData').addEventListener('click', async () => {
      if (confirm('确定要清除所有数据吗？此操作不可恢复。')) {
        await this.clearAllData();
      }
    });
    
    // 帮助按钮
    document.getElementById('openHelp').addEventListener('click', () => {
      chrome.tabs.create({
        url: 'https://github.com/your-repo/bug-shot-turbo/wiki'
      });
    });
  }

  async clearAllData() {
    try {
      // 清除所有存储的数据
      await chrome.storage.local.clear();
      
      // 重新初始化默认配置
      const defaultConfig = {
        selectors: {
          title: "input[name='bug[title]']",
          descIframe: "iframe.ke-edit-iframe",
          descBody: "body.ke-content"
        },
        templates: {
          title: "${issue}（${pathLast1}）",
          description: "【问题】${firstTag} - ${issue}\n【页面】${pageURL}\n【时间】${timestamp}\n【期望】<在此补充>\n【实际】<在此补充>\n（截图：粘贴后见下）"
        },
        tags: ["按钮失效", "表单校验", "样式错位", "接口报错", "其他"]
      };
      
      await chrome.storage.local.set({ config: defaultConfig });
      
      // 刷新页面
      await this.loadData();
      
      // 显示成功提示
      this.showToast('数据已清除', 'success');
    } catch (error) {
      console.error('Clear data error:', error);
      this.showToast('清除数据失败', 'error');
    }
  }

  viewBugDetail(bugId) {
    // 这里可以扩展显示缺陷详情
    console.log('View bug detail:', bugId);
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    
    // 如果是字符串格式的时间，直接返回
    if (typeof timestamp === 'string') {
      // 提取时间部分
      const match = timestamp.match(/(\d{1,2}:\d{2})/);
      if (match) return match[1];
      return timestamp;
    }
    
    // 如果是数字时间戳
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // 小于1小时
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}分钟前`;
    }
    
    // 小于24小时
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}小时前`;
    }
    
    // 显示日期
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 4px;
      color: white;
      font-size: 13px;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
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
    }, 2000);
  }
}

// 初始化Popup管理器
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});