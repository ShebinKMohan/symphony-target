const STORAGE_KEY = "todos";
const POMODORO_HISTORY_STORAGE_KEY = "pomodoroSessions";
const POMODORO_HISTORY_LIMIT = 5;

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

function clonePomodoroSession(session) {
  return {
    id: session.id,
    completedAt: session.completedAt,
    todoTitle: typeof session.todoTitle === "string" ? session.todoTitle : "",
  };
}

function hasValidSessionTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function loadPomodoroHistory(storage = getDefaultStorage()) {
  if (!storage) {
    return [];
  }

  try {
    const rawSessions = storage.getItem(POMODORO_HISTORY_STORAGE_KEY);
    const parsedSessions = rawSessions ? JSON.parse(rawSessions) : [];

    if (!Array.isArray(parsedSessions)) {
      return [];
    }

    return parsedSessions
      .filter(
        (session) =>
          session &&
          typeof session.id === "string" &&
          hasValidSessionTimestamp(session.completedAt),
      )
      .map(clonePomodoroSession);
  } catch (_error) {
    return [];
  }
}

function savePomodoroHistory(sessions, storage = getDefaultStorage()) {
  if (!storage) {
    return;
  }

  storage.setItem(
    POMODORO_HISTORY_STORAGE_KEY,
    JSON.stringify(sessions.map(clonePomodoroSession)),
  );
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function normalizeHistoryLimit(value, fallback) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.floor(parsedValue);
}

function normalizeTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function formatSessionTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderPomodoroHistory(sessions) {
  if (!sessions.length) {
    return '<li class="history-empty">No completed sessions yet</li>';
  }

  return sessions
    .map((session) => {
      const completedAt = escapeHtml(session.completedAt);
      const timeLabel = escapeHtml(formatSessionTimestamp(session.completedAt));
      const title = session.todoTitle ? escapeHtml(session.todoTitle) : "Focus session";

      return `
        <li class="history-item">
          <time class="history-time" datetime="${completedAt}">${timeLabel}</time>
          <span class="history-todo">${title}</span>
        </li>
      `;
    })
    .join("");
}

function renderLinkedTodoOptions(todos, selectedId = "") {
  const selectableTodos = todos;
  const selectedTodoExists = selectableTodos.some((todo) => todo.id === selectedId);
  const emptyOptionText = selectableTodos.length ? "No linked todo" : "No todos available";
  const emptySelected = selectedTodoExists ? "" : " selected";

  return [
    `<option value=""${emptySelected}>${emptyOptionText}</option>`,
    ...selectableTodos.map((todo) => {
      const id = escapeHtml(todo.id);
      const text = escapeHtml(todo.text);
      const selected = todo.id === selectedId ? " selected" : "";

      return `<option value="${id}"${selected}>${text}</option>`;
    }),
  ].join("");
}

function createPomodoroHistoryController(options = {}) {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const idFactory = options.idFactory || createSessionId;
  const nowFactory = options.nowFactory || (() => new Date());
  const limit = normalizeHistoryLimit(options.limit, POMODORO_HISTORY_LIMIT);
  let sessions = loadPomodoroHistory(storage).slice(0, limit);

  function persist() {
    savePomodoroHistory(sessions, storage);
  }

  return {
    getSessions() {
      return sessions.map(clonePomodoroSession);
    },

    recordSession(todoTitle = "") {
      const cleanTodoTitle = String(todoTitle || "").trim();
      const session = {
        id: idFactory(),
        completedAt: normalizeTimestamp(nowFactory()),
        todoTitle: cleanTodoTitle,
      };

      sessions = [session, ...sessions].slice(0, limit);
      persist();

      return clonePomodoroSession(session);
    },
  };
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

function didCompleteFocusSession(previousState, nextState) {
  return Boolean(
    previousState &&
      nextState &&
      previousState.mode === "focus" &&
      previousState.isRunning &&
      nextState.mode === "break" &&
      !nextState.isRunning &&
      nextState.completedFocusSessions > previousState.completedFocusSessions,
  );
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

function initPomodoroApp(options = {}) {
  const rootDocument = options.document || document;
  const rootWindow = options.window || window;
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const timer = options.timer || createPomodoroTimer(options);
  const history =
    options.history ||
    createPomodoroHistoryController({
      storage,
      idFactory: options.sessionIdFactory,
      nowFactory: options.nowFactory,
    });
  let todos = loadTodos(storage);
  const timerRoot = rootDocument.querySelector("[data-pomodoro-timer]");
  const display = rootDocument.querySelector("[data-timer-display]");
  const status = rootDocument.querySelector("[data-timer-status]");
  const sessionLabel = rootDocument.querySelector("[data-session-label]");
  const completedCount = rootDocument.querySelector("[data-completed-count]");
  const progress = rootDocument.querySelector("[data-timer-progress]");
  const linkedTodo = rootDocument.querySelector("[data-linked-todo]");
  const historyList = rootDocument.querySelector("[data-session-history]");
  const modeButtons = Array.from(rootDocument.querySelectorAll("[data-session-mode]"));
  const actionButtons = Array.from(rootDocument.querySelectorAll("[data-timer-action]"));

  function renderLinkedTodos() {
    if (!linkedTodo) {
      return;
    }

    const selectedId = linkedTodo.value;
    todos = loadTodos(storage);
    linkedTodo.innerHTML = renderLinkedTodoOptions(todos, selectedId);
    linkedTodo.disabled = !todos.length;
  }

  function getLinkedTodoTitle() {
    if (!linkedTodo || !linkedTodo.value) {
      return "";
    }

    const selectedTodo = todos.find((todo) => todo.id === linkedTodo.value);

    return selectedTodo ? selectedTodo.text : "";
  }

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

    if (historyList) {
      historyList.innerHTML = renderPomodoroHistory(history.getSessions());
    }

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
    const previousState = timer.getState();
    const nextState = timer.tick(1);

    if (didCompleteFocusSession(previousState, nextState)) {
      history.recordSession(getLinkedTodoTitle());
    }

    if (previousState.isRunning || nextState.isRunning) {
      render();
    }
  }, 1000);

  renderLinkedTodos();
  render();

  return {
    history,
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
      return;
    }

    if (document.querySelector("[data-todo-form]")) {
      initTodoApp();
    }
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    createPomodoroHistoryController,
    createTodoController,
    createPomodoroTimer,
    didCompleteFocusSession,
    formatDuration,
    initPomodoroApp,
    loadPomodoroHistory,
    loadTodos,
    renderPomodoroHistory,
    renderTodos,
    savePomodoroHistory,
    saveTodos,
  };
}
