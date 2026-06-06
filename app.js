const STORAGE_KEY = "todos";

function getDefaultStorage() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function getTodoTitle(todo) {
  if (typeof todo.text === "string") {
    return todo.text;
  }

  if (typeof todo.title === "string") {
    return todo.title;
  }

  return "";
}

function cloneTodo(todo) {
  const clonedTodo = {
    id: todo.id,
    text: getTodoTitle(todo),
    completed: Boolean(todo.completed),
  };

  if (typeof todo.notes === "string") {
    clonedTodo.notes = todo.notes;
  }

  const pomodoroSessions = getPomodoroSessions(todo);

  if (pomodoroSessions.length) {
    clonedTodo.pomodoroSessions = pomodoroSessions;
  }

  return clonedTodo;
}

function getPomodoroSessions(todo) {
  if (!Array.isArray(todo.pomodoroSessions)) {
    return [];
  }

  return todo.pomodoroSessions
    .filter(
      (session) =>
        session &&
        typeof session.id === "string" &&
        Number.isFinite(Number(session.minutes)) &&
        Number(session.minutes) > 0 &&
        typeof session.completedAt === "string",
    )
    .map((session) => ({
      id: session.id,
      minutes: Number(session.minutes),
      completedAt: session.completedAt,
    }));
}

function getFocusMinutes(todo) {
  return getPomodoroSessions(todo).reduce((total, session) => total + session.minutes, 0);
}

