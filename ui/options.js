// Bug Shot Turbo - Options鑴氭湰 - 鍙墿灞曟爣绛剧増鏈?

class OptionsManager {
  constructor() {
    this.config = null;
    this.currentEditingTag = null;
    this.selectedTags = new Set();
    this.searchTimeout = null;
    this.dropdownListBound = false;
    this.menuRulesBound = false;
    this.init();
  }

  async init() {
    console.log('BST Options: Initializing...');
    
    // 绛夊緟鏍囩绠＄悊鍣ㄥ垵濮嬪寲
    await this.initTagsManager();
    
    // 鍔犺浇褰撳墠閰嶇疆
    await this.loadConfig();
    
    // 鏄剧ず閰嶇疆
    this.displayConfig();
    
    // 缁戝畾浜嬩欢
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
      if (!Array.isArray(this.config.dropdowns)) {
        this.config.dropdowns = [];
      }
      if (!Array.isArray(this.config.menuRules)) {
        this.config.menuRules = this.getDefaultConfig().menuRules;
      }
      if (!this.config.ai) {
        this.config.ai = this.getDefaultConfig().ai;
      }
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
          title: document.getElementById('titleTemplate').value,
          description: document.getElementById('descTemplate').value
        },
        ai: {
        enable: false,
        endpoint: "",
        apiKey: "",
        model: "",
        timeoutMs: 5000
      },
      dropdowns: [],
      menuRules: [
        {
          domain: "https://supply-test.ycb51.cn/",
          menuXPath: "/html/body/div[1]/div/section/section/div[1]/ul/li/ul/li",
          activeClass: "is-active",
          titleSelector: ".title"
        }
      ]
    };
  }

  displayConfig() {
    // 鏄剧ずTAPD椤圭洰閰嶇疆
    this.displayTapdConfig();
    
    // 鏄剧ず鏍囩绠＄悊
    this.displayTagsManagement();

    // 鏄剧ずAI閰嶇疆
    this.displayAiConfig();

    // 鏄剧ず鑿滃崟瑙勫垯
    this.renderMenuRules();

    // 缁戝畾 AI 娴嬭瘯
    const aiTestBtn = document.getElementById('aiTestBtn');
    if (aiTestBtn) {
      aiTestBtn.addEventListener('click', () => this.testAiConnectivity());
    }
  }

  displayTapdConfig() {
    document.getElementById('tapdProjectIds').value = this.config.tapd.projectIds.join(', ');
    document.getElementById('tapdDomains').value = this.config.tapd.domains.join(', ');
    document.getElementById('titleSelector').value = this.config.selectors.title;
    document.getElementById('descIframeSelector').value = this.config.selectors.descIframe;
    document.getElementById('descBodySelector').value = this.config.selectors.descBody;
    document.getElementById('titleTemplate').value = this.config.templates.title;
    document.getElementById('descTemplate').value = this.config.templates.description;
    this.renderDropdowns();
  }

  displayAiConfig() {
    const ai = this.config.ai || {};
    const enableEl = document.getElementById('aiEnable');
    if (!enableEl) return;
    enableEl.checked = !!ai.enable;
    document.getElementById('aiEndpoint').value = ai.endpoint || '';
    document.getElementById('aiKey').value = ai.apiKey || '';
    document.getElementById('aiModel').value = ai.model || '';
    document.getElementById('aiTimeout').value = ai.timeoutMs || 5000;
  }

  async displayTagsManagement() {
    if (!window.BST_TagsManager) return;

    // 鏄剧ず鏍囩璁剧疆
    const settings = window.BST_TagsManager.getSettings();
    document.getElementById('maxRecent').value = settings.maxRecent || 8;
    document.getElementById('showCategories').checked = settings.showCategories !== false;
    document.getElementById('showColors').checked = settings.showColors !== false;
    document.getElementById('allowQuickCreate').checked = settings.allowQuickCreate !== false;

    // 鏄剧ず鍒嗙被鍒楄〃
    await this.renderCategories();

    // 鏄剧ず鏍囩鍒楄〃
    await this.renderTagsList();

    // 鏇存柊缁熻淇℃伅
    this.updateStats();
  }

  async renderCategories() {
    const categoriesList = document.getElementById('categoriesList');
    const categories = window.BST_TagsManager.categories || [];
    
    categoriesList.innerHTML = categories.map(category => `
      <div class="category-chip" data-category-id="${category.id}">
        <div class="color-dot" style="background: ${category.color}"></div>
        <span>${category.name}</span>
        <button class="edit-btn" onclick="editCategory('${category.id}')">鉁忥笍</button>
      </div>
    `).join('');
  }

  async renderTagsList(searchTerm = '', sortBy = 'category') {
    const tagsList = document.getElementById('tagsList');
    const tags = window.BST_TagsManager.getAllTags();
    const tagUsage = window.BST_TagsManager.getTagUsageStats();

    let filteredTags = tags;
    
    // 鎼滅储杩囨护
    if (searchTerm) {
      filteredTags = window.BST_TagsManager.searchTags(searchTerm);
    }

    // 鎺掑簭
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
            ${tag.favorite ? '<span class="tag-favorite">鈽?/span>' : ''}
          </div>
          <div class="tag-stats">
            <span>浣跨敤 ${usage.count}</span>
            ${usage.lastUsedAt ? `<span>${this.formatDate(usage.lastUsedAt)}</span>` : ''}
          </div>
          <div class="tag-actions">
            <button class="tag-action-btn" onclick="optionsManager.editTag('${tag.id}')" title="缂栬緫">鉁忥笍</button>
            <button class="tag-action-btn" onclick="optionsManager.duplicateTag('${tag.id}')" title="澶嶅埗">馃搵</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ===== 涓嬫媺閰嶇疆娓叉煋涓庨噰闆?=====

  renderDropdowns() {
    const list = document.getElementById('dropdownList');
    if (!list) return;

    const data = Array.isArray(this.config.dropdowns) ? this.config.dropdowns : [];
    if (!data.length) {
      list.innerHTML = '<div class="empty-state">鏆傛棤涓嬫媺閰嶇疆锛岀偣鍑烩€滄柊澧炰笅鎷夆€濆紑濮嬮厤缃?/div>';
      return;
    }

    list.innerHTML = data.map((item, index) => this.buildDropdownCard(item, index)).join('');
  }

    buildDropdownCard(item = {}, index = 0) {
    const selectors = item.selectors || [];
    const css = selectors.find(s => s.css)?.css || '';
    const xpath = selectors.find(s => s.xpath)?.xpath || '';
    const candidatesText = Array.isArray(item.candidates) && item.candidates.length
      ? item.candidates.join('\n')
      : Object.keys(item.mapping || {}).join('\n');
    const type = item.type || 'native';

    return `
      <div class="dropdown-card" data-index="${index}">
        <div class="card-row header">
          <input type="text" class="dropdown-name" placeholder="下拉名称，如 问题类型" value="${this.escapeHTML(item.name || '')}">
          <select class="dropdown-type">
            <option value="native" ${type === 'native' ? 'selected' : ''}>native</option>
            <option value="antd" ${type === 'antd' ? 'selected' : ''}>antd</option>
            <option value="element" ${type === 'element' ? 'selected' : ''}>element</option>
            <option value="custom" ${type === 'custom' ? 'selected' : ''}>custom</option>
          </select>
          <button class="btn-text dropdown-remove">删除</button>
        </div>
        <div class="card-row">
          <label>CSS 选择器</label>
          <input type="text" class="dropdown-css" placeholder="#module-select" value="${this.escapeHTML(css)}">
        </div>
        <div class="card-row">
          <label>XPath 选择器（可选）</label>
          <input type="text" class="dropdown-xpath" placeholder="//label[contains(.,\"所属模块\")]/following::select[1]" value="${this.escapeHTML(xpath)}">
        </div>
        <div class="card-row split">
          <div>
            <label>展开选择器（可选）</label>
            <input type="text" class="dropdown-open-selector" placeholder=".ant-select-selector" value="${this.escapeHTML(item.openSelector || '')}">
          </div>
          <div>
            <label>选项选择器（可选）</label>
            <input type="text" class="dropdown-options-selector" placeholder=".ant-select-dropdown .ant-select-item-option" value="${this.escapeHTML(item.optionsSelector || '')}">
          </div>
        </div>
        <div class="card-row mappings">
          <div class="row-title">候选值（每行一个，AI 只从这些候选里选择）</div>
          <textarea class="dropdown-candidates" rows="4" placeholder="例如：\nfatal\nserious\nnormal\nprompt\nadvice">${this.escapeHTML(candidatesText)}</textarea>
        </div>
      </div>
    `;
  }

  mappingEntries(mappingObj = {}) {
    if (!mappingObj || typeof mappingObj !== 'object') return [];
    return Object.entries(mappingObj).map(([value, keywords]) => ({
      value,
      keywords: Array.isArray(keywords) ? keywords.join(', ') : ''
    }));
  }

  bindDropdownListEvents() {
    if (this.dropdownListBound) return;
    const list = document.getElementById('dropdownList');
    if (!list) return;

    list.addEventListener('click', (e) => {
      const card = e.target.closest('.dropdown-card');
      if (!card) return;
      const index = parseInt(card.dataset.index, 10);

      if (e.target.classList.contains('dropdown-remove')) {
        this.removeDropdown(index);
      }

      if (e.target.classList.contains('add-mapping')) {
        this.addMappingRow(index);
      }

      if (e.target.classList.contains('remove-mapping')) {
        const mapIndex = parseInt(e.target.closest('.mapping-row')?.dataset.mapIndex || '-1', 10);
        this.removeMappingRow(index, mapIndex);
      }
    });

    this.dropdownListBound = true;
  }

  addDropdownCard() {
    // 鍏堝悓姝ュ綋鍓嶈〃鍗曪紝鍐嶆柊澧?
    this.config.dropdowns = this.collectDropdownsFromDom();
    this.config.dropdowns.push({
      name: '',
      type: 'native',
      selectors: [{ css: '' }],
      mapping: {}
    });
    this.renderDropdowns();
  }

  removeDropdown(index) {
    this.config.dropdowns = this.collectDropdownsFromDom();
    this.config.dropdowns.splice(index, 1);
    this.renderDropdowns();
  }

  addMappingRow(dropdownIndex) {
    this.config.dropdowns = this.collectDropdownsFromDom();
    const target = this.config.dropdowns[dropdownIndex];
    if (!target.mapping) target.mapping = {};
    target.mapping[''] = [];
    this.renderDropdowns();
  }

  removeMappingRow(dropdownIndex, mapIndex) {
    this.config.dropdowns = this.collectDropdownsFromDom();
    const target = this.config.dropdowns[dropdownIndex];
    const entries = this.mappingEntries(target.mapping);
    if (entries[mapIndex]) {
      delete target.mapping[entries[mapIndex].value];
    }
    this.renderDropdowns();
  }

  collectDropdownsFromDom() {
    const cards = Array.from(document.querySelectorAll('.dropdown-card'));
    const dropdowns = [];

    cards.forEach(card => {
      const name = card.querySelector('.dropdown-name')?.value?.trim() || '';
      const type = card.querySelector('.dropdown-type')?.value || 'native';
      const css = card.querySelector('.dropdown-css')?.value?.trim() || '';
      const xpath = card.querySelector('.dropdown-xpath')?.value?.trim() || '';
      const openSelector = card.querySelector('.dropdown-open-selector')?.value?.trim() || '';
      const optionsSelector = card.querySelector('.dropdown-options-selector')?.value?.trim() || '';
      const candidatesRaw = card.querySelector('.dropdown-candidates')?.value || '';

      const selectors = [];
      if (css) selectors.push({ css });
      if (xpath) selectors.push({ xpath });

      const candidates = candidatesRaw.split(/\n|[,，]/).map(s => s.trim()).filter(Boolean);

      if (!name && selectors.length === 0) {
        return; // 璺宠繃绌哄崱
      }

      const item = {
        name,
        type,
        selectors,
        candidates
      };
      if (openSelector) item.openSelector = openSelector;
      if (optionsSelector) item.optionsSelector = optionsSelector;

      dropdowns.push(item);
    });

    return dropdowns;
  }

  // ===== 鑿滃崟瑙勫垯娓叉煋涓庨噰闆?=====

  renderMenuRules() {
    const list = document.getElementById('menuRulesList');
    if (!list) return;

    const data = Array.isArray(this.config.menuRules) ? this.config.menuRules : [];
    if (!data.length) {
      list.innerHTML = '<div class="empty-state">鏆傛棤鑿滃崟瑙勫垯锛岀偣鍑烩€滄柊澧炶鍒欌€濆紑濮嬮厤缃?/div>';
      return;
    }

    list.innerHTML = data.map((item, index) => this.buildMenuRuleCard(item, index)).join('');
  }

    buildMenuRuleCard(item = {}, index = 0) {
    return `
      <div class="menu-rule-card" data-index="${index}">
        <div class="card-row header">
          <input type="text" class="menu-rule-domain" placeholder="https://supply-test.ycb51.cn/" value="${this.escapeHTML(item.domain || '')}">
          <button class="btn-text menu-rule-remove">删除</button>
        </div>
        <div class="card-row">
          <label>二级菜单 XPath</label>
          <input type="text" class="menu-rule-xpath" placeholder="/html/body/.../ul/li/ul/li" value="${this.escapeHTML(item.menuXPath || '')}">
        </div>
        <div class="card-row split">
          <div>
            <label>活动类名</label>
            <input type="text" class="menu-rule-active" placeholder="is-active" value="${this.escapeHTML(item.activeClass || '')}">
          </div>
          <div>
            <label>标题选择器</label>
            <input type="text" class="menu-rule-title" placeholder=".title" value="${this.escapeHTML(item.titleSelector || '')}">
          </div>
        </div>
      </div>
    `;
  }

  bindMenuRulesEvents() {
    if (this.menuRulesBound) return;
    const list = document.getElementById('menuRulesList');
    if (!list) return;

    list.addEventListener('click', (e) => {
      if (!e.target.classList.contains('menu-rule-remove')) return;
      const card = e.target.closest('.menu-rule-card');
      if (!card) return;
      const index = parseInt(card.dataset.index, 10);
      if (Number.isNaN(index)) return;
      this.removeMenuRule(index);
    });

    this.menuRulesBound = true;
  }

  addMenuRuleCard() {
    this.config.menuRules = this.collectMenuRulesFromDom();
    this.config.menuRules.push({
      domain: '',
      menuXPath: '',
      activeClass: '',
      titleSelector: ''
    });
    this.renderMenuRules();
  }

  removeMenuRule(index) {
    this.config.menuRules = this.collectMenuRulesFromDom();
    this.config.menuRules.splice(index, 1);
    this.renderMenuRules();
  }

  collectMenuRulesFromDom() {
    const cards = Array.from(document.querySelectorAll('.menu-rule-card'));
    const rules = [];

    cards.forEach(card => {
      const domain = card.querySelector('.menu-rule-domain')?.value?.trim() || '';
      const menuXPath = card.querySelector('.menu-rule-xpath')?.value?.trim() || '';
      const activeClass = card.querySelector('.menu-rule-active')?.value?.trim() || '';
      const titleSelector = card.querySelector('.menu-rule-title')?.value?.trim() || '';

      if (!domain && !menuXPath && !activeClass && !titleSelector) {
        return;
      }

      rules.push({
        domain,
        menuXPath,
        activeClass,
        titleSelector
      });
    });

    return rules;
  }

  validateDropdownMappings() {
    const cards = Array.from(document.querySelectorAll('.dropdown-card'));
    let hasError = false;
    const messages = [];

    cards.forEach((card, cardIndex) => {
      const dropdownName = card.querySelector('.dropdown-name')?.value?.trim() || `Dropdown ${cardIndex + 1}`;
      const candidatesRaw = card.querySelector('.dropdown-candidates')?.value || '';
      const candidates = candidatesRaw.split(/\n|[,，]/).map(s => s.trim()).filter(Boolean);
      if (!candidates.length) {
        hasError = true;
        messages.push(`${dropdownName} 缺少候选值`);
      }
    });

    if (hasError) {
      this.showStatus(`保存失败: ${messages.join('；')}`, 'error');
      const firstError = document.querySelector('.dropdown-candidates');
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  async testAiConnectivity() {
    const statusEl = document.getElementById('aiTestStatus');
    const endpoint = document.getElementById('aiEndpoint')?.value?.trim();
    const apiKey = document.getElementById('aiKey')?.value?.trim();
    const model = document.getElementById('aiModel')?.value?.trim() || 'gpt-3.5-turbo';
    const timeoutMs = parseInt(document.getElementById('aiTimeout')?.value || '5000', 10) || 5000;

    if (!endpoint || !apiKey) {
      statusEl.textContent = '请先填写 Endpoint 和 API Key';
      statusEl.style.color = '#e53e3e';
      return;
    }

    statusEl.textContent = '测试中...';
    statusEl.style.color = '#718096';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'test' },
            { role: 'user', content: 'ping' }
          ],
          max_tokens: 5,
          temperature: 0
        }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      statusEl.textContent = '连通成功';
      statusEl.style.color = '#38a169';
    } catch (error) {
      clearTimeout(timer);
      statusEl.textContent = `失败: ${error?.message || '请求异常'}`;
      statusEl.style.color = '#e53e3e';
    }
  }

  escapeHTML(str = '') {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    // Tab鍒囨崲
    this.bindTabNavigation();
    
    // 淇濆瓨閰嶇疆鎸夐挳
    document.getElementById('saveOptions').addEventListener('click', () => {
      this.saveConfig();
    });
    
    // 閲嶇疆鎸夐挳
    const resetBtn = document.getElementById('resetOptions');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetConfig();
      });
    }

    // 鏁版嵁绠＄悊鎸夐挳
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

    // 涓嬫媺閰嶇疆
    const addDropdownBtn = document.getElementById('addDropdownBtn');
    if (addDropdownBtn) {
      addDropdownBtn.addEventListener('click', () => this.addDropdownCard());
    }
    this.bindDropdownListEvents();

    // 鑿滃崟瑙勫垯閰嶇疆
    const addMenuRuleBtn = document.getElementById('addMenuRuleBtn');
    if (addMenuRuleBtn) {
      addMenuRuleBtn.addEventListener('click', () => this.addMenuRuleCard());
    }
    this.bindMenuRulesEvents();

    // 鏂囦欢瀵煎叆
    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.importConfig(e.target.files[0]);
    });

    // 鏍囩绠＄悊宸茬Щ闄?
  }
  
  bindTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.option-section');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetSection = tab.dataset.section;
        
        // 绉婚櫎鎵€鏈夋椿鍔ㄧ姸鎬?
        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        
        // 娣诲姞娲诲姩鐘舵€?
        tab.classList.add('active');
        const section = document.getElementById(`${targetSection}-section`);
        if (section) {
          section.classList.add('active');
        }
        
        // 淇濆瓨褰撳墠鏍囩椤靛埌localStorage
        localStorage.setItem('bst-active-tab', targetSection);
      });
    });
    
    // 鎭㈠涓婃鐨勬爣绛鹃〉
    const lastTab = localStorage.getItem('bst-active-tab');
    if (lastTab) {
      const tab = document.querySelector(`[data-section="${lastTab}"]`);
      if (tab) {
        tab.click();
      }
    }
  }

  bindTagsEvents() {}

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
      // 鍙栨秷鍏ㄩ€?
      this.selectedTags.clear();
      allRows.forEach(row => {
        row.classList.remove('selected');
        row.querySelector('.tag-checkbox').checked = false;
      });
    } else {
      // 鍏ㄩ€?
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
      title.textContent = '缂栬緫鏍囩';
      deleteBtn.style.display = 'block';
      
      document.getElementById('tagName').value = tag.name;
      document.getElementById('tagCategory').value = tag.category;
      document.getElementById('tagColor').value = tag.color;
      document.getElementById('tagHotkey').value = tag.hotkey || '';
      document.getElementById('tagFavorite').checked = tag.favorite;
    } else {
      title.textContent = '鏂板鏍囩';
      deleteBtn.style.display = 'none';
      
      document.getElementById('tagName').value = '';
      document.getElementById('tagCategory').value = '鍔熻兘';
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
    
    // 鏇存柊閫変腑鐘舵€?
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
      this.showStatus('配置已成功保存', 'success');
    } catch (error) {
      alert('请输入标签名称');
    }
  }

  async deleteCurrentTag() {
    if (!this.currentEditingTag) return;
    
    if (confirm('确定要删除这个标签吗？')) {
      try {
        await window.BST_TagsManager.deleteTag(this.currentEditingTag);
        this.hideTagEditModal();
        await this.displayTagsManagement();
      this.showStatus('配置已成功保存', 'success');
      } catch (error) {
      alert('请输入标签名称');
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
        name: tag.name + ' (鍓湰)',
        hotkey: '', // 娓呯┖蹇嵎閿伩鍏嶅啿绐?
        favorite: false
      };
      delete newTag.id;
      
      await window.BST_TagsManager.addTag(newTag);
      await this.displayTagsManagement();
      this.showStatus('配置已成功保存', 'success');
    } catch (error) {
      alert('请输入标签名称');
    }
  }

  async deleteSelectedTags() {
    if (this.selectedTags.size === 0) return;
    
    if (confirm("确定要删除选中的  个标签吗？")) {
      try {
        const deletePromises = Array.from(this.selectedTags).map(tagId => 
          window.BST_TagsManager.deleteTag(tagId)
        );
        
        await Promise.all(deletePromises);
        this.selectedTags.clear();
        await this.displayTagsManagement();
      this.showStatus('配置已成功保存', 'success');
      } catch (error) {
      alert('请输入标签名称');
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
      this.showStatus('配置已成功保存', 'success');
    } catch (error) {
      console.error('Save tag settings error:', error);
    }
  }

  async saveConfig() {
    try {
      // 鏄剧ず鍔犺浇鐘舵€?
      const saveBtn = document.getElementById('saveOptions');
      const originalText = saveBtn.innerHTML;
      if (!this.validateDropdownMappings()) {
        return;
      }
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
        },
        ai: {
          enable: document.getElementById('aiEnable')?.checked || false,
          endpoint: document.getElementById('aiEndpoint')?.value || '',
          apiKey: document.getElementById('aiKey')?.value || '',
          model: document.getElementById('aiModel')?.value || '',
          timeoutMs: parseInt(document.getElementById('aiTimeout')?.value || '5000', 10) || 5000
        },
        dropdowns: this.collectDropdownsFromDom(),
        menuRules: this.collectMenuRulesFromDom()
      };

      await chrome.storage.local.set({ config: newConfig, dropdownConfigs: newConfig.dropdowns });
      this.config = newConfig;
      
      // 鎭㈠鎸夐挳鐘舵€?
      setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
      }, 1000);
      
      this.showStatus('配置已成功保存', 'success');
    } catch (error) {
      console.error('Save config error:', error);
      this.showStatus('保存失败: ' + error.message, 'error');
      
      // 鎭㈠鎸夐挳鐘舵€?
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
      this.showStatus('配置已成功保存', 'success');
      } catch (error) {
        console.error('Reset config error:', error);
      this.showStatus('保存失败: ' + error.message, 'error');
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
      this.showStatus('配置已成功保存', 'success');
        } else {
          throw new Error(result.error);
        }
      }

      this.displayConfig();
    } catch (error) {
      console.error('Import error:', error);
      this.showStatus('保存失败: ' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    if (confirm('确定要恢复默认配置吗？这将清除所有自定义设置。')) {
      try {
        this.config = this.getDefaultConfig();
        await chrome.storage.local.set({ config: this.config });
        await window.BST_TagsManager.resetToDefaults();
        
        this.displayConfig();
      this.showStatus('配置已成功保存', 'success');
      } catch (error) {
        console.error('Reset error:', error);
      this.showStatus('保存失败: ' + error.message, 'error');
      }
    }
  }

  async clearHistory() {
    if (confirm('确定要清除所有历史记录吗？')) {
      try {
        await chrome.storage.local.remove(['history', 'lastPackage', 'tagUsage']);
      this.showStatus('配置已成功保存', 'success');
        await this.displayTagsManagement(); // 鍒锋柊浣跨敤缁熻
      } catch (error) {
        console.error('Clear history error:', error);
      this.showStatus('保存失败: ' + error.message, 'error');
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
    
    // 鑷姩闅愯棌
    clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => {
      status.classList.remove('show');
    }, 5000);
  }
}

// 鍒濆鍖?
document.addEventListener('DOMContentLoaded', () => {
  window.optionsManager = new OptionsManager();
});

console.log('BST: Options script loaded');
