// Bug Shot Turbo - 快速修复脚本
// 在页面console中执行此脚本进行问题排查

(function() {
  console.log('🔧 Bug Shot Turbo 快速修复脚本启动...');
  
  // 1. 检查基本环境
  const checks = {
    chrome: typeof chrome !== 'undefined',
    chromeRuntime: typeof chrome?.runtime !== 'undefined',
    annotator: typeof annotator !== 'undefined',
    url: window.location.href,
    protocol: window.location.protocol
  };
  
  console.log('✅ 环境检查:', checks);
  
  // 2. 检查扩展ID和版本
  try {
    if (chrome?.runtime) {
      console.log('📦 扩展ID:', chrome.runtime.id);
      console.log('📦 Manifest:', chrome.runtime.getManifest()?.name);
    }
  } catch (e) {
    console.log('❌ 无法获取扩展信息:', e.message);
  }
  
  // 3. 重新注册键盘监听器（备用方案）
  function setupBackupKeyListener() {
    console.log('🔑 设置备用键盘监听器...');
    
    // 移除可能的旧监听器
    document.removeEventListener('keydown', window.BST_BACKUP_LISTENER);
    
    // 创建新的监听器
    window.BST_BACKUP_LISTENER = function(e) {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        console.log('🎯 备用监听器捕获Alt+S');
        e.preventDefault();
        e.stopPropagation();
        
        if (typeof annotator !== 'undefined') {
          annotator.toggle();
          console.log('✅ 通过备用监听器启动标注工具');
        } else {
          console.log('❌ annotator实例不存在');
        }
        
        return false;
      }
    };
    
    // 注册监听器（使用capture模式，最高优先级）
    document.addEventListener('keydown', window.BST_BACKUP_LISTENER, true);
    console.log('✅ 备用键盘监听器已激活');
  }
  
  // 4. 测试快捷键功能
  function testShortcut() {
    console.log('🧪 测试快捷键功能...');
    
    // 创建模拟事件
    const testEvent = new KeyboardEvent('keydown', {
      key: 's',
      altKey: true,
      bubbles: true,
      cancelable: true,
      code: 'KeyS'
    });
    
    console.log('📤 发送测试事件:', testEvent);
    document.dispatchEvent(testEvent);
    
    setTimeout(() => {
      if (typeof annotator !== 'undefined') {
        console.log('📊 当前annotator状态:', {
          isActive: annotator.isActive,
          overlay: !!annotator.overlay
        });
      }
    }, 100);
  }
  
  // 5. 强制初始化annotator
  function forceInitAnnotator() {
    console.log('⚡ 强制重新初始化annotator...');
    
    try {
      // 如果已存在，先清理
      if (typeof annotator !== 'undefined') {
        annotator.cleanup();
      }
      
      // 重新创建
      if (typeof ScreenshotAnnotator !== 'undefined') {
        window.annotator = new ScreenshotAnnotator();
        console.log('✅ annotator重新创建成功');
      } else {
        console.log('❌ ScreenshotAnnotator类不存在');
      }
    } catch (error) {
      console.log('❌ 重新初始化失败:', error);
    }
  }
  
  // 6. 检查页面兼容性
  function checkPageCompatibility() {
    const isCompatible = 
      window.location.protocol.startsWith('http') && 
      !window.location.href.startsWith('chrome://') &&
      !window.location.href.startsWith('chrome-extension://');
    
    console.log('🌐 页面兼容性:', isCompatible ? '✅ 兼容' : '❌ 不兼容');
    
    if (!isCompatible) {
      console.log('💡 提示: 请在普通网页上使用此扩展，特殊页面不支持');
    }
    
    return isCompatible;
  }
  
  // 执行所有检查和修复
  console.log('🚀 开始执行修复流程...');
  
  if (checkPageCompatibility()) {
    setupBackupKeyListener();
    
    setTimeout(() => {
      testShortcut();
    }, 500);
    
    if (typeof annotator === 'undefined') {
      forceInitAnnotator();
    }
  }
  
  // 提供手动控制函数
  window.BST_FIX = {
    setupBackupKeyListener,
    testShortcut,
    forceInitAnnotator,
    checkPageCompatibility,
    manualToggle: () => {
      if (typeof annotator !== 'undefined') {
        annotator.toggle();
        return '✅ 手动触发成功';
      }
      return '❌ annotator不存在';
    },
    getStatus: () => {
      return {
        annotator: typeof annotator !== 'undefined',
        isActive: typeof annotator !== 'undefined' ? annotator.isActive : null,
        chrome: typeof chrome !== 'undefined',
        url: window.location.href
      };
    }
  };
  
  console.log('✅ 快速修复脚本加载完成');
  console.log('💡 使用 BST_FIX.manualToggle() 手动测试功能');
  console.log('💡 使用 BST_FIX.getStatus() 查看当前状态');
  
})();