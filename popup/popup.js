// 虚拟dom渲染器
function renderer(vNode) {
  if (typeof vNode === "string")
    return document.createTextNode(vNode);

  const { tag, props, children } = vNode;
  const element = document.createElement(tag);
  if (props) {
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
  }
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

// 获取 main 元素
const main = document.getElementById("main");

// 获取全部的划线数据
let markData;
chrome.storage.local.get(["markData"]).then(value => {
  markData = value?.markData ?? [];
  main.appendChild(createMarkListEl());
});

// 创建划线列表元素
function createMarkListEl() {
  return renderer({
    tag: "ul",
    props: {
      className: "mark-list"
    },
    children: markData.map((item, index) => ({
      tag: "li",
      props: {
        className: "mark-list_item"
      },
      children: [
        {
          tag: "p",
          props: {
            className: "mark-list_item-title",
            onClick: e => {
              switch (e.target.tagName) {
                case "SPAN":
                  const markListDetails =
                    e.target.parentNode.nextElementSibling;
                  const isOpen =
                    markListDetails.style.maxHeight &&
                    markListDetails.style.maxHeight !==
                      "0px";

                  if (isOpen) {
                    markListDetails.style.maxHeight = "0";
                  } else {
                    markListDetails.style.maxHeight =
                      markListDetails.scrollHeight + "px";
                  }
                  break;
                case "IMG":
                  markData.splice(index, 1);
                  chrome.storage.local.set({ markData });
                  e.target.parentNode.parentNode.remove();
                  break;
              }
            }
          },
          children: [
            {
              tag: "span",
              children: item.tabInfo.title
            },
            {
              tag: "img",
              props: {
                src: "../icon/mark-del.png"
              }
            }
          ]
        },
        createMarkDetailsEl(item)
      ]
    }))
  });
}

// 创建每一页面的划线详情列表
function createMarkDetailsEl(markInfo) {
  return {
    tag: "ul",
    props: {
      className: "mark-list_item-details"
    },
    children: markInfo.markList.map((item, index) => ({
      tag: "li",
      props: {
        className: "mark-list_sub-item",
        onClick: () => {
          chrome.runtime.sendMessage({
            action: "position",
            offsetTop: item.offsetTop
          });
          chrome.tabs.create({
            active: true,
            url: markInfo.tabInfo.url
          });
        }
      },
      children: [
        {
          tag: "span",
          children: item.content
        },
        {
          tag: "img",
          props: {
            src: "../icon/mark-del.png",
            onClick: e => {
              e.stopPropagation();
              markInfo.markList.splice(index, 1);
              chrome.storage.local.set({ markData });
              e.target.parentNode.remove();
            }
          }
        }
      ]
    }))
  };
}
