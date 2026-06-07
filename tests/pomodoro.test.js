const assert = require("node:assert/strict");
const test = require("node:test");

const { createPomodoroTimer, formatDuration } = require("../app");

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

test("pomodoro timer loads saved focus and break durations", () => {
  const timer = createPomodoroTimer({
    storage: createStorage({
      pomodoroSettings: JSON.stringify({ focusMinutes: 32, breakMinutes: 9 }),
    }),
  });

  assert.equal(timer.getState().remainingSeconds, 32 * 60);
  assert.equal(timer.getState().durationSeconds, 32 * 60);

  timer.switchMode("break");

  assert.equal(timer.getState().remainingSeconds, 9 * 60);
  assert.equal(timer.getState().durationSeconds, 9 * 60);
});

test("pomodoro timer persists edited focus and break durations", () => {
  const storage = createStorage();
  const timer = createPomodoroTimer({ storage });

  assert.equal(typeof timer.updateDurations, "function");

  const state = timer.updateDurations({ focusMinutes: 40, breakMinutes: 12 });

  assert.equal(state.mode, "focus");
  assert.equal(state.isRunning, false);
  assert.equal(state.remainingSeconds, 40 * 60);
  assert.equal(state.durationSeconds, 40 * 60);
  assert.equal(
    storage.getItem("pomodoroSettings"),
    JSON.stringify({ focusMinutes: 40, breakMinutes: 12 }),
  );

  timer.switchMode("break");

  assert.equal(timer.getState().remainingSeconds, 12 * 60);
});
