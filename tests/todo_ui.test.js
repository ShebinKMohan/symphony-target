const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const { initTodoApp } = require("../app");

const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

class FakeClassList {
  constructor(className = "") {
    this.classes = new Set(className.split(/\s+/).filter(Boolean));
  }

  contains(className) {
    return this.classes.has(className);
  }

  toggle(className, force) {
    if (force === true) {
      this.classes.add(className);
      return true;
    }

    if (force === false) {
      this.classes.delete(className);
      return false;
    }

    if (this.classes.has(className)) {
      this.classes.delete(className);
      return false;
    }

    this.classes.add(className);
    return true;
  }
}

class FakeElement {
  constructor(options = {}) {
    this.attributes = new Map();
    this.dataset = options.dataset || {};
    this.value = options.value || "";
    this.textContent = options.textContent || "";
    this.innerHTML = "";
    this.listeners = new Map();
    this.classList = new FakeClassList(options.className);
  }

  addEventListener(type, handler) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(handler);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(type, event = {}) {
    const listeners = this.listeners.get(type) || [];
    const dispatchedEvent = {
      preventDefault() {},
      target: this,
      ...event,
    };

    listeners.forEach((handler) => handler(dispatchedEvent));
  }

  focus() {
    this.focused = true;
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  closest(selector) {
    if (selector === "[data-action]" && this.dataset.action) {
      return this;
    }

    if (selector === ".todo-item" && this.todoItem) {
      return this.todoItem;
    }

    return null;
  }

  querySelector(selector) {
    if (selector === "[data-note-input]") {
      return this.noteInput || null;
    }

    return null;
  }
}

function createTodoDom() {
  const form = new FakeElement();
  const input = new FakeElement();
  const search = new FakeElement();
  const list = new FakeElement();
  const count = new FakeElement();
  const filterButtons = {
    all: new FakeElement({
      className: "todo-filter",
      dataset: { todoFilter: "all" },
    }),
    active: new FakeElement({
      className: "todo-filter",
      dataset: { todoFilter: "active" },
    }),
    completed: new FakeElement({
      className: "todo-filter",
      dataset: { todoFilter: "completed" },
    }),
  };
  const filters = Object.values(filterButtons);
  const elements = new Map([
    ["[data-todo-form]", form],
    ["[data-todo-input]", input],
    ["[data-todo-search]", search],
    ["[data-todo-list]", list],
    ["[data-todo-count]", count],
  ]);

  return {
    count,
    filterButtons,
    form,
    input,
    list,
    search,
    document: {
      querySelector(selector) {
        return elements.get(selector) || null;
      },
      querySelectorAll(selector) {
        return selector === "[data-todo-filter]" ? filters : [];
      },
      dispatchEvent() {},
    },
  };
}

function createActionTarget(action, id, options = {}) {
  return new FakeElement({
    dataset: {
      action,
      id,
    },
    value: options.value || "",
  });
}

test("index page exposes the todo UI hooks", () => {
  assert.match(html, /data-todo-form/);
  assert.match(html, /data-todo-input/);
  assert.match(html, /data-todo-search/);
  assert.match(html, /data-todo-filter="active"/);
  assert.match(html, /data-todo-list/);
  assert.match(html, /data-todo-count/);
});

test("todo UI metadata controls persist priority, due date, and clear date changes", () => {
  const storage = createStorage({
    todos: JSON.stringify([{ id: "todo-1", text: "Plan launch", completed: false }]),
  });
  const { document, list } = createTodoDom();

  initTodoApp({ document, storage });

  list.dispatchEvent("change", {
    target: createActionTarget("priority", "todo-1", { value: "High" }),
  });
  list.dispatchEvent("change", {
    target: createActionTarget("due-date", "todo-1", { value: "2026-06-30" }),
  });

  assert.deepEqual(JSON.parse(storage.getItem("todos")), [
    {
      id: "todo-1",
      text: "Plan launch",
      completed: false,
      priority: "High",
      dueDate: "2026-06-30",
    },
  ]);
  assert.match(list.innerHTML, /<option value="High" selected>/);
  assert.match(list.innerHTML, /value="2026-06-30"/);

  list.dispatchEvent("click", {
    target: createActionTarget("clear-due-date", "todo-1"),
  });

  assert.deepEqual(JSON.parse(storage.getItem("todos")), [
    {
      id: "todo-1",
      text: "Plan launch",
      completed: false,
      priority: "High",
      dueDate: "",
    },
  ]);
});

test("todo app switches filters with clear active state and persisted reload data", () => {
  const storage = createStorage({
    todos: JSON.stringify([
      { id: "todo-active", text: "Plan sprint", completed: false },
      { id: "todo-completed", text: "Close invoice", completed: true },
    ]),
  });
  const { document, list, count, filterButtons } = createTodoDom();

  initTodoApp({ document, storage });

  assert.match(list.innerHTML, /Plan sprint/);
  assert.match(list.innerHTML, /Close invoice/);
  assert.equal(count.textContent, "1 active / 1 complete");
  assert.equal(filterButtons.all.getAttribute("aria-pressed"), "true");
  assert.equal(filterButtons.all.classList.contains("is-active"), true);

  filterButtons.active.dispatchEvent("click");

  assert.match(list.innerHTML, /Plan sprint/);
  assert.doesNotMatch(list.innerHTML, /Close invoice/);
  assert.equal(filterButtons.all.getAttribute("aria-pressed"), "false");
  assert.equal(filterButtons.active.getAttribute("aria-pressed"), "true");
  assert.equal(filterButtons.active.classList.contains("is-active"), true);

  list.dispatchEvent("click", {
    target: createActionTarget("toggle", "todo-active"),
  });

  assert.match(list.innerHTML, /No active todos/);
  assert.equal(count.textContent, "0 active / 2 complete");
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([
      {
        id: "todo-active",
        text: "Plan sprint",
        completed: true,
        priority: "Medium",
        dueDate: "",
      },
      {
        id: "todo-completed",
        text: "Close invoice",
        completed: true,
        priority: "Medium",
        dueDate: "",
      },
    ]),
  );

  const { document: reloadedDocument, list: reloadedList } = createTodoDom();

  initTodoApp({ document: reloadedDocument, storage });

  assert.match(reloadedList.innerHTML, /Plan sprint/);
  assert.match(reloadedList.innerHTML, /Close invoice/);
  assert.match(reloadedList.innerHTML, /is-completed/);
});
