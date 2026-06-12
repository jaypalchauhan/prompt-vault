/**
 * Injected into the page to replace the content of the focused text box.
 *
 * Must stay self-contained: chrome.scripting serialises this function and
 * runs it inside the page, so it cannot reference anything outside itself.
 * Returns true if a text box was found and filled.
 */
export function injectPrompt(text) {
  const isEditable = (el) =>
    !!el &&
    (el.tagName === 'TEXTAREA' ||
      (el.tagName === 'INPUT' && /^(text|search|url|email|tel)$/i.test(el.type)) ||
      el.isContentEditable);

  // The focused element, following through shadow DOM if needed
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }

  // Nothing focused? Fall back to the first text box on the page.
  if (!isEditable(el)) {
    el = document.querySelector('textarea, [contenteditable="true"]');
  }
  if (!isEditable(el)) {
    return false;
  }

  el.focus();

  if (el.isContentEditable) {
    // Rich editors (ChatGPT, Claude, Gemini, ...) listen for real edit
    // commands, so use execCommand to replace the current content.
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  } else {
    // React and friends ignore plain `el.value = ...` assignments — go
    // through the native setter, then fire the events frameworks expect.
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return true;
}
