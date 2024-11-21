// 虚拟dom渲染器
function renderer(vNode) {
  if (typeof vNode === "string")
    return document.createTextNode(vNode);

  const { tag, props, children } = vNode;
  const element = document.createElement(tag);
  Object.keys(props).forEach(key => {
    if (key.startsWith("on")) {
      const eventType = key.slice(2).toLowerCase();
      element.addEventListener(eventType, props[key]);
    } else {
      element.setAttribute(
        key === "className" ? "class" : key,
        props[key]
      );
    }
  });
  if (children) {
    if (typeof children === "string") {
      element.appendChild(
        document.createTextNode(children)
      );
    } else {
      children.forEach(vNode => {
        element.appendChild(renderer(vNode));
      });
    }
  }

  return element;
}

// id生成器
function generateID() {
  const timestamp = Date.now();
  const randomNum = (Math.random() * 16) | 0;
  return `markId-${timestamp}-${randomNum.toString(16)}`;
}

// 创建消息弹框
function createMessageBox(type, content) {
  const messageDOM = renderer({
    tag: "div",
    props: {
      className: `ml-message ml-message--${type}`
    },
    children: content
  });
  document.body.appendChild(messageDOM);

  setTimeout(() => {
    messageDOM.remove();
  }, 3000);
}

// 获取元素到顶部的距离
function getElementTopPosition(el) {
  const rect = el.getBoundingClientRect
    ? el.getBoundingClientRect()
    : el.parentNode.getBoundingClientRect();
  const scrollTop = document.documentElement.scrollTop;
  return rect.top + scrollTop;
}

// 所有划线数据
let markData;
// 当前标签的路径
const nowTabUrl = window.location.href;

// 更新本地存储的划线数据
function updateMarkData() {
  chrome.storage.local.set({ markData }).then(
    () => {
      createMessageBox("success", "操作成功");
    },
    () => {
      createMessageBox("error", "操作失败");
    }
  );
}

// 监听 background 消息（页面加载完成调用和点击划线菜单调用）
chrome.runtime.onMessage.addListener(request => {
  switch (request.action) {
    case "markAction":
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rangeInfo = {
          markId: generateID(),
          color: "#0eb0c9",
          markType: "line",
          content: range.toString(),
          endContainer: getSelectionLocation(
            range.endContainer
          ),
          endOffset: range.endOffset,
          startContainer: getSelectionLocation(
            range.startContainer
          ),
          startOffset: range.startOffset,
          offsetTop: getElementTopPosition(
            range.commonAncestorContainer
          ),
          commonAncestorContainer: {
            nodeName:
              range.commonAncestorContainer.nodeName,
            innerHTML:
              range.commonAncestorContainer.innerHTML,
            innerText:
              range.commonAncestorContainer.innerText,
            className:
              range.commonAncestorContainer.className,
            textContent:
              range.commonAncestorContainer.textContent
          }
        };
        const span = createMarkElement(rangeInfo);

        const nowTabIndex = markData.findIndex(
          item => item.tabInfo.url === nowTabUrl
        );

        if (nowTabIndex !== -1) {
          markData[nowTabIndex].markList.push(rangeInfo);
        } else {
          markData.push({
            tabInfo: {
              title: request.activeTab.title,
              url: request.activeTab.url
            },
            markList: [rangeInfo]
          });
        }
        updateMarkData();
        range.surroundContents(span);
      }
      break;
    case "loadingComplete":
      chrome.storage.local.get(["markData"]).then(value => {
        markData = value?.markData ?? [];

        // 获取当前标签页的划线数据
        const nowTabMarkData = markData.find(
          item => item.tabInfo.url === nowTabUrl
        );

        if (nowTabMarkData) {
          const selection = window.getSelection();
          setTimeout(() => {
            nowTabMarkData.markList.forEach(markInfo => {
              const range = document.createRange();

              range.setStart(
                getNodeDOM(markInfo.startContainer),
                markInfo.startOffset
              );
              range.setEnd(
                getNodeDOM(markInfo.endContainer),
                markInfo.endOffset
              );

              selection.addRange(range);

              const spanElement =
                createMarkElement(markInfo);
              selection
                .getRangeAt(0)
                .surroundContents(spanElement);

              selection.removeAllRanges();
            });
          }, 0);
        }
      });
      break;
    case "position":
      window.scrollTo({
        top: request.offsetTop - 100,
        behavior: "smooth"
      });
      break;
  }
});

// 修改划线的样式
function setMark(target, type, value) {
  const markId = target.getAttribute("mark-id");

  const nowTabIndex = markData.findIndex(
    item => item.tabInfo.url === nowTabUrl
  );
  const nowMarkIndex = markData[
    nowTabIndex
  ].markList.findIndex(item => item.markId === markId);

  switch (type) {
    case "type":
      markData[nowTabIndex].markList[
        nowMarkIndex
      ].markType = value;
      target.className = `ml-mark ml-mark--${value}`;
      break;
    case "color":
      markData[nowTabIndex].markList[nowMarkIndex].color =
        value;
      target.style.setProperty("--ml-mark-color", value);
      break;
    case "del":
      markData[nowTabIndex].markList.splice(
        nowMarkIndex,
        1
      );
      break;
  }

  updateMarkData();
}

