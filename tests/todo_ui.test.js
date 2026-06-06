const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");

test("index page exposes the todo UI hooks", () => {
  assert.match(html, /data-todo-form/);
  assert.match(html, /data-todo-input/);
  assert.match(html, /data-todo-list/);
  assert.match(html, /data-todo-count/);
});
