const ALARM_NAME = "pindark-schedule-tick";
const ALARM_PERIOD_MINUTES = 15;

const PIN_DARK_URL_PATTERNS = [
  "*://*.pinterest.com/*",
];

// Helpers

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        enabled: true,
        scheduleEnabled: false,
        schedule: { startHour: 19, startMin: 0, endHour: 7, endMin: 0 },
      },
      resolve
    );
  });
}

function isInScheduleWindow(window) {
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const start = window.startHour * 60 + (window.startMin || 0);
  const end = window.endHour * 60 + (window.endMin || 0);
  if (start > end) return minutesNow >= start || minutesNow < end;
  return minutesNow >= start && minutesNow < end;
}

function shouldBeOn(settings) {
  if (!settings || settings.enabled === false) return false;
  if (!settings.scheduleEnabled) return true;
  return isInScheduleWindow(settings.schedule);
}

function describeState(settings) {
  if (settings.enabled === false) return { on: false, label: "OFF" };
  if (settings.scheduleEnabled && isInScheduleWindow(settings.schedule)) {
    return { on: true, label: "SCHED" };
  }
  if (settings.scheduleEnabled) return { on: true, label: "ON", muted: true };
  return { on: true, label: "ON" };
}

// Badge

async function updateBadge() {
  const settings = await loadSettings();
  const state = describeState(settings);

  if (!state.on) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const color = state.label === "SCHED" ? "#facc15" : state.muted ? "#707070" : "#4ade80";
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text: state.label });
}

// Broadcast

async function broadcastState() {
  const settings = await loadSettings();
  const on = shouldBeOn(settings);
  const tabs = await chrome.tabs.query({ url: PIN_DARK_URL_PATTERNS });
  for (const tab of tabs) {
    if (tab.id !== undefined) {
      chrome.tabs.sendMessage(tab.id, { type: "PINDARK_STATE", on }).catch(() => {
        // Content script may not be loaded yet on this tab. That's fine —
        // the content script's storage.onChanged listener will catch up.
      });
    }
  }
}

// Alarm wiring

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await updateBadge();
  await broadcastState();
});

// Lifecycle

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarm();
  await updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  await updateBadge();
});

// React to popup-driven changes immediately (don't wait 15 minutes).
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  await updateBadge();
  await broadcastState();
});
