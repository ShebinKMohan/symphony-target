const assert = require("node:assert/strict");
const test = require("node:test");

const { createTodoController, renderTodos } = require("../app");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test("adding a todo stores it and renders it immediately", () => {
  const storage = createStorage();
  const app = createTodoController({
    storage,
    idFactory: () => "todo-1",
  });

  const todo = app.addTodo("Buy milk");

  assert.deepEqual(todo, {
    id: "todo-1",
    text: "Buy milk",
    completed: false,
  });
  assert.equal(app.getTodos().length, 1);
  assert.match(renderTodos(app.getTodos()), /Buy milk/);
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([{ id: "todo-1", text: "Buy milk", completed: false }]),
  );
});

test("completed todos have a clear rendered state", () => {
  const app = createTodoController({
    storage: createStorage(),
    idFactory: () => "todo-1",
  });

  app.addTodo("Send invoice");
  app.toggleTodo("todo-1");

  const html = renderTodos(app.getTodos());

  assert.equal(app.getTodos()[0].completed, true);
  assert.match(html, /is-completed/);
  assert.match(html, /checked/);
});

test("deleted todos are removed and persisted", () => {
  const storage = createStorage();
  const app = createTodoController({
    storage,
    idFactory: () => "todo-1",
  });

  app.addTodo("Temporary task");
  app.deleteTodo("todo-1");

  assert.deepEqual(app.getTodos(), []);
  assert.equal(storage.getItem("todos"), JSON.stringify([]));
  assert.doesNotMatch(renderTodos(app.getTodos()), /Temporary task/);
});

test("saved todos are loaded after a refresh", () => {
  const storage = createStorage({
    todos: JSON.stringify([
      { id: "todo-1", text: "Persist me", completed: true },
    ]),
  });

  const app = createTodoController({ storage });

  assert.deepEqual(app.getTodos(), [
    { id: "todo-1", text: "Persist me", completed: true },
  ]);
  assert.match(renderTodos(app.getTodos()), /Persist me/);
  assert.match(renderTodos(app.getTodos()), /is-completed/);
});
