/*
 * PinDark — content.js
 *
 * Runs at document_start. Responsibilities:
 *   1. Read the user's stored preference (on/off/scheduled) from
 *      chrome.storage.sync and apply or remove the `pindark-on` class
 *      on <html>.
 *   2. Watch for the feed wrapper element. Once it appears, attach a
 *      MutationObserver scoped to it (childList only, debounced 100ms)
 *      so newly-mounted pins/dialogs get the dark class applied.
 *   3. Listen for storage changes so the toggle responds live without
 *      a page reload.
 *
 *   Pinterest is an infinite-scroll heavy hitter. Observing document.body
 *   fires thousands of mutations per minute and burns CPU. The feed
 *   wrapper is the smallest stable subtree that contains everything we
 *   care about.
*/

(() => {
  "use strict";

  const CLASS_ON = "pindark-on";
  const FEED_WRAPPER_SELECTOR = '[data-test-id="mainAppRoot"]';

  /**
   * Default state matches the popup's DEFAULTS object. Mirrored here so
   * we can apply the class synchronously at document_start — before
   * chrome.storage.sync's async callback would otherwise resolve.
   * This prevents the brief white flash users see on first paint.
   */
  const DEFAULTS = {
    enabled: true,
    scheduleEnabled: false,
    schedule: { startHour: 19, startMin: 0, endHour: 7, endMin: 0 },
  };

  /** @type {MutationObserver | null} */
  let wrapperObserver = null;
  /** @type {MutationObserver | null} */
  let bodyObserver = null;
  /** @type {number | null} */
  let debounceTimer = null;

  // Preference state

  /**
   * Read the current effective state. Order of precedence:
   *   1. enabled === false  -> OFF
   *   2. schedule === false -> ON (forced on by user)
   *   3. inside schedule    -> ON
   *   4. outside schedule   -> OFF
   *
   * @returns {boolean} whether dark mode should be active right now
   */
  function computeShouldBeOn(settings) {
    if (!settings || settings.enabled === false) return false;
    if (!settings.schedule || !settings.scheduleEnabled) return true;
    return isInScheduleWindow(settings.schedule);
  }

  /**
   * @param {{ startHour: number, startMin: number, endHour: number, endMin: number }} window
   * @returns {boolean}
   */
  function isInScheduleWindow(window) {
    const now = new Date();
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const start = window.startHour * 60 + (window.startMin || 0);
    const end = window.endHour * 60 + (window.endMin || 0);

    // Window that crosses midnight (e.g. 19:00 -> 07:00).
    if (start > end) {
      return minutesNow >= start || minutesNow < end;
    }
    // Same-day window (e.g. 09:00 -> 17:00).
    return minutesNow >= start && minutesNow < end;
  }

  // Apply / remove

  function applyDark() {
    document.documentElement.classList.add(CLASS_ON);
  }

  function removeDark() {
    document.documentElement.classList.remove(CLASS_ON);
  }

  function syncFromStorage() {
    chrome.storage.sync.get(DEFAULTS, (settings) => {
      if (computeShouldBeOn(settings)) {
        applyDark();
      } else {
        removeDark();
      }
    });
  }

  // Observer plumbing

  /**
   * Pinterest's React tree re-mounts pin cards constantly during scroll.
   * Each new subtree needs the dark class chain. We do this by re-asserting
   * the class on <html>, which is already classless for us — but we also
   * re-apply to any portal-rendered dialogs (they're appended to body and
   * might race against our class flip).
   */
  function scheduleReapply() {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      // Re-evaluate; the class is idempotent so this is cheap.
      syncFromStorage();
    }, 100);
  }

  /**
   * Attach the scoped observer. The wrapper is the only subtree we watch.
   * We intentionally do NOT observe attributes or subtree style mutations —
   * Pinterest mutates inline styles constantly and that destroys perf.
   */
  function attachWrapperObserver(wrapper) {
    if (wrapperObserver) wrapperObserver.disconnect();
    wrapperObserver = new MutationObserver(scheduleReapply);
    wrapperObserver.observe(wrapper, { childList: true, subtree: true });
  }

  /**
   * Body-level fallback. Runs only until the feed wrapper is found.
   * Once we attach the scoped observer, this one disconnects itself.
   */
  function attachBodyFallback() {
    if (bodyObserver) return;
    bodyObserver = new MutationObserver(() => {
      const wrapper = document.querySelector(FEED_WRAPPER_SELECTOR);
      if (wrapper) {
        attachWrapperObserver(wrapper);
        if (bodyObserver) {
          bodyObserver.disconnect();
          bodyObserver = null;
        }
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Bootstrap

  // Apply the default state SYNCHRONOUSLY before first paint, so the
  // page doesn't briefly flash white. We use the same default object
  // the popup uses; the async storage read below will reconcile any
  // user-saved divergence within a few milliseconds.
  if (computeShouldBeOn(DEFAULTS)) {
    applyDark();
  }

  // Then reconcile with the user's actual saved preferences.
  syncFromStorage();

  // Live updates: respond to popup toggle without a reload.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    syncFromStorage();
  });

  // Find the wrapper. If it's not in the DOM yet (likely at document_start),
  // start the body-level fallback which will hand off to the scoped observer.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      const wrapper = document.querySelector(FEED_WRAPPER_SELECTOR);
      if (wrapper) {
        attachWrapperObserver(wrapper);
      } else {
        attachBodyFallback();
      }
    });
  } else {
    const wrapper = document.querySelector(FEED_WRAPPER_SELECTOR);
    if (wrapper) {
      attachWrapperObserver(wrapper);
    } else {
      attachBodyFallback();
    }
  }
})();