function formatPomodoroCount(count) {
  return `${count} ${count === 1 ? "pomodoro" : "pomodoros"}`;
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
      .filter((todo) => todo && typeof todo.id === "string" && getTodoTitle(todo))
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

function normalizeSearchTerm(search) {
  return String(search || "").trim().toLowerCase();
}

function getTodoSearchText(todo) {
  return [todo.text, todo.title, todo.notes]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function todoMatchesStatus(todo, status) {
  if (status === "active") {
    return !todo.completed;
  }

  if (status === "completed") {
    return todo.completed;
  }

  return true;
}

function filterTodos(todos, filters = {}) {
  const search = normalizeSearchTerm(filters.search);

  return todos
    .filter((todo) => todoMatchesStatus(todo, filters.status))
    .filter((todo) => !search || getTodoSearchText(todo).includes(search))
    .map(cloneTodo);
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

function normalizeDuration(value, fallback) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.floor(parsedValue);
}

function normalizeDurationSeconds(value, fallback = 60) {
  return normalizeDuration(value, fallback);
}

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
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
  const sessionIdFactory = options.sessionIdFactory || createId;
  const now = options.now || (() => new Date().toISOString());
  let todos = loadTodos(storage);

  function persist() {
    saveTodos(todos, storage);
  }

  return {
    getTodos(filters = {}) {
      return filterTodos(todos, filters);
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

    logPomodoroSession(id, minutes = 25) {
      const sessionMinutes = Number(minutes);

      if (!Number.isFinite(sessionMinutes) || sessionMinutes <= 0) {
        return null;
      }

      const session = {
        id: sessionIdFactory(),
        minutes: sessionMinutes,
        completedAt: String(now()),
      };
      let sessionLogged = false;

      todos = todos.map((todo) => {
        if (todo.id !== id) {
          return todo;
        }

        sessionLogged = true;

        return {
          ...todo,
          pomodoroSessions: [...getPomodoroSessions(todo), session],
        };
      });

      if (!sessionLogged) {
        return null;
      }

      persist();

      return { ...session };
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
      const pomodoroSessions = getPomodoroSessions(todo);
      const pomodoroCount = pomodoroSessions.length;
      const focusMinutes = getFocusMinutes(todo);
      const completedClass = todo.completed ? " is-completed" : "";
      const checked = todo.completed ? " checked" : "";

      return `
        <li class="todo-item${completedClass}" data-id="${id}">
          <label class="todo-check">
            <input type="checkbox" data-action="toggle" data-id="${id}"${checked} aria-label="Toggle ${text}">
            <span class="checkmark" aria-hidden="true"></span>
          </label>
          <div class="todo-content">
            <span class="todo-text">${text}</span>
            <span class="todo-focus">${formatPomodoroCount(pomodoroCount)} / ${focusMinutes} min focus</span>
          </div>
          <button class="pomodoro-button" type="button" data-action="pomodoro" data-id="${id}" aria-label="Log a Pomodoro for ${text}">+25m</button>
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
const POMODORO_SETTINGS_KEY = "pomodoroSettings";

function getReadyStatus(mode) {
  return mode === "break" ? "Ready for a break" : "Ready to focus";
}

function getDurationMinutes(seconds) {
  return Math.max(1, Math.floor(seconds / 60));
}

function loadPomodoroSettings(storage, fallbackDurations = POMODORO_DURATIONS) {
  const fallbackSettings = {
    focusMinutes: getDurationMinutes(fallbackDurations.focus),
    breakMinutes: getDurationMinutes(fallbackDurations.break),
  };

  if (!storage) {
    return fallbackSettings;
  }

  try {
    const rawSettings = storage.getItem(POMODORO_SETTINGS_KEY);
    const parsedSettings = rawSettings ? JSON.parse(rawSettings) : {};

    return {
      focusMinutes: normalizeDuration(parsedSettings.focusMinutes, fallbackSettings.focusMinutes),
      breakMinutes: normalizeDuration(parsedSettings.breakMinutes, fallbackSettings.breakMinutes),
    };
  } catch (_error) {
    return fallbackSettings;
  }
}

function savePomodoroSettings(settings, storage) {
  if (!storage) {
    return;
  }

  storage.setItem(
    POMODORO_SETTINGS_KEY,
    JSON.stringify({
      focusMinutes: settings.focusMinutes,
      breakMinutes: settings.breakMinutes,
    }),
  );
}

function createPomodoroTimer(options = {}) {
  const storage = options.storage === undefined ? getDefaultStorage() : options.storage;
  const savedSettings = loadPomodoroSettings(storage);
  const durations = {
    focus: normalizeDuration(options.focusSeconds, savedSettings.focusMinutes * 60),
    break: normalizeDuration(options.breakSeconds, savedSettings.breakMinutes * 60),
  };
  const onSessionComplete = options.onSessionComplete || (() => {});
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

  function getDurationSettings() {
    return {
      focusMinutes: getDurationMinutes(durations.focus),
      breakMinutes: getDurationMinutes(durations.break),
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

  function notifySessionComplete(completedMode) {
    onSessionComplete({
      completedMode,
      nextMode: mode,
      completedFocusSessions,
    });
  }

  function completeSession() {
    const completedMode = mode;

    if (mode === "focus") {
      completedFocusSessions += 1;
      setMode("break", "Focus complete. Start your break.");
      notifySessionComplete(completedMode);
      return;
    }

    setMode("focus", "Break complete. Ready to focus.");
    notifySessionComplete(completedMode);
  }

  return {
    getState,
    getDurationSettings,

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

    updateDurations(settings) {
      const nextSettings = {
        focusMinutes: normalizeDuration(settings && settings.focusMinutes, getDurationSettings().focusMinutes),
        breakMinutes: normalizeDuration(settings && settings.breakMinutes, getDurationSettings().breakMinutes),
      };

      durations.focus = nextSettings.focusMinutes * 60;
      durations.break = nextSettings.breakMinutes * 60;
      savePomodoroSettings(nextSettings, storage);

      isRunning = false;
      remainingSeconds = durations[mode];
      statusText = getReadyStatus(mode);

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
  const searchInput = rootDocument.querySelector("[data-todo-search]");
  const list = rootDocument.querySelector("[data-todo-list]");
  const count = rootDocument.querySelector("[data-todo-count]");

  function render() {
    const allTodos = controller.getTodos();
    const completed = allTodos.filter((todo) => todo.completed).length;
    const active = allTodos.length - completed;
    const todos = controller.getTodos({
      search: searchInput ? searchInput.value : "",
    });

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

    if (actionTarget.dataset.action === "pomodoro") {
      controller.logPomodoroSession(actionTarget.dataset.id);
    }

    render();
  });

  if (searchInput) {
    searchInput.addEventListener("input", render);
  }

  render();

  return controller;
}

function initPomodoroApp(options = {}) {
  const rootDocument = options.document || document;
  const rootWindow = options.window || window;
  const notifier = options.notifier || createTimerCompletionNotifier();
  const timer =
    options.timer ||
    createPomodoroTimer({
      ...options,
      onSessionComplete: () => {
        notifier.completeTimer();
        updatePermissionStatus();
      },
    });
  const timerRoot = rootDocument.querySelector("[data-pomodoro-timer]");
  const display = rootDocument.querySelector("[data-timer-display]");
  const status = rootDocument.querySelector("[data-timer-status]");
  const sessionLabel = rootDocument.querySelector("[data-session-label]");
  const completedCount = rootDocument.querySelector("[data-completed-count]");
  const progress = rootDocument.querySelector("[data-timer-progress]");
  const permissionButton = rootDocument.querySelector("[data-notification-permission]");
  const permissionStatus = rootDocument.querySelector("[data-notification-status]");
  const modeButtons = Array.from(rootDocument.querySelectorAll("[data-session-mode]"));
  const actionButtons = Array.from(rootDocument.querySelectorAll("[data-timer-action]"));
  const durationSettings = rootDocument.querySelector("[data-duration-settings]");
  const durationInputs = {
    focus: rootDocument.querySelector('[data-duration-input="focus"]'),
    break: rootDocument.querySelector('[data-duration-input="break"]'),
  };
  const durationStatus = rootDocument.querySelector("[data-duration-status]");

  function updatePermissionStatus() {
    if (!permissionStatus) {
      return;
    }

    const notificationStatus = notifier.getPermissionStatus();
    permissionStatus.textContent = `Notifications: ${notificationStatus}`;

    if (permissionButton) {
      permissionButton.disabled =
        notificationStatus === "granted" || notificationStatus === "unsupported";
      permissionButton.textContent =
        notificationStatus === "granted" ? "Notifications enabled" : "Enable notifications";
    }
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

  function updateDurationInputs() {
    if (!durationInputs.focus || !durationInputs.break) {
      return;
    }

    const settings = timer.getDurationSettings();
    durationInputs.focus.value = String(settings.focusMinutes);
    durationInputs.break.value = String(settings.breakMinutes);
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

  if (permissionButton) {
    permissionButton.addEventListener("click", async () => {
      if (permissionStatus) {
        permissionStatus.textContent = "Notifications: asking";
      }

      await notifier.requestNotificationPermission();
      updatePermissionStatus();
    });
  }

  if (durationSettings) {
    durationSettings.addEventListener("submit", (event) => {
      event.preventDefault();

      timer.updateDurations({
        focusMinutes: durationInputs.focus && durationInputs.focus.value,
        breakMinutes: durationInputs.break && durationInputs.break.value,
      });
      updateDurationInputs();

      if (durationStatus) {
        durationStatus.textContent = "Saved";
      }

      render();
    });
  }

  const intervalId = rootWindow.setInterval(() => {
    const wasRunning = timer.getState().isRunning;

    timer.tick(1);

    if (wasRunning || timer.getState().isRunning) {
      render();
    }
  }, 1000);

  render();
  updateDurationInputs();
  updatePermissionStatus();

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
    createCountdownTimer,
    createTimerCompletionNotifier,
    createTodoController,
    filterTodos,
    createPomodoroTimer,
    formatDuration,
    initPomodoroApp,
    initTimerApp: initPomodoroApp,
    loadTodos,
    playAlarmSound,
    renderTodos,
    saveTodos,
  };
}
