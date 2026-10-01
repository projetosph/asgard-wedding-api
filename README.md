# Asgard Wedding — Fase 3

## Objetivo
PIX e cartão isolados por casamento.

## 1. Execute primeiro no DBeaver
backend/sql/002_pagamentos_multicasal.sql

## 2. Substitua no projeto
Backend:
- backend/server.js
- backend/db.js
- backend/package.json

Adicione:
- backend/services/mercadoPago.js
- backend/sql/002_pagamentos_multicasal.sql

Frontend:
- frontend/pagamento.html
- frontend/checkout.js

Mantenha todos os arquivos da Fase 2.

## 3. Variáveis na Render
- DATABASE_URL
- PUBLIC_URL = https://asgard-wedding-api.onrender.com
- MERCADO_PAGO_TOKEN
- MERCADO_PAGO_PUBLIC_KEY

Nunca coloque MERCADO_PAGO_TOKEN no frontend ou GitHub.

## Mudança estrutural importante
O PostgreSQL passa a ser a fonte de verdade do pagamento.
Quando um pagamento é aprovado, o backend incrementa `arrecadado`
no presente uma única vez usando `aplicado_em`.

## Modelo financeiro atual
Esta fase usa uma única conta Mercado Pago, a definida pelas variáveis da Render.
Antes de vender o serviço para casais diferentes, precisamos decidir se os valores
entrarão numa conta central da Asgard ou se cada casal terá sua própria integração.
