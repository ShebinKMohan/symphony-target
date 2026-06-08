const assert = require("node:assert/strict");
const test = require("node:test");

const { createTodoController, getFilteredTodos, renderTodos } = require("../app");

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
    priority: "Medium",
    dueDate: "",
  });
  assert.equal(app.getTodos().length, 1);
  assert.match(renderTodos(app.getTodos()), /Buy milk/);
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([
      { id: "todo-1", text: "Buy milk", completed: false, priority: "Medium", dueDate: "" },
    ]),
  );
});

test("priority and due date can be edited and persisted", () => {
  const storage = createStorage();
  const app = createTodoController({
    storage,
    idFactory: () => "todo-1",
  });

  app.addTodo("File taxes");
  app.updateTodoMetadata("todo-1", { priority: "High", dueDate: "2026-06-30" });

  assert.deepEqual(app.getTodos(), [
    {
      id: "todo-1",
      text: "File taxes",
      completed: false,
      priority: "High",
      dueDate: "2026-06-30",
    },
  ]);
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([
      {
        id: "todo-1",
        text: "File taxes",
        completed: false,
        priority: "High",
        dueDate: "2026-06-30",
      },
    ]),
  );

  const html = renderTodos(app.getTodos());

  assert.match(html, /<option value="High" selected>/);
  assert.match(html, /value="2026-06-30"/);
});

test("due dates can be cleared without losing priority", () => {
  const storage = createStorage();
  const app = createTodoController({
    storage,
    idFactory: () => "todo-1",
  });

  app.addTodo("Renew passport");
  app.updateTodoMetadata("todo-1", { priority: "Low", dueDate: "2026-07-10" });
  app.updateTodoMetadata("todo-1", { dueDate: "" });

  assert.deepEqual(app.getTodos(), [
    {
      id: "todo-1",
      text: "Renew passport",
      completed: false,
      priority: "Low",
      dueDate: "",
    },
  ]);
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([
      {
        id: "todo-1",
        text: "Renew passport",
        completed: false,
        priority: "Low",
        dueDate: "",
      },
    ]),
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
    { id: "todo-1", text: "Persist me", completed: true, priority: "Medium", dueDate: "" },
  ]);
  assert.match(renderTodos(app.getTodos()), /Persist me/);
  assert.match(renderTodos(app.getTodos()), /is-completed/);
  assert.match(renderTodos(app.getTodos()), /<option value="Medium" selected>/);
});

test("todo filters return all, active, and completed without changing storage", () => {
  const storage = createStorage();
  const ids = ["todo-1", "todo-2"];
  const app = createTodoController({
    storage,
    idFactory: () => ids.shift(),
  });

  app.addTodo("Read notes");
  app.addTodo("Send update");
  app.toggleTodo("todo-1");

  assert.deepEqual(
    getFilteredTodos(app.getTodos(), "all").map((todo) => todo.text),
    ["Send update", "Read notes"],
  );
  assert.deepEqual(
    getFilteredTodos(app.getTodos(), "active").map((todo) => todo.text),
    ["Send update"],
  );
  assert.deepEqual(
    getFilteredTodos(app.getTodos(), "completed").map((todo) => todo.text),
    ["Read notes"],
  );
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([
      { id: "todo-2", text: "Send update", completed: false, priority: "Medium", dueDate: "" },
      { id: "todo-1", text: "Read notes", completed: true, priority: "Medium", dueDate: "" },
    ]),
  );
});

test("todo notes can be added, edited, cleared, and persisted", () => {
  const storage = createStorage();
  const app = createTodoController({
    storage,
    idFactory: () => "todo-1",
  });

  app.addTodo("Draft launch note");

  const addedNote = app.updateTodoNote("todo-1", "  Discuss launch blockers  ");

  assert.deepEqual(addedNote, {
    id: "todo-1",
    text: "Draft launch note",
    completed: false,
    priority: "Medium",
    dueDate: "",
    note: "Discuss launch blockers",
  });
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([
      {
        id: "todo-1",
        text: "Draft launch note",
        completed: false,
        priority: "Medium",
        dueDate: "",
        note: "Discuss launch blockers",
      },
    ]),
  );

  const editedNote = app.updateTodoNote("todo-1", "Send summary after standup");

  assert.equal(editedNote.note, "Send summary after standup");

  const clearedNote = app.updateTodoNote("todo-1", "");

  assert.deepEqual(clearedNote, {
    id: "todo-1",
    text: "Draft launch note",
    completed: false,
    priority: "Medium",
    dueDate: "",
  });
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([
      {
        id: "todo-1",
        text: "Draft launch note",
        completed: false,
        priority: "Medium",
        dueDate: "",
      },
    ]),
  );
});

