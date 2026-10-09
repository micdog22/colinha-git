// Busca da colinha: ignora acentos e maiúsculas, entende alguns sinônimos
// e ordena os resultados pela relevância (título > palavras-chave > comandos > texto).

const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'e', 'em',
  'no', 'na', 'nos', 'nas', 'ao', 'aos', 'para', 'pra', 'pro', 'por', 'pelo', 'pela', 'com',
  'como', 'que', 'se', 'eu', 'me', 'meu', 'minha', 'meus', 'minhas', 'sem', 'mas', 'ou',
  'quero', 'queria', 'preciso', 'fazer', 'faco', 'dar',
]);

const SYNONYM_GROUPS = [
  ['apagar', 'deletar', 'excluir', 'remover', 'delete', 'remove'],
  ['desfazer', 'undo', 'reverter', 'voltar', 'cancelar'],
  ['renomear', 'rename'],
  ['enviar', 'push', 'subir', 'publicar'],
  ['baixar', 'pull', 'fetch', 'atualizar', 'download'],
  ['guardar', 'stash', 'esconder'],
  ['juntar', 'merge', 'mesclar', 'integrar', 'unir'],
  ['senha', 'segredo', 'token', 'credencial', 'chave'],
  ['versao', 'tag', 'release'],
  ['conflito', 'conflict'],
  ['ignorar', 'ignore', 'gitignore'],
  ['historico', 'log', 'history'],
  ['trocar', 'mudar', 'alternar', 'switch'],
  ['branch', 'ramo'],
  ['arquivo', 'file'],
];

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) SYNONYMS.set(word, group.filter((w) => w !== word));
}

const FIELD_WEIGHTS = [
  ['title', 10],
  ['keywords', 6],
  ['commands', 5],
  ['category', 3],
  ['text', 2],
];

export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function tokenize(query) {
  const all = normalize(query).split(/\s+/).filter(Boolean);
  const useful = all.filter((token) => !STOP_WORDS.has(token));
  return useful.length ? useful : all;
}

// Formas alternativas de um termo: sinônimos e singular simples ("conflitos" → "conflito").
function variants(token) {
  const result = [{ text: token, factor: 1 }];
  const singular = token.endsWith('oes') || token.endsWith('aes')
    ? `${token.slice(0, -3)}ao`
    : token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : null;
  if (singular) result.push({ text: singular, factor: 0.9 });
  for (const base of [token, singular]) {
    for (const synonym of SYNONYMS.get(base) || []) result.push({ text: synonym, factor: 0.8 });
  }
  return result;
}

export function buildIndex(entries, categories) {
  const labels = new Map(categories.map((c) => [c.id, c.label]));
  return entries.map((entry, order) => ({
    entry,
    order,
    fields: {
      title: normalize(entry.title),
      keywords: normalize((entry.keywords || []).join(' | ')),
      commands: normalize([...entry.commands, entry.legacy || ''].join('\n')),
      category: normalize(labels.get(entry.category) || ''),
      text: normalize(`${entry.explanation}\n${entry.warning || ''}`),
    },
  }));
}

function isWordStart(text, pos) {
  return pos === 0 || !/[a-z0-9]/.test(text[pos - 1]);
}

function scoreToken(fields, token) {
  let best = 0;
  for (const { text, factor } of variants(token)) {
    for (const [field, weight] of FIELD_WEIGHTS) {
      const pos = fields[field].indexOf(text);
      if (pos === -1) continue;
      const score = (weight + (isWordStart(fields[field], pos) ? weight / 2 : 0)) * factor;
      if (score > best) best = score;
    }
  }
  return best;
}

// Termos que aparecem juntos, na mesma ordem, valem mais ("git add", "voltar arquivo").
function phraseBonus(fields, phrase) {
  let best = 0;
  for (const [field, weight] of FIELD_WEIGHTS) {
    if (fields[field].includes(phrase)) best = Math.max(best, weight * 1.5);
  }
  return best;
}

/**
 * Busca dicas no índice. Todos os termos precisam aparecer (em qualquer campo).
 * Sem termos, devolve tudo na ordem original. `category` filtra por categoria.
 */
export function search(index, query, { category = null } = {}) {
  const tokens = tokenize(query);
  const found = [];
  for (const item of index) {
    if (category && item.entry.category !== category) continue;
    let score = 0;
    let matches = true;
    for (const token of tokens) {
      const tokenScore = scoreToken(item.fields, token);
      if (!tokenScore) {
        matches = false;
        break;
      }
      score += tokenScore;
    }
    if (!matches) continue;
    if (tokens.length > 1) score += phraseBonus(item.fields, tokens.join(' '));
    found.push({ entry: item.entry, score, order: item.order });
  }
  if (tokens.length) found.sort((a, b) => b.score - a.score || a.order - b.order);
  return found.map((item) => item.entry);
}

export function countByCategory(entries) {
  const counts = {};
  for (const entry of entries) counts[entry.category] = (counts[entry.category] || 0) + 1;
  return counts;
}

// Fecha a frase com ponto, sem duplicar pontuação (ex.: "Socorro!").
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

export function statusMessage(count, { query = '', categoryLabel = '' } = {}) {
  const q = query.trim();
  const where = categoryLabel ? ` em ${categoryLabel}` : '';
  if (!q) {
    if (!categoryLabel) return `Mostrando todas as ${count} dicas.`;
    return sentence(`${count} ${count === 1 ? 'dica' : 'dicas'}${where}`);
  }
  if (count === 0) {
    return `${sentence(`Nenhuma dica encontrada para “${q}”${where}`)} Tente outras palavras, como “desfazer” ou “branch”.`;
  }
  return sentence(`${count} ${count === 1 ? 'resultado' : 'resultados'} para “${q}”${where}`);
}
