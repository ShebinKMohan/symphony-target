const STORAGE_KEY = "todos";
const TODO_FILTERS = new Set(["all", "active", "completed"]);

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

function normalizeTodoFilter(filter) {
  return TODO_FILTERS.has(filter) ? filter : "all";
}

function getFilteredTodos(todos, filter = "all") {
  const normalizedFilter = normalizeTodoFilter(filter);
  const sourceTodos = Array.isArray(todos) ? todos : [];

  return sourceTodos
    .filter((todo) => {
      if (normalizedFilter === "active") {
        return !todo.completed;
      }

      if (normalizedFilter === "completed") {
        return todo.completed;
      }

      return true;
    })
    .map(cloneTodo);
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

function getEmptyStateMessage(filter) {
  const normalizedFilter = normalizeTodoFilter(filter);

  if (normalizedFilter === "active") {
    return "No active todos";
  }

  if (normalizedFilter === "completed") {
    return "No completed todos";
  }

  return "No todos yet";
}

function renderTodos(todos, options = {}) {
  if (!todos.length) {
    return `<li class="empty-state">${getEmptyStateMessage(options.filter)}</li>`;
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

const POMODORO_DURATIONS = {
  focus: 25 * 60,
  break: 5 * 60,
};

function normalizeDuration(value, fallback) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.floor(parsedValue);
}

function getReadyStatus(mode) {
  return mode === "break" ? "Ready for a break" : "Ready to focus";
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function createPomodoroTimer(options = {}) {
  const durations = {
    focus: normalizeDuration(options.focusSeconds, POMODORO_DURATIONS.focus),
    break: normalizeDuration(options.breakSeconds, POMODORO_DURATIONS.break),
  };
  let mode = "focus";
  let isRunning = false;
  let remainingSeconds = durations[mode];
  let completedFocusSessions = 0;
  let statusText = getReadyStatus(mode);

  function getState() {
    return {
      mode,
      isRunning,
      remainingSeconds,
      durationSeconds: durations[mode],
      completedFocusSessions,
      statusText,
    };
  }

  function setMode(nextMode, nextStatusText) {
    if (!Object.prototype.hasOwnProperty.call(durations, nextMode)) {
      return;
    }

    mode = nextMode;
    isRunning = false;
    remainingSeconds = durations[mode];
    statusText = nextStatusText || getReadyStatus(mode);
  }

  function completeSession() {
    if (mode === "focus") {
      completedFocusSessions += 1;
      setMode("break", "Focus complete. Start your break.");
      return;
    }

    setMode("focus", "Break complete. Ready to focus.");
  }

  return {
    getState,

    start() {
      isRunning = true;
      statusText = mode === "focus" ? "Focus session running" : "Break session running";
      return getState();
    },

    pause() {
      isRunning = false;
      statusText = "Paused";
      return getState();
    },

    reset() {
      isRunning = false;
      remainingSeconds = durations[mode];
      statusText = getReadyStatus(mode);
      return getState();
    },

    switchMode(nextMode) {
      setMode(nextMode);
      return getState();
    },

    tick(seconds = 1) {
      if (!isRunning) {
        return getState();
      }

      const elapsedSeconds = normalizeDuration(seconds, 1);
      remainingSeconds = Math.max(0, remainingSeconds - elapsedSeconds);

      if (remainingSeconds === 0) {
        completeSession();
      }

      return getState();
    },
  };
}

function initTodoApp(options = {}) {
  const rootDocument = options.document || document;
  const controller = createTodoController({ storage: options.storage });
  const form = rootDocument.querySelector("[data-todo-form]");
  const input = rootDocument.querySelector("[data-todo-input]");
  const list = rootDocument.querySelector("[data-todo-list]");
  const count = rootDocument.querySelector("[data-todo-count]");
  const filterButtons = Array.from(rootDocument.querySelectorAll("[data-todo-filter]"));
  let currentFilter = "all";

  function render() {
    const todos = controller.getTodos();
    const completed = todos.filter((todo) => todo.completed).length;
    const active = todos.length - completed;
    const filteredTodos = getFilteredTodos(todos, currentFilter);

    list.innerHTML = renderTodos(filteredTodos, { filter: currentFilter });
    count.textContent = `${active} active / ${completed} complete`;

    filterButtons.forEach((button) => {
      const isActiveFilter = normalizeTodoFilter(button.dataset.todoFilter) === currentFilter;
      button.setAttribute("aria-pressed", String(isActiveFilter));
      button.classList.toggle("is-active", isActiveFilter);
    });
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

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = normalizeTodoFilter(button.dataset.todoFilter);
      render();
    });
  });

  render();

  return controller;
}

function initPomodoroApp(options = {}) {
  const rootDocument = options.document || document;
  const rootWindow = options.window || window;
  const timer = options.timer || createPomodoroTimer(options);
  const timerRoot = rootDocument.querySelector("[data-pomodoro-timer]");
  const display = rootDocument.querySelector("[data-timer-display]");
  const status = rootDocument.querySelector("[data-timer-status]");
  const sessionLabel = rootDocument.querySelector("[data-session-label]");
  const completedCount = rootDocument.querySelector("[data-completed-count]");
  const progress = rootDocument.querySelector("[data-timer-progress]");
  const modeButtons = Array.from(rootDocument.querySelectorAll("[data-session-mode]"));
  const actionButtons = Array.from(rootDocument.querySelectorAll("[data-timer-action]"));

  function render() {
    const state = timer.getState();
    const progressPercent =
      state.durationSeconds === 0
        ? 0
        : ((state.durationSeconds - state.remainingSeconds) / state.durationSeconds) * 100;

    if (timerRoot) {
      timerRoot.dataset.sessionMode = state.mode;
    }

    display.textContent = formatDuration(state.remainingSeconds);
    status.textContent = state.statusText;
    sessionLabel.textContent = state.mode === "focus" ? "Focus" : "Break";
    completedCount.textContent = String(state.completedFocusSessions);
    progress.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;

    modeButtons.forEach((button) => {
      const isActiveMode = button.dataset.sessionMode === state.mode;
      button.setAttribute("aria-pressed", String(isActiveMode));
      button.disabled = state.isRunning;
    });

    actionButtons.forEach((button) => {
      const action = button.dataset.timerAction;

      if (action === "start") {
        button.disabled = state.isRunning;
      }

      if (action === "pause") {
        button.disabled = !state.isRunning;
      }
    });
  }

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      timer.switchMode(button.dataset.sessionMode);
      render();
    });
  });

  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.timerAction;

      if (action === "start") {
        timer.start();
      }

      if (action === "pause") {
        timer.pause();
      }

      if (action === "reset") {
        timer.reset();
      }

      render();
    });
  });

  const intervalId = rootWindow.setInterval(() => {
    const wasRunning = timer.getState().isRunning;

    timer.tick(1);

    if (wasRunning || timer.getState().isRunning) {
      render();
    }
  }, 1000);

  render();

  return {
    timer,
    stop() {
      rootWindow.clearInterval(intervalId);
    },
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-pomodoro-timer]")) {
      initPomodoroApp();
    }

    if (document.querySelector("[data-todo-form]")) {
      initTodoApp();
    }
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    createTodoController,
    createPomodoroTimer,
    formatDuration,
    getFilteredTodos,
    initPomodoroApp,
    initTodoApp,
    loadTodos,
    renderTodos,
    saveTodos,
  };
}
