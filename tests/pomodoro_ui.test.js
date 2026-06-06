const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");

test("index page exposes the Pomodoro timer UI hooks", () => {
  assert.match(html, /data-pomodoro-timer/);
  assert.match(html, /data-timer-display/);
  assert.match(html, /data-timer-status/);
  assert.match(html, /data-session-mode="focus"/);
  assert.match(html, /data-session-mode="break"/);
  assert.match(html, /data-timer-action="start"/);
  assert.match(html, /data-timer-action="pause"/);
  assert.match(html, /data-timer-action="reset"/);
});

test("index page exposes Todo hooks for Pomodoro session tracking", () => {
  assert.match(html, /data-todo-form/);
  assert.match(html, /data-todo-input/);
  assert.match(html, /data-todo-count/);
  assert.match(html, /data-todo-list/);
});
