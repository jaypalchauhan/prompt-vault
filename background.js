/**
 * Service worker: keeps a right-click "Insert prompt" dropdown in sync with
 * the saved prompts, so a prompt can be inserted into any text box on any
 * site without opening the popup.
 *
 * Prompts inserted from the context menu keep their {{variables}} as-is —
 * the fill-in form is a popup feature.
 */
import { injectPrompt } from './insert.js';
import { SAMPLE_PROMPTS } from './samples.js';

const ROOT_ID = 'prompt-vault-root';

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

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [info.frameId ?? 0] },
    func: injectPrompt,
    args: [prompt.body],
  });

  if (result?.result) {
    // count the use so frequently used prompts rise to the top
    const updated = prompts.map((p) =>
      p.id === prompt.id ? { ...p, uses: (p.uses ?? 0) + 1 } : p,
    );
    await chrome.storage.sync.set({ prompts: updated });
  }
});
