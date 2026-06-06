const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createPomodoroHistoryController,
  createPomodoroTimer,
  didCompleteFocusSession,
  formatDuration,
  renderPomodoroHistory,
} = require("../app");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

test("pomodoro timer starts in a 25 minute focus session", () => {
  const timer = createPomodoroTimer();

  assert.deepEqual(timer.getState(), {
    mode: "focus",
    isRunning: false,
    remainingSeconds: 25 * 60,
    durationSeconds: 25 * 60,
    completedFocusSessions: 0,
    statusText: "Ready to focus",
  });
  assert.equal(formatDuration(timer.getState().remainingSeconds), "25:00");
});

test("start, tick, and pause control the countdown", () => {
  const timer = createPomodoroTimer({ focusSeconds: 10, breakSeconds: 5 });

  timer.start();
  timer.tick(3);

  assert.equal(timer.getState().isRunning, true);
  assert.equal(timer.getState().remainingSeconds, 7);

  timer.pause();
  timer.tick(4);

  assert.equal(timer.getState().isRunning, false);
  assert.equal(timer.getState().remainingSeconds, 7);
});

test("finishing a focus session moves to a stopped break session", () => {
  const timer = createPomodoroTimer({ focusSeconds: 3, breakSeconds: 2 });

  timer.start();
  timer.tick(3);

  assert.deepEqual(timer.getState(), {
    mode: "break",
    isRunning: false,
    remainingSeconds: 2,
    durationSeconds: 2,
    completedFocusSessions: 1,
    statusText: "Focus complete. Start your break.",
  });
});

test("reset restores the current session and mode selection updates duration", () => {
  const timer = createPomodoroTimer({ focusSeconds: 12, breakSeconds: 4 });

  timer.start();
  timer.tick(5);
  timer.reset();

  assert.equal(timer.getState().mode, "focus");
  assert.equal(timer.getState().remainingSeconds, 12);
  assert.equal(timer.getState().isRunning, false);

  timer.switchMode("break");

  assert.equal(timer.getState().mode, "break");
  assert.equal(timer.getState().remainingSeconds, 4);
  assert.equal(timer.getState().durationSeconds, 4);
  assert.equal(timer.getState().statusText, "Ready for a break");
});

test("focus completion is detected without changing timer state shape", () => {
  const timer = createPomodoroTimer({ focusSeconds: 1, breakSeconds: 5 });

  const before = timer.start();
  const after = timer.tick(1);

  assert.equal(didCompleteFocusSession(before, after), true);
  assert.equal(didCompleteFocusSession(after, timer.getState()), false);
});

test("recording a completed focus session persists timestamp and linked todo title", () => {
  const storage = createStorage();
  const history = createPomodoroHistoryController({
    storage,
    idFactory: () => "session-1",
    nowFactory: () => new Date("2026-06-06T10:30:00.000Z"),
  });

  const session = history.recordSession("Write project brief");

  assert.deepEqual(session, {
    id: "session-1",
    completedAt: "2026-06-06T10:30:00.000Z",
    todoTitle: "Write project brief",
  });
  assert.deepEqual(history.getSessions(), [session]);
  assert.equal(
    storage.getItem("pomodoroSessions"),
    JSON.stringify([session]),
  );

  const html = renderPomodoroHistory(history.getSessions());

  assert.match(html, /Write project brief/);
  assert.match(html, /datetime="2026-06-06T10:30:00.000Z"/);
});

test("saved Pomodoro history is loaded after a refresh", () => {
  const storage = createStorage({
    pomodoroSessions: JSON.stringify([
      {
        id: "session-1",
        completedAt: "2026-06-06T10:30:00.000Z",
        todoTitle: "Review checklist",
      },
    ]),
  });

  const history = createPomodoroHistoryController({ storage });

  assert.deepEqual(history.getSessions(), [
    {
      id: "session-1",
      completedAt: "2026-06-06T10:30:00.000Z",
      todoTitle: "Review checklist",
    },
  ]);
  assert.match(renderPomodoroHistory(history.getSessions()), /Review checklist/);
});
