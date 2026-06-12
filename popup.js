import { injectPrompt } from './insert.js';

// When opened as a plain web page (e.g. the GitHub Pages demo) the extension
// APIs are missing — fall back to localStorage so the UI stays usable.
const IS_EXTENSION = typeof chrome !== 'undefined' && !!chrome.storage?.sync;

const store = IS_EXTENSION
  ? {
      async get() {
        const { prompts } = await chrome.storage.sync.get('prompts');
        return prompts ?? [];
      },
      async set(prompts) {
        await chrome.storage.sync.set({ prompts });
      },
    }
  : {
      async get() {
        try {
          return JSON.parse(localStorage.getItem('prompts')) ?? [];
        } catch {
          return [];
        }
      },
      async set(prompts) {
        localStorage.setItem('prompts', JSON.stringify(prompts));
      },
    };

const els = {
  search: document.getElementById('search'),
  list: document.getElementById('prompt-list'),
  emptyNote: document.getElementById('empty-note'),
  editor: document.getElementById('editor'),
  editorTitle: document.getElementById('editor-title'),
  editorBody: document.getElementById('editor-body'),
  addBtn: document.getElementById('add-btn'),
  cancelBtn: document.getElementById('editor-cancel'),
  exportBtn: document.getElementById('export-btn'),
  importBtn: document.getElementById('import-btn'),
  importFile: document.getElementById('import-file'),
  status: document.getElementById('status'),
};

let prompts = [];
let editingId = null;
let statusTimer = null;

function showStatus(message) {
  els.status.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    els.status.textContent = '';
  }, 2000);
}

function render() {
  const needle = els.search.value.trim().toLowerCase();
  const visible = needle
    ? prompts.filter(
        (p) => p.title.toLowerCase().includes(needle) || p.body.toLowerCase().includes(needle),
      )
    : prompts;

  els.list.replaceChildren(
    ...visible.map((prompt) => {
      const li = document.createElement('li');
      li.className = 'prompt-item';

      const main = document.createElement('button');
      main.className = 'prompt-main';
      main.title = 'Insert into the page';
      const title = document.createElement('span');
      title.className = 'prompt-title';
      title.textContent = prompt.title;
      const preview = document.createElement('span');
      preview.className = 'prompt-preview';
      preview.textContent = prompt.body.replace(/\s+/g, ' ').slice(0, 80);
      main.append(title, preview);
      main.addEventListener('click', () => usePrompt(prompt));

      const edit = document.createElement('button');
      edit.className = 'icon-btn';
      edit.textContent = '✎';
      edit.title = 'Edit';
      edit.addEventListener('click', () => openEditor(prompt));

      const del = document.createElement('button');
      del.className = 'icon-btn delete';
      del.textContent = '✕';
      del.title = 'Delete';
      del.addEventListener('click', () => deletePrompt(prompt.id));

      li.append(main, edit, del);
      return li;
    }),
  );

  els.emptyNote.classList.toggle('hidden', prompts.length > 0);
}

async function usePrompt(prompt) {
  if (IS_EXTENSION) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectPrompt,
        args: [prompt.body],
      });
      if (result?.result) {
        window.close();
        return;
      }
    } catch {
      // Page does not allow injection (chrome:// pages, web store, ...)
    }
  }
  await navigator.clipboard.writeText(prompt.body);
  showStatus('Copied to clipboard');
}

function openEditor(prompt = null) {
  editingId = prompt?.id ?? null;
  els.editorTitle.value = prompt?.title ?? '';
  els.editorBody.value = prompt?.body ?? '';
  els.editor.classList.remove('hidden');
  els.editorTitle.focus();
}

function closeEditor() {
  editingId = null;
  els.editor.reset();
  els.editor.classList.add('hidden');
}

async function savePrompt(event) {
  event.preventDefault();
  const title = els.editorTitle.value.trim();
  const body = els.editorBody.value;
  if (!title || !body.trim()) return;

  if (editingId) {
    prompts = prompts.map((p) => (p.id === editingId ? { ...p, title, body } : p));
  } else {
    prompts = [{ id: crypto.randomUUID(), title, body }, ...prompts];
  }
  await store.set(prompts);
  closeEditor();
  render();
}

async function deletePrompt(id) {
  prompts = prompts.filter((p) => p.id !== id);
  await store.set(prompts);
  render();
}

function exportPrompts() {
  const blob = new Blob([JSON.stringify(prompts, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'prompt-vault.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importPrompts(file) {
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error('not an array');
    const existingIds = new Set(prompts.map((p) => p.id));
    const cleaned = imported
      .filter((p) => p && typeof p.title === 'string' && typeof p.body === 'string')
      .map((p) => ({
        id: typeof p.id === 'string' && !existingIds.has(p.id) ? p.id : crypto.randomUUID(),
        title: p.title.slice(0, 60),
        body: p.body,
      }));
    prompts = [...cleaned, ...prompts];
    await store.set(prompts);
    render();
    showStatus(`Imported ${cleaned.length} prompt(s)`);
  } catch {
    showStatus('Invalid JSON file');
  }
}

els.search.addEventListener('input', render);
els.addBtn.addEventListener('click', () => openEditor());
els.cancelBtn.addEventListener('click', closeEditor);
els.editor.addEventListener('submit', savePrompt);
els.exportBtn.addEventListener('click', exportPrompts);
els.importBtn.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', () => {
  if (els.importFile.files[0]) {
    importPrompts(els.importFile.files[0]);
    els.importFile.value = '';
  }
});

(async function init() {
  prompts = await store.get();
  if (!IS_EXTENSION && prompts.length === 0) {
    // Demo mode starts empty (extension seeding happens in background.js)
    prompts = [
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
    await store.set(prompts);
  }
  render();
})();
