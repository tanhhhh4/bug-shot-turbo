// Bug Shot Turbo - TAPD自动填充模块

class TapdAutoFiller {
  constructor() {
    this.config = null;
    this.bugData = null;
    this.retryCount = 0;
    this.maxRetries = 10;
    
    this.init();
  }

  async init() {
    console.log('BST TAPD Filler: Initializing...');
    // 加载配置
    await this.loadConfig();
    
    // 检查是否是TAPD新建缺陷页面
    if (this.isTapdNewBugPage()) {
      console.log('BST TAPD Filler: TAPD new bug page detected, waiting for page load...');
      // 延迟执行，等待页面完全加载，增加等待时间
      setTimeout(() => {
        console.log('BST TAPD Filler: First attempt to check for pending bug data...');
        this.checkAndFill();
      }, 2000);
      
      // 再次尝试，以防第一次失败
      setTimeout(() => {
        console.log('BST TAPD Filler: Second attempt to check for pending bug data...');
        this.checkAndFill();
      }, 4000);
      
      // 第三次尝试，给更多时间加载
      setTimeout(() => {
        console.log('BST TAPD Filler: Third attempt to check for pending bug data...');
        this.checkAndFill();
      }, 6000);
    }
    
    // 监听页面变化（SPA路由切换）
    this.observePageChanges();
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['config']);
      this.config = result.config || {
        tapd: {
          projectIds: ["47910877"],
          domains: ["tapd.cn", "tapd.tencent.com"]
        },
        selectors: {
          // 更新为TAPD实际的选择器
          title: "input#BugTitle, input[name='data[Bug][title]']",
          descIframe: "iframe#BugDescription_ifr, iframe[id*='Description']",
          descBody: "body#tinymce, body.mce-content-body"
        },
        templates: {
          title: "${issue}（${pathLast1}）",
          description: "【问题】${firstTag} - ${issue}\n【页面】${pageURL}\n【时间】${timestamp}\n【期望】<在此补充>\n【实际】<在此补充>\n（截图：粘贴后见下）"
        }
      };
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  isTapdNewBugPage() {
    const url = window.location.href;
    
    // 检查是否是配置的TAPD域名
    const domains = this.config?.tapd?.domains || ["tapd.cn", "tapd.tencent.com"];
    const isTapdDomain = domains.some(domain => url.includes(domain));
    
    // 检查是否包含配置的项目ID（如果配置了的话）
    const projectIds = this.config?.tapd?.projectIds || [];
    let hasValidProjectId = true;
    if (projectIds.length > 0) {
      hasValidProjectId = projectIds.some(id => url.includes(`/${id}/`));
    }
    
    // 检查是否是新建缺陷页面
    const isNewBug = url.includes('/bugtrace/bugs/add') || 
                     url.includes('/bugtrace/bugs/addBUG') || // 添加大写BUG支持
                     url.includes('/bug/add') ||
                     url.includes('view=addBug') ||
                     url.includes('new_bug');
    
    const isValid = isTapdDomain && hasValidProjectId && isNewBug;
    
    if (isValid) {
      console.log('BST: Detected TAPD new bug page:', url);
    }
    
    return isValid;
  }

  observePageChanges() {
    // 监听URL变化（用于SPA应用）
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        if (this.isTapdNewBugPage()) {
          setTimeout(() => {
            this.checkAndFill();
          }, 1000);
        }
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }

