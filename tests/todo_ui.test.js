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

test("index page exposes the todo UI hooks", () => {
  assert.match(html, /data-todo-form/);
  assert.match(html, /data-todo-input/);
  assert.match(html, /data-todo-list/);
  assert.match(html, /data-todo-count/);
});

test("todo UI metadata controls persist priority, due date, and clear date changes", () => {
  const listeners = {};
  const form = {
    addEventListener(eventName, listener) {
      listeners[`form:${eventName}`] = listener;
    },
  };
  const input = { value: "", focus() {} };
  const list = {
    innerHTML: "",
    addEventListener(eventName, listener) {
      listeners[`list:${eventName}`] = listener;
    },
  };
  const count = { textContent: "" };
  const document = {
    querySelector(selector) {
      return {
        "[data-todo-form]": form,
        "[data-todo-input]": input,
        "[data-todo-list]": list,
        "[data-todo-count]": count,
      }[selector];
    },
  };
  const storage = createStorage({
    todos: JSON.stringify([{ id: "todo-1", text: "Plan launch", completed: false }]),
  });
  const eventFor = (target) => ({
    target: {
      ...target,
      closest(selector) {
        return selector === "[data-action]" ? this : null;
      },
    },
  });

  initTodoApp({ document, storage });

  listeners["list:change"](
    eventFor({ dataset: { action: "priority", id: "todo-1" }, value: "High" }),
  );
  listeners["list:change"](
    eventFor({ dataset: { action: "due-date", id: "todo-1" }, value: "2026-06-30" }),
  );

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

  listeners["list:click"](eventFor({ dataset: { action: "clear-due-date", id: "todo-1" } }));

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
