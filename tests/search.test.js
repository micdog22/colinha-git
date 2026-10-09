import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, ENTRIES } from '../src/data.js';
import { buildIndex, countByCategory, normalize, search, statusMessage, tokenize } from '../src/search.js';

const index = buildIndex(ENTRIES, CATEGORIES);
const ids = (results) => results.map((e) => e.id);

test('normalize remove acentos e cedilha e deixa minúsculo', () => {
  assert.equal(normalize('Histórico e Investigação'), 'historico e investigacao');
  assert.equal(normalize('AÇÃO, Pôr, Têm, Último'), 'acao, por, tem, ultimo');
  assert.equal(normalize(null), '');
});

test('tokenize ignora palavras vazias, mas não fica sem termos', () => {
  assert.deepEqual(tokenize('como desfazer o último commit'), ['desfazer', 'ultimo', 'commit']);
  assert.deepEqual(tokenize('  de  '), ['de']);
  assert.deepEqual(tokenize(''), []);
});

test('busca vazia devolve tudo na ordem original', () => {
  assert.deepEqual(ids(search(index, '')), ids(ENTRIES));
  assert.deepEqual(ids(search(index, '   ')), ids(ENTRIES));
});

test('busca ignora acentos e maiúsculas', () => {
  const a = ids(search(index, 'histórico'));
  const b = ids(search(index, 'HISTORICO'));
  const c = ids(search(index, 'Historico'));
  assert.ok(a.length > 0);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test('busca encontra pelo nome da categoria', () => {
  const results = search(index, 'investigação');
  const historico = ENTRIES.filter((e) => e.category === 'historico').map((e) => e.id);
  for (const id of historico) assert.ok(ids(results).includes(id), `${id} deveria aparecer`);
});

test('busca encontra por trechos de comandos', () => {
  assert.equal(search(index, '--force-with-lease')[0].id, 'push-force-with-lease');
  assert.ok(ids(search(index, 'reset --hard')).includes('reset-hard'));
  assert.ok(ids(search(index, 'HEAD~1')).includes('reset-soft'));
  assert.ok(ids(search(index, 'stash@{0}')).includes('stash-listar'));
  assert.ok(ids(search(index, 'filter-repo')).includes('socorro-segredo-enviado'));
});

test('busca encontra pelo texto da explicação', () => {
  assert.ok(ids(search(index, 'fast-forward')).includes('merge'));
  assert.ok(ids(search(index, 'robôs varrem')).includes('socorro-segredo-enviado'));
});

test('comando antigo também é encontrado', () => {
  const results = ids(search(index, 'checkout -b'));
  assert.ok(results.includes('criar-branch'));
});

test('todos os termos precisam aparecer', () => {
  const results = ids(search(index, 'stash branch'));
  assert.ok(results.includes('stash-branch'));
  assert.ok(!results.includes('listar-branches'));
});

test('título pesa mais que explicação na ordenação', () => {
  assert.equal(search(index, 'reflog')[0].id, 'reflog');
  assert.equal(search(index, 'bisect')[0].id, 'bisect');
});

test('termos juntos na mesma ordem sobem no ranking', () => {
  assert.equal(search(index, 'git add')[0].id, 'adicionar-arquivos');
  assert.equal(search(index, 'voltar arquivo')[0].id, 'descartar-alteracoes');
});

test('perguntas em linguagem natural funcionam', () => {
  const results = ids(search(index, 'como desfazer o último commit sem perder as alterações'));
  assert.ok(results.length > 0);
  assert.ok(results.slice(0, 3).includes('socorro-desfazer-commit'));
});

test('sinônimos e plural simples ampliam a busca', () => {
  assert.ok(ids(search(index, 'deletar branch')).includes('apagar-branch'));
  assert.ok(ids(search(index, 'vazou senha')).includes('socorro-segredo-enviado'));
  assert.ok(ids(search(index, 'token')).includes('socorro-segredo-enviado'));
  assert.ok(ids(search(index, 'conflitos rebase')).includes('conflito-rebase'));
  assert.ok(ids(search(index, 'commits')).includes('commit'));
});

test('filtro por categoria combina com a busca', () => {
  const all = search(index, '', { category: 'stash' });
  assert.ok(all.length >= 5);
  assert.ok(all.every((e) => e.category === 'stash'));
  const filtered = search(index, 'apagar', { category: 'stash' });
  assert.equal(filtered[0].id, 'stash-apagar');
  assert.ok(filtered.every((e) => e.category === 'stash'));
});

test('sem resultados devolve lista vazia', () => {
  assert.deepEqual(search(index, 'xyzwvut'), []);
});

test('caracteres especiais não quebram a busca', () => {
  for (const query of ['[', '(', '*', '+', '?', '\\', 'c++', '$REMOTE', '.*']) {
    assert.doesNotThrow(() => search(index, query), query);
  }
  assert.ok(ids(search(index, '$REMOTE')).includes('conflito-mergetool'));
});

test('countByCategory soma corretamente', () => {
  const counts = countByCategory(ENTRIES);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(total, ENTRIES.length);
  assert.equal(counts.socorro, ENTRIES.filter((e) => e.category === 'socorro').length);
});

test('mensagens de status no singular e no plural', () => {
  assert.equal(statusMessage(118), 'Mostrando todas as 118 dicas.');
  assert.equal(statusMessage(1, { categoryLabel: 'Stash' }), '1 dica em Stash.');
  assert.equal(statusMessage(7, { categoryLabel: 'Stash' }), '7 dicas em Stash.');
  assert.equal(statusMessage(1, { query: 'reflog' }), '1 resultado para “reflog”.');
  assert.equal(statusMessage(3, { query: ' reset ', categoryLabel: 'Socorro!' }), '3 resultados para “reset” em Socorro!');
  assert.match(statusMessage(0, { query: 'xyz' }), /^Nenhuma dica encontrada para “xyz”\. Tente/);
  assert.match(statusMessage(0, { query: 'xyz', categoryLabel: 'Socorro!' }), /em Socorro! Tente/);
});
