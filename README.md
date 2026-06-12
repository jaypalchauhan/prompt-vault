# Prompt Vault

A Chrome extension for people who keep retyping the same AI prompts. Save your
prompts once, then insert them into **any text box on any site** — ChatGPT,
Claude, Gemini, GitHub, Gmail — with one click or a right-click.

**Live demo of the popup UI:** https://jaypalchauhan.github.io/prompt-vault/demo.html

## Features

- **One-click insert** — open the popup, click a prompt, it replaces the text
  in the box you were typing in
- **Right-click dropdown** — right-click any text field → *Insert prompt* →
  pick from your saved prompts, without opening the popup
- Works with plain inputs, textareas **and** rich editors (ChatGPT, Claude and
  Gemini use contenteditable editors — handled via real edit commands so the
  site reacts as if you typed)
- React-safe insertion: goes through the native value setter and fires
  `input`/`change` events, so frameworks pick up the new text
- Search, edit, delete, and **import/export** prompts as JSON
- Prompts sync across your Chrome profile via `chrome.storage.sync`
- Privacy-friendly: no servers, no tracking, no broad host permissions —
  uses `activeTab`, so it only touches a page when **you** invoke it
- Falls back to copying the prompt to your clipboard on pages where injection
  isn't allowed (e.g. `chrome://` pages)

## Install (developer mode)

1. Clone or [download](https://github.com/jaypalchauhan/prompt-vault/archive/refs/heads/main.zip) this repo
2. Open `chrome://extensions` in Chrome or Edge
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select the `prompt-vault` folder
5. Pin the ⚡ icon — you start with three sample prompts

## How it works

```
popup.js / background.js          insert.js (injected into the page)
┌─────────────────────────┐       ┌─────────────────────────────────┐
│ prompts in              │ click │ find focused element            │
│ chrome.storage.sync     ├──────►│ (follows shadow DOM)            │
│                         │       │ contenteditable? execCommand    │
│ context menu kept in    │       │ input/textarea?  native setter  │
│ sync via storage events │       │   + input/change events         │
└─────────────────────────┘       └─────────────────────────────────┘
```

The popup and the service worker share one injection function
([insert.js](insert.js)), executed in the page via `chrome.scripting` — there
is no persistent content script running on every site.

## Project structure

```
manifest.json    # Manifest V3
popup.html/css/js# popup UI: list, search, editor, import/export
background.js    # right-click menu, kept in sync with storage
insert.js        # the injection function shared by both
demo.html        # standalone demo (localStorage instead of chrome.storage)
```

## License

MIT — see [LICENSE](LICENSE).
