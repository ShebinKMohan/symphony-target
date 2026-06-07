const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createPomodoroTimer,
  handlePomodoroShortcut,
  handleTodoInputShortcut,
} = require("../app");

function createKeyboardEvent({ key, code = "", target = { tagName: "BODY" } }) {
  let defaultPrevented = false;

  return {
    key,
    code,
    target,
    preventDefault() {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  };
}

test("Enter adds a todo from the focused todo input and clears it", () => {
  const addedTodos = [];
  const input = {
    value: " Draft review notes ",
    focused: false,
    focus() {
      this.focused = true;
    },
  };
  const controller = {
    addTodo(text) {
      addedTodos.push(text);
      return { id: "todo-1", text: text.trim(), completed: false };
    },
  };
  let renderCount = 0;

  const event = createKeyboardEvent({ key: "Enter", target: input });
  const handled = handleTodoInputShortcut(event, {
    controller,
    input,
    render: () => {
      renderCount += 1;
    },
  });

  assert.equal(handled, true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(addedTodos, [" Draft review notes "]);
  assert.equal(input.value, "");
  assert.equal(input.focused, true);
  assert.equal(renderCount, 1);
});

test("Escape clears the current todo input without adding a todo", () => {
  const input = { value: "Half typed task" };
  const controller = {
    addTodo() {
      throw new Error("Escape should not add a todo");
    },
  };

  const event = createKeyboardEvent({ key: "Escape", target: input });
  const handled = handleTodoInputShortcut(event, {
    controller,
    input,
    render: () => {
      throw new Error("Escape should not re-render the todo list");
    },
  });

  assert.equal(handled, true);
  assert.equal(event.defaultPrevented, true);
  assert.equal(input.value, "");
});

test("todo shortcuts ignore ordinary typing", () => {
  const input = { value: "Keep typing" };
  const event = createKeyboardEvent({ key: "k", target: input });

  const handled = handleTodoInputShortcut(event, {
    controller: {
      addTodo() {
        throw new Error("ordinary typing should not add a todo");
      },
    },
    input,
    render: () => {
      throw new Error("ordinary typing should not re-render");
    },
  });

  assert.equal(handled, false);
  assert.equal(event.defaultPrevented, false);
  assert.equal(input.value, "Keep typing");
});

test("Space toggles the Pomodoro timer when focus is outside text fields", () => {
  const timer = createPomodoroTimer({ focusSeconds: 10, breakSeconds: 5 });
  let renderCount = 0;

  const startEvent = createKeyboardEvent({ key: " ", code: "Space" });
  const started = handlePomodoroShortcut(startEvent, timer, () => {
    renderCount += 1;
  });

  assert.equal(started, true);
  assert.equal(startEvent.defaultPrevented, true);
  assert.equal(timer.getState().isRunning, true);
  assert.equal(timer.getState().statusText, "Focus session running");

  const pauseEvent = createKeyboardEvent({ key: " ", code: "Space" });
  const paused = handlePomodoroShortcut(pauseEvent, timer, () => {
    renderCount += 1;
  });

  assert.equal(paused, true);
  assert.equal(pauseEvent.defaultPrevented, true);
  assert.equal(timer.getState().isRunning, false);
  assert.equal(timer.getState().statusText, "Paused");
  assert.equal(renderCount, 2);
});

test("Space does not toggle the Pomodoro timer from inputs or textareas", () => {
  const timer = createPomodoroTimer({ focusSeconds: 10, breakSeconds: 5 });

  for (const tagName of ["INPUT", "TEXTAREA"]) {
    const event = createKeyboardEvent({
      key: " ",
      code: "Space",
      target: { tagName },
    });

    const handled = handlePomodoroShortcut(event, timer, () => {
      throw new Error(`Space in ${tagName} should not render the timer`);
    });

    assert.equal(handled, false);
    assert.equal(event.defaultPrevented, false);
    assert.equal(timer.getState().isRunning, false);
  }
});

test("Space does not toggle the Pomodoro timer when document focus is in a text field", () => {
  const timer = createPomodoroTimer({ focusSeconds: 10, breakSeconds: 5 });
  const activeElement = { tagName: "INPUT" };
  const event = createKeyboardEvent({
    key: " ",
    code: "Space",
    target: {
      tagName: "BODY",
      ownerDocument: {
        activeElement,
      },
    },
  });

  const handled = handlePomodoroShortcut(event, timer, () => {
    throw new Error("Space should not render the timer while input focus is active");
  });

  assert.equal(handled, false);
  assert.equal(event.defaultPrevented, false);
  assert.equal(timer.getState().isRunning, false);
});
