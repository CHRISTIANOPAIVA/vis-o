
## Mudar o formato de erro de uma API exige revisar todos os consumidores
- Contexto: trocar respostas de erro em texto por JSON `{ error }` fez `r.json()`
  passar a funcionar no erro. Um `.then(setData)` sem checar `r.ok` pôs um objeto
  onde se esperava array, e o `.map` derrubou a página.
- Regra: ao mudar status ou corpo de uma rota, rodar `grep` em todos os `fetch` dela
  e garantir `if (!r.ok)` antes do `json()`. Testar a UI com o backend falhando, não
  só a API.
