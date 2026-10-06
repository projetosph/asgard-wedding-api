# Asgard Wedding — Template 02

Template 02 completo, baseado na estética aprovada: fundo fotográfico de casamento, cartões marfim translúcidos, tipografia editorial, verde sálvia e rodapé discreto.

## Estrutura
Coloque TODOS estes arquivos juntos em:

frontend/templates/template-02/

Arquivos principais:
- template-02.html
- template-02.css
- template-02-common.js
- template-02-home.js
- template-02-presentes.html / .js
- template-02-presenca.html / .js
- template-02-local.html / .js
- template-02-recados.html / .js
- template-02-galeria.html / .js
- template-02-musica.html / .js
- template-02-checkout.html
- template-02-pagamento.html

## Integração com o projeto existente
O template usa as APIs já existentes:
- GET /api/casamentos/:slug
- GET /api/casamentos/:slug/presentes
- POST /api/casamentos/:slug/presencas
- GET/POST /api/casamentos/:slug/recados
- GET /api/casamentos/:slug/galeria
- GET /api/casamentos/:slug/musica

O checkout reaproveita:
- ../../utils.js
- ../../casamento-context.js
- ../../checkout.js

Assim, o motor de Mercado Pago atual não é duplicado.

## Como ativar em um casamento
No PostgreSQL/DBeaver:

UPDATE casamentos
SET template = 'template-02'
WHERE slug = 'joao-e-maria';

Depois acesse normalmente:
https://projetosph.github.io/asgard-wedding-api/casamento.html?casamento=joao-e-maria

O dispatcher deve encaminhar para:
templates/template-02/template-02.html?casamento=joao-e-maria

## Foto de fundo
A prioridade é:
1. casamento.foto_capa
2. casamento.foto_home
3. casamento.foto_principal
4. imagem padrão

Portanto, quando o painel/ADM tiver foto de capa cadastrada, o Template 02 usa essa imagem automaticamente.

## Redes sociais no rodapé
Configuradas em template-02-common.js:
- WhatsApp: +55 75 99920-7455
- Instagram: @asgardtec
- Facebook: link configurado no projeto

## Observação sobre checkout
O HTML do checkout foi preparado para usar exatamente o motor compartilhado já existente no frontend.
Se seu checkout.js atual tiver caminhos de redirecionamento hardcoded para páginas do Template 01, ajuste-os para preservar a página do Template 02 ou envie o checkout.js atual para adaptação exata.
