/**
 * Service worker: keeps a right-click "Insert prompt" dropdown in sync with
 * the saved prompts, so a prompt can be inserted into any text box on any
 * site without opening the popup.
 */
import { injectPrompt } from './insert.js';

const ROOT_ID = 'prompt-vault-root';

const SAMPLE_PROMPTS = [
  {
    id: 'sample-explain',
    title: 'Explain like I am five',
    body: 'Explain the following topic in simple words, as if I were five years old. Use a short analogy from everyday life:\n\n',
  },
  {
    id: 'sample-review',
    title: 'Code review',
    body: 'Review the following code. Point out bugs, security issues and readability problems, in order of importance. Suggest a fix for each:\n\n',
  },
  {
    id: 'sample-email',
    title: 'Professional email',
    body: 'Rewrite the following text as a short, polite, professional email. Keep it under 120 words:\n\n',
  },
];

async function getPrompts() {
  const { prompts } = await chrome.storage.sync.get('prompts');
  return prompts ?? [];
}

async function rebuildMenu() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: ROOT_ID,
    title: 'Insert prompt',
    contexts: ['editable'],
  });
  const prompts = await getPrompts();
  if (prompts.length === 0) {
    chrome.contextMenus.create({
      id: 'prompt-vault-empty',
      parentId: ROOT_ID,
      title: 'No prompts saved yet',
      enabled: false,
      contexts: ['editable'],
    });
    return;
  }
  for (const prompt of prompts) {
    chrome.contextMenus.create({
      id: `prompt:${prompt.id}`,
      parentId: ROOT_ID,
      title: prompt.title,
      contexts: ['editable'],
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const prompts = await getPrompts();
  if (prompts.length === 0) {
    await chrome.storage.sync.set({ prompts: SAMPLE_PROMPTS });
  }
  await rebuildMenu();
});

chrome.runtime.onStartup.addListener(rebuildMenu);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.prompts) {
    rebuildMenu();
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const id = String(info.menuItemId);
  if (!id.startsWith('prompt:') || !tab?.id) return;

  const prompts = await getPrompts();
  const prompt = prompts.find((p) => `prompt:${p.id}` === id);
  if (!prompt) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
    func: injectPrompt,
    args: [prompt.body],
  });
});