  // 调试函数：手动测试页面检测
  testPageDetection() {
    console.log('BST TAPD Filler: Manual test started');
    console.log('Current URL:', window.location.href);
    console.log('Is TAPD page detected:', this.isTapdNewBugPage());
    
    // 测试选择器
    const titleSelectors = [
      "input#BugTitle", "input[name='data[Bug][title]']", "input[name='title']",
      "input[placeholder*='标题']", "input[type='text']:first-of-type"
    ];
    
    console.log('BST TAPD Filler: Testing title selectors...');
    titleSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      console.log(`Selector "${selector}":`, element);
    });
    
    const descSelectors = [
      "iframe#BugDescription_ifr", "div[contenteditable='true']", 
      "textarea[name*='description']", "[role='textbox']"
    ];
    
    console.log('BST TAPD Filler: Testing description selectors...');  
    descSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      console.log(`Selector "${selector}":`, element);
    });
  }

  async checkAndFill() {
    try {
      console.log('BST TAPD Filler: Requesting bug data from background...');
      // 获取待填充的数据
      const response = await chrome.runtime.sendMessage({ 
        action: 'getBugData' 
      });
      
      console.log('BST TAPD Filler: Response from background:', response);
      
      if (response && response.success && response.data) {
        console.log('BST TAPD Filler: Bug data received:', response.data);
        this.bugData = response.data;
        await this.autoFill();
      } else {
        console.log('BST TAPD Filler: No pending bug data found');
        if (response && !response.success) {
          console.log('BST TAPD Filler: Response indicates no data:', response);
        }
      }
    } catch (error) {
      console.error('BST TAPD Filler: Check and fill error:', error);
    }
  }

  async autoFill() {
    try {
      // 渲染模板
      const title = this.renderTemplate(this.config.templates.title, this.bugData);
      const description = this.renderTemplate(this.config.templates.description, this.bugData);
      
      // 填充标题
      const titleFilled = await this.fillTitle(title);
      
      // 填充描述
      const descFilled = await this.fillDescription(description);
      
      if (titleFilled && descFilled) {
        // 显示成功提示
        this.showToast('缺陷信息已自动填充，请在详情框中粘贴截图（Ctrl/Cmd+V）', 'success');
        
        // 更新数据状态
        await chrome.runtime.sendMessage({
          action: 'updateBugStatus',
          id: this.bugData.id,
          status: 'consumed'
        });
        
        // 尝试聚焦到描述框，方便用户粘贴图片
        this.focusDescriptionField();
      } else {
        // 重试机制
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          setTimeout(() => {
            this.autoFill();
          }, 500);
        } else {
          this.showToast('自动填充失败，请手动填写', 'error');
        }
      }
    } catch (error) {
      console.error('Auto fill error:', error);
      this.showToast('自动填充出错：' + error.message, 'error');
    }
  }

  renderTemplate(template, data) {
    return template.replace(/\${(\w+)}/g, (match, key) => {
      // 特殊处理多区域的问题描述
      if (key === 'issue' && data.issuesSummary) {
        return data.issuesSummary;
      }
      return data[key] || '';
    });
  }

  async fillTitle(title) {
    try {
      // 尝试多种选择器（优先使用TAPD实际的选择器）
      const selectors = [
        "input#BugTitle",
        "input[name='data[Bug][title]']",
        "input[name='title']",
        "input[name='bug_title']", 
        "input[data-field='title']",
        this.config.selectors.title,
        "input[placeholder='插入标题']",
        "input[placeholder*='标题']",
        "input[placeholder*='Title']",
        "input[type='text']:first-of-type", // 通常第一个文本输入框就是标题
        ".form-control[name*='title']",
        ".ant-input[placeholder*='标题']" // Ant Design组件
      ];
      
      console.log('BST TAPD Filler: Trying to fill title with:', title);
      console.log('BST TAPD Filler: Available selectors:', selectors);
      
      for (const selector of selectors) {
        console.log('BST TAPD Filler: Trying title selector:', selector);
        const input = document.querySelector(selector);
        if (input) {
          console.log('BST TAPD Filler: Found title input element:', input);
          // 模拟用户输入
          input.focus();
          input.value = title;
          
          // 触发各种事件，确保框架能检测到变化
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          
          // 如果是React/Vue应用，可能需要直接设置属性
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 
            'value'
          ).set;
          nativeInputValueSetter.call(input, title);
          
          input.dispatchEvent(new Event('input', { bubbles: true }));
          
          return true;
        }
      }
      
      console.log('Title input not found');
      return false;
    } catch (error) {
      console.error('Fill title error:', error);
      return false;
    }
  }

  async fillDescription(description) {
    try {
      // TAPD使用的是iframe富文本编辑器，优先查找iframe
      const iframeSelectors = [
        "iframe#BugDescription_ifr",
        "iframe[id*='Description_ifr']",
        "iframe[id*='Description']",
        "iframe[id*='detail']", // 可能使用detail字段
        "iframe[id*='content']", // 可能使用content字段  
        this.config.selectors.descIframe,
        "iframe.mce-edit-iframe",
        "iframe[src*='tinymce']",
        ".editor iframe", // 编辑器容器内的iframe
        "iframe[title*='富文本']",
        "iframe[title*='编辑器']"
      ];
      
      for (const selector of iframeSelectors) {
        const iframe = document.querySelector(selector);
        if (iframe) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const bodySelectors = [
              "body#tinymce",
              "body.mce-content-body",
              "body.cherry-editor-content",
              this.config.selectors.descBody,
              "body[contenteditable='true']"
            ];
            
            for (const bodySelector of bodySelectors) {
              const body = iframeDoc.querySelector(bodySelector);
              if (body) {
                // TAPD的编辑器已经有默认模板，我们需要在特定位置插入内容
                const existingContent = body.innerHTML;
                
                // 查找【问题描述】的位置
                if (existingContent.includes('【问题描述】')) {
                  // 在【问题描述】后面插入内容
                  const newContent = existingContent.replace(
                    /【问题描述】：<\/b><\/div><div>/,
                    `【问题描述】：</b></div><div>${description.replace(/\n/g, '<br>')}</div><div>`
                  );
                  body.innerHTML = newContent;
                } else {
                  // 如果没有找到模板，直接在开头插入
                  body.focus();
                  const formattedDesc = description.replace(/\n/g, '<br>');
                  body.innerHTML = `<div>${formattedDesc}</div><br>` + body.innerHTML;
                }
                
                // 触发事件
                const event = iframeDoc.createEvent('Event');
                event.initEvent('input', true, true);
                body.dispatchEvent(event);
                
                // 将光标移动到【问题截图】位置，方便用户粘贴
                this.moveCursorToScreenshotSection(iframeDoc, body);
                
                return true;
              }
            }
          } catch (e) {
            console.log('Cannot access iframe:', e);
          }
        }
      }
      
      // 如果iframe方式失败，尝试直接查找可编辑区域
      const directSelectors = [
        "div[contenteditable='true']",
        "textarea[name*='description']",
        "textarea[name*='detail']",
        "textarea[name*='content']",
        "textarea#BugDescription", 
        "textarea[data-field*='description']",
        ".editor-content[contenteditable='true']",
        ".rich-editor [contenteditable='true']",
        ".ant-input[contenteditable='true']", // Ant Design
        ".editor-wrapper [contenteditable='true']",
        "[role='textbox']", // 富文本编辑器通常有这个role
        ".ql-editor", // Quill编辑器
        ".w-e-text" // wangEditor
      ];
      
      for (const selector of directSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          if (element.tagName === 'TEXTAREA') {
            element.focus();
            element.value = description;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            element.focus();
            element.innerHTML = description.replace(/\n/g, '<br>');
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
          return true;
        }
      }
      
      console.log('Description field not found');
      return false;
    } catch (error) {
      console.error('Fill description error:', error);
      return false;
    }
  }

  moveCursorToScreenshotSection(iframeDoc, body) {
    try {
      // 查找【问题截图】位置
      const walker = iframeDoc.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.includes('【问题截图】')) {
          // 找到了，将光标定位到这个节点后面
          const range = iframeDoc.createRange();
          const sel = iframeDoc.getSelection();
          
          // 找到【问题截图】后的下一个div或p
          let targetNode = node.parentNode;
          while (targetNode && targetNode.nextSibling) {
            targetNode = targetNode.nextSibling;
            if (targetNode.nodeType === 1 && (targetNode.tagName === 'DIV' || targetNode.tagName === 'P')) {
              break;
            }
          }
          
          if (targetNode) {
            range.selectNodeContents(targetNode);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          break;
        }
      }
    } catch (e) {
      console.log('Move cursor error:', e);
    }
  }

  focusDescriptionField() {
    // 尝试聚焦到描述字段
    setTimeout(() => {
      // 直接可编辑元素
      const editableElements = document.querySelectorAll("div[contenteditable='true'], textarea[name*='desc']");
      if (editableElements.length > 0) {
        editableElements[0].focus();
        // 将光标移动到末尾
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editableElements[0]);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      
      // iframe中的元素
      const iframes = document.querySelectorAll("iframe.ke-edit-iframe, iframe.editor-iframe");
      for (const iframe of iframes) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const body = iframeDoc.querySelector("body[contenteditable='true'], body.ke-content");
          if (body) {
            body.focus();
            // 将光标移动到末尾
            const range = iframeDoc.createRange();
            const sel = iframe.contentWindow.getSelection();
            range.selectNodeContents(body);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            break;
          }
        } catch (e) {
          console.log('Cannot focus iframe:', e);
        }
      }
    }, 500);
  }

  showToast(message, type = 'info') {
    // 移除已存在的toast
    const existingToast = document.querySelector('.bst-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `bst-toast bst-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      z-index: 999999;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
    `;
    
    // 添加动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    
    if (type === 'success') {
      toast.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    } else if (type === 'error') {
      toast.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    } else {
      toast.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
    }
    
    document.body.appendChild(toast);
    
    // 自动移除
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 5000);
  }
}

// 初始化自动填充器
const tapdFiller = new TapdAutoFiller();

// 暴露调试函数到全局，方便在控制台测试
window.bstTapdDebug = {
  testPageDetection: () => tapdFiller.testPageDetection(),
  checkAndFill: () => tapdFiller.checkAndFill(),
  isTapdPage: () => tapdFiller.isTapdNewBugPage()
};

console.log('BST TAPD Filler: Debug functions available at window.bstTapdDebug');