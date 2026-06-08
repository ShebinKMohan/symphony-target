const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const {
  createPomodoroTimer,
  initPomodoroApp,
} = require("../app");

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

function datasetFromAttributes(attributes = {}) {
  return Object.entries(attributes).reduce((dataset, [name, value]) => {
    if (!name.startsWith("data-")) {
      return dataset;
    }

    const key = name
      .slice(5)
      .replace(/-([a-z])/g, (_match, character) => character.toUpperCase());
    dataset[key] = value;
    return dataset;
  }, {});
}

function createElement(attributes = {}) {
  const listeners = new Map();

  return {
    attributes: {},
    dataset: datasetFromAttributes(attributes),
    disabled: Boolean(attributes.disabled),
    innerHTML: "",
    style: {},
    textContent: "",
    value: attributes.value || "",
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).forEach((listener) => listener(event));
    },
    focus() {},
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
}

function createDocument(elements) {
  const listeners = new Map();

  return {
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).forEach((listener) => listener(event));
    },
    removeEventListener(type, listener) {
      listeners.set(
        type,
        (listeners.get(type) || []).filter((storedListener) => storedListener !== listener),
      );
    },
    querySelector(selector) {
      return elements[selector] || null;
    },
    querySelectorAll(selector) {
      return elements[selector] || [];
    },
  };
}

function createAppDocument() {
  const focusButton = createElement({ "data-session-mode": "focus" });
  const breakButton = createElement({ "data-session-mode": "break" });
  const startButton = createElement({ "data-timer-action": "start" });
  const pauseButton = createElement({ "data-timer-action": "pause" });
  const resetButton = createElement({ "data-timer-action": "reset" });
  const elements = {
    "[data-completed-count]": createElement(),
    "[data-linked-todo]": createElement(),
    "[data-pomodoro-timer]": createElement(),
    "[data-session-history]": createElement(),
    "[data-session-label]": createElement(),
    "[data-timer-display]": createElement(),
    "[data-timer-progress]": createElement(),
    "[data-timer-status]": createElement(),
    "[data-session-mode]": [focusButton, breakButton],
    "[data-timer-action]": [startButton, pauseButton, resetButton],
  };

  return {
    document: createDocument(elements),
    elements,
  };
}

function createWindow() {
  let intervalCallback = null;

  return {
    clearInterval() {},
    getIntervalCallback() {
      return intervalCallback;
    },
    setInterval(callback) {
      intervalCallback = callback;
      return 1;
    },
  };
}

test("index page exposes the Pomodoro timer UI hooks", () => {
  assert.match(html, /data-pomodoro-timer/);
  assert.match(html, /data-timer-display/);
  assert.match(html, /data-timer-status/);
  assert.match(html, /data-session-mode="focus"/);
  assert.match(html, /data-session-mode="break"/);
  assert.match(html, /data-timer-action="start"/);
  assert.match(html, /data-timer-action="pause"/);
  assert.match(html, /data-timer-action="reset"/);
  assert.match(html, /data-linked-todo/);
  assert.match(html, /data-session-history/);
  assert.match(html, /data-duration-settings/);
  assert.match(html, /data-duration-input="focus"/);
  assert.match(html, /data-duration-input="break"/);
  assert.match(html, /data-duration-save/);
  assert.match(html, /data-duration-status/);
  assert.match(html, /data-daily-focus-summary/);
  assert.match(html, /data-daily-focus-sessions/);
  assert.match(html, /data-daily-focus-session-label/);
  assert.match(html, /data-daily-focus-minutes/);
});

test("completed Pomodoro sessions use newly available todos and render after reload", () => {
  const storage = createStorage();
  const { document, elements } = createAppDocument();
  const window = createWindow();

  const pomodoro = initPomodoroApp({
    document,
    storage,
    window,
    timer: createPomodoroTimer({ focusSeconds: 1, breakSeconds: 5 }),
    sessionIdFactory: () => "session-1",
    nowFactory: () => new Date("2026-06-06T10:30:00.000Z"),
  });

  storage.setItem(
    "todos",
    JSON.stringify([{ id: "todo-1", text: "Write project brief", completed: false }]),
  );
  document.dispatchEvent({ type: "todos:changed" });

  assert.equal(elements["[data-linked-todo]"].disabled, false);
  assert.match(elements["[data-linked-todo]"].innerHTML, /Write project brief/);

  elements["[data-linked-todo]"].value = "todo-1";
  pomodoro.timer.start();
  window.getIntervalCallback()();

  assert.match(elements["[data-session-history]"].innerHTML, /Write project brief/);
  pomodoro.stop();

  const reload = createAppDocument();
  const reloadWindow = createWindow();

  initPomodoroApp({
    document: reload.document,
    storage,
    window: reloadWindow,
    timer: createPomodoroTimer({ focusSeconds: 1, breakSeconds: 5 }),
  });

  assert.match(reload.elements["[data-session-history]"].innerHTML, /Write project brief/);
});

test("index page exposes Todo hooks for Pomodoro session tracking", () => {
  assert.match(html, /data-todo-form/);
  assert.match(html, /data-todo-input/);
  assert.match(html, /data-todo-search/);
  assert.match(html, /data-todo-count/);
  assert.match(html, /data-todo-list/);
});

test("index page keeps todo UI hooks alongside the Pomodoro timer", () => {
  assert.match(html, /data-todo-form/);
  assert.match(html, /data-todo-input/);
  assert.match(html, /data-todo-list/);
  assert.match(html, /data-todo-count/);
  assert.match(html, /data-todo-filter="all"/);
  assert.match(html, /data-todo-filter="active"/);
  assert.match(html, /data-todo-filter="completed"/);
});
