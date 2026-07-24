# PinDark

A clean, lightweight dark mode for Pinterest Web.

## Features

- Dark theme across the entire Pinterest experience (home feed, search, pin detail, profile, boards, settings).
- Toolbar toggle: on / off.
- Optional schedule: dark mode auto-activates during the hours you choose.
- Live status indicator (Active / Scheduled / Off).
- Privacy-first: no analytics, no tracking, no network requests.
- A "Support" link to the developer if you find it useful.

## Installation (development)

1. Clone this repository.
2. Open `chrome://extensions` (Edge/Chrome) or `about:debugging` (Firefox).
3. Enable **Developer mode**.
4. Click **Load unpacked** (Edge/Chrome) or **Load Temporary Add-on** (Firefox) and select this directory.
5. Open [Pinterest](https://www.pinterest.com) and the dark theme should apply immediately.

## Building a release ZIP

The release ZIP is what you upload to the **Edge Add-ons** and **Firefox Add-ons** stores.

```bash
npm install
npm run build
```

This produces `pindark-v<version>.zip` in the project root (version is read from `manifest.json`).

## Project structure

```
pinterest-dark-mode/
├── manifest.json
├── content/
│   ├── content.js     # Scoped MutationObserver + live toggle
│   └── theme.css      # CSS variable overrides + structural fallbacks
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js       # chrome.storage.sync state management
├── background/
│   └── service-worker.js  # Schedule alarm + toolbar badge
├── icons/             # 16/32/48/128 PNG icons
├── scripts/
│   └── build.js       # `npm run build` — produces release ZIP
├── privacy-policy.html
├── LICENSE              # GNU GPLv3
└── store-listing/
    └── description.md
```

## How it works

Pinterest Web is built on a small set of CSS custom properties (design tokens) that are reused across the entire UI. PinDark overrides those tokens at the root with `!important`, then adds structural fallbacks (`[data-test-id]`, `[role]`, `[aria-label]`) for the few elements that don't read tokens. No `filter: invert()` — that would break images and animations.

The content script watches the feed wrapper (`[data-test-id="mainAppRoot"]`) for new pin cards and dialogs. The observer is scoped to that subtree and only watches `childList`, which keeps CPU usage low even during infinite scroll.

## Privacy

See [privacy-policy.html](./privacy-policy.html). Short version: nothing is collected, nothing leaves your browser.

Because PinDark is open-source under GNU GPLv3, the community can independently verify that absolutely zero data collection occurs.

## Support

If PinDark makes your Pinterest browsing easier, consider [buying the developer a coffee](https://topmate.io/mrfanta_stick/2208264/pay).

For bug reports, feature requests, or just to chat about open-source development, reach out on Discord: **da_honoured_1**.

## License

Licensed under GNU GPLv3. See the [LICENSE](./LICENSE) file for details.
