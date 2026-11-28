/**
 * In-page JavaScript and DOM-tree helpers for browserUse actions, ported from
 * browser-use's default_action_watchdog.py, session.py and dom/views.py.
 * The JS strings run inside the page via Runtime.callFunctionOn, with `this`
 * bound to the target element.
 */
import { NodeType, type DomNode } from './dom-tree.js'

/** Text of all descendant text nodes, joined by newlines (views.py get_all_children_text). */
export function allChildrenText(node: DomNode, maxDepth = -1): string {
  const parts: string[] = []
  const walk = (n: DomNode, depth: number) => {
    if (maxDepth !== -1 && depth > maxDepth) return
    if (n.nodeType === NodeType.TEXT) parts.push(n.nodeValue)
    else if (n.nodeType === NodeType.ELEMENT) for (const c of n.children) walk(c, depth + 1)
  }
  walk(node, 0)
  return parts.join('\n').trim()
}

export const isFileInput = (n: DomNode) => n.nodeName.toUpperCase() === 'INPUT' && (n.attributes['type'] ?? '').toLowerCase() === 'file'

/** The nearest file input: the node, its descendants, then siblings, walking up 3 levels. */
export function findFileInputNear(node: DomNode, maxHeight = 3, maxDepth = 3): DomNode | null {
  const inDescendants = (n: DomNode, depth: number): DomNode | null => {
    if (depth < 0) return null
    if (isFileInput(n)) return n
    for (const c of n.childrenNodes || []) { const r = inDescendants(c, depth - 1); if (r) return r }
    return null
  }
  let cur: DomNode | null = node
  for (let i = 0; i <= maxHeight && cur; i++) {
    if (isFileInput(cur)) return cur
    const r = inDescendants(cur, maxDepth)
    if (r) return r
    for (const sib of cur.parentNode?.childrenNodes || []) {
      if (sib === cur) continue
      if (isFileInput(sib)) return sib
      const s = inDescendants(sib, maxDepth)
      if (s) return s
    }
    cur = cur.parentNode
  }
  return null
}

/** Inputs where typing key by key fails (date spinbuttons, pickers), so the value is set directly. */
export function requiresDirectValue(node: DomNode): boolean {
  if (node.tagName !== 'input' || !Object.keys(node.attributes).length) return false
  const type = (node.attributes['type'] ?? '').toLowerCase()
  if (['date', 'time', 'datetime-local', 'month', 'week', 'color', 'range'].includes(type)) return true
  if (type === 'text' || type === '') {
    const cls = (node.attributes['class'] ?? '').toLowerCase()
    if (['datepicker', 'daterangepicker', 'datetimepicker', 'bootstrap-datepicker'].some((i) => cls.includes(i))) return true
    if (['data-datepicker', 'data-date-format', 'data-provide'].some((a) => a in node.attributes)) return true
  }
  return false
}

/** true when a click at (x, y) would reach this element (or its label/input pair). */
export const OCCLUSION_JS = `function(x, y) {
  const at = document.elementFromPoint(x, y);
  if (!at) return false;
  if (this === at || this.contains(at) || at.contains(this)) return true;
  if (this.tagName === 'INPUT' && this.id) {
    const l = document.querySelector('label[for="' + CSS.escape(this.id) + '"]');
    if (l && (l === at || l.contains(at))) return true;
  }
  if (this.tagName === 'INPUT') {
    let a = at;
    for (let i = 0; i < 3 && a; i++) { if (a.tagName === 'LABEL' && a.contains(this)) return true; a = a.parentElement; }
  }
  if (this.tagName === 'LABEL' && at.tagName === 'INPUT' && (at.id === this.htmlFor || this.contains(at))) return true;
  return false;
}`

export const CLEAR_JS = `function() {
  const editable = this.getAttribute('contenteditable') === 'true' || this.getAttribute('contenteditable') === '' || this.isContentEditable === true;
  if (editable) {
    while (this.firstChild) this.removeChild(this.firstChild);
    this.textContent = ""; this.innerHTML = ""; this.focus();
    const sel = window.getSelection(); const range = document.createRange();
    range.setStart(this, 0); range.setEnd(this, 0); sel.removeAllRanges(); sel.addRange(range);
    this.dispatchEvent(new Event("input", { bubbles: true })); this.dispatchEvent(new Event("change", { bubbles: true }));
    return { cleared: true, method: 'contenteditable', finalText: this.textContent };
  } else if (this.value !== undefined) {
    try { this.select(); } catch (e) {}
    this.value = "";
    this.dispatchEvent(new Event("input", { bubbles: true })); this.dispatchEvent(new Event("change", { bubbles: true }));
    return { cleared: true, method: 'value', finalText: this.value };
  }
  return { cleared: false, method: 'none' };
}`

// The native setter bypasses React's value tracking, so onChange fires.
export const SET_VALUE_JS = `function(text) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(this, text);
  this.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  this.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  this.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  this.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  if (typeof jQuery !== 'undefined' && jQuery.fn) {
    try { jQuery(this).trigger('change'); if (jQuery(this).data('datepicker')) jQuery(this).datepicker('update'); } catch (e) {}
  }
  return this.value;
}`

