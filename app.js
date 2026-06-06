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

function getDefaultNotificationClass() {
  if (typeof Notification !== "undefined") {
    return Notification;
  }

  return null;
}

function getDefaultAudioContextClass() {
  if (typeof window !== "undefined") {
    return window.AudioContext || window.webkitAudioContext || null;
  }

  return null;
}

function normalizeDurationSeconds(value, fallback = 60) {
  const seconds = Math.floor(Number(value));

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return fallback;
  }

  return seconds;
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const displaySeconds = String(safeSeconds % 60).padStart(2, "0");

  return `${minutes}:${displaySeconds}`;
}

function playAlarmSound(options = {}) {
  const AudioContextClass =
    options.AudioContextClass === undefined
      ? getDefaultAudioContextClass()
      : options.AudioContextClass;

  if (!AudioContextClass) {
    return "unavailable";
  }

  try {
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime || 0;

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(660, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.74);

    if (typeof audioContext.close === "function" && typeof oscillator.addEventListener === "function") {
      oscillator.addEventListener("ended", () => audioContext.close(), { once: true });
    }

    return "played";
  } catch (_error) {
    return "unavailable";
  }
}

function createTimerCompletionNotifier(options = {}) {
  const NotificationClass =
    options.NotificationClass === undefined
      ? getDefaultNotificationClass()
      : options.NotificationClass;
  const playAlarm = options.playAlarm || playAlarmSound;
  const title = options.title || "Timer complete";
  const body = options.body || "Your timer is done.";

  function getPermissionStatus() {
    if (!NotificationClass) {
      return "unsupported";
    }

    return NotificationClass.permission || "default";
  }

  async function requestNotificationPermission() {
    if (!NotificationClass || typeof NotificationClass.requestPermission !== "function") {
      return "unsupported";
    }

    return NotificationClass.requestPermission();
  }

  function completeTimer() {
    let sound = "unavailable";
    let notification = getPermissionStatus();

    try {
      sound = playAlarm() || "played";
    } catch (_error) {
      sound = "unavailable";
    }

    if (NotificationClass && NotificationClass.permission === "granted") {
      try {
        new NotificationClass(title, { body });
        notification = "shown";
      } catch (_error) {
        notification = "failed";
      }
    }

    return { sound, notification };
  }

  return {
    completeTimer,
    getPermissionStatus,
    requestNotificationPermission,
  };
}

function getDefaultTimerFunction(name) {
  if (typeof globalThis !== "undefined" && typeof globalThis[name] === "function") {
    return globalThis[name].bind(globalThis);
  }

  return null;
}

function createCountdownTimer(options = {}) {
  let durationSeconds = normalizeDurationSeconds(options.durationSeconds, 60);
  let remainingSeconds = durationSeconds;
  let timerId = null;
  let completed = false;
  const intervalMs = normalizeDurationSeconds(options.intervalMs, 1000);
  const schedule = options.setInterval || getDefaultTimerFunction("setInterval");
  const cancel = options.clearInterval || getDefaultTimerFunction("clearInterval");
  const onTick = options.onTick || (() => {});
  const onComplete = options.onComplete || (() => {});

  function isRunning() {
    return timerId !== null;
  }

  function stopInterval() {
    if (timerId !== null && cancel) {
      cancel(timerId);
    }

    timerId = null;
  }

  function finish() {
    if (completed) {
      return;
    }

    completed = true;
    remainingSeconds = 0;
    stopInterval();
    onTick(remainingSeconds);
    onComplete();
  }

  function tick() {
    if (remainingSeconds <= 0) {
      finish();
      return;
    }

    remainingSeconds = Math.max(0, remainingSeconds - 1);

    if (remainingSeconds === 0) {
      finish();
      return;
    }

    onTick(remainingSeconds);
  }

  return {
    getRemainingSeconds() {
      return remainingSeconds;
    },

    isRunning,

    pause() {
      stopInterval();
    },

    reset(seconds = durationSeconds) {
      durationSeconds = normalizeDurationSeconds(seconds, durationSeconds);
      remainingSeconds = durationSeconds;
      completed = false;
      stopInterval();
      onTick(remainingSeconds);
    },

    start() {
      if (isRunning() || remainingSeconds <= 0 || !schedule) {
        return;
      }

      completed = false;
      timerId = schedule(tick, intervalMs);
      onTick(remainingSeconds);
    },
  };
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

function initTimerApp(options = {}) {
  const rootDocument = options.document || document;
  const display = rootDocument.querySelector("[data-timer-display]");
  const minutesInput = rootDocument.querySelector("[data-timer-minutes]");
  const startButton = rootDocument.querySelector("[data-timer-start]");
  const pauseButton = rootDocument.querySelector("[data-timer-pause]");
  const resetButton = rootDocument.querySelector("[data-timer-reset]");
  const permissionButton = rootDocument.querySelector("[data-notification-permission]");
  const permissionStatus = rootDocument.querySelector("[data-notification-status]");

  if (!display || !minutesInput || !startButton || !pauseButton || !resetButton) {
    return null;
  }

  const notifier = options.notifier || createTimerCompletionNotifier();
  let timer;

  function getInputDurationSeconds() {
    const minutes = Number(minutesInput.value);
    const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 1;

    return Math.round(safeMinutes * 60);
  }

  function updateDisplay(seconds) {
    display.textContent = formatDuration(seconds);
  }

  function updateControls() {
    const running = timer.isRunning();

    startButton.disabled = running;
    pauseButton.disabled = !running;
  }

  function updatePermissionStatus() {
    if (!permissionStatus) {
      return;
    }

    const status = notifier.getPermissionStatus();
    permissionStatus.textContent = `Notifications: ${status}`;

    if (permissionButton) {
      permissionButton.disabled = status === "granted" || status === "unsupported";
      permissionButton.textContent =
        status === "granted" ? "Notifications enabled" : "Enable notifications";
    }
  }

  function createTimer(durationSeconds) {
    return createCountdownTimer({
      durationSeconds,
      onTick: (remainingSeconds) => {
        updateDisplay(remainingSeconds);
        updateControls();
      },
      onComplete: () => {
        updateControls();
        notifier.completeTimer();
      },
    });
  }

  timer = createTimer(getInputDurationSeconds());
  updateDisplay(timer.getRemainingSeconds());
  updateControls();
  updatePermissionStatus();

  startButton.addEventListener("click", () => {
    if (timer.getRemainingSeconds() <= 0) {
      timer.reset(getInputDurationSeconds());
    }

    timer.start();
    updateControls();
  });

  pauseButton.addEventListener("click", () => {
    timer.pause();
    updateControls();
  });

  resetButton.addEventListener("click", () => {
    timer.reset(getInputDurationSeconds());
    updateControls();
  });

  minutesInput.addEventListener("change", () => {
    if (!timer.isRunning()) {
      timer.reset(getInputDurationSeconds());
      updateControls();
    }
  });

  if (permissionButton) {
    permissionButton.addEventListener("click", async () => {
      if (permissionStatus) {
        permissionStatus.textContent = "Notifications: asking";
      }

      await notifier.requestNotificationPermission();
      updatePermissionStatus();
    });
  }

  return timer;
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
  document.addEventListener("DOMContentLoaded", () => {
    initTimerApp();
    initTodoApp();
  });
}

if (typeof module !== "undefined") {
  module.exports = {
    createCountdownTimer,
    createTimerCompletionNotifier,
    createTodoController,
    formatDuration,
    initTimerApp,
    loadTodos,
    playAlarmSound,
    renderTodos,
    saveTodos,
  };
}
