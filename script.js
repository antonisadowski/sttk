function animateElement(element, style, time, easing, end) {
  const init = {};
  for (const property in style) {
    init[property] = getComputedStyle(element)[property] || element.style[property];
  }
  let progress = 0;
  const regex = /\b(?:\d+(?:\.\d*)?(?:[a-z]+\b|%)?|(?:calc|var)\(.*\))/g;
  function animate() {
    if (progress < 1) {
      setTimeout(animate, 10);
      for (const property in style) {
        if (regex.test(style[property])) {
          let index = 0;
          element.style[property] = style[property].replace(regex, match => `calc(${init[property].match(regex)[index]} + ${easing(progress)} * (${match} - ${init[property].match(regex)[index++]}))`);
        }
      }
      progress += 1 / (time / 10);
    } else {
      for (const property in style) {
        element.style[property] = style[property];
      }
      end(element);
    }
  }
  animate();
}

export class Widget {
  #signals = {
    activate: {
      click: (func, event) => func(event),
      keydown: (func, event) => {
        if (event.code === "Enter") {
          func(event);
        }
      }
    },
    mousePress: { "": (func, event) => func(event), mousedown: (func, event) => func(event) },
    mouseRelease: { "": (func, event) => func(event), mouseup: (func, event) => func(event) },
    click: { "": (func, event) => func(event), click: (func, event) => func(event) },
    keyPress: { "": (func, event) => func(event), keydown: (func, event) => func(event) },
    keyRelease: { "": (func, event) => func(event), keyup: (func, event) => func(event) },
    type: { "": (func, event) => func(event), keypress: (func, event) => func(event) }
  };

  #element = null;

  constructor(element, signals) {
    this.#element = element;
    this.#element.tabIndex = "0";
    for (const signal in signals) {
      this.#signals[signal] = signals[signal];
    }
    for (const property in window) {
      if (/^on/.test(property)) {
        this.#element.addEventListener(property.slice(2), event => {
          for (const signal in this.connected) {
            this.connected[signal].forEach(connected => {
              event.widget = this;
              this.#signals[signal][event.type]?.(connected, event)
            });
          }
        });
      }
    }
  }

  connected = {};

  connect(signal, func) {
    (this.connected[signal] || (this.connected[signal] = [])).push(func);
  }

  trigger(signal, event) {
    if (this.connected[signal]) {
      for (const func of this.connected[signal]) {
        this.#signals[signal][""](func, event);
      }
    }
  }

  show(element) {
    element.appendChild(this.#element);
  }
}

export class Window extends Widget {
  #element = null;