// 创建高亮设置弹框
function createHighlightSettings(el) {
  const children = [
    {
      onClick: () => {
        setMark(el.target, "type", "line");
      },
      imgUrl: chrome.runtime.getURL("icon/mark-line.png")
    },
    {
      onClick: () => {
        setMark(el.target, "type", "bg");
      },
      imgUrl: chrome.runtime.getURL(`icon/mark-bg.png`)
    },
    {
      onClick: () => {
        setMark(el.target, "del");
      },
      imgUrl: chrome.runtime.getURL(`icon/mark-del.png`)
    }
  ];

  const highlightSettings = renderer({
    tag: "div",
    props: {
      id: "ml-highlight-settings"
    },
    children: [
      {
        tag: "div",
        props: {
          className:
            "ml-highlight-settings_button ml-set-color",
          onClick: () => {
            const el = document.getElementsByClassName(
              "ml-set-color_color-picker"
            )[0];
            el.style.display = "block";
            createColorPicker();
          }
        },
        children: [
          {
            tag: "div",
            props: {
              style: `background-color:${window
                .getComputedStyle(el.target)
                .getPropertyValue("--ml-mark-color")}`,
              className: "ml-set-color_now-color"
            }
          },
          {
            tag: "div",
            props: {
              className: "ml-set-color_color-picker"
            },
            children: [
              {
                tag: "canvas",
                props: {
                  id: "color-canvas",
                  width: 300,
                  height: 150
                }
              },
              {
                tag: "div",
                props: {
                  className:
                    "ml-set-color_color-picker_button",
                  onClick: e => {
                    const color =
                      e.target.style.backgroundColor;
                    setMark(el.target, "color", color);
                  }
                },
                children: "确定"
              }
            ]
          }
        ]
      },
      ...children.map(({ onClick, imgUrl }) => ({
        tag: "div",
        props: {
          className: "ml-highlight-settings_button",
          onClick
        },
        children: [
          {
            tag: "img",
            props: {
              src: imgUrl
            }
          }
        ]
      }))
    ]
  });

  return highlightSettings;
}

// 移除高亮设置框的计时器
let hideTimeout = null;
// 划线部分鼠标移入事件
function markMouseover(e) {
  let highlightSettingsDOM = document.getElementById(
    "ml-highlight-settings"
  );
  if (!highlightSettingsDOM) {
    highlightSettingsDOM = createHighlightSettings(e);
    highlightSettingsDOM.addEventListener(
      "mouseenter",
      () => {
        showHighlightSettings(highlightSettingsDOM);
      }
    );
    highlightSettingsDOM.addEventListener(
      "mouseleave",
      () => {
        delHighlightSettings(highlightSettingsDOM);
      }
    );
    document.body.appendChild(highlightSettingsDOM);
  }

  const rect = e.target.getBoundingClientRect();
  highlightSettingsDOM.style.top = `${
    rect.top + window.scrollY + rect.height
  }px`;
  highlightSettingsDOM.style.left = `${
    rect.left +
    window.scrollX +
    rect.width -
    highlightSettingsDOM.offsetWidth
  }px`;

  showHighlightSettings(highlightSettingsDOM);
}
// 划线部分鼠标移出事件
function markMouseleave() {
  const highlightSettingsDOM = document.getElementById(
    "ml-highlight-settings"
  );
  delHighlightSettings(highlightSettingsDOM);
}
// 移除高亮设置弹框
function delHighlightSettings(dom) {
  dom.classList.remove("ml-highlight-settings--show");
  hideTimeout = setTimeout(() => {
    dom.remove();
    hideTimeout = null;
  }, 300);
}
// 显示高亮设置弹框并移除计时器
function showHighlightSettings(dom) {
  dom.className = "ml-highlight-settings--show";
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

// 获取划线内容在网页中的位置
function getSelectionLocation(container) {
  const path = [];
  while (container.nodeName !== "BODY") {
    const index = Array.from(
      container.parentNode.childNodes
    ).indexOf(container);
    path.unshift(`${container.nodeName}-${index}`);
    container = container.parentNode;
  }
  return path.join("/");
}

// 创建颜色选择器
function createColorPicker() {
  const canvas = document.getElementById("color-canvas");
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(
    0,
    0,
    canvas.width,
    0
  );
  gradient.addColorStop(0, "red");
  gradient.addColorStop(0.17, "yellow");
  gradient.addColorStop(0.34, "green");
  gradient.addColorStop(0.51, "cyan");
  gradient.addColorStop(0.68, "blue");
  gradient.addColorStop(0.85, "magenta");
  gradient.addColorStop(1, "red");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 添加点击事件，获取点击位置的颜色
  canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const pixel = ctx.getImageData(x, y, 1, 1).data;

    const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    const buttonDOM = document.getElementsByClassName(
      "ml-set-color_color-picker_button"
    )[0];
    buttonDOM.style.backgroundColor = color;
  });
}

// 创建包裹选中部分的元素
function createMarkElement(markInfo) {
  const element = renderer({
    tag: "span",
    props: {
      className: `ml-mark ml-mark--${markInfo.markType}`,
      "mark-id": markInfo.markId,
      onMouseover: markMouseover,
      onMouseleave: markMouseleave
    }
  });
  element.style.setProperty(
    "--ml-mark-color",
    markInfo.color
  );

  return element;
}

// 获取路径处理后的dom元素
function getNodeDOM(path) {
  const nodeNames = path.split("/");
  let currentNode = document.body;

  for (const nodeName of nodeNames) {
    const [name, index] = nodeName.split("-");
    const children = Array.from(currentNode.childNodes);

    currentNode = children[index];
    if (!currentNode || currentNode.nodeName !== name) {
      return null;
    }
  }
  return currentNode;
}
