// 添加菜单选项
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "ml-mark",
    title: "选中划线",
    contexts: ["selection"]
  });
});
// 监听菜单点击事件
chrome.contextMenus.onClicked.addListener(info => {
  if (info.menuItemId === "ml-mark") {
    chrome.tabs.query(
      { active: true, currentWindow: true },
      tabs => {
        const activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, {
          action: "markAction",
          activeTab
        });
      }
    );
  }
});

let position = null;
chrome.runtime.onMessage.addListener(request => {
  if (request.action === "position") {
    position = request;
  }
});
chrome.tabs.onUpdated.addListener((_, changeInfo) => {
  if (changeInfo.status === "complete") {
    chrome.tabs.query(
      { active: true, currentWindow: true },
      tabs => {
        const activeTab = tabs[0];
        chrome.tabs.sendMessage(activeTab.id, {
          action: "loadingComplete"
        });
        if (position) {
          chrome.tabs.sendMessage(activeTab.id, position);
          position = null;
        }
      }
    );
  }
});
