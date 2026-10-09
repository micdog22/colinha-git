# Colinha de Git: guia prático de Git em português (HTML + JavaScript)

Uma colinha de Git organizada por **situação**, não por comando: “desfazer o último commit sem perder as alterações”, “apaguei uma branch sem querer”, “o push foi rejeitado”. Você busca o que quer fazer, copia o comando e segue em frente.

Feita para quem está começando e também para quem usa Git todo dia, mas não lembra de cabeça a diferença entre `reset --soft` e `reset --hard`.

**Acesse online:** https://micdog22.github.io/colinha-git/

## Recursos
- 118 dicas em 11 categorias: Primeiros passos, Dia a dia, Branches, Remotos e GitHub, Desfazendo coisas, Histórico e investigação, Stash, Tags e releases, Conflitos, .gitignore e Socorro!
- Busca instantânea que ignora acentos e maiúsculas, procura em títulos, comandos e explicações e entende sinônimos comuns (“deletar” encontra “apagar”, “senha” encontra “token”).
- Filtro por categoria, botão de copiar em cada comando e link direto para cada dica.
- Comandos modernos (`git switch`, `git restore`), com o equivalente antigo (`git checkout`) indicado quando existe.
- Avisos claros nos comandos destrutivos (`reset --hard`, `clean -fd`, `branch -D` e push forçado, de preferência com `--force-with-lease`).
- Tema claro e escuro (automático ou escolhido no botão) e versão para impressão em duas colunas.
- Sem dependências e sem rastreadores: tudo roda no navegador.

## Como usar
- Digite na busca o que você quer fazer: `desfazer commit`, `conflito`, `senha`, `rebase`, `reset --hard`.
- Use os botões de categoria para navegar por assunto.
- Clique em **Copiar** ao lado do comando. Trechos como `<arquivo>`, `<branch>` e `<hash>` devem ser trocados pelos seus valores.
- Compartilhe uma busca pelo endereço, por exemplo `https://micdog22.github.io/colinha-git/?q=reflog`, ou uma dica específica pelo link no título dela.
- Atalhos: `/` vai para a busca e `Esc` limpa o que foi digitado.
- Para ter a colinha no papel, use o botão **Imprimir** (imprime o que estiver filtrado na tela).

## Como rodar localmente
```bash
python3 -m http.server 8000
```
Na pasta do projeto, rode o comando acima e abra http://localhost:8000 (os módulos ES não carregam via `file://`).

## Testes
```bash
npm test
```
(ou `node --test`). Os testes conferem a integridade dos dados (ids únicos, campos obrigatórios, categorias conhecidas, avisos nos comandos destrutivos) e o comportamento da busca.

## Como funciona
- `src/data.js` tem as categorias e as dicas. Cada dica tem título, comandos, explicação e, quando faz sentido, aviso, comando antigo equivalente e palavras-chave extras.
- `src/search.js` normaliza o texto (remove acentos com `NFD`), ignora palavras como “como” e “o”, expande sinônimos e dá mais peso a quem casa no título do que na explicação. Todos os termos digitados precisam aparecer na dica.
- `src/app.js` monta a página com APIs do DOM (sem `innerHTML`) e guarda só a sua preferência de tema no `localStorage`.

## Contribuindo
Issues e pull requests são bem-vindos. Achou um comando impreciso ou sentiu falta de alguma situação? Abra uma issue contando o caso.

## Licença
MIT. Veja [LICENSE](LICENSE).
