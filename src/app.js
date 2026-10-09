import { CATEGORIES, ENTRIES } from './data.js';
import { buildIndex, countByCategory, search, statusMessage } from './search.js';

const index = buildIndex(ENTRIES, CATEGORIES);
const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
const THEME_KEY = 'colinha-git:tema';
const THEMES = ['auto', 'escuro', 'claro'];

const els = {
  input: document.getElementById('busca'),
  chips: document.getElementById('categorias'),
  status: document.getElementById('status'),
  results: document.getElementById('resultados'),
  theme: document.getElementById('tema'),
  print: document.getElementById('imprimir'),
  announcer: document.getElementById('anuncio'),
};

const state = { query: '', category: null };
const chipButtons = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Texto com trechos entre crases viram <code>, sempre via textContent.
function appendRichText(parent, text) {
  text.split('`').forEach((part, i) => {
    if (!part) return;
    parent.append(i % 2 === 1 ? el('code', '', part) : document.createTextNode(part));
  });
}

// Marca os trechos que a pessoa deve trocar, como <arquivo> ou <branch>.
function appendCommandText(parent, command) {
  command.split(/(<[^<>\s]+>)/).forEach((part, i) => {
    if (!part) return;
    parent.append(i % 2 === 1 ? el('span', 'ph', part) : document.createTextNode(part));
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.className = 'clipboard-helper';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function announce(message) {
  els.announcer.textContent = '';
  window.setTimeout(() => { els.announcer.textContent = message; }, 30);
}

function renderCommand(command, isFile) {
  const row = el('div', 'cmd');
  const code = el('code', isFile ? 'line' : 'line prompt');
  appendCommandText(code, command);
  const button = el('button', 'copy', 'Copiar');
  button.type = 'button';
  button.setAttribute('aria-label', `Copiar: ${command}`);
  button.addEventListener('click', async () => {
    const ok = await copyText(command);
    button.textContent = ok ? 'Copiado!' : 'Não copiou';
    button.classList.toggle('done', ok);
    announce(ok ? 'Comando copiado.' : 'Não foi possível copiar. Selecione o texto e copie manualmente.');
    window.setTimeout(() => {
      button.textContent = 'Copiar';
      button.classList.remove('done');
    }, 1600);
  });
  row.append(code, button);
  return row;
}

function renderEntry(entry, showCategory) {
  const article = el('article', 'entry card');
  article.id = `dica-${entry.id}`;

  const head = el('div', 'entry-head');
  const title = el('h3');
  const link = el('a', 'entry-link');
  // Opções como --hard não devem quebrar no hífen.
  entry.title.split(/(\S*--\S+)/).forEach((part, i) => {
    if (part) link.append(i % 2 === 1 ? el('span', 'nowrap', part) : document.createTextNode(part));
  });
  link.href = `#dica-${entry.id}`;
  title.append(link);
  head.append(title);
  if (showCategory) {
    const category = categoryById.get(entry.category);
    head.append(el('span', 'badge', `${category.icon} ${category.label}`));
  }
  article.append(head);

  const block = el('div', 'code-block');
  block.append(el('p', 'code-label', entry.file ? `No arquivo ${entry.file}` : 'No terminal'));
  for (const command of entry.commands) block.append(renderCommand(command, Boolean(entry.file)));
  article.append(block);

  const explanation = el('p', 'explanation');
  appendRichText(explanation, entry.explanation);
  article.append(explanation);

  if (entry.warning) {
    const warning = el('p', 'warning');
    warning.append(el('strong', '', 'Atenção: '));
    appendRichText(warning, entry.warning);
    article.append(warning);
  }
  if (entry.legacy) {
    const legacy = el('p', 'legacy');
    legacy.append('Comando antigo equivalente: ');
    const code = el('code');
    appendCommandText(code, entry.legacy);
    legacy.append(code);
    article.append(legacy);
  }
  return article;
}

function renderChips() {
  const all = el('button', 'chip', '');
  all.type = 'button';
  all.dataset.category = '';
  chipButtons.set('', all);
  els.chips.append(all);
  for (const category of CATEGORIES) {
    const chip = el('button', 'chip');
    chip.type = 'button';
    chip.dataset.category = category.id;
    chipButtons.set(category.id, chip);
    els.chips.append(chip);
  }
  els.chips.addEventListener('click', (event) => {
    const chip = event.target.closest('button.chip');
    if (!chip) return;
    const id = chip.dataset.category || null;
    state.category = state.category === id ? null : id;
    update();
    revealActiveChip();
  });
}

// No celular os filtros rolam na horizontal: mantém o filtro ativo à vista.
function revealActiveChip() {
  const chip = chipButtons.get(state.category || '');
  const box = els.chips;
  if (!chip || box.scrollWidth <= box.clientWidth) return;
  const left = chip.offsetLeft;
  if (left < box.scrollLeft || left + chip.offsetWidth > box.scrollLeft + box.clientWidth) {
    box.scrollLeft = Math.max(0, left - 8);
  }
}

function updateChips(matchesIgnoringCategory) {
  const counts = countByCategory(matchesIgnoringCategory);
  for (const [id, chip] of chipButtons) {
    const category = categoryById.get(id);
    const count = id ? counts[id] || 0 : matchesIgnoringCategory.length;
    chip.textContent = '';
    chip.append(category ? `${category.icon} ${category.label}` : 'Todas');
    chip.append(el('span', 'chip-count', String(count)));
    chip.setAttribute('aria-pressed', String((state.category || '') === id));
  }
}

function renderResults(entries) {
  const fragment = document.createDocumentFragment();
  if (state.query.trim()) {
    const list = el('div', 'entry-list');
    for (const entry of entries) list.append(renderEntry(entry, true));
    fragment.append(list);
  } else {
    for (const category of CATEGORIES) {
      const inCategory = entries.filter((e) => e.category === category.id);
      if (!inCategory.length) continue;
      const section = el('section', 'category-section');
      section.setAttribute('aria-labelledby', `cat-${category.id}`);
      const heading = el('h2', '', `${category.icon} ${category.label}`);
      heading.id = `cat-${category.id}`;
      section.append(heading);
      const list = el('div', 'entry-list');
      for (const entry of inCategory) list.append(renderEntry(entry, false));
      section.append(list);
      fragment.append(section);
    }
  }
  els.results.replaceChildren(fragment);
}

function writeUrl() {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.category) params.set('categoria', state.category);
  const qs = params.toString();
  try {
    history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  } catch {
    // Alguns ambientes bloqueiam o histórico; a busca continua funcionando.
  }
}

function update() {
  const ignoringCategory = search(index, state.query);
  const entries = state.category ? ignoringCategory.filter((e) => e.category === state.category) : ignoringCategory;
  updateChips(ignoringCategory);
  renderResults(entries);
  const label = state.category ? categoryById.get(state.category).label : '';
  els.status.textContent = statusMessage(entries.length, { query: state.query, categoryLabel: label });
  writeUrl();
}

function highlightFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id.startsWith('dica-')) return;
  let target = document.getElementById(id);
  if (!target && (state.query || state.category)) {
    state.query = '';
    state.category = null;
    els.input.value = '';
    update();
    target = document.getElementById(id);
  }
  if (!target) return;
  document.querySelectorAll('.entry.highlight').forEach((node) => node.classList.remove('highlight'));
  target.classList.add('highlight');
  target.scrollIntoView({ block: 'start' });
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'escuro') root.dataset.theme = 'dark';
  else if (theme === 'claro') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  els.theme.textContent = `Tema: ${theme === 'auto' ? 'automático' : theme}`;
}

function setupTheme() {
  let theme = 'auto';
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.includes(saved)) theme = saved;
  } catch {
    // Sem localStorage: fica no tema automático.
  }
  applyTheme(theme);
  els.theme.addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Preferência não salva, mas aplicada nesta visita.
    }
  });
}

function init() {
  const params = new URLSearchParams(location.search);
  state.query = params.get('q') || '';
  const category = params.get('categoria');
  state.category = categoryById.has(category) ? category : null;
  els.input.value = state.query;

  renderChips();
  setupTheme();
  update();
  revealActiveChip();
  highlightFromHash();

  els.input.addEventListener('input', () => {
    state.query = els.input.value;
    update();
  });
  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && els.input.value) {
      event.preventDefault();
      els.input.value = '';
      state.query = '';
      update();
    }
  });
  document.addEventListener('keydown', (event) => {
    const typing = event.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      els.input.focus();
      els.input.select();
    }
  });
  window.addEventListener('hashchange', highlightFromHash);
  els.print.addEventListener('click', () => window.print());
}

init();
