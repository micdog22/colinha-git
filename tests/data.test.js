import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, ENTRIES } from '../src/data.js';

const categoryIds = new Set(CATEGORIES.map((c) => c.id));

test('categorias têm id e rótulo únicos', () => {
  assert.equal(categoryIds.size, CATEGORIES.length);
  assert.equal(new Set(CATEGORIES.map((c) => c.label)).size, CATEGORIES.length);
  for (const category of CATEGORIES) {
    assert.ok(category.label.trim(), `categoria sem rótulo: ${category.id}`);
    assert.ok(category.icon, `categoria sem ícone: ${category.id}`);
  }
});

test('há as categorias esperadas, incluindo Socorro!', () => {
  for (const id of ['primeiros-passos', 'dia-a-dia', 'branches', 'remotos', 'desfazendo', 'historico', 'stash', 'tags', 'conflitos', 'gitignore', 'socorro']) {
    assert.ok(categoryIds.has(id), `falta a categoria ${id}`);
  }
});

test('quantidade de dicas fica entre 90 e 120 e toda categoria tem conteúdo', () => {
  assert.ok(ENTRIES.length >= 90 && ENTRIES.length <= 120, `total: ${ENTRIES.length}`);
  for (const category of CATEGORIES) {
    const count = ENTRIES.filter((e) => e.category === category.id).length;
    assert.ok(count >= 5, `${category.id} tem só ${count} dicas`);
  }
});

test('ids são únicos e no formato de slug', () => {
  const ids = ENTRIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'há ids repetidos');
  for (const id of ids) assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('títulos são únicos', () => {
  const titles = ENTRIES.map((e) => e.title.toLowerCase());
  assert.equal(new Set(titles).size, titles.length);
});

test('toda dica tem título, comandos, explicação e categoria conhecida', () => {
  for (const entry of ENTRIES) {
    assert.ok(typeof entry.title === 'string' && entry.title.trim(), `${entry.id}: sem título`);
    assert.ok(Array.isArray(entry.commands) && entry.commands.length > 0, `${entry.id}: sem comandos`);
    for (const command of entry.commands) {
      assert.ok(typeof command === 'string' && command.trim(), `${entry.id}: comando vazio`);
      assert.equal(command, command.trim(), `${entry.id}: espaços sobrando em "${command}"`);
      assert.doesNotMatch(command, / {2}/, `${entry.id}: espaço duplo em "${command}"`);
    }
    assert.ok(typeof entry.explanation === 'string' && entry.explanation.length > 20, `${entry.id}: explicação curta`);
    assert.ok(categoryIds.has(entry.category), `${entry.id}: categoria desconhecida ${entry.category}`);
  }
});

test('textos terminam com pontuação e têm crases balanceadas', () => {
  for (const entry of ENTRIES) {
    for (const field of ['explanation', 'warning']) {
      const text = entry[field];
      if (text === undefined) continue;
      assert.match(text, /[.!?)]$/, `${entry.id}.${field} não termina com pontuação`);
      assert.equal((text.match(/`/g) || []).length % 2, 0, `${entry.id}.${field} tem crase sem par`);
      assert.doesNotMatch(text, / {2}/, `${entry.id}.${field} tem espaço duplo`);
    }
  }
});

test('comandos de terminal começam com git (ou com uma ferramenta conhecida)', () => {
  for (const entry of ENTRIES) {
    if (entry.file) continue;
    for (const command of entry.commands) {
      assert.match(command, /^(git|ssh-keygen|ssh|echo|touch) /, `${entry.id}: "${command}"`);
    }
  }
});

test('comandos destrutivos sempre vêm com aviso', () => {
  const destructive = /reset --hard|push\b.*--force(?!-with-lease)|push\b.* -f\b|clean -\w*f|branch -D|stash (clear|drop)|filter-repo/;
  for (const entry of ENTRIES) {
    if (entry.commands.some((c) => destructive.test(c))) {
      assert.ok(entry.warning && entry.warning.length > 10, `${entry.id} precisa de aviso`);
    }
  }
});

test('push forçado sem lease só aparece na limpeza de segredo', () => {
  const forced = ENTRIES.filter((e) => e.commands.some((c) => /push\b.*--force(?!-with-lease)/.test(c)));
  assert.deepEqual(forced.map((e) => e.id), ['socorro-segredo-enviado']);
});

test('comandos modernos: git checkout só aparece como equivalente antigo', () => {
  for (const entry of ENTRIES) {
    for (const command of entry.commands) assert.doesNotMatch(command, /git checkout/, `${entry.id}: use switch/restore`);
    if (entry.legacy) assert.match(entry.legacy, /^git (checkout|reset) /);
  }
});

test('dicas obrigatórias do Socorro! estão presentes', () => {
  const socorro = ENTRIES.filter((e) => e.category === 'socorro');
  const has = (pattern) => socorro.some((e) => pattern.test(e.title));
  assert.ok(has(/branch errada|era para ser numa branch/i));
  assert.ok(has(/desfazer o último commit sem perder/i));
  assert.ok(has(/apaguei uma branch/i));
  assert.ok(has(/senha ou um token/i));
  assert.ok(has(/detached HEAD/));
  assert.ok(has(/pull deu conflito/i));
  assert.ok(has(/push foi rejeitado/i));
});

test('segredo enviado: revogar primeiro, filter-repo e push combinado com o time', () => {
  const entry = ENTRIES.find((e) => e.id === 'socorro-segredo-enviado');
  assert.match(entry.explanation, /^Primeiro, e mais importante: revogue/);
  assert.ok(entry.commands.some((c) => c.startsWith('git filter-repo ')));
  assert.match(entry.warning, /combine com o time/);
});

test('reset tem as três variantes na seção Desfazendo coisas', () => {
  const commands = ENTRIES.filter((e) => e.category === 'desfazendo').flatMap((e) => e.commands);
  for (const flag of ['--soft', '--mixed', '--hard']) {
    assert.ok(commands.some((c) => c.startsWith('git reset ') && c.includes(flag)), `falta reset ${flag}`);
  }
});

test('nenhum dado pessoal: só e-mails de exemplo', () => {
  const all = JSON.stringify(ENTRIES);
  const emails = all.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [];
  for (const email of emails) assert.match(email, /@example\.com$|^git@github\.com/);
});
