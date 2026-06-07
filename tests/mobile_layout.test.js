const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");

function getBlock(source, token) {
  const tokenIndex = source.indexOf(token);
  assert.notEqual(tokenIndex, -1, `${token} should be present`);

  return getBlockAt(source, token, tokenIndex);
}

function getLastBlock(source, token) {
  let tokenIndex = -1;
  let nextTokenIndex = source.indexOf(token);

  while (nextTokenIndex !== -1) {
    tokenIndex = nextTokenIndex;
    nextTokenIndex = source.indexOf(token, tokenIndex + token.length);
  }

  assert.notEqual(tokenIndex, -1, `${token} should be present`);

  return getBlockAt(source, token, tokenIndex);
}

function getBlockAt(source, token, tokenIndex) {
  const openBraceIndex = source.indexOf("{", tokenIndex);
  assert.notEqual(openBraceIndex, -1, `${token} should have a declaration block`);

  let depth = 0;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    }

    if (source[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(openBraceIndex + 1, index);
      }
    }
  }

  assert.fail(`${token} should close its declaration block`);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

const mobileCss = getBlock(css, "@media (max-width: 560px)");

test("mobile breakpoint keeps timer controls compact and readable", () => {
  const timerDisplay = normalizeWhitespace(getBlock(mobileCss, ".timer-display"));
  const timerControls = normalizeWhitespace(getBlock(mobileCss, ".timer-controls"));

  assert.match(timerDisplay, /font-size:\s*clamp\(/);
  assert.match(timerControls, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(timerControls, /gap:\s*8px/);
});

test("mobile breakpoint keeps todo controls aligned without horizontal overflow", () => {
  const todoForm = normalizeWhitespace(getBlock(mobileCss, ".todo-form"));
  const todoItem = normalizeWhitespace(getBlock(mobileCss, ".todo-item"));
  const todoContent = normalizeWhitespace(getBlock(mobileCss, ".todo-content"));
  const pomodoroButton = normalizeWhitespace(getLastBlock(mobileCss, ".pomodoro-button"));
  const deleteButton = normalizeWhitespace(getLastBlock(mobileCss, ".delete-button"));

  assert.match(todoForm, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.match(
    todoItem,
    /grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/,
  );
  assert.match(todoContent, /grid-column:\s*2\s*\/\s*4/);
  assert.match(pomodoroButton, /grid-column:\s*2/);
  assert.match(deleteButton, /grid-column:\s*3/);
});
