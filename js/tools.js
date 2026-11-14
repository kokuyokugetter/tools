import { calculators } from './calculators.js';
import { dailyTools } from './daily-tools.js';
import { shoppingTools } from './shopping-tools.js';

const tools = [...shoppingTools, ...dailyTools, ...calculators];

const get = (id) => document.getElementById(id);
const search = get('search');
const catalog = get('catalog');
const filters = get('filters');
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
const cards = new Map();

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
    search.value = '';
    for (const item of filters.children) item.setAttribute('aria-pressed', String(item === button));
    renderCatalog();
  });
  filters.append(button);
}

function renderCatalog() {
  const terms = normalize(search.value).trim().split(/\s+/).filter(Boolean);
  const matches = index.filter(({ tool, text }) => terms.length
    ? terms.every((term) => text.includes(term))
    : category === 'すべて' || tool.category === category);
  const score = ({ title }) => terms.filter((term) => title.includes(term)).length;
  if (terms.length) matches.sort((a, b) => score(b) - score(a));
  get('count').textContent = matches.length ? `${matches.length}件のツール` : '一致するツールはありません。';
  const visible = new Set(matches.map(({ tool }) => tool.id));
  for (const [id, { item }] of cards) item.hidden = !visible.has(id);
  catalog.append(...matches.map(({ tool }) => cards.get(tool.id).item));
}

function createCard(tool) {
  const item = element('li', undefined, 'tool-card');
  const toggle = element('button', undefined, 'card');
  toggle.type = 'button';
  toggle.id = 'toggle-' + tool.id;
  toggle.setAttribute('aria-controls', 'panel-' + tool.id);
  toggle.setAttribute('aria-expanded', 'false');
  const title = element('span', tool.name, 'card-title');
  const arrow = element('span', '⌄', 'card-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  toggle.append(element('span', tool.category, 'card-category'), title,
    element('span', tool.description, 'card-description'), arrow);

  const panel = element('section', undefined, 'tool');
  panel.id = 'panel-' + tool.id;
  panel.setAttribute('aria-labelledby', toggle.id);
  panel.hidden = true;
  toggle.addEventListener('click', () => {
    const top = toggle.getBoundingClientRect().top;
    const hash = activeId === tool.id ? '' : '#' + tool.id;
    history.pushState(null, '', location.pathname + location.search + hash);
    openTool();
    toggle.focus({ preventScroll: true });
    const shift = toggle.getBoundingClientRect().top - top;
    if (shift) window.scrollBy({ top: shift, behavior: 'instant' });
  });
  item.append(toggle, panel);
  catalog.append(item);
  cards.set(tool.id, { item, toggle, panel });
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
    for (const key of ['step', 'min', 'max', 'value', 'placeholder']) {
      if (field[key] !== undefined) control[key] = field[key];
    }
    if (field.type === 'number') control.inputMode = field.step === 1 ? 'numeric' : 'decimal';
  }
  if (field.value !== undefined && field.choices) control.value = field.value;
  label.append(element('span', field.label), control);
  return label;
}

function readValues(form, fields) {
  return Object.fromEntries(fields.map(({ name }) => {
    const control = form.elements.namedItem(name);
    if (control.type !== 'number') return [name, control.value];
    return [name, control.validity.valid && Number.isFinite(control.valueAsNumber)
      ? control.valueAsNumber : undefined];
  }));
}

function openTool() {
  const tool = entries.get(location.hash.slice(1));
  if (activeId === tool?.id) return;
  const previous = cards.get(activeId);
  if (previous) {
    if (previous.panel.contains(document.activeElement)) previous.toggle.focus({ preventScroll: true });
    previous.toggle.setAttribute('aria-expanded', 'false');
    previous.panel.hidden = true;
  }
  activeId = tool?.id;
  if (!tool) return;

  const { toggle, panel } = cards.get(tool.id);
  toggle.setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  if (panel.firstChild) return;

  const form = element('form');
  const result = element('output');
  const close = element('button', '閉じる', 'close-tool');
  close.type = 'button';
  close.addEventListener('click', () => {
    toggle.click();
    toggle.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  form.addEventListener('submit', (event) => event.preventDefault());
  panel.append(form, result, close);
  if (tool.mount) {
    tool.mount(form, result, controlFor);
  } else {
    form.append(...tool.fields.map(controlFor));
    const update = (event) => {
      tool.sync?.(form, event?.target.name);
      result.textContent = tool.calculate(readValues(form, tool.fields));
    };
    form.addEventListener('input', update);
    update();
  }
}

search.addEventListener('input', () => {
  category = 'すべて';
  for (const button of filters.children) button.setAttribute('aria-pressed', String(button.textContent === category));
  renderCatalog();
});
search.addEventListener('keydown', (event) => {
  if (event.isComposing) return;
  if (event.key === 'Escape') {
    search.value = '';
    renderCatalog();
  }
  if (event.key === 'Enter') catalog.querySelector('li:not([hidden]) .card')?.click();
});
document.addEventListener('keydown', (event) => {
  if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.closest('input, textarea, select, [contenteditable]')) return;
  if (event.key === '/') {
    event.preventDefault();
    search.focus();
  }
});
window.addEventListener('hashchange', openTool);

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
for (const tool of tools) createCard(tool);
renderCatalog();
openTool();
