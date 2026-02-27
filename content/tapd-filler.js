// Bug Shot Turbo - TAPD自动填充模块

class TapdAutoFiller {
  constructor() {
    this.config = null;
    this.bugData = null;
    this.retryCount = 0;
    this.maxRetries = 10;
    this.dropdownConfigs = [];
    this.hasFilled = false;
    this.isChecking = false;
    this.isFilling = false;
    this.processingBugId = null;
    this.lastCompletedBugId = null;
    this.checkTimers = [];
    this.aiCopywritingCache = new Map();
    this.aiDropdownCache = new Map();

    this.init();
  }

  async init() {
    console.log('BST TAPD Filler: Initializing...');
    // 加载配置
    await this.loadConfig();

    // 检查是否是TAPD新建缺陷页面
    if (this.isTapdNewBugPage()) {
      console.log('BST TAPD Filler: TAPD new bug page detected, waiting for page load...');
      this.scheduleCheck(2000, 'First');
      this.scheduleCheck(4000, 'Second');
      this.scheduleCheck(6000, 'Third');
    }

    // 监听页面变化（SPA路由切换）
    this.observePageChanges();
  }

  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['config', 'dropdownConfigs']);
      this.config = result.config || {
        tapd: {
          projectIds: [],
          domains: ["tapd.cn", "tapd.tencent.com"]
        },
        selectors: {
          // 更新为TAPD实际的选择器
          title: "input#BugTitle, input[name='data[Bug][title]']",
          descIframe: "iframe#BugDescription_ifr, iframe[id*='Description']",
          descBody: "body#tinymce, body.mce-content-body"
        },
        templates: {
          title: "${rectangleList}（${pathLast1}）",
          description: "【问题类型】${firstTag}\n\n【详细说明】\n${rectangleList}\n\n【页面地址】${pageURL}\n【发现时间】${timestamp}\n【附件截图】粘贴后见下方（Ctrl/Cmd+V）"
        },
        dropdowns: []
      };

      this.dropdownConfigs = result.dropdownConfigs || this.config.dropdowns || [];
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

    // 检查是否是新建缺陷页面（兼容 TAPD 新旧路由）
    const isNewBug = url.includes('/bugtrace/bugs/add') ||
      url.includes('/bugtrace/bugs/addBUG') || // 添加大写BUG支持
      url.includes('/bug/add') ||
      url.includes('/bug/create') ||
      url.includes('/bug/new') ||
      url.includes('workitem_type_id=bug') ||
      url.includes('view=addBug') ||
      url.includes('new_bug');

    // 路由不稳定时，使用页面结构兜底识别
    const hasCreateBugSignals = !!document.querySelector(
      "input[placeholder*='缺陷标题'], input[placeholder*='标题'], .cherry-editor textarea, [class*='cherry'] textarea"
    );

    const isValid = isTapdDomain && hasValidProjectId && (isNewBug || hasCreateBugSignals);

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

  scheduleCheck(delayMs, label) {
    const timerId = setTimeout(() => {
      console.log(`BST TAPD Filler: ${label} attempt to check for pending bug data...`);
      this.checkAndFill();
    }, delayMs);
    this.checkTimers.push(timerId);
  }

  clearScheduledChecks() {
    this.checkTimers.forEach(id => clearTimeout(id));
    this.checkTimers = [];
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
    if (this.hasFilled || this.isChecking) {
      return;
    }
    this.isChecking = true;
    try {
      console.log('BST TAPD Filler: Requesting bug data from background...');
      // 获取待填充的数据
      const response = await chrome.runtime.sendMessage({
        action: 'getBugData'
      });

      console.log('BST TAPD Filler: Response from background:', response);

      if (response && response.success && response.data) {
        console.log('BST TAPD Filler: Bug data received:', response.data);
        const bugId = response.data.id;
        if (!bugId) {
          console.log('BST TAPD Filler: Missing bug id, skip');
          return;
        }
        if (this.lastCompletedBugId === bugId) {
          console.log('BST TAPD Filler: Bug already completed, skip', bugId);
          return;
        }
        if (this.processingBugId === bugId && this.retryCount > 0) {
          console.log('BST TAPD Filler: Bug is waiting for retry, skip duplicate check', bugId);
          return;
        }
        if (this.isFilling && this.processingBugId === bugId) {
          console.log('BST TAPD Filler: Bug is currently being filled, skip', bugId);
          return;
        }
        this.bugData = response.data;
        await this.autoFill(bugId);
      } else {
        console.log('BST TAPD Filler: No pending bug data found');
        if (response && !response.success) {
          console.log('BST TAPD Filler: Response indicates no data:', response);
        }
      }
    } catch (error) {
      console.error('BST TAPD Filler: Check and fill error:', error);
    } finally {
      this.isChecking = false;
    }
  }

  async autoFill(bugId) {
    if (this.isFilling) {
      console.log('BST TAPD Filler: autoFill is already running, skip');
      return;
    }

    this.isFilling = true;
    this.processingBugId = bugId || this.bugData?.id || null;
    try {
      // === AI 文案优化 ===
      const aiCopywriting = await this.fetchAiCopywritingCached(this.processingBugId).catch(e => {
        console.log('BST TAPD Filler: AI copywriting failed, using original text', e?.message);
        return null;
      });

      // 如果 AI 返回了优化文案，替换 bugData 中的内容用于渲染
      const renderData = { ...this.bugData };
      if (aiCopywriting) {
        console.log('BST TAPD Filler: AI copywriting result', aiCopywriting);

        // 优化标题：用 AI 返回的 title 覆盖 issuesSummary（标题模板用）
        if (aiCopywriting.title) {
          renderData.issuesSummary = aiCopywriting.title;
        }

        // 优化描述：用 AI 返回的 descriptions 覆盖 rectangles 的文本
        if (Array.isArray(aiCopywriting.descriptions) && aiCopywriting.descriptions.length > 0
          && Array.isArray(renderData.rectangles)) {
          renderData.rectangles = renderData.rectangles.map((r, i) => ({
            ...r,
            text: aiCopywriting.descriptions[i] || r.text
          }));
        }

        // 新变量：AI 生成的详细描述（模板变量 ${aiDetail}）
        if (typeof aiCopywriting.detail === 'string' && aiCopywriting.detail.trim()) {
          renderData.aiDetail = aiCopywriting.detail.trim();
        } else if (Array.isArray(aiCopywriting.descriptions) && aiCopywriting.descriptions.length > 0) {
          renderData.aiDetail = aiCopywriting.descriptions
            .map((text, i) => `${i + 1}、${text}`)
            .join('\n');
        }
      }

      // 渲染模板
      const title = this.buildTitleWithMenu(this.renderTemplate(this.config.templates.title, renderData));
      const description = this.renderTemplate(this.config.templates.description, renderData);

      // 填充标题
      const titleFilled = await this.fillTitle(title);

      // 填充描述
      const descFilled = await this.fillDescription(description);
      console.log('BST TAPD Filler: fill result', { titleFilled, descFilled });

      if (titleFilled && descFilled) {
        this.hasFilled = true;
        await chrome.runtime.sendMessage({
          action: 'updateBugStatus',
          id: this.bugData.id,
          status: 'consumed'
        });
        await chrome.runtime.sendMessage({ action: 'clearBugData' });
      }

      // 特殊字段：按顺序处理（处理人 -> 迭代），各字段仅尝试一次
      await this.autoFillSpecialFieldsInOrder();

      // 根据描述尝试自动匹配下拉（跳过特殊字段）
      await this.autoSelectDropdowns(description, this.processingBugId);

      // 所有自动选择动作结束后，尝试收起可能残留的下拉面板
      await this.collapseDropdownPanels();

      if (titleFilled && descFilled) {
        // 显示成功提示
        const aiHint = aiCopywriting ? '（AI 已优化文案）' : '';
        this.showToast(`缺陷信息已自动填充${aiHint}，截图已尝试自动插入；如未显示可手动粘贴（Ctrl/Cmd+V）`, 'success');

        this.lastCompletedBugId = this.processingBugId;
        this.retryCount = 0;
        this.clearScheduledChecks();

        // 尝试聚焦到描述框，方便用户粘贴图片
        this.focusDescriptionField();
      } else {
        // 重试机制
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          const currentBugId = this.processingBugId;
          setTimeout(() => {
            this.autoFill(currentBugId);
          }, 500);
        } else {
          this.showToast('自动填充失败，请手动填写', 'error');
        }
      }
    } catch (error) {
      console.error('Auto fill error:', error);
      this.showToast('自动填充出错：' + error.message, 'error');
    } finally {
      this.isFilling = false;
    }
  }

  buildTitleWithMenu(title) {
    const menuName = (this.bugData?.secondMenuName || '').trim();
    if (!menuName) return title;
    const prefix = `【${menuName}】`;
    if ((title || '').startsWith(prefix)) return title;
    return `${prefix}${title || ''}`.trim();
  }

  renderTemplate(template, data) {
    return template.replace(/\${(\w+)}/g, (match, key) => {
      // 特殊处理多区域的问题描述
      if (key === 'issue' && data.issuesSummary) {
        return data.issuesSummary;
      }

      // 新变量：AI 详细描述，AI 不可用时降级到 issue/rectangleList
      if (key === 'aiDetail') {
        if (data.aiDetail) return data.aiDetail;
        if (data.rectangles && Array.isArray(data.rectangles) && data.rectangles.length > 0) {
          return data.rectangles.map(r => `${r.order}、${r.text}`).join('\n');
        }
        return data.issuesSummary || data.issue || '';
      }

      // 处理矩形标注列表（新功能）
      if (key === 'rectangleList') {
        if (data.rectangles && Array.isArray(data.rectangles) && data.rectangles.length > 0) {
          return data.rectangles.map(r => `${r.order}、${r.text}`).join('\n');
        }
        return '（无详细标注）';
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
        "input[placeholder='请输入缺陷标题']",
        "input[placeholder*='缺陷标题']",
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
      console.log('BST TAPD Filler: start fill description');
      // 新版页面兜底：先按模板块定位编辑器并写入【问题描述】段落
      const templateFilled = this.fillDescriptionByTemplateBlock(description);
      if (templateFilled) {
        console.log('BST TAPD Filler: description filled by template block');
        return true;
      }

      // 新版 TAPD（Cherry 编辑器）优先
      const modernSelectors = [
        ".cherry-editor textarea",
        ".cherry textarea",
        "[class*='cherry'] textarea",
        "textarea[placeholder*='问题描述']",
        "textarea[placeholder*='描述']",
        ".ProseMirror",
        ".cherry-previewer[contenteditable='true']",
        "div[contenteditable='true'][data-placeholder*='问题']",
        "[contenteditable='true']",
        "[contenteditable='plaintext-only']",
        "[contenteditable]",
        "[role='textbox']",
        this.config?.selectors?.descBody
      ];

      for (const selector of modernSelectors) {
        const element = document.querySelector(selector);
        if (!element) continue;
        if (!this.isElementVisible(element)) continue;

        if (element.tagName === 'TEXTAREA') {
          const existingText = element.value || '';
          const mergedText = this.mergeDescriptionForTemplate(existingText, description);
          this.setTextareaValue(element, mergedText);
          if (this.didDescriptionApply(element, description)) {
            console.log('BST TAPD Filler: description filled by modern textarea', selector);
            return true;
          }
          continue;
        }

        this.setContenteditableText(element, description);
        if (this.didDescriptionApply(element, description)) {
          console.log('BST TAPD Filler: description filled by modern editable', selector);
          return true;
        }
      }

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
        const iframeList = Array.from(document.querySelectorAll(selector));
        for (const iframe of iframeList) {
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

                // 自动插入截图并定位到【问题截图】位置
                this.insertScreenshotIntoSection(iframeDoc, body);
                this.moveCursorToScreenshotSection(iframeDoc, body);

                if (this.didDescriptionApply(body, description)) {
                  console.log('BST TAPD Filler: description filled by iframe', {
                    selector,
                    iframeId: iframe.id
                  });
                  return true;
                }
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
        "[contenteditable='true']",
        "[contenteditable='plaintext-only']",
        "[contenteditable]",
        "[role='textbox']",
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
        ".w-e-text", // wangEditor
        this.config?.selectors?.descBody
      ];

      for (const selector of directSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          if (!this.isElementVisible(element)) continue;
          if (element.tagName === 'TEXTAREA') {
            const mergedText = this.mergeDescriptionForTemplate(element.value || '', description);
            this.setTextareaValue(element, mergedText);
            if (this.didDescriptionApply(element, description)) {
              console.log('BST TAPD Filler: description filled by direct textarea', selector);
              return true;
            }
          } else {
            this.setContenteditableText(element, description);
            if (this.didDescriptionApply(element, description)) {
              console.log('BST TAPD Filler: description filled by direct editable', selector);
              return true;
            }
          }
        }
      }

      // 结构化兜底：根据“【问题描述】”模板节点定位编辑区
      const markerFilled = this.fillDescriptionByMarkerAnchor(description);
      if (markerFilled) {
        console.log('BST TAPD Filler: description filled by marker anchor fallback');
        return true;
      }

      console.log('Description field not found');
      return false;
    } catch (error) {
      console.error('Fill description error:', error);
      return false;
    }
  }

  // ========== Dropdown auto-selection ========== 

  normalizeText(text = '') {
    return text.toLowerCase().replace(/\s+/g, '').replace(/[^\w\u4e00-\u9fa5]/g, '');
  }

  delay(ms = 100) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async autoSelectDropdowns(description, bugId = '') {
    const configs = this.dropdownConfigs || [];

    // 合并可用文本：只取矩形文本+标签，避免额外敏感数据
    let combinedText = description || '';
    const rectTexts = Array.isArray(this.bugData?.rectangles)
      ? this.bugData.rectangles.map(r => `${r.order}.${r.text || ''}`).join(' ')
      : '';
    const tagText = this.bugData?.tag || '';
    combinedText = `${rectTexts} ${tagText}`.trim();
    const normalizedDesc = this.normalizeText(combinedText);

    // AI 预选
    this.aiDropdownSuggestions = await this.fetchAiDropdownSuggestionsCached(
      bugId,
      configs,
      rectTexts,
      tagText
    ).catch(() => ({})) || {};

    // 新版页面优先：AI 返回键名通常就是右侧字段名，直接按字段名选择
    if (this.aiDropdownSuggestions && typeof this.aiDropdownSuggestions === 'object') {
      for (const [fieldName, value] of Object.entries(this.aiDropdownSuggestions)) {
        const keyword = (value || '').toString().trim();
        if (!fieldName || !keyword) continue;
        const ok = await this.pickDropdownByFieldName(fieldName, keyword);
        console.log('BST TAPD Filler: AI field-name dropdown result', { fieldName, value: keyword, ok });
      }
    }

    if (!configs.length) return;

    for (const cfg of configs) {
      if (this.isSpecialDropdownName(cfg?.name)) {
        continue;
      }
      try {
        const aiValue = this.aiDropdownSuggestions?.[cfg.name];
        await this.autoSelectOneDropdown(cfg, normalizedDesc, aiValue);
      } catch (e) {
        console.log('BST TAPD Filler: dropdown auto-select error', cfg?.name || '', e);
      }
    }
  }

  mergeDescriptionForTemplate(existingText = '', description = '') {
    const desc = (description || '').trim();
    if (!desc) return existingText || '';

    const current = existingText || '';
    if (!current.trim()) return desc;

    if (current.includes(desc)) return current;

    const markerPattern = /(【问题描述】[:：]?\s*\n?)/;
    if (markerPattern.test(current)) {
      return current.replace(markerPattern, `$1${desc}\n\n`);
    }

    return `${desc}\n\n${current}`;
  }

  fillDescriptionByTemplateBlock(description = '') {
    const text = (description || '').trim();
    if (!text) return false;

    const candidateRoots = [
      ...Array.from(document.querySelectorAll('textarea')),
      ...Array.from(document.querySelectorAll('[contenteditable="true"]')),
      ...Array.from(document.querySelectorAll('.ProseMirror, .ql-editor, .cherry-previewer, .cherry-editor, [class*="editor"]'))
    ];

    const root = candidateRoots.find(el => {
      const t = (el.tagName === 'TEXTAREA' ? el.value : el.innerText || '').trim();
      return t.includes('【问题描述】') && t.includes('【问题截图】');
    });

    if (!root) return false;

    if (root.tagName === 'TEXTAREA') {
      const merged = this.mergeDescriptionForTemplate(root.value || '', text);
      this.setTextareaValue(root, merged);
      return this.didDescriptionApply(root, text);
    }

    const rawText = (root.innerText || '').trim();
    const mergedText = this.mergeDescriptionForTemplate(rawText, text);
    this.setContenteditableText(root, mergedText);
    return this.didDescriptionApply(root, text);
  }

  didDescriptionApply(el, description) {
    const desc = (description || '').trim();
    if (!el || !desc) return false;
    const probe = desc.slice(0, 8);
    const current = el.tagName === 'TEXTAREA'
      ? (el.value || '')
      : (el.innerText || el.textContent || '');
    return current.includes(probe);
  }

  fillDescriptionByMarkerAnchor(description = '') {
    const desc = (description || '').trim();
    if (!desc) return false;

    const markerNode = Array.from(document.querySelectorAll('div, p, span')).find(node => {
      const text = (node.textContent || '').trim();
      return text.includes('【问题描述】');
    });
    if (!markerNode) return false;

    const formBlock = markerNode.closest('.content-form__item, .content-form__item-group-cuscontent, .content-fields-fullscreen') || document.body;
    const editorCandidates = Array.from(formBlock.querySelectorAll(
      "textarea, [contenteditable='true'], [role='textbox'], .ql-editor, .ProseMirror, .cherry-editor textarea, .cherry-previewer[contenteditable='true']"
    ));

    for (const el of editorCandidates) {
      if (el.tagName === 'TEXTAREA') {
        const merged = this.mergeDescriptionForTemplate(el.value || '', desc);
        this.setTextareaValue(el, merged);
      } else {
        const current = (el.innerText || el.textContent || '').trim();
        const merged = this.mergeDescriptionForTemplate(current, desc);
        this.setContenteditableText(el, merged);
      }
      if (this.didDescriptionApply(el, desc)) return true;
    }

    return false;
  }

  setTextareaValue(textarea, value) {
    if (!textarea) return;
    textarea.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(textarea, value);
    } else {
      textarea.value = value;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  setContenteditableText(element, text) {
    if (!element) return;
    const target = element.matches?.('[contenteditable="true"]')
      ? element
      : (element.querySelector?.('[contenteditable="true"]') || element);

    target.focus();

    try {
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
    } catch (e) {
      target.innerText = text;
    }

    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }

  async autoFillSpecialFieldsInOrder() {
    await this.autoFillSpecialAssignee();
    await this.autoFillSpecialIteration();
  }

  async autoFillSpecialAssignee() {
    const keyword = (this.bugData?.assignee || '').trim();
    if (!keyword) {
      console.log('BST TAPD Filler: special assignee empty, skip');
      return false;
    }

    const input = this.findFirstElement([
      '#BugCurrentOwnerValue',
      "[data-field-name='current_owner'] input#BugCurrentOwnerValue",
      "[data-field-name='current_owner'] input[type='text'][data-control='pinyinuserchooser']",
      "[data-field-name='current_owner'] input[type='text']",
      "input[id*='CurrentOwner'][type='text']"
    ]);

    if (!input) {
      console.log('BST TAPD Filler: special assignee input not found');
      const byFieldName = await this.pickDropdownByFieldName('处理人', keyword);
      console.log('BST TAPD Filler: special assignee field-name fallback', { keyword, byFieldName });
      return byFieldName;
    }

    this.setInputValue(input, keyword);
    const picked = await this.pickFirstVisibleSuggestion([
      '.tt-menu .tt-suggestion',
      '.tt-dropdown-menu .tt-suggestion',
      '.twitter-typeahead .tt-suggestion'
    ]);

    console.log('BST TAPD Filler: special assignee result', { keyword, picked });
    return picked;
  }

  async autoFillSpecialIteration() {
    const keyword = (this.bugData?.iteration || '').trim();
    if (!keyword) {
      console.log('BST TAPD Filler: special iteration empty, skip');
      return false;
    }

    const container = document.querySelector("[data-field-name='iteration_id']");
    const input = this.findFirstElement([
      '#BugIterationIdValue',
      "[data-field-name='iteration_id'] input[type='text']",
      "input[id*='Iteration'][type='text']"
    ]);

    if (input) {
      this.setInputValue(input, keyword);
      const picked = await this.pickFirstVisibleSuggestion([
        '.tt-menu .tt-suggestion',
        '.tt-dropdown-menu .tt-suggestion',
        '.twitter-typeahead .tt-suggestion',
        '.select2-results__option[aria-selected]',
        '.ui-autocomplete li',
        '.autocomplete-suggestion'
      ]);
      console.log('BST TAPD Filler: special iteration typeahead result', { keyword, picked });
      return picked;
    }

    const selectEl = container?.querySelector?.('select');
    if (!selectEl) {
      console.log('BST TAPD Filler: special iteration input/select not found');
      const byFieldName = await this.pickDropdownByFieldName('迭代', keyword);
      console.log('BST TAPD Filler: special iteration field-name fallback', { keyword, byFieldName });
      return byFieldName;
    }

    const options = this.collectNativeOptions(selectEl);
    const normKeyword = this.normalizeText(keyword);
    const matchedOptions = options.filter(o => (
      (o.normalizedText && o.normalizedText.includes(normKeyword)) ||
      (o.value && this.normalizeText(o.value).includes(normKeyword))
    ));

    if (!matchedOptions.length) {
      console.log('BST TAPD Filler: special iteration no native match', { keyword });
      return false;
    }

    this.applyNativeSelection(selectEl, matchedOptions[0]);
    console.log('BST TAPD Filler: special iteration native result', {
      keyword,
      value: matchedOptions[0].value
    });
    return true;
  }

  isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  async pickFirstVisibleSuggestion(selectors = []) {
    for (let i = 0; i < 8; i += 1) {
      for (const selector of selectors) {
        const items = Array.from(document.querySelectorAll(selector));
        const firstVisible = items.find(el => this.isElementVisible(el));
        if (firstVisible) {
          firstVisible.click();
          return true;
        }
      }
      await this.delay(120);
    }
    return false;
  }

  findFirstElement(selectors = []) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  setInputValue(input, value) {
    if (!input) return;

    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  }

  isSpecialDropdownName(name = '') {
    return this.isAssigneeDropdownName(name) || this.isIterationDropdownName(name);
  }

  isAssigneeDropdownName(name = '') {
    const normalizedName = this.normalizeText(name);
    return ['处理人', '负责人', '当前处理人', 'owner', 'current_owner']
      .some(alias => normalizedName.includes(this.normalizeText(alias)));
  }

  isIterationDropdownName(name = '') {
    const normalizedName = this.normalizeText(name);
    return ['迭代', 'iteration', 'sprint', 'iteration_id']
      .some(alias => normalizedName.includes(this.normalizeText(alias)));
  }

  async autoSelectOneDropdown(cfg, normalizedDesc, aiValue) {
    if (!cfg) return;

    const element = this.findElementBySelectors(cfg.selectors || []);
    const type = cfg.type || (element && element.tagName === 'SELECT' ? 'native' : 'custom');

    const mappingHit = this.matchByMapping(normalizedDesc, cfg.mapping);
    const manualValue = this.getManualDropdownValue(cfg.name) || aiValue || this.bugData?.dropdownValue?.trim();

    // 新版页面兜底：未命中旧选择器时，按字段名定位并选择
    if (!element && manualValue && cfg?.name) {
      const byFieldName = await this.pickDropdownByFieldName(cfg.name, manualValue);
      if (byFieldName) {
        console.log('BST TAPD Filler: dropdown selected by field name', { name: cfg.name, value: manualValue });
        return;
      }
    }

    if (type === 'native' && element && element.tagName === 'SELECT') {
      const options = this.collectNativeOptions(element);
      const targetOption = this.pickOption(options, normalizedDesc, mappingHit, manualValue);
      if (!targetOption) {
        console.log('BST TAPD Filler: no match for dropdown', cfg.name, { aiValue, mappingHit, candidates: cfg.candidates });
        if (cfg?.name && manualValue) {
          await this.pickDropdownByFieldName(cfg.name, manualValue);
        }
        return;
      }
      console.log('BST TAPD Filler: select native', { name: cfg.name, value: targetOption.value, aiValue, mappingHit });
      this.applyNativeSelection(element, targetOption);
      return;
    }

    // Custom dropdown: click to open then click the matched option
    await this.openDropdown(element, cfg);

    const options = await this.collectCustomOptions(cfg);
    if (!options.length) {
      if (cfg?.name && manualValue) {
        await this.pickDropdownByFieldName(cfg.name, manualValue);
      }
      return;
    }

    const targetOption = this.pickOption(options, normalizedDesc, mappingHit, manualValue);
    if (!targetOption || !targetOption.el) {
      if (cfg?.name && manualValue) {
        await this.pickDropdownByFieldName(cfg.name, manualValue);
      }
      return;
    }

    targetOption.el.click();
  }

  async pickDropdownByFieldName(fieldName, value) {
    const nameNorm = this.normalizeText(fieldName);
    const valueNorm = this.normalizeText(value);
    if (!nameNorm || !valueNorm) return false;

    // 新版 TAPD：先按固定结构精确定位字段容器
    const preciseContainer = this.resolveTapdFieldContainerByName(fieldName);
    if (preciseContainer) {
      const precisePicked = await this.pickValueFromTapdContainer(preciseContainer, value, valueNorm);
      if (precisePicked) return true;
    }

    const labelNodes = Array.from(document.querySelectorAll('label, span, div')).filter(node => {
      if (!this.isElementVisible(node)) return false;
      const text = (node.textContent || '').trim();
      if (!text || text.length > 30) return false;
      return this.normalizeText(text).includes(nameNorm);
    });

    for (const label of labelNodes) {
      const row = label.closest('.content-form__item')
        || label.parentElement?.closest?.('.content-form__item')
        || label.parentElement?.parentElement?.closest?.('.content-form__item')
        || label.closest("[class*='form-item'], [class*='field'], [class*='row'], li, tr")
        || label.parentElement;
      if (!row) continue;

      const trigger = row.querySelector(
        ".form__item-content__value-label, .label-value, .entity-detail-right-col__value .form__item-content__value-label, .entity-detail-right-col__value .label-value, .el-input__inner, input[type='text'], [role='combobox']"
      );
      if (!trigger || !this.isElementVisible(trigger)) continue;

      this.dispatchClickSequence(trigger);
      await this.delay(120);

      if (trigger.tagName === 'INPUT') {
        this.setInputValue(trigger, value);
      }

      const activeDropdown = this.getActiveDropdownRoot();
      const optionRoot = activeDropdown || document;
      const options = Array.from(optionRoot.querySelectorAll(
        ".agi-select__options-item, .agi-select__options li, .el-select-dropdown__item, .el-select-dropdown li, [role='option']"
      ))
        .map(el => this.getClickableOptionNode(el))
        .filter(el => el && this.isElementVisible(el) && !el.classList.contains('is-disabled'));

      const exact = options.find(el => this.normalizeText(el.textContent || '') === valueNorm);
      const include = options.find(el => this.normalizeText(el.textContent || '').includes(valueNorm));
      const option = exact || include;
      if (option) {
        this.dispatchClickSequence(option);
        await this.delay(120);
        const rowTextAfterClick = row.textContent || '';
        if (rowTextAfterClick.includes(value)) return true;
      }

      // typeahead 场景尝试回车确认首项
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await this.delay(80);
      const rowTextAfterEnter = row.textContent || '';
      if (rowTextAfterEnter.includes(value)) return true;
    }

    return false;
  }

  resolveTapdFieldContainerByName(fieldName = '') {
    const n = this.normalizeText(fieldName);
    const map = [
      { aliases: ['优先级', 'priority'], selector: '.content-form__item.priority.select' },
      { aliases: ['严重程度', 'severity'], selector: '.content-form__item.severity.select' },
      { aliases: ['处理人', '负责人', 'owner', 'currentowner'], selector: '.content-form__item.owner.user_choose' },
      { aliases: ['迭代', 'iteration', 'sprint'], selector: '.content-form__item.iteration_id.select' },
      { aliases: ['bug类型', '类型'], selector: '.content-form__item.custom_field_one.select' },
      { aliases: ['bug原因', '原因'], selector: '.content-form__item.custom_field_two.select' },
      { aliases: ['bug来源', '来源'], selector: '.content-form__item.custom_field_three.select' },
      { aliases: ['bug等级', '等级'], selector: '.content-form__item.custom_field_four.select' }
    ];

    for (const item of map) {
      if (item.aliases.some(a => n.includes(this.normalizeText(a)))) {
        const container = document.querySelector(item.selector);
        if (container) return container;
      }
    }
    return null;
  }

  async pickValueFromTapdContainer(container, value, valueNorm) {
    const trigger = container.querySelector(
      '.form__item-content__value-label, .label-value, .entity-detail-right-col__value .form__item-content__value-label, .entity-detail-right-col__value .label-value, .el-input__inner, [role="combobox"], input[type="text"]'
    );
    if (!trigger) return false;

    this.dispatchClickSequence(trigger);
    await this.delay(160);

    const optionSelectors = [
      '.agi-select__options-item',
      '.agi-select__options li',
      '.el-select-dropdown__item',
      '.el-select-dropdown li',
      '[role="option"]'
    ].join(', ');

    const activeDropdown = this.getActiveDropdownRoot();
    const optionRoot = activeDropdown || document;
    const options = Array.from(optionRoot.querySelectorAll(optionSelectors))
      .map(el => this.getClickableOptionNode(el))
      .filter(el => el && this.isElementVisible(el) && !el.classList.contains('is-disabled'));

    const exact = options.find(el => this.normalizeText(el.textContent || '') === valueNorm);
    const include = options.find(el => this.normalizeText(el.textContent || '').includes(valueNorm));
    const target = exact || include;
    if (!target) return false;

    this.dispatchClickSequence(target);
    await this.delay(120);
    return (container.textContent || '').includes(value);
  }

  dispatchClickSequence(el) {
    if (!el) return;
    try {
      if (typeof el.focus === 'function') el.focus();
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } catch (e) {
      console.log('BST TAPD Filler: dispatchClickSequence failed', e);
    }
  }

  getClickableOptionNode(el) {
    if (!el) return null;
    if (el.matches('.agi-select__options-item, .el-select-dropdown__item, [role="option"], li')) return el;
    return el.closest('.agi-select__options-item, .el-select-dropdown__item, [role="option"], li');
  }

  getActiveDropdownRoot() {
    const roots = Array.from(document.querySelectorAll(
      '.agi-select.select-menu, .agi-select__options, .el-select-dropdown.el-popper, .el-select-dropdown, .el-popper .el-select-dropdown, [role="listbox"]'
    )).filter(el => this.isElementVisible(el));

    if (!roots.length) return null;

    roots.sort((a, b) => {
      const za = Number(window.getComputedStyle(a).zIndex) || 0;
      const zb = Number(window.getComputedStyle(b).zIndex) || 0;
      return zb - za;
    });
    return roots[0];
  }

  getManualDropdownValue(name = '') {
    const fieldName = (name || '').trim();
    if (!fieldName) return '';

    if (this.isAssigneeDropdownName(fieldName)) {
      return (this.bugData?.assignee || '').trim();
    }
    if (this.isIterationDropdownName(fieldName)) {
      return (this.bugData?.iteration || '').trim();
    }

    return '';
  }

  async fetchAiDropdownSuggestions(configs, rectTexts, tagText) {
    const ai = this.config?.ai;
    if (!ai?.enable || !ai.endpoint || !ai.apiKey || !ai.model) {
      console.log('BST TAPD Filler: AI disabled or config missing');
      return {};
    }

    const dropdownBlocks = configs.map(cfg => {
      const candidates = Array.isArray(cfg.candidates) && cfg.candidates.length
        ? cfg.candidates
        : Object.keys(cfg.mapping || {});
      return {
        name: cfg.name || '下拉',
        candidates
      };
    });

    const prompt = [
      '你是一个只选择下拉值的助手。',
      '规则：',
      '1. 每个下拉只能从提供的候选中选 1 个；',
      '2. 返回 JSON，键是下拉名称，值是候选中的一个；',
      '3. 不要输出多余文字。',
      '4. 严重程度方面，除非描述中明确涉及数据丢失、系统崩溃、安全漏洞等极其严重的问题，否则不要选择"致命"。',
      '',
      '候选列表：',
      ...dropdownBlocks.map(d => `- ${d.name}: [${d.candidates.join(', ')}]`),
      '',
      '上下文：',
      `矩形文本：${rectTexts || '（空）'}`,
      `标签：${tagText || '（空）'}`,
      '',
      '示例返回：{"严重程度":"normal","优先级":"P1"}'
    ].join('\n');

    console.log('BST TAPD Filler: AI request payload', {
      endpoint: ai.endpoint,
      model: ai.model,
      dropdowns: dropdownBlocks,
      rectTexts,
      tagText
    });

    const controller = new AbortController();
    const timeoutMs = ai.timeoutMs || 5000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(ai.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ai.apiKey}`
        },
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: 'system', content: '你只返回 JSON，键为下拉名称，值为候选中的一个。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      if (data?.error) {
        throw new Error(data.error?.message || 'AI provider returned error');
      }
      console.log('BST TAPD Filler: AI response raw', data);

      const content = data?.choices?.[0]?.message?.content || '';
      let parsed = {};
      try {
        // 去掉可能的 ```json 包裹
        const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.log('BST TAPD Filler: AI response not JSON, content=', content);
        return {};
      }

      console.log('BST TAPD Filler: AI parsed suggestions', parsed);
      return parsed;
    } catch (error) {
      clearTimeout(timer);
      console.log('BST TAPD Filler: AI request failed', { error: error?.message, timeoutMs });
      return {};
    }
  }

  async fetchAiDropdownSuggestionsCached(bugId, configs, rectTexts, tagText) {
    if (bugId && this.aiDropdownCache.has(bugId)) {
      return this.aiDropdownCache.get(bugId);
    }
    const result = await this.fetchAiDropdownSuggestions(configs, rectTexts, tagText);
    if (bugId && result && Object.keys(result).length > 0) {
      this.aiDropdownCache.set(bugId, result || {});
    }
    return result || {};
  }

  /**
   * AI 文案优化：对用户输入的问题描述进行规范化润色
   * 规则：不臆想、不无中生有，保留编号结构
   * @returns {Promise<{title: string, descriptions: string[], detail?: string}|null>}
   */
  async fetchAiCopywriting() {
    const ai = this.config?.ai;
    if (!ai?.enable || !ai.endpoint || !ai.apiKey || !ai.model) {
      console.log('BST TAPD Filler: AI disabled, skip copywriting');
      return null;
    }

    // 收集原始文本
    const rectangles = this.bugData?.rectangles || [];
    const tagText = this.bugData?.tag || this.bugData?.firstTag || '';
    if (!rectangles.length && !this.bugData?.issuesSummary) {
      console.log('BST TAPD Filler: No text to optimize');
      return null;
    }

    // 构建原始描述文本
    const originalTexts = rectangles.length > 0
      ? rectangles.map(r => `${r.order}、${r.text || ''}`).join('\n')
      : (this.bugData?.issuesSummary || '');

    const prompt = [
      '你是一个 BUG 文案优化助手，负责将测试人员输入的问题描述润色为更专业、清晰的表达。',
      '',
      '严格规则：',
      '1. 仅对用户输入的问题描述进行规范化润色，使表达更专业清晰；',
      '2. 绝对不要添加用户没有提到的信息，不要臆想、不要无中生有；',
      '3. 如果用户输入包含多条（如 1、xxx  2、xxx），必须逐条保留编号并分别优化，不要合并；',
      '4. 返回 JSON 格式：{"title": "优化后的简洁标题", "descriptions": ["优化后的描述1", "优化后的描述2"], "detail": "整合后的详细描述"}',
      '5. title 应该简洁概括所有问题，不超过 30 字；',
      '6. descriptions 数组的长度必须和输入的条目数完全一致；',
      '7. detail 需要是可直接贴到缺陷单里的完整详细描述；',
      '8. 不要输出 JSON 以外的任何文字。',
      '',
      `问题标签：${tagText || '（无）'}`,
      '',
      '用户原始输入：',
      originalTexts
    ].join('\n');

    console.log('BST TAPD Filler: AI copywriting request', { originalTexts, tagText });

    const controller = new AbortController();
    const timeoutMs = ai.timeoutMs || 6000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(ai.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ai.apiKey}`
        },
        body: JSON.stringify({
          model: ai.model,
          messages: [
            { role: 'system', content: '你是一个 BUG 文案优化助手。只返回 JSON，不要输出其他内容。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      if (data?.error) {
        throw new Error(data.error?.message || 'AI provider returned error');
      }
      console.log('BST TAPD Filler: AI copywriting response raw', data);

      const content = data?.choices?.[0]?.message?.content || '';
      let parsed = null;
      try {
        const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        console.log('BST TAPD Filler: AI copywriting response not valid JSON', content);
        return null;
      }

      // 基本校验：不能比原始条目多
      if (parsed && Array.isArray(parsed.descriptions)) {
        if (parsed.descriptions.length > rectangles.length && rectangles.length > 0) {
          console.log('BST TAPD Filler: AI returned more descriptions than input, trimming');
          parsed.descriptions = parsed.descriptions.slice(0, rectangles.length);
        }
      }

      console.log('BST TAPD Filler: AI copywriting parsed result', parsed);
      return parsed;
    } catch (error) {
      clearTimeout(timer);
      console.log('BST TAPD Filler: AI copywriting request failed', { error: error?.message, timeoutMs });
      return null;
    }
  }

  async fetchAiCopywritingCached(bugId) {
    if (bugId && this.aiCopywritingCache.has(bugId)) {
      return this.aiCopywritingCache.get(bugId);
    }
    const result = await this.fetchAiCopywriting();
    if (bugId && result) {
      this.aiCopywritingCache.set(bugId, result);
    }
    return result;
  }

  findElementBySelectors(selectors = []) {
    for (const sel of selectors) {
      if (sel.css) {
        const el = document.querySelector(sel.css);
        if (el) return el;
      }
      if (sel.xpath) {
        const el = this.evaluateXPath(sel.xpath);
        if (el) return el;
      }
    }
    return null;
  }

  evaluateXPath(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch (e) {
      console.log('BST TAPD Filler: XPath error', xpath, e);
      return null;
    }
  }

  matchByMapping(normalizedDesc, mapping = {}) {
    if (!mapping) return null;
    for (const [value, keywords] of Object.entries(mapping)) {
      if (!Array.isArray(keywords)) continue;
      if (keywords.some(k => normalizedDesc.includes(this.normalizeText(k)))) {
        return { target: value, source: 'mapping' };
      }
    }
    return null;
  }

  collectNativeOptions(selectEl) {
    return Array.from(selectEl.options).map(opt => ({
      value: opt.value,
      text: opt.textContent?.trim() || '',
      normalizedText: this.normalizeText(opt.textContent || ''),
      el: opt
    }));
  }

  async collectCustomOptions(cfg) {
    const selector = cfg.optionsSelector || '.ant-select-dropdown .ant-select-item-option, .el-select-dropdown__item';
    let attempts = 0;
    while (attempts < 3) {
      const nodes = Array.from(document.querySelectorAll(selector));
      if (nodes.length) {
        return nodes.map(node => ({
          value: node.getAttribute('data-value') || node.getAttribute('value') || node.textContent?.trim() || '',
          text: node.textContent?.trim() || '',
          normalizedText: this.normalizeText(node.textContent || ''),
          el: node
        }));
      }
      attempts += 1;
      await this.delay(cfg.retryDelay || 120);
    }
    return [];
  }

  pickOption(options, normalizedDesc, mappingHit, manualValue) {
    if (!options || !options.length) return null;

    // 0) 用户手填值优先
    if (manualValue) {
      const manualNorm = this.normalizeText(manualValue);
      const byValue = options.find(o => o.value === manualValue);
      if (byValue) return byValue;
      const byText = options.find(o => o.normalizedText === manualNorm);
      if (byText) return byText;
      const byValueNorm = options.find(o => this.normalizeText(o.value) === manualNorm);
      if (byValueNorm) return byValueNorm;
    }

    // 1) mapping value first
    if (mappingHit?.target) {
      const byValue = options.find(o => o.value === mappingHit.target);
      if (byValue) return byValue;
      const byText = options.find(o => o.normalizedText === this.normalizeText(mappingHit.target));
      if (byText) return byText;
    }

    // 2) description contains option text
    const byDesc = options.find(o => o.normalizedText && normalizedDesc.includes(o.normalizedText));
    if (byDesc) return byDesc;

    // 3) description contains option value
    const byValueInDesc = options.find(o => o.value && normalizedDesc.includes(this.normalizeText(o.value)));
    if (byValueInDesc) return byValueInDesc;

    return null;
  }

  applyNativeSelection(selectEl, option) {
    try {
      selectEl.value = option.value;
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {
      console.log('BST TAPD Filler: apply native selection failed', e);
    }
  }

  async openDropdown(element, cfg) {
    // click trigger if available
    if (element) {
      element.click();
    }

    // if a specific opener is provided
    if (cfg.openSelector) {
      const opener = element?.querySelector?.(cfg.openSelector) || document.querySelector(cfg.openSelector);
      opener?.click();
    }

    // optional box coordinate fallback
    if (cfg.box) {
      this.clickBox(cfg.box);
    }

    await this.delay(cfg.openDelay || 120);
  }

  clickBox(box) {
    if (!box) return;
    const centerX = box.x + (box.width || 0) / 2;
    const centerY = box.y + (box.height || 0) / 2;
    const target = document.elementFromPoint(centerX, centerY);
    if (target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: centerX, clientY: centerY }));
    }
  }

  async collapseDropdownPanels() {
    try {
      const assigneeRow = document.querySelector("[data-field-name='current_owner']");
      const blankTarget = assigneeRow?.querySelector?.('.controls')
        || assigneeRow
        || document.querySelector("[data-field-name='priority']")
        || document.body;

      if (blankTarget) {
        blankTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        blankTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        blankTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      await this.delay(80);
      document.body?.click?.();
    } catch (e) {
      console.log('BST TAPD Filler: collapse dropdown panels failed', e);
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

  insertScreenshotIntoSection(iframeDoc, body) {
    try {
      const dataUrl = this.bugData?.screenshot;
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return false;
      }

      if (body.innerHTML.includes(dataUrl) || body.querySelector('img[data-bst-screenshot=\"1\"]')) {
        return true;
      }

      const walker = iframeDoc.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.includes('【问题截图】')) {
          let targetNode = node.parentNode;
          while (targetNode && targetNode.nextSibling) {
            targetNode = targetNode.nextSibling;
            if (targetNode.nodeType === 1 && (targetNode.tagName === 'DIV' || targetNode.tagName === 'P')) {
              break;
            }
          }

          const img = iframeDoc.createElement('img');
          img.src = dataUrl;
          img.alt = 'screenshot';
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.setAttribute('data-bst-screenshot', '1');

          if (targetNode && targetNode.nodeType === 1) {
            targetNode.appendChild(img);
          } else {
            body.appendChild(img);
          }

          const event = iframeDoc.createEvent('Event');
          event.initEvent('input', true, true);
          body.dispatchEvent(event);

          return true;
        }
      }
    } catch (e) {
      console.log('Insert screenshot error:', e);
    }
    return false;
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
