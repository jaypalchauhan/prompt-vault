import { injectPrompt } from './insert.js';
import { SAMPLE_PROMPTS } from './samples.js';

// When opened as a plain web page (e.g. the GitHub Pages demo) the extension
// APIs are missing — fall back to localStorage so the UI stays usable.
const IS_EXTENSION = typeof chrome !== 'undefined' && !!chrome.storage?.sync;

const VAR_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

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

const els = Object.fromEntries(
  [
    'search', 'tag-bar', 'prompt-list', 'empty-note', 'editor', 'editor-title',
    'editor-tags', 'editor-body', 'add-btn', 'editor-cancel', 'theme-btn',
    'var-panel', 'var-title', 'var-fields', 'var-preview', 'var-cancel',
    'var-insert', 'export-btn', 'import-btn', 'import-file', 'status',
  ].map((id) => [id.replace(/-(\w)/g, (_, c) => c.toUpperCase()), document.getElementById(id)]),
);

let prompts = [];
let editingId = null;
let activeTag = null;
let varPrompt = null; // prompt currently in the variable fill-in panel
let statusTimer = null;

/* ---------- helpers ---------- */

function extractVariables(body) {
  const names = [];
  for (const match of body.matchAll(VAR_PATTERN)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

function fillVariables(body, values) {
  return body.replace(VAR_PATTERN, (_, name) => values[name] ?? `{{${name}}}`);
}

function normalize(stored) {
  return stored.map((p) => ({ tags: [], uses: 0, updatedAt: 0, ...p }));
}

function sorted(list) {
  return [...list].sort(
    (a, b) => b.uses - a.uses || b.updatedAt - a.updatedAt || a.title.localeCompare(b.title),
  );
}

function showStatus(message) {
  els.status.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    els.status.textContent = '';
  }, 2000);
}

function closePanels() {
  editingId = null;
  varPrompt = null;
  els.editor.reset();
  els.editor.classList.add('hidden');
  els.varPanel.classList.add('hidden');
}

/* ---------- rendering ---------- */

function renderTagBar() {
  const tags = [...new Set(prompts.flatMap((p) => p.tags))].sort();
  if (activeTag && !tags.includes(activeTag)) activeTag = null;
  if (tags.length === 0) {
    els.tagBar.replaceChildren();
    return;
  }
  els.tagBar.replaceChildren(
    ...[null, ...tags].map((tag) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (tag === activeTag ? ' active' : '');
      chip.textContent = tag ?? 'All';
      chip.addEventListener('click', () => {
        activeTag = tag;
        render();
      });
      return chip;
    }),
  );
}

function renderList() {
  const needle = els.search.value.trim().toLowerCase();
  let visible = sorted(prompts);
  if (activeTag) visible = visible.filter((p) => p.tags.includes(activeTag));
  if (needle) {
    visible = visible.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.body.toLowerCase().includes(needle) ||
        p.tags.some((t) => t.toLowerCase().includes(needle)),
    );
  }

  els.promptList.replaceChildren(
    ...visible.map((prompt) => {
      const li = document.createElement('li');
      li.className = 'prompt-item';

      const row = document.createElement('div');
      row.className = 'prompt-row';

      const main = document.createElement('button');
      main.type = 'button';
      main.className = 'prompt-main';
      main.title = 'Insert into the page';
      const title = document.createElement('span');
      title.className = 'prompt-title';
      title.textContent = prompt.title;
      const preview = document.createElement('span');
      preview.className = 'prompt-preview';
      preview.textContent = prompt.body.replace(/\s+/g, ' ').slice(0, 90);
      main.append(title, preview);
      main.addEventListener('click', () => usePrompt(prompt));

      const actions = document.createElement('div');
      actions.className = 'prompt-actions';
      for (const [glyph, label, handler, cls] of [
        ['⧉', 'Copy', () => copyPrompt(prompt), ''],
        ['✎', 'Edit', () => openEditor(prompt), ''],
        ['✕', 'Delete', () => deletePrompt(prompt.id), 'delete'],
      ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `icon-btn ${cls}`.trim();
        btn.textContent = glyph;
        btn.title = label;
        btn.addEventListener('click', handler);
        actions.append(btn);
      }
      row.append(main, actions);

      const meta = document.createElement('div');
      meta.className = 'prompt-meta';
      for (const tag of prompt.tags) {
        const chip = document.createElement('span');
        chip.className = 'mini-chip';
        chip.textContent = tag;
        meta.append(chip);
      }
      const vars = extractVariables(prompt.body);
      if (vars.length > 0) {
        const badge = document.createElement('span');
        badge.className = 'var-badge';
        badge.textContent = `{{ }} ×${vars.length}`;
        badge.title = `Variables: ${vars.join(', ')}`;
        meta.append(badge);
      }
      if (prompt.uses > 0) {
        const uses = document.createElement('span');
        uses.className = 'uses-badge';
        uses.textContent = `used ${prompt.uses}×`;
        meta.append(uses);
      }

      li.append(row, meta);
      return li;
    }),
  );

  els.emptyNote.classList.toggle('hidden', visible.length > 0);
}

