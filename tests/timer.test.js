const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createTimerCompletionNotifier,
  createCountdownTimer,
} = require("../app");

test("notification permission is requested only through the explicit action", async () => {
  let requestCount = 0;

  class FakeNotification {
    static permission = "default";

    static async requestPermission() {
      requestCount += 1;
      FakeNotification.permission = "granted";
      return FakeNotification.permission;
    }
  }

  const notifier = createTimerCompletionNotifier({
    NotificationClass: FakeNotification,
    playAlarm: () => {},
  });

  assert.equal(notifier.getPermissionStatus(), "default");
  assert.equal(requestCount, 0);

  const permission = await notifier.requestNotificationPermission();

  assert.equal(permission, "granted");
  assert.equal(notifier.getPermissionStatus(), "granted");
  assert.equal(requestCount, 1);
});

test("timer completion plays an alarm and shows a notification when permission is granted", () => {
  let alarmCount = 0;
  const notifications = [];

  class FakeNotification {
    static permission = "granted";

    constructor(title, options) {
      notifications.push({ title, options });
    }
  }

  const notifier = createTimerCompletionNotifier({
    NotificationClass: FakeNotification,
    playAlarm: () => {
      alarmCount += 1;
    },
  });

  const result = notifier.completeTimer();

  assert.deepEqual(result, { sound: "played", notification: "shown" });
  assert.equal(alarmCount, 1);
  assert.deepEqual(notifications, [
    {
      title: "Timer complete",
      options: { body: "Your timer is done." },
    },
  ]);
});

test("countdown timer fires completion once when time reaches zero", () => {
  let tickHandler;
  let clearCount = 0;
  let completionCount = 0;

  const timer = createCountdownTimer({
    durationSeconds: 2,
    setInterval: (handler) => {
      tickHandler = handler;
      return "timer-id";
    },
    clearInterval: (timerId) => {
      assert.equal(timerId, "timer-id");
      clearCount += 1;
    },
    onComplete: () => {
      completionCount += 1;
    },
  });

  timer.start();
  tickHandler();
  tickHandler();
  tickHandler();

  assert.equal(timer.getRemainingSeconds(), 0);
  assert.equal(timer.isRunning(), false);
  assert.equal(completionCount, 1);
  assert.equal(clearCount, 1);
});