  get x() {
    return parseFloat(getComputedStyle(this.#element).left);
  }
  set x(x) {
    this.#element.style.setProperty("--x", `${x}px`);
    this.trigger("move");
    return this.x;
  }

  get y() {
    return parseFloat(getComputedStyle(this.#element).top);
  }
  set y(y) {
    this.#element.style.setProperty("--y", `${y}px`);
    this.trigger("move");
    return this.y;
  }

  get width() {
    return parseFloat(getComputedStyle(this.#element).width);
  }
  set width(width) {
    this.#element.style.setProperty("--width", `${width}px`);
    this.trigger("resize");
    return this.width;
  }

  get height() {
    return parseFloat(getComputedStyle(this.#element).height);
  }
  set height(height) {
    this.#element.style.setProperty("--height", `${height}px`);
    this.trigger("resize");
    return this.height;
  }

  get title() {
    return this.#element.querySelector(".sttk-window-title").innerHTML;
  }
  set title(title) {
    this.#element.querySelector(".sttk-window-title").innerHTML = title;
    return this.title;
  }

  get maximized() {
    return this.#element.classList.contains("maximized");
  }
  set maximized(maximized) {
    if (this.maximized !== maximized) {
      if (maximized) {
        animateElement(this.#element, {
          left: "0px",
          top: "0px",
          width: "100vw",
          height: "100vh"
        }, 250, x => 1 - (1 - x) ** 2, element => element.classList.add("maximized"));
      } else {
        animateElement(this.#element, {
          left: "var(--x)",
          top: "var(--y)",
          width: "var(--width)",
          height: "var(--height)"
        }, 250, x => 1 - (1 - x) ** 2, element => element.classList.remove("maximized"));
      }
    }
  }

  child = null;

  constructor(properties = {}) {
    const element = document.createElement("div");
    super(element, {
      move: {
        "": (event, func) => {
          event.windowX = this.x;
          event.windowY = this.y;
          func(event);
        }
      },
      resize: {
        "": (event, func) => {
          event.windowWidth = this.width;
          event.windowHeight = this.height;
          func(event);
        }
      }
    });
    this.#element = element;

    element.classList.add("sttk-window");
    element.style.opacity = "0";
    element.style.transform = `matrix(0.75, 0, 0, 0.75, 0, ${0.25 * Math.max(64, properties.height ?? 64)})`;

    element.innerHTML += `<div export class=\"sttk-window-title\">${properties.title ?? ""}</div><svg export class=\"sttk-window-close-button\" width=\"8\" height=\"8\" viewBox=\"-4 -4 16 16\">\
<path d=\"M0,0l8,8m0,-8l-8,8\" />\
</svg>`;
    element.querySelector(".sttk-window-close-button").addEventListener("click", () => this.close());

    element.addEventListener("mousedown", event => {
      event.truncX = Math.max(0, Math.min(event.x, innerWidth));
      event.truncY = Math.max(0, Math.min(event.y, innerHeight));
      event.elementX = event.x - element.getBoundingClientRect().x - parseFloat(getComputedStyle(element).borderLeftWidth) - parseFloat(getComputedStyle(element).paddingLeft);
      event.elementY = event.y - element.getBoundingClientRect().y - parseFloat(getComputedStyle(element).borderTopWidth) - parseFloat(getComputedStyle(element).paddingTop);
      if (event.elementX < 16 && event.elementY < -parseFloat(getComputedStyle(element).borderTopWidth) + 16) {
        event.preventDefault();
        const truncX = event.truncX;
        const truncY = event.truncY;
        const elementX = event.elementX;
        const elementY = event.elementY;
        const width = this.width;
        const height = this.height;
        const mousemove = event => {
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.x = Math.min(event.truncX - elementX, this.x + this.width - 64);
          this.y = Math.min(event.truncY - elementY - parseFloat(getComputedStyle(element).borderTopWidth), this.y + this.height - 64);
          this.width = Math.max(64, width + truncX - event.truncX);
          this.height = Math.max(64, height + truncY - event.truncY);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", () => document.removeEventListener("mousemove", mousemove));
      } else if (event.elementX > this.width - 16 && event.elementY < -parseFloat(getComputedStyle(element).borderTopWidth) + 16) {
        event.preventDefault();
        const truncX = event.truncX;
        const truncY = event.truncY;
        const elementY = event.elementY;
        const width = this.width;
        const height = this.height;
        const mousemove = event => {
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.y = Math.min(event.truncY - elementY - parseFloat(getComputedStyle(element).borderTopWidth), this.y + this.height - 64);
          this.width = Math.max(64, width + event.truncX - truncX);
          this.height = Math.max(64, height + truncY - event.truncY);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", () => document.removeEventListener("mousemove", mousemove));
      } else if (event.elementX > this.width - 16 && event.elementY > this.height - 16) {
        event.preventDefault();
        const truncX = event.truncX;
        const truncY = event.truncY;
        const width = this.width;
        const height = this.height;
        const mousemove = event => {
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.width = Math.max(64, width + event.truncX - truncX);
          this.height = Math.max(64, height + event.truncY - truncY);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", () => document.removeEventListener("mousemove", mousemove));
      } else if (event.elementX < 16 && event.elementY > this.height - 16) {
        event.preventDefault();
        const truncX = event.truncX;
        const truncY = event.truncY;
        const elementX = event.elementX;
        const width = this.width;
        const height = this.height;
        const mousemove = event => {
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.x = Math.min(event.truncX - elementX, this.x + this.width - 64);
          this.width = Math.max(64, width + truncX - event.truncX);
          this.height = Math.max(64, height + event.truncY - truncY);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", () => document.removeEventListener("mousemove", mousemove));
      } else if (event.elementY < -parseFloat(getComputedStyle(element).borderTopWidth) + 16) {
        event.preventDefault();
        const truncY = event.truncY;
        const elementY = event.elementY;
        const height = this.height;
        const mousemove = event => {
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.y = Math.min(event.truncY - elementY - parseFloat(getComputedStyle(element).borderTopWidth), this.y + this.height - 64);
          this.height = Math.max(64, height + truncY - event.truncY);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", () => document.removeEventListener("mousemove", mousemove));
      } else if (event.elementX > this.width - 16) {
        event.preventDefault();
        const truncX = event.truncX;
        const width = this.width;
        const mousemove = event => {
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.width = Math.max(64, width + event.truncX - truncX);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", () => document.removeEventListener("mousemove", mousemove));
      } else if (event.elementY > this.height - 16) {
        event.preventDefault();
        const truncY = event.truncY;
        const height = this.height;
        const mousemove = event => {
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.height = Math.max(64, height + event.truncY - truncY);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", () => document.removeEventListener("mousemove", mousemove));
      } else if (event.elementX < 16) {
        event.preventDefault();
        const truncX = event.truncX;
        const elementX = event.elementX;
        const width = this.width;
        const mousemove = event => {
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.x = Math.min(event.truncX - elementX, this.x + this.width - 64);
          this.width = Math.max(64, width + truncX - event.truncX);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", () => document.removeEventListener("mousemove", mousemove));
      } else if (event.elementY < 0) {
        event.preventDefault();
        let elementX = event.elementX;
        const elementY = event.elementY;
        const mousemove = event => {
          if (this.maximized) {
            this.maximized = false;
            elementX = parseFloat(this.#element.style.getPropertyValue("--width")) / 2;
          }
          event.truncX = Math.max(0, Math.min(event.x, innerWidth));
          event.truncY = Math.max(0, Math.min(event.y, innerHeight));
          this.x = event.truncX - elementX;
          this.y = event.truncY - elementY - parseFloat(getComputedStyle(element).borderTopWidth);
        };
        document.addEventListener("mousemove", mousemove);
        document.addEventListener("mouseup", event => {
          document.removeEventListener("mousemove", mousemove);
          if (event.clientY < 16) {
            this.maximized = true;
          }
        });
      }
    });

    element.addEventListener("mousemove", event => {
      event.elementX = event.x - element.getBoundingClientRect().x - parseFloat(getComputedStyle(element).borderLeftWidth) - parseFloat(getComputedStyle(element).paddingLeft);
      event.elementY = event.y - element.getBoundingClientRect().y - parseFloat(getComputedStyle(element).borderTopWidth) - parseFloat(getComputedStyle(element).paddingTop);
      if (event.elementY < 0) {
        element.style.cursor = "move";
      } else {
        element.style.cursor = "auto";
      }
      if (!this.maximized) {
        if (event.elementX < 16 && event.elementY < -parseFloat(getComputedStyle(element).borderTopWidth) + 16) {
          element.style.cursor = "nw-resize";
        } else if (event.elementX > this.width - 16 && event.elementY < -parseFloat(getComputedStyle(element).borderTopWidth) + 16) {
          element.style.cursor = "ne-resize";
        } else if (event.elementX > this.width - 16 && event.elementY > this.height - 16) {
          element.style.cursor = "se-resize";
        } else if (event.elementX < 16 && event.elementY > this.height - 16) {
          element.style.cursor = "sw-resize";
        } else if (event.elementY < -parseFloat(getComputedStyle(element).borderTopWidth) + 16) {
          element.style.cursor = "n-resize";
        } else if (event.elementX > this.width - 16) {
          element.style.cursor = "e-resize";
        } else if (event.elementY > this.height - 16) {
          element.style.cursor = "s-resize";
        } else if (event.elementX < 16) {
          element.style.cursor = "w-resize";
        }
      }
    });

    for (const property in properties) {
      this[property] = properties[property];
    }
  }

  show(element) {
    super.show(element);
    this.width = Math.max(64, this.width);
    this.height = Math.max(64, this.height);
    animateElement(this.#element, {
      opacity: "1", transform: "matrix(1, 0, 0, 1, 0, 0)"
    }, 125, x => 1 - (1 - x) ** 2, () => {});
  }

  showAll(element) {
    this.show(element);
    this.child?.showAll?.(this.#element);
  }

  close() {
    animateElement(this.#element, { opacity: "0", transform: "matrix(0.75, 0, 0, 0.75, 0, 0)" }, 125, x => 1 - (1 - x) ** 2, () => this.#element.remove());
  }
}

export class Box extends Widget {
  #element = null;

  get orientation() {
    return this.#element.style.getPropertyValue("--orientation") || "horizontal";
  }
  set orientation(orientation) {
    this.#element.style.setProperty("--orientation", orientation);
    return this.orientation;
  }

  children = [];

  constructor(properties = {}) {
    const element = document.createElement("div");
    super(element, {});
    this.#element = element;

    element.classList.add("sttk-box");

    for (const property in properties) {
      this[property] = properties[property];
    }
  }

  append(widget) {
    this.children.push(widget);
  }

  showAll(element) {
    this.show(element);
    this.children.forEach(child => child.showAll(this.#element));
  }
}

export class Grid extends Widget {
  #element = null;

  children = [];

  constructor() {
    const element = document.createElement("div");
    super(element, {});
    this.#element = element;

    element.classList.add("sttk-grid");
  }

  add(widget, columnIndex, rowIndex, columnSpan, rowSpan) {
    this.children.push({
      widget,
      columnIndex,
      rowIndex,
      columnSpan,
      rowSpan
    });
  }

  showAll(element) {
    this.show(element);
    this.#element.childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("sttk-grid-item")) {
        node.remove();
      }
    });
    this.children.forEach(child => {
      const element = document.createElement("div");
      element.classList.add("sttk-grid-item");
      element.style.setProperty("--column-index", child.columnIndex);
      element.style.setProperty("--row-index", child.rowIndex);
      element.style.setProperty("--column-span", child.columnSpan);
      element.style.setProperty("--row-span", child.rowSpan);
      child.widget.showAll(element);
      this.#element.appendChild(element);
    });
  }
}

export class Label extends Widget {
  #element = null;

  get text() {
    return this.#element.textContent;
  }
  set text(text) {
    this.#element.textContent = text;
    return this.text;
  }

  get html() {
    return this.#element.innerHTML;
  }
  set html(html) {
    this.#element.innerHTML = html;
    return this.html;
  }

  get selectable() {
    return this.#element.style.getPropertyValue("--select") !== "none";
  }
  set selectable(selectable) {
    this.#element.style.setProperty("--select", selectable ? "contain" : "none");
    return this.selectable;
  }

  constructor(properties = {}) {
    const element = document.createElement("div");
    super(element, {});
    this.#element = element;

    element.classList.add("sttk-label");

    this.selectable = false;
    for (const property in properties) {
      this[property] = properties[property];
    }
  }

  showAll(element) {
    this.show(element);
  }
}

export class Button extends Widget {
  #element = null;

  get text() {
    return this.#element.textContent;
  }
  set text(text) {
    this.#element.textContent = text;
    return this.text;
  }

  get html() {
    return this.#element.innerHTML;
  }
  set html(html) {
    this.#element.innerHTML = html;
    return this.html;
  }

  constructor(properties = {}) {
    const element = document.createElement("div");
    super(element, {});
    this.#element = element;

    element.classList.add("sttk-button");

    for (const property in properties) {
      this[property] = properties[property];
    }
  }

  showAll(element) {
    this.show(element);
  }
}

export class Entry extends Widget {
  #element = null;

  get text() {
    return this.#element.value;
  }
  set text(text) {
    this.#element.value = text;
    return this.text;
  }

  get placeholder() {
    return this.#element.placeholder;
  }
  set placeholder(placeholder) {
    this.#element.placeholder = placeholder;
    return this.placeholder;
  }

  constructor(properties = {}) {
    const element = document.createElement("input");
    super(element, {
      confirm: {
        keydown: (func, event) => {
          if (event.code === "Enter") {
            func(event);
          }
        }
      }
    });
    this.#element = element;

    element.type = "text";
    element.classList.add("sttk-entry");

    for (const property in properties) {
      this[property] = properties[property];
    }
  }

  showAll(element) {
    this.show(element);
  }
}