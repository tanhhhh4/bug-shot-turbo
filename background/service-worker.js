// Bug Shot Turbo - 后台服务脚本

class BackgroundService {
  constructor() {
    this.setupListeners();
  }

  setupListeners() {
    // 监听快捷键命令
    chrome.commands.onCommand.addListener((command) => {
      if (command === 'toggle-annotation') {
        this.toggleAnnotation();
      }
    });

    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放
    });

    // 监听扩展安装/更新
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.onInstall();
      } else if (details.reason === 'update') {
        this.onUpdate(details.previousVersion);
      }
    });
  }

  async toggleAnnotation() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('BST Background: Toggle command received, active tab:', tab?.id, tab?.url);
      
      if (!tab) {
        console.warn('BST Background: No active tab found');
        return;
      }
      
      // 检查是否是受限页面
      if (!tab.url || 
          tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') || 
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:') ||
          tab.url === 'about:blank') {
        console.warn('BST Background: Cannot run on restricted page:', tab.url);
        return;
      }
      
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'toggleAnnotation' });
        console.log('BST Background: Message sent to tab, response:', response);
      } catch (error) {
        console.log('BST Background: Direct message failed, trying injection');
        await this.toggleAnnotationWithInjection(tab.id);
      }
    } catch (error) {
      console.error('BST Background: Failed to toggle annotation:', error);
    }
  }

  async toggleAnnotationWithInjection(tabId, sendResponse) {
    try {
      console.log('BST Background: Injecting and toggling annotation for tab', tabId);
      
      // 先注入CSS
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tabId },
          files: ['content/annotator.css']
        });
      } catch (cssError) {
        console.log('BST Background: CSS may already be injected:', cssError.message);
      }
      
      // 再注入JS
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/annotator-rectangle-tool.js']
        });
        console.log('BST Background: Script injected, waiting for initialization...');
      } catch (jsError) {
        console.log('BST Background: Script may already be injected:', jsError.message);
      }
      
      // 直接执行toggle，不依赖消息传递
      setTimeout(async () => {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              // 直接在页面上下文中执行
              if (window.annotator && typeof window.annotator.toggle === 'function') {
                window.annotator.toggle();
                console.log('BST: Toggled existing annotator');
                return { success: true };
              }

              if (typeof RectangleAnnotator !== 'undefined') {
                window.annotator = new RectangleAnnotator();
                window.annotator.toggle();
                console.log('BST: Created and toggled RectangleAnnotator');
                return { success: true };
              }

              // 兼容历史实现
              if (typeof ScreenshotAnnotator !== 'undefined') {
                window.annotator = new ScreenshotAnnotator();
                window.annotator.toggle();
                console.log('BST: Created and toggled ScreenshotAnnotator');
                return { success: true };
              }

              console.error('BST: Annotator class not found');
              return { success: false, error: 'No annotator class found' };
            }
          });
          console.log('BST Background: Toggle executed successfully');
          if (sendResponse) sendResponse({ success: true });
        } catch (execError) {
          console.error('BST Background: Execute script failed:', execError);
          if (sendResponse) sendResponse({ success: false, error: execError.message });
        }
      }, 200);
    } catch (error) {
      console.error('BST Background: Injection failed:', error);
      if (sendResponse) sendResponse({ success: false, error: error.message });
    }
  }

  async handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'captureVisibleTab':
        this.captureScreenshot(sender.tab, sendResponse);
        break;
        
      case 'saveBugData':
        this.saveBugData(request.data, sendResponse);
        break;
        
      case 'getBugData':
        this.getBugData(sendResponse);
        break;
        
      case 'clearBugData':
        this.clearBugData(sendResponse);
        break;
        
      case 'updateBugStatus':
        this.updateBugStatus(request.id, request.status, sendResponse);
        break;
        
      case 'toggleAnnotationViaBackground':
        // 备用方式：通过background script注入并触发
        this.toggleAnnotationWithInjection(request.tabId, sendResponse);
        break;
        
      case 'openTapdPage':
        // 通过background script打开新标签页
        this.openTapdPage(sendResponse);
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  async captureScreenshot(tab, sendResponse) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 100
      });
      sendResponse({ success: true, dataUrl });
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async saveBugData(data, sendResponse) {
    try {
      console.log('BST Background: Received bug data to save:', data);
      
      // 生成唯一ID
      data.id = `bug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // 如果没有timestamp，才添加
      if (!data.timestamp) {
        data.timestamp = new Date().toLocaleString('zh-CN');
      }
      data.status = 'pending';
      
      console.log('BST Background: Processed bug data:', data);

      // 保存到storage
      await chrome.storage.local.set({ 
        lastPackage: data,
        lastUpdateTime: Date.now()
      });

      // 更新历史记录
      const result = await chrome.storage.local.get(['history']);
      let history = result.history || [];
      history.unshift(data);
      
      // 保留最近10条
      if (history.length > 10) {
        history = history.slice(0, 10);
      }
      
      await chrome.storage.local.set({ history });

      // 更新统计数据
      const metrics = await this.getMetrics();
      metrics.totalBugs++;
      await chrome.storage.local.set({ metrics });

      sendResponse({ success: true, data });
    } catch (error) {
      console.error('Save bug data failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getBugData(sendResponse) {
    try {
      const result = await chrome.storage.local.get(['lastPackage']);
      if (result.lastPackage && result.lastPackage.status === 'pending') {
        sendResponse({ success: true, data: result.lastPackage });
      } else {
        sendResponse({ success: false, data: null });
      }
    } catch (error) {
      console.error('Get bug data failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async clearBugData(sendResponse) {
    try {
      await chrome.storage.local.remove(['lastPackage']);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Clear bug data failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async updateBugStatus(id, status, sendResponse) {
    try {
      const result = await chrome.storage.local.get(['lastPackage', 'history']);
      
      // 更新lastPackage状态
      if (result.lastPackage && result.lastPackage.id === id) {
        result.lastPackage.status = status;
        await chrome.storage.local.set({ lastPackage: result.lastPackage });
      }
      
      // 更新历史记录中的状态
      if (result.history) {
        const index = result.history.findIndex(item => item.id === id);
        if (index !== -1) {
          result.history[index].status = status;
          await chrome.storage.local.set({ history: result.history });
        }
      }

      // 更新统计数据
      if (status === 'consumed') {
        const metrics = await this.getMetrics();
        metrics.autoFillSuccess++;
        await chrome.storage.local.set({ metrics });
      }

      sendResponse({ success: true });
    } catch (error) {
      console.error('Update bug status failed:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getMetrics() {
    const result = await chrome.storage.local.get(['metrics']);
    return result.metrics || {
      totalBugs: 0,
      autoFillSuccess: 0,
      clipboardSuccess: 0,
      averageTime: []
    };
  }

  async onInstall() {
    // 初始化配置（更新为TAPD实际的选择器）
    const defaultConfig = {
      tapd: {
        projectIds: ["47910877"], // 支持多个项目ID
        domains: ["tapd.cn", "tapd.tencent.com"] // 支持的TAPD域名
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
      menuRules: [
        {
          domain: "https://supply-test.ycb51.cn/",
          menuXPath: "/html/body/div[1]/div/section/section/div[1]/ul/li/ul/li",
          activeClass: "is-active",
          titleSelector: ".title"
        }
      ],
      tags: ["按钮失效", "表单校验", "样式错位", "接口报错", "其他"]
    };

    await chrome.storage.local.set({ config: defaultConfig });
    console.log('Bug Shot Turbo installed successfully');
  }

  async openTapdPage(sendResponse) {
    try {
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
          console.log('BST Background: Using configured TAPD URL:', tapdUrl);
        } else {
          console.log('BST Background: No config found, using default TAPD URL:', tapdUrl);
        }
      } catch (configError) {
        console.warn('BST Background: Failed to load config, using default TAPD URL:', configError);
      }
      
      const newTab = await chrome.tabs.create({ 
        url: tapdUrl, 
        active: true 
      });
      console.log('BST Background: Successfully opened TAPD page in new tab:', newTab.id);
      sendResponse({ success: true, tabId: newTab.id });
    } catch (error) {
      console.error('BST Background: Failed to open TAPD page:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async onUpdate(previousVersion) {
    console.log(`Bug Shot Turbo updated from ${previousVersion} to ${chrome.runtime.getManifest().version}`);
  }
}

// 初始化后台服务
const backgroundService = new BackgroundService();