function render() {
  renderTagBar();
  renderList();
}

/* ---------- insert / copy ---------- */

async function deliver(prompt, text) {
  if (IS_EXTENSION) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: injectPrompt,
        args: [text],
      });
      if (result?.result) {
        await recordUse(prompt.id);
        window.close();
        return;
      }
    } catch {
      // Page does not allow injection (chrome:// pages, web store, ...)
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    await recordUse(prompt.id);
    showStatus('Copied to clipboard');
  } catch {
    showStatus('Could not copy — select and copy manually');
  }
}

async function recordUse(id) {
  prompts = prompts.map((p) => (p.id === id ? { ...p, uses: p.uses + 1 } : p));
  await store.set(prompts);
  render();
}

function usePrompt(prompt) {
  const vars = extractVariables(prompt.body);
  if (vars.length === 0) {
    deliver(prompt, prompt.body);
    return;
  }
  openVarPanel(prompt, vars);
}

async function copyPrompt(prompt) {
  try {
    await navigator.clipboard.writeText(prompt.body);
    showStatus('Copied to clipboard');
  } catch {
    showStatus('Could not copy');
  }
}

/* ---------- variable fill-in panel ---------- */

function openVarPanel(prompt, vars) {
  closePanels();
  varPrompt = prompt;
  els.varTitle.textContent = prompt.title;
  els.varFields.replaceChildren(
    ...vars.map((name) => {
      const wrap = document.createElement('div');
      wrap.className = 'var-field';
      const label = document.createElement('label');
      label.textContent = name;
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.var = name;
      input.placeholder = `Value for {{${name}}}`;
      input.addEventListener('input', updateVarPreview);
      wrap.append(label, input);
      return wrap;
    }),
  );
  updateVarPreview();
  els.varPanel.classList.remove('hidden');
  els.varFields.querySelector('input')?.focus();
}

function collectVarValues() {
  const values = {};
  for (const input of els.varFields.querySelectorAll('input')) {
    if (input.value.trim()) values[input.dataset.var] = input.value;
  }
  return values;
}

function updateVarPreview() {
  if (!varPrompt) return;
  els.varPreview.value = fillVariables(varPrompt.body, collectVarValues());
}

/* ---------- editor ---------- */

function openEditor(prompt = null) {
  closePanels();
  editingId = prompt?.id ?? null;
  els.editorTitle.value = prompt?.title ?? '';
  els.editorTags.value = prompt?.tags.join(', ') ?? '';
  els.editorBody.value = prompt?.body ?? '';
  els.editor.classList.remove('hidden');
  els.editorTitle.focus();
}

async function savePrompt(event) {
  event.preventDefault();
  const title = els.editorTitle.value.trim();
  const body = els.editorBody.value;
  const tags = els.editorTags.value
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5);
  if (!title || !body.trim()) return;

  if (editingId) {
    prompts = prompts.map((p) =>
      p.id === editingId ? { ...p, title, body, tags, updatedAt: Date.now() } : p,
    );
  } else {
    prompts = [
      { id: crypto.randomUUID(), title, body, tags, uses: 0, updatedAt: Date.now() },
      ...prompts,
    ];
  }
  await store.set(prompts);
  closePanels();
  render();
}

async function deletePrompt(id) {
  prompts = prompts.filter((p) => p.id !== id);
  await store.set(prompts);
  render();
}

/* ---------- import / export ---------- */

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
    const cleaned = normalize(
      imported.filter((p) => p && typeof p.title === 'string' && typeof p.body === 'string'),
    ).map((p) => ({
      ...p,
      id: typeof p.id === 'string' && !existingIds.has(p.id) ? p.id : crypto.randomUUID(),
      title: p.title.slice(0, 60),
    }));
    prompts = [...cleaned, ...prompts];
    await store.set(prompts);
    render();
    showStatus(`Imported ${cleaned.length} prompt(s)`);
  } catch {
    showStatus('Invalid JSON file');
  }
}

/* ---------- theme ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
}

/* ---------- wiring ---------- */

els.search.addEventListener('input', renderList);
els.addBtn.addEventListener('click', () => openEditor());
els.editorCancel.addEventListener('click', closePanels);
els.editor.addEventListener('submit', savePrompt);
els.varCancel.addEventListener('click', closePanels);
els.varInsert.addEventListener('click', () => {
  if (!varPrompt) return;
  const text = fillVariables(varPrompt.body, collectVarValues());
  const prompt = varPrompt;
  closePanels();
  deliver(prompt, text);
});
els.themeBtn.addEventListener('click', () =>
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'),
);
els.exportBtn.addEventListener('click', exportPrompts);
els.importBtn.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', () => {
  if (els.importFile.files[0]) {
    importPrompts(els.importFile.files[0]);
    els.importFile.value = '';
  }
});

(async function init() {
  applyTheme(localStorage.getItem('theme') ?? 'dark');
  prompts = normalize(await store.get());
  if (!IS_EXTENSION && prompts.length === 0) {
    // Demo mode starts empty (extension seeding happens in background.js)
    prompts = SAMPLE_PROMPTS;
    await store.set(prompts);
  }
  render();
})();
