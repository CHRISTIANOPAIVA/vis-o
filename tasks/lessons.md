
## Mudar o formato de erro de uma API exige revisar todos os consumidores
- Contexto: trocar respostas de erro em texto por JSON `{ error }` fez `r.json()`
  passar a funcionar no erro. Um `.then(setData)` sem checar `r.ok` pôs um objeto
  onde se esperava array, e o `.map` derrubou a página.
- Regra: ao mudar status ou corpo de uma rota, rodar `grep` em todos os `fetch` dela
  e garantir `if (!r.ok)` antes do `json()`. Testar a UI com o backend falhando, não
  só a API.

## O hook de comando destrutivo casa texto, não só comando
- Contexto: o hook PreToolUse bloqueia qualquer comando Bash cujo texto contenha
  `rm -rf`, inclusive dentro de heredoc de documentação.
- Regra: não planejar remoção de diretórios como subtarefa do pipeline; deixar como
  ação manual do dono. Ao escrever docs via shell, não citar o comando literal (usar Edit).
