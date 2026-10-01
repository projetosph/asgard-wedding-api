# Asgard Wedding — Fase 1

Esta pasta é a primeira fundação multi-casal baseada no site Paulo & Alana.

## O que esta fase faz

- Cria a tabela `casamentos`.
- Registra `paulo-e-alana` como o primeiro casamento / Template 01.
- Cria tabelas separadas por `casamento_id` para presentes, presenças, recados e pagamentos.
- Expõe uma API por `slug`.
- Faz o frontend descobrir qual casamento deve carregar.
- Mantém o site atual protegido: esta estrutura nasce paralela às tabelas antigas.

## Teste conceitual

Depois de publicar o backend e executar o SQL:

GET /api/casamentos/paulo-e-alana

deve retornar os dados de Paulo & Alana.

O frontend também aceita temporariamente:

index-template-01.html?casamento=paulo-e-alana

Mais adiante configuraremos a hospedagem para a URL bonita:

/paulo-e-alana

## Ordem de implantação

1. Faça backup do PostgreSQL atual.
2. Execute `backend/sql/001_asgard_wedding.sql`.
3. No backend, instale as dependências com `npm install`.
4. Garanta que `DATABASE_URL` esteja configurada no Render.
5. Teste a API localmente ou em um serviço de homologação.
6. Só depois conecte o frontend.
7. Na Fase 2 migraremos os presentes, presenças e pagamentos reais de Paulo & Alana.

## Atenção sobre Mercado Pago

Esta fase NÃO substitui ainda o backend de pagamento em produção.
Ela prepara a coluna lógica de `casamento_id`. Na próxima fase, PIX/cartão/webhook serão migrados para `casamento_pagamentos` e vinculados ao casamento correto.

## Estrutura de URL planejada

asgardwedding.com.br/paulo-e-alana
asgardwedding.com.br/joao-e-maria
asgardwedding.com.br/lucas-e-bia

Todos usam o mesmo Template 01 por padrão e o mesmo backend.