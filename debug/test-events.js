// 测试脚本 - 验证事件监听器
console.log('=== Bug Shot Turbo 调试脚本 ===');

// 测试1: 检查content script是否正确加载
console.log('1. 检查content script加载状态:');
console.log('  annotator实例:', typeof annotator !== 'undefined' ? '✓ 已加载' : '✗ 未加载');

if (typeof annotator !== 'undefined') {
  console.log('  annotator.isActive:', annotator.isActive);
  console.log('  annotator构造函数:', annotator.constructor.name);
}

// 测试2: 检查Chrome API可用性
console.log('2. 检查Chrome API:');
console.log('  chrome.runtime:', typeof chrome.runtime !== 'undefined' ? '✓ 可用' : '✗ 不可用');
console.log('  chrome.runtime.onMessage:', typeof chrome.runtime.onMessage !== 'undefined' ? '✓ 可用' : '✗ 不可用');

// 测试3: 手动触发快捷键事件
console.log('3. 测试快捷键事件:');
function testKeyboardEvent() {
  const event = new KeyboardEvent('keydown', {
    key: 's',
    altKey: true,
    bubbles: true,
    cancelable: true
  });
  
  console.log('  发送Alt+S事件...');
  document.dispatchEvent(event);
  
  setTimeout(() => {
    console.log('  annotator.isActive:', typeof annotator !== 'undefined' ? annotator.isActive : '未知');
  }, 100);
}

// 测试4: 检查事件监听器
console.log('4. 检查事件监听器:');
const originalAddEventListener = document.addEventListener;
let eventListeners = [];

document.addEventListener = function(type, listener, options) {
  if (type === 'keydown') {
    eventListeners.push({ type, listener: listener.toString().substring(0, 100) + '...' });
    console.log(`  添加keydown监听器: ${listener.toString().substring(0, 50)}...`);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

// 测试5: 检查消息通信
console.log('5. 测试消息通信:');
function testMessageCommunication() {
  try {
    chrome.runtime.sendMessage({ action: 'test', data: 'debug' }, (response) => {
      console.log('  消息响应:', response);
    });
  } catch (error) {
    console.log('  消息发送失败:', error.message);
  }
}

// 运行测试
console.log('=== 开始测试 ===');
setTimeout(testKeyboardEvent, 1000);
setTimeout(testMessageCommunication, 2000);

// 导出测试函数
window.BST_DEBUG = {
  testKeyboardEvent,
  testMessageCommunication,
  getEventListeners: () => eventListeners,
  manualToggle: () => {
    if (typeof annotator !== 'undefined') {
      annotator.toggle();
      return '手动触发toggle完成';
    }
    return 'annotator未定义';
  }
};

console.log('调试工具已加载，使用 window.BST_DEBUG 访问测试函数');