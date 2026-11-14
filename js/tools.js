import { calculators } from './calculators.js';
import { advancedTools } from './advanced-tools.js';

const tools = [...calculators, ...advancedTools];
const advancedIds = new Set(advancedTools.map((tool) => tool.id));

const get = (id) => document.getElementById(id);
const search = get('search');
const catalog = get('catalog');
const filters = get('filters');
const panel = get('tool');
const theme = get('theme');
const entries = new Map(tools.map((tool) => [tool.id, tool]));
const normalize = (text) => text.normalize('NFKC').toLowerCase()
  .replace(/[ァ-ヶ]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) - 96));
const index = tools.map((tool) => ({
  tool,
  title: normalize(tool.name),
  text: normalize([tool.name, tool.category, tool.description, tool.keywords].join(' ')),
}));

let category = 'すべて';
let activeId;
let panelOpen = false;
let disposeTool;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

for (const name of ['すべて', ...new Set(tools.map((tool) => tool.category))]) {
  const button = element('button', name);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(name === category));
  button.addEventListener('click', () => {
    category = name;
    for (const item of filters.children) item.setAttribute('aria-pressed', String(item === button));
    renderCatalog();
  });
  filters.append(button);
}

function renderCatalog() {
  const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
  const matches = index.filter(({ tool, text }) =>
    (category === 'すべて' || tool.category === category) && terms.every((term) => text.includes(term)));
  const score = ({ title }) => terms.filter((term) => title.includes(term)).length;
  if (terms.length) matches.sort((a, b) => score(b) - score(a));
  get('count').textContent = matches.length ? `${matches.length}件のツール` : '一致するツールはありません。';
  catalog.replaceChildren(...matches.map(({ tool }) => {
    const item = element('li');
    const link = element('a', undefined, 'card');
    link.href = '#' + tool.id;
    if (tool.id === activeId) link.setAttribute('aria-current', 'true');
    link.append(element('small', tool.category), element('strong', tool.name), element('p', tool.description));
    item.append(link);
    return item;
  }));
}

