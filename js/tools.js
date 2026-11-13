import { calculators } from './calculators.js';

const get = (id) => document.getElementById(id);
const search = get('search');
const catalog = get('catalog');
const filters = get('filters');
const panel = get('tool');
const theme = get('theme');
const entries = new Map(calculators.map((tool) => [tool.id, tool]));
const normalize = (text) => text.normalize('NFKC').toLowerCase()
  .replace(/[ァ-ヶ]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) - 96));
const index = calculators.map((tool) => ({
  tool,
  title: normalize(tool.name),
  text: normalize([tool.name, tool.category, tool.description, tool.keywords].join(' ')),
}));

let category = 'すべて';
let activeId;
let panelOpen = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

for (const name of ['すべて', ...new Set(calculators.map((tool) => tool.category))]) {
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
  const control = element(field.choices ? 'select' : 'input');
  control.name = field.name;
  if (field.choices) {
    for (const [value, title] of field.choices) control.add(new Option(title, value));
  } else {
    control.type = field.type;
    for (const key of ['step', 'min', 'max', 'value']) {
      if (field[key] !== undefined) control[key] = field[key];
    }
    if (field.type === 'number') control.inputMode = field.step === 1 ? 'numeric' : 'decimal';
  }
  label.append(element('span', field.label), control);
  return label;
}

function openTool(moveFocus = true) {
  const nextId = location.hash.slice(1);
  const tool = entries.get(nextId);
  const changed = activeId !== tool?.id || panelOpen !== Boolean(tool);
  activeId = tool?.id;
  panelOpen = Boolean(tool);
  panel.hidden = !panelOpen;
  if (changed) {
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
    form.addEventListener('submit', (event) => event.preventDefault());
    const update = (event) => {
      tool.sync?.(form, event?.target.name);
      const values = Object.fromEntries(Array.from(form.elements, (control) => [
        control.name,
        control.type === 'number'
          ? (control.validity.valid && Number.isFinite(control.valueAsNumber) ? control.valueAsNumber : undefined)
          : control.value,
      ]));
      result.textContent = tool.calculate(values);
    };
    form.addEventListener('input', update);
    panel.append(heading, element('p', tool.description, 'description'), form, result);
    update();
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
