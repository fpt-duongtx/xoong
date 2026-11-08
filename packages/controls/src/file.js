// @ts-check
/**
 * <xo-file> is a file field with a drop zone: drag a file onto it, or click to browse.
 *
 *   <xo-file name="logo" label="Logo" accept="image/*" max-size="2MB" hint="PNG or SVG, up to 2 MB"></xo-file>
 *   <xo-file name="attachments" multiple></xo-file>
 *
 * - The value is a `File` (with `multiple`: an array of files); a form sends it as multipart. `accept` takes the native syntax (`image/*`, `.pdf`);
 *   `max-size` is bytes or `2MB`, `500KB`. A refused file shows a message and fires `xo-file-reject` with `{ file, reason }` (`type` or `size`).
 * - Images get a thumbnail. Each file has a Remove button. `el.progress = 0.4` shows an upload progress bar (`null` hides it).
 * - The real <input type=file> stays in the zone, visually hidden but focusable: Enter and Space open the file dialog.
 */
import { XoControl, define, text } from '@xoong/core';

const UNITS = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
const bytes = (/** @type {string | undefined} */ v) => { const m = /^\s*([\d.]+)\s*([kmg]?b)?\s*$/i.exec(v ?? ''); return m ? Math.round(Number(m[1]) * UNITS[/** @type {keyof typeof UNITS} */ ((m[2] ?? 'b').toLowerCase())]) : 0; };
const matches = (/** @type {File} */ f, /** @type {string | undefined} */ accept) => !accept || accept.split(',').map((s) => s.trim().toLowerCase()).some((a) => a.startsWith('.') ? f.name.toLowerCase().endsWith(a) : a.endsWith('/*') ? f.type.startsWith(a.slice(0, -1)) : f.type === a);

class XoFile extends XoControl {
  static props = { ...XoControl.props, label: String, accept: String, maxSize: String, multiple: Boolean, hint: String };

  /** @type {HTMLInputElement | null} */ #input = null;
  /** @type {HTMLElement | null} */ #zone = null;
  /** @type {HTMLElement | null} */ #list = null;
  /** @type {HTMLElement | null} */ #error = null;
  /** @type {HTMLProgressElement | null} */ #bar = null;
  /** @type {string[]} */ #urls = [];

  get #files() { const v = super.value; return /** @type {File[]} */ (Array.isArray(v) ? v : v ? [v] : []); }
  setValue(v) { super.setValue(this.multiple ? (Array.isArray(v) ? v : v ? [v] : []) : Array.isArray(v) ? v[0] ?? '' : v ?? ''); this.#paintList(); }
  serialize(v) {
    if (!Array.isArray(v)) return super.serialize(v);
    const data = new FormData();
    for (const f of v) data.append(this.name, f);
    return v.length ? data : null;
  }
  isEmpty(v) { return !v || (Array.isArray(v) && !v.length); }
  get focusTarget() { return this.#input; }

  /** Upload progress from 0 to 1, or null to hide the bar. */
  get progress() { return this.#bar && !this.#bar.hidden ? this.#bar.value : null; }
  set progress(p) { if (!this.#bar) return; this.#bar.hidden = p == null; if (p != null) this.#bar.value = Math.min(1, Math.max(0, p)); }

  connected() {
    const zone = document.createElement('label');
    zone.className = 'xo-dropzone';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = this.accept ?? '';
    input.multiple = this.multiple;
    input.setAttribute('aria-label', this.label || this.name || text('xoong.controls.file', 'File'));
    zone.innerHTML = `<span class="ic" data-ic="upload" aria-hidden="true"></span><span><b>${this.multiple ? text('xoong.file.dropMany', 'Drop files') : text('xoong.file.drop', 'Drop a file')}</b> ${text('xoong.file.browse', 'or click to browse')}</span>`;
    if (this.hint) { const h = document.createElement('span'); h.textContent = this.hint; zone.append(h); }
    zone.append(input);
    input.addEventListener('change', () => { this.#take([...(input.files ?? [])]); input.value = ''; });
    for (const type of ['dragenter', 'dragover']) zone.addEventListener(type, (e) => { e.preventDefault(); zone.toggleAttribute('data-over', true); });
    for (const type of ['dragleave', 'drop']) zone.addEventListener(type, () => zone.removeAttribute('data-over'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); this.#take([...(/** @type {DragEvent} */ (e).dataTransfer?.files ?? [])]); });
    const error = document.createElement('p');
    error.className = 'error'; error.setAttribute('role', 'alert'); error.hidden = true;
    const bar = document.createElement('progress');
    bar.max = 1; bar.hidden = true; bar.setAttribute('aria-label', text('xoong.file.progress', 'Upload progress'));
    const list = document.createElement('ul');
    list.className = 'xo-file-list';
    this.#input = input; this.#zone = zone; this.#error = error; this.#list = list; this.#bar = bar;
    this.replaceChildren(zone, error, bar, list);
    queueMicrotask(() => this.#paintList());
  }
  disconnected() { this.#revoke(); }
  attributeChangedCallback(attr, old, value) {
    super.attributeChangedCallback(attr, old, value);
    if (this.#input) { this.#input.accept = this.accept ?? ''; this.#input.multiple = this.multiple; this.#input.disabled = this.isDisabled || this.readonly; }
  }

  #take(/** @type {File[]} */ files) {
    const limit = bytes(this.maxSize);
    const ok = [];
    const refuse = (/** @type {File} */ file, /** @type {'type' | 'size'} */ reason, /** @type {string} */ message) => {
      this.#say(message);
      this.dispatchEvent(new CustomEvent('xo-file-reject', { bubbles: true, detail: { file, reason } }));
    };
    this.#say('');
    for (const f of this.multiple ? files : files.slice(0, 1)) {
      if (!matches(f, this.accept)) refuse(f, 'type', text('xoong.file.type', '{name} is not an allowed file type.', { name: f.name }));
      else if (limit && f.size > limit) refuse(f, 'size', text('xoong.file.size', '{name} is too large (at most {max}).', { name: f.name, max: this.maxSize }));
      else ok.push(f);
    }
    if (!ok.length) return;
    this.userInput(this.multiple ? [...this.#files, ...ok] : ok[0]);
    this.userChange();
  }
  #say(/** @type {string} */ m) { if (this.#error) { this.#error.textContent = m; this.#error.hidden = !m; } }
  #revoke() { for (const u of this.#urls.splice(0)) URL.revokeObjectURL?.(u); }

  #paintList() {
    const list = this.#list;
    if (!list) return;
    this.#revoke();
    list.replaceChildren(...this.#files.map((f) => {
      const li = document.createElement('li');
      if (f.type.startsWith('image/') && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(f); this.#urls.push(url);
        const img = document.createElement('img'); img.src = url; img.alt = ''; img.width = 40; img.height = 40;
        li.append(img);
      }
      const name = document.createElement('span'); name.textContent = f.name;
      const rm = document.createElement('button');
      rm.type = 'button'; rm.className = 'ghost sm'; rm.textContent = text('xoong.file.remove', 'Remove'); rm.setAttribute('aria-label', text('xoong.controls.remove', 'Remove {label}', { label: f.name }));
      rm.addEventListener('click', () => { this.userInput(this.multiple ? this.#files.filter((x) => x !== f) : ''); this.userChange(); this.#input?.focus(); });
      li.append(name, rm);
      return li;
    }));
  }
}
define('xo-file', XoFile);