export const FRAMEWORK_EVENTS_JS = `function() {
  const el = this; if (!el) return false;
  el.focus();
  try { el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: el.value, inputType: 'insertText' })); } catch (e) {}
  try { el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true })); } catch (e) {}
  try { el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true })); } catch (e) {}
  if (el._reactInternalFiber || el._reactInternalInstance || el.__reactInternalInstance) {
    try { const ev = new InputEvent('input', { bubbles: true, cancelable: true, data: el.value }); Object.defineProperty(ev, 'isTrusted', { value: true }); el.dispatchEvent(ev); } catch (e) {}
  }
  if (el.__vue__ || el._vnode || el.__vueParentComponent) {
    try { const ev = new Event('input', { bubbles: true }); setTimeout(() => el.dispatchEvent(ev), 0); } catch (e) {}
  }
  return true;
}`

export const FORCE_VALUE_JS = `function(v) {
  if (this.value !== undefined) {
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value') || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (d && d.set) d.set.call(this, v); else this.value = v;
  } else if (this.isContentEditable) {
    this.textContent = v;
  }
  this.dispatchEvent(new Event('input', { bubbles: true })); this.dispatchEvent(new Event('change', { bubbles: true }));
  return this.value !== undefined ? this.value : this.textContent;
}`

export const SELECT_JS = `function(targetText) {
  const start = this;
  const lower = targetText.toLowerCase();
  function attempt(el) {
    if (el.tagName.toLowerCase() === 'select') {
      const options = Array.from(el.options);
      for (const o of options) {
        if (o.text.trim().toLowerCase() === lower || o.value.toLowerCase() === lower) {
          const expected = o.value;
          el.focus(); el.value = expected; o.selected = true; el.selectedIndex = o.index;
          el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
          el.blur();
          if (el.value !== expected) {
            return { success: false, error: 'Selection was set but reverted by page framework. The dropdown may require clicking.', selectionReverted: true,
              targetOption: { text: o.text.trim(), value: expected, index: o.index },
              availableOptions: Array.from(el.options).map(x => ({ text: x.text.trim(), value: x.value })) };
          }
          return { success: true, message: 'Selected option: ' + o.text.trim() + ' (value: ' + o.value + ')', value: o.value };
        }
      }
      return { success: false, error: "Option with text or value '" + targetText + "' not found in select element",
        availableOptions: options.map(x => ({ text: x.text.trim(), value: x.value })) };
    }
    const role = el.getAttribute('role');
    if (role === 'menu' || role === 'listbox' || role === 'combobox') {
      const items = el.querySelectorAll('[role="menuitem"], [role="option"]');
      for (const it of items) {
        if (it.textContent && (it.textContent.trim().toLowerCase() === lower || (it.getAttribute('data-value') || '').toLowerCase() === lower)) {
          items.forEach(mi => { mi.setAttribute('aria-selected', 'false'); mi.classList.remove('selected'); });
          it.setAttribute('aria-selected', 'true'); it.classList.add('selected');
          it.click(); it.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
          return { success: true, message: 'Selected ARIA menu item: ' + it.textContent.trim() };
        }
      }
      return { success: false, error: "Menu item with text or value '" + targetText + "' not found",
        availableOptions: Array.from(items).map(i => ({ text: i.textContent ? i.textContent.trim() : '', value: i.getAttribute('data-value') || '' })).filter(o => o.text || o.value) };
    }
    if (el.classList.contains('dropdown') || el.classList.contains('ui')) {
      const items = el.querySelectorAll('.item, .option, [data-value]');
      for (const it of items) {
        if (it.textContent && (it.textContent.trim().toLowerCase() === lower || (it.getAttribute('data-value') || '').toLowerCase() === lower)) {
          items.forEach(mi => mi.classList.remove('selected', 'active'));
          it.classList.add('selected', 'active');
          const t = el.querySelector('.text'); if (t) t.textContent = it.textContent.trim();
          it.click(); it.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, message: 'Selected custom dropdown item: ' + it.textContent.trim() };
        }
      }
      return { success: false, error: "Custom dropdown item with text or value '" + targetText + "' not found",
        availableOptions: Array.from(items).map(i => ({ text: i.textContent ? i.textContent.trim() : '', value: i.getAttribute('data-value') || '' })).filter(o => o.text || o.value) };
    }
    return null;
  }
  function searchChildren(el, maxDepth, depth) {
    if (depth >= maxDepth) return null;
    for (const c of el.children) {
      const r = attempt(c); if (r && r.success) return r;
      const cr = searchChildren(c, maxDepth, depth + 1); if (cr && cr.success) return cr;
    }
    return null;
  }
  const own = attempt(start);
  if (own) return own;
  const found = searchChildren(start, 4, 0);
  if (found && found.success) return found;
  return { success: false, error: "Element and its children (depth 4) do not contain a dropdown with option '" + targetText + "' (tag: " + start.tagName + ", role: " + start.getAttribute('role') + ", classes: " + start.className + ")" };
}`

export const SELECT_CLICK_FALLBACK_JS = `function(i) {
  const s = this;
  if (s.tagName.toLowerCase() !== 'select') return { success: false, error: 'Not a select element' };
  const o = s.options[i];
  if (!o) return { success: false, error: 'Option not found at index ' + i };
  s.focus();
  s.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  s.selectedIndex = i; o.selected = true;
  o.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  s.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  s.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  s.blur();
  if (s.value === o.value || s.selectedIndex === i) return { success: true, message: 'Selected via click fallback: ' + o.text.trim(), value: o.value };
  return { success: false, error: 'Click fallback also failed - framework may block all programmatic selection' };
}`