test("saved notes render with editable controls and old todos still render", () => {
  const storage = createStorage({
    todos: JSON.stringify([
      {
        id: "todo-1",
        text: "Review order",
        completed: false,
        note: "Bring receipts & SKU list",
      },
      { id: "todo-2", text: "Legacy todo", completed: true },
    ]),
  });

  const app = createTodoController({ storage });
  const html = renderTodos(app.getTodos());

  assert.deepEqual(app.getTodos(), [
    {
      id: "todo-1",
      text: "Review order",
      completed: false,
      priority: "Medium",
      dueDate: "",
      note: "Bring receipts & SKU list",
    },
    { id: "todo-2", text: "Legacy todo", completed: true, priority: "Medium", dueDate: "" },
  ]);
  assert.match(html, /class="todo-note-input"/);
  assert.match(html, /data-action="save-note"/);
  assert.match(html, /data-action="clear-note"/);
  assert.match(html, /Bring receipts &amp; SKU list/);
  assert.match(html, /Legacy todo/);
  assert.doesNotMatch(html, /undefined/);
});

test("long notes are escaped and kept inside the note editor", () => {
  const longNote = `${"followup".repeat(24)} <call>`;
  const html = renderTodos([
    {
      id: "todo-1",
      text: "Handle long note",
      completed: false,
      note: longNote,
    },
  ]);

  assert.match(html, /class="todo-note-input"/);
  assert.match(html, /followupfollowup/);
  assert.match(html, /&lt;call&gt;/);
});

test("getTodos applies case-insensitive search to todo titles and notes", () => {
  const app = createTodoController({
    storage: createStorage({
      todos: JSON.stringify([
        { id: "todo-1", text: "Buy Milk", completed: false, notes: "oat carton" },
        { id: "todo-2", text: "Plan meals", completed: true, notes: "include kale" },
        { id: "todo-3", text: "File taxes", completed: false, notes: "quarterly receipts" },
      ]),
    }),
  });

  assert.deepEqual(app.getTodos({ search: "milk" }).map((todo) => todo.id), ["todo-1"]);
  assert.deepEqual(app.getTodos({ search: "KALE" }).map((todo) => todo.id), ["todo-2"]);
  assert.deepEqual(app.getTodos({ search: "   " }).map((todo) => todo.id), [
    "todo-1",
    "todo-2",
    "todo-3",
  ]);
});

test("saved todos with title fields remain searchable", () => {
  const app = createTodoController({
    storage: createStorage({
      todos: JSON.stringify([
        { id: "todo-1", title: "Buy Milk", completed: false, notes: "oat carton" },
      ]),
    }),
  });

  assert.deepEqual(app.getTodos({ search: "milk" }), [
    {
      id: "todo-1",
      text: "Buy Milk",
      completed: false,
      priority: "Medium",
      dueDate: "",
      notes: "oat carton",
    },
  ]);
});

test("getTodos combines search with completion status filters", () => {
  const app = createTodoController({
    storage: createStorage({
      todos: JSON.stringify([
        { id: "todo-1", text: "Call accountant", completed: false, notes: "invoice follow-up" },
        { id: "todo-2", text: "Archive receipt", completed: true, notes: "invoice paid" },
        { id: "todo-3", text: "Plan meals", completed: false, notes: "weekly menu" },
      ]),
    }),
  });

  assert.deepEqual(app.getTodos({ search: "invoice", status: "active" }).map((todo) => todo.id), [
    "todo-1",
  ]);
  assert.deepEqual(app.getTodos({ search: "invoice", status: "completed" }).map((todo) => todo.id), [
    "todo-2",
  ]);
});

test("pomodoro sessions are associated with todos and persisted", () => {
  const storage = createStorage();
  const app = createTodoController({
    storage,
    idFactory: () => "todo-1",
    sessionIdFactory: () => "session-1",
    now: () => "2026-06-06T10:00:00.000Z",
  });

  app.addTodo("Draft proposal");

  const session = app.logPomodoroSession("todo-1");

  assert.deepEqual(session, {
    id: "session-1",
    minutes: 25,
    completedAt: "2026-06-06T10:00:00.000Z",
  });
  assert.deepEqual(app.getTodos()[0].pomodoroSessions, [session]);
  assert.equal(
    storage.getItem("todos"),
    JSON.stringify([
      {
        id: "todo-1",
        text: "Draft proposal",
        completed: false,
        priority: "Medium",
        dueDate: "",
        pomodoroSessions: [session],
      },
    ]),
  );
});

test("todo rows show tracked focus time for pomodoro sessions", () => {
  const app = createTodoController({
    storage: createStorage({
      todos: JSON.stringify([
        {
          id: "todo-1",
          text: "Write tests",
          completed: false,
          pomodoroSessions: [
            { id: "session-1", minutes: 25, completedAt: "2026-06-06T10:00:00.000Z" },
            { id: "session-2", minutes: 25, completedAt: "2026-06-06T10:30:00.000Z" },
          ],
        },
      ]),
    }),
  });

  const html = renderTodos(app.getTodos());

  assert.match(html, /2 pomodoros/);
  assert.match(html, /50 min focus/);
  assert.match(html, /data-action="pomodoro"/);
});

test("filtered empty states are short and specific", () => {
  assert.match(renderTodos([], { filter: "all" }), /No todos yet/);
  assert.match(renderTodos([], { filter: "active" }), /No active todos/);
  assert.match(renderTodos([], { filter: "completed" }), /No completed todos/);
});