function controlFor(field) {
  const label = element('label', undefined, 'field');
  const control = element(field.choices ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
  control.name = field.name;
  if (field.choices) {
    for (const [value, title] of field.choices) control.add(new Option(title, value));
  } else {
    if (field.type === 'textarea') {
      control.rows = field.rows ?? 6;
      control.spellcheck = false;
      label.classList.add('field-wide');
    } else {
      control.type = field.type;
    }
    for (const key of ['step', 'min', 'max', 'value']) {
      if (field[key] !== undefined) control[key] = field[key];
    }
    if (field.accept) control.accept = field.accept;
    if (field.type === 'number') control.inputMode = field.step === 1 ? 'numeric' : 'decimal';
  }
  if (field.value !== undefined && field.choices) control.value = field.value;
  label.append(element('span', field.label), control);
  return label;
}

function readValues(form, fields) {
  return Object.fromEntries(fields.map(({ name }) => {
    const control = form.elements.namedItem(name);
    if (control.type === 'file') return [name, control.files[0]];
    if (control.type !== 'number') return [name, control.value];
    return [name, control.validity.valid && Number.isFinite(control.valueAsNumber)
      ? control.valueAsNumber : undefined];
  }));
}

function setupAdvanced(tool, form, result) {
  const actions = element('div', undefined, 'tool-actions');
  const run = element('button', '計算する', 'run-tool');
  run.type = 'submit';
  const cancel = element('button', '中止');
  cancel.type = 'button';
  cancel.hidden = true;
  actions.append(run, cancel);
  form.append(actions);

  const detail = element('pre', undefined, 'result-detail');
  detail.tabIndex = 0;
  detail.hidden = true;
  const download = element('a', undefined, 'result-download');
  download.hidden = true;
  result.after(detail, download);

  let worker;
  let downloadUrl;
  function stop() {
    const restoreFocus = document.activeElement === cancel;
    worker?.terminate();
    worker = undefined;
    run.disabled = false;
    cancel.hidden = true;
    if (restoreFocus) run.focus({ preventScroll: true });
  }
  function clearResult() {
    detail.hidden = true;
    detail.textContent = '';
    download.hidden = true;
    download.removeAttribute('href');
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = undefined;
  }
  cancel.addEventListener('click', () => {
    stop();
    result.textContent = '計算を中止しました。';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (worker) return;
    clearResult();
    try {
      const current = new Worker(new URL('./tool-worker.js', import.meta.url), { type: 'module' });
      worker = current;
      cancel.hidden = false;
      result.textContent = '計算中…';
      current.onmessage = ({ data }) => {
        if (worker !== current) return;
        stop();
        result.textContent = data.text;
        if (data.detail) {
          detail.textContent = data.detail;
          detail.hidden = false;
        }
        if (data.artifact) {
          const { filename, text, blob, type = 'text/plain;charset=utf-8' } = data.artifact;
          downloadUrl = URL.createObjectURL(blob ?? new Blob([text], { type }));
          download.href = downloadUrl;
          download.download = filename;
          download.textContent = `${filename} をダウンロード`;
          download.hidden = false;
        }
      };
      current.onerror = () => {
        if (worker !== current) return;
        stop();
        result.textContent = '計算処理を読み込めませんでした。ページを再読み込みしてお試しください。';
      };
      current.onmessageerror = () => {
        if (worker !== current) return;
        stop();
        result.textContent = '計算結果を受け取れませんでした。入力を減らしてお試しください。';
      };
      current.postMessage({ id: tool.id, values: readValues(form, tool.fields) });
      run.disabled = true;
      cancel.focus();
    } catch {
      stop();
      result.textContent = '計算を開始できませんでした。ブラウザと入力内容を確認してください。';
    }
  });
  form.addEventListener('input', () => {
    if (worker) {
      stop();
      result.textContent = '入力が変わりました。もう一度計算してください。';
    } else if (result.textContent !== '入力を確認して計算を実行してください。') {
      clearResult();
      result.textContent = '入力が変わりました。もう一度計算してください。';
    }
  });
  return () => {
    stop();
    clearResult();
  };
}

function openTool(moveFocus = true) {
  const nextId = location.hash.slice(1);
  const tool = entries.get(nextId);
  const changed = activeId !== tool?.id || panelOpen !== Boolean(tool);
  activeId = tool?.id;
  panelOpen = Boolean(tool);
  panel.hidden = !panelOpen;
  if (changed) {
    disposeTool?.();
    disposeTool = undefined;
    renderCatalog();
    panel.replaceChildren();
  }
  if (!tool) return;
  if (changed) {
    const heading = element('h2', tool.name);
    heading.id = 'tool-heading';
    heading.tabIndex = -1;
    panel.setAttribute('aria-labelledby', heading.id);
    const form = element('form');
    const result = element('output');
    form.append(...tool.fields.map(controlFor));
    panel.append(heading, element('p', tool.description, 'description'), form, result);
    if (advancedIds.has(tool.id)) {
      result.textContent = '入力を確認して計算を実行してください。';
      disposeTool = setupAdvanced(tool, form, result);
    } else {
      form.addEventListener('submit', (event) => event.preventDefault());
      const update = (event) => {
        tool.sync?.(form, event?.target.name);
        result.textContent = tool.calculate(readValues(form, tool.fields));
      };
      form.addEventListener('input', update);
      update();
    }
  }
  if (moveFocus) {
    get('tool-heading').focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'start' });
  }
}

search.addEventListener('input', renderCatalog);
search.addEventListener('keydown', (event) => {
  if (event.isComposing) return;
  if (event.key === 'Escape') {
    search.value = '';
    renderCatalog();
  }
  if (event.key === 'Enter') catalog.querySelector('a')?.click();
});
document.addEventListener('keydown', (event) => {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest('input, textarea, select, [contenteditable]')) return;
  if (event.key === '/') {
    event.preventDefault();
    search.focus();
  }
});
catalog.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (link?.hash === location.hash && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    openTool();
  }
});
window.addEventListener('hashchange', () => openTool());

const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let preference;
try { preference = localStorage.getItem('tools-theme'); } catch {}
function applyTheme() {
  const dark = preference === 'dark' || (preference !== 'light' && systemTheme.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  theme.setAttribute('aria-pressed', String(dark));
}
theme.addEventListener('click', () => {
  preference = theme.getAttribute('aria-pressed') === 'true' ? 'light' : 'dark';
  try { localStorage.setItem('tools-theme', preference); } catch {}
  applyTheme();
});
systemTheme.addEventListener('change', applyTheme);
applyTheme();
renderCatalog();
openTool();
