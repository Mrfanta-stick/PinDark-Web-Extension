/*
 * PinDark — popup.js
 *
 * Wires the popup UI to chrome.storage.sync. State shape:
 *   {
 *     enabled:        boolean,            // master on/off
 *     scheduleEnabled:boolean,            // auto-on at night
 *     schedule: {
 *       startHour: number, startMin: number,
 *       endHour:   number, endMin:   number,
 *     }
 *   }
 *
 * The content script reads the same shape, so changes here propagate
 * to the page in real time via chrome.storage.onChanged.
*/

(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    scheduleEnabled: false,
    schedule: { startHour: 19, startMin: 0, endHour: 7, endMin: 0 },
  };

  const els = {
    enabled:        document.getElementById("toggle-enabled"),
    schedule:       document.getElementById("toggle-schedule"),
    scheduleWindow: document.getElementById("schedule-window"),
    startHour:      document.getElementById("start-hour"),
    startMin:       document.getElementById("start-min"),
    endHour:        document.getElementById("end-hour"),
    endMin:         document.getElementById("end-min"),
    status:         document.getElementById("status"),
  };

  // Helpers

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, resolve);
    });
  }

  function saveSettings(patch) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(patch, () => resolve());
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

  function renderStatus(settings) {
    const { status } = els;
    status.classList.remove("popup__status--on", "popup__status--scheduled", "popup__status--off");
    if (settings.enabled === false) {
      status.classList.add("popup__status--off");
      status.textContent = "Off";
    } else if (settings.scheduleEnabled && isInScheduleWindow(settings.schedule)) {
      status.classList.add("popup__status--scheduled");
      status.textContent = "Scheduled";
    } else if (settings.scheduleEnabled) {
      status.classList.add("popup__status--off");
      status.textContent = "Scheduled (waiting)";
    } else {
      status.classList.add("popup__status--on");
      status.textContent = "Active";
    }
  }

  function applyToUI(settings) {
    els.enabled.checked = settings.enabled !== false;
    els.schedule.checked = !!settings.scheduleEnabled;
    els.scheduleWindow.hidden = !settings.scheduleEnabled;
    els.startHour.value = settings.schedule.startHour;
    els.startMin.value  = String(settings.schedule.startMin).padStart(2, "0");
    els.endHour.value   = settings.schedule.endHour;
    els.endMin.value    = String(settings.schedule.endMin).padStart(2, "0");
    renderStatus(settings);
  }

  // Event wiring

  els.enabled.addEventListener("change", async () => {
    await saveSettings({ enabled: els.enabled.checked });
    const fresh = await loadSettings();
    renderStatus(fresh);
  });

  els.schedule.addEventListener("change", async () => {
    await saveSettings({ scheduleEnabled: els.schedule.checked });
    els.scheduleWindow.hidden = !els.schedule.checked;
    const fresh = await loadSettings();
    renderStatus(fresh);
  });

  function bindTimeInput(el, key, sub) {
    el.addEventListener("change", async () => {
      const settings = await loadSettings();
      const value = clampInt(el.value, 0, sub === "Hour" ? 23 : 59);
      settings.schedule[key] = value;
      el.value = sub === "Min" ? String(value).padStart(2, "0") : String(value);
      await saveSettings({ schedule: settings.schedule });
      const fresh = await loadSettings();
      renderStatus(fresh);
    });
  }

  function clampInt(value, min, max) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  bindTimeInput(els.startHour, "startHour", "Hour");
  bindTimeInput(els.startMin,  "startMin",  "Min");
  bindTimeInput(els.endHour,   "endHour",   "Hour");
  bindTimeInput(els.endMin,    "endMin",    "Min");

  // Init

  loadSettings().then(applyToUI);
})();
