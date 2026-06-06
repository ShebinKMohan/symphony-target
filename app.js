const STORAGE_KEY = "todos";

function getDefaultStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function cloneTodo(todo) {
  return {
    id: todo.id,
    text: todo.text,
    completed: Boolean(todo.completed),
  };
}

function loadTodos(storage = getDefaultStorage()) {
  if (!storage) {
    return [];
  }

  try {
    const rawTodos = storage.getItem(STORAGE_KEY);
    const parsedTodos = rawTodos ? JSON.parse(rawTodos) : [];

    if (!Array.isArray(parsedTodos)) {
      return [];
    }

    return parsedTodos
      .filter((todo) => todo && typeof todo.id === "string" && typeof todo.text === "string")
      .map(cloneTodo);
  } catch (_error) {
    return [];
  }
}

function saveTodos(todos, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(todos.map(cloneTodo)));
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTodoController(options = {}) {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const idFactory = options.idFactory || createId;
  let todos = loadTodos(storage);

  function persist() {
    saveTodos(todos, storage);
  }

  return {
    getTodos() {
      return todos.map(cloneTodo);
    },

    addTodo(text) {
      const cleanText = String(text || "").trim();

      if (!cleanText) {
        return null;
      }

      const todo = {
        id: idFactory(),
        text: cleanText,
        completed: false,
      };

      todos = [todo, ...todos];
      persist();

      return cloneTodo(todo);
    },

    toggleTodo(id) {
      todos = todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      );
      persist();
    },

    deleteTodo(id) {
      todos = todos.filter((todo) => todo.id !== id);
      persist();
    },
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function renderTodos(todos) {
  if (!todos.length) {
    return '<li class="empty-state">No todos yet</li>';
  }

  return todos
    .map((todo) => {
      const id = escapeHtml(todo.id);
      const text = escapeHtml(todo.text);
      const completedClass = todo.completed ? " is-completed" : "";
      const checked = todo.completed ? " checked" : "";

      return `
        <li class="todo-item${completedClass}" data-id="${id}">
          <label class="todo-check">
            <input type="checkbox" data-action="toggle" data-id="${id}"${checked} aria-label="Toggle ${text}">
            <span class="checkmark" aria-hidden="true"></span>
          </label>
          <span class="todo-text">${text}</span>
          <button class="delete-button" type="button" data-action="delete" data-id="${id}" aria-label="Delete ${text}">Delete</button>
        </li>
      `;
    })
    .join("");
}

function initTodoApp(options = {}) {
  const rootDocument = options.document || document;
  const controller = createTodoController({ storage: options.storage });
  const form = rootDocument.querySelector("[data-todo-form]");
  const input = rootDocument.querySelector("[data-todo-input]");
  const list = rootDocument.querySelector("[data-todo-list]");
  const count = rootDocument.querySelector("[data-todo-count]");

  function render() {
    const todos = controller.getTodos();
    const completed = todos.filter((todo) => todo.completed).length;
    const active = todos.length - completed;

    list.innerHTML = renderTodos(todos);
    count.textContent = `${active} active / ${completed} complete`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const todo = controller.addTodo(input.value);

    if (todo) {
      input.value = "";
      input.focus();
      render();
    }
  });

  list.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      return;
    }

    if (actionTarget.dataset.action === "toggle") {
      controller.toggleTodo(actionTarget.dataset.id);
    }

    if (actionTarget.dataset.action === "delete") {
      controller.deleteTodo(actionTarget.dataset.id);
    }

    render();
  });

  render();

  return controller;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => initTodoApp());
}

if (typeof module !== "undefined") {
  module.exports = {
    createTodoController,
    loadTodos,
    renderTodos,
    saveTodos,
  };
}
