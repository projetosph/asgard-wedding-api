# Template 04 — Asgard Wedding

Template original inspirado em padrões comuns de sites premium de casamento: hero fotográfico, Save the Date, navegação editorial, lista de presentes, RSVP, local, recados, galeria, música e checkout.

## Instalação
Copie a pasta para:
frontend/templates/template-04/

## Dispatcher
No frontend/casamento.html, reconheça `template-04` e direcione para:
templates/template-04/template-04.html?casamento=SLUG

## Ativar no banco
```sql
UPDATE casamentos
SET template = 'template-04'
WHERE slug = 'joao-e-maria';
```

## APIs reaproveitadas
- /api/casamentos/:slug
- /api/casamentos/:slug/presentes
- /api/casamentos/:slug/presencas
- /api/casamentos/:slug/recados
- /api/casamentos/:slug/galeria
- /api/casamentos/:slug/musica

## Checkout
Reaproveita ../../utils.js, ../../casamento-context.js e ../../checkout.js.
O CSS já possui estado visual `.opcao.selecionado`.
