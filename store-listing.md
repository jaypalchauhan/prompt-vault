# Chrome Web Store — submission kit

Everything needed to publish Prompt Vault. The store-ready package is the
`prompt-vault-2.0.0.zip` attached to the [v2.0.0 release](https://github.com/jaypalchauhan/prompt-vault/releases).

## Step-by-step

1. Go to https://chrome.google.com/webstore/devconsole and sign in with your
   Google account
2. Pay the one-time **$5 developer registration fee** (first time only)
3. Click **+ New item** and upload `prompt-vault-2.0.0.zip`
4. Fill the listing with the copy below, upload 1-5 screenshots
   (1280×800 — the demo page at https://jaypalchauhan.github.io/prompt-vault/demo.html
   makes good source material)
5. Fill the **Privacy** tab with the justifications below
6. Submit for review — first review usually takes a few business days

> Microsoft Edge Add-ons (https://partner.microsoft.com/dashboard/microsoftedge)
> accepts the same ZIP and has **no registration fee**.

## Listing copy

**Name:** Prompt Vault

**Summary (132 chars max):**
Save AI prompts with {{variables}}, tags and search — insert them into any text box on any site with one click.

**Description:**

Tired of retyping the same AI prompts? Prompt Vault keeps them one click away — on ChatGPT, Claude, Gemini, GitHub, Gmail, anywhere you type.

⚡ INSERT ANYWHERE
Open the popup (Alt+P) and click a prompt — it replaces the text in the box you were typing in. Or right-click any text field and pick from the "Insert prompt" menu. Works with plain text boxes and the rich editors used by ChatGPT, Claude and Gemini.

🧩 FILL-IN-THE-BLANK VARIABLES
Write prompts like "Explain {{topic}} in {{count}} bullet points". When you insert one, a small form pops up to fill in each blank, with a live preview of the final text.

🏷️ ORGANISED, NOT BURIED
Tag your prompts and filter with one click. Full-text search. Prompts you use most float to the top automatically.

🔒 PRIVATE BY DESIGN
No account, no servers, no tracking. Prompts live in your browser and sync across your Chrome profile. The extension only touches a page when you invoke it — no broad host permissions.

Also: light & dark themes, JSON import/export, copy-to-clipboard fallback.

**Category:** Productivity → Workflow & Planning
**Language:** English

## Privacy tab answers

- **Single purpose:** Saves user-written text snippets (prompts) and inserts
  them into text fields on the active page when the user requests it.
- **storage** — stores the user's saved prompts in Chrome sync storage.
- **activeTab / scripting** — used only when the user clicks a prompt in the
  popup or the context menu, to insert the chosen text into the active tab's
  focused text field. No scripts run in the background on any page.
- **contextMenus** — provides the right-click "Insert prompt" menu on
  editable fields.
- **Remote code:** No remote code is loaded or executed.
- **Data usage:** No user data is collected or transmitted. All data stays in
  the user's browser/Chrome sync.
