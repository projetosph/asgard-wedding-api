-- ASGARD WEDDING - FASE 1
-- Estrutura multi-casal paralela. Não apaga nem altera as tabelas antigas.

CREATE TABLE IF NOT EXISTS casamentos (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(120) UNIQUE NOT NULL,
    noivo VARCHAR(120) NOT NULL,
    noiva VARCHAR(120) NOT NULL,
    data_casamento DATE NOT NULL,
    horario TIME,
    local_nome VARCHAR(220),
    local_endereco TEXT,
    mapa_url TEXT,
    template VARCHAR(80) NOT NULL DEFAULT 'template-01',
    cor_primaria VARCHAR(20),
    cor_secundaria VARCHAR(20),
    foto_capa TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'rascunho',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS casamento_presentes (
    id BIGSERIAL PRIMARY KEY,
    casamento_id BIGINT NOT NULL REFERENCES casamentos(id) ON DELETE CASCADE,
    nome VARCHAR(220) NOT NULL,
    descricao TEXT,
    valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
    arrecadado NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (arrecadado >= 0),
    imagem TEXT,
    link TEXT,
    comprado BOOLEAN NOT NULL DEFAULT FALSE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casamento_presentes_casamento
ON casamento_presentes(casamento_id);

CREATE TABLE IF NOT EXISTS casamento_presencas (
    id BIGSERIAL PRIMARY KEY,
    casamento_id BIGINT NOT NULL REFERENCES casamentos(id) ON DELETE CASCADE,
    nome_titular VARCHAR(180) NOT NULL,
    nomes JSONB NOT NULL DEFAULT '[]'::jsonb,
    quantidade INTEGER NOT NULL CHECK (quantidade >= 1),
    mensagem TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casamento_presencas_casamento
ON casamento_presencas(casamento_id);

CREATE TABLE IF NOT EXISTS casamento_recados (
    id BIGSERIAL PRIMARY KEY,
    casamento_id BIGINT NOT NULL REFERENCES casamentos(id) ON DELETE CASCADE,
    nome VARCHAR(180) NOT NULL,
    mensagem TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casamento_recados_casamento
ON casamento_recados(casamento_id);

CREATE TABLE IF NOT EXISTS casamento_pagamentos (
    id BIGSERIAL PRIMARY KEY,
    casamento_id BIGINT NOT NULL REFERENCES casamentos(id) ON DELETE CASCADE,
    presente_id BIGINT REFERENCES casamento_presentes(id) ON DELETE SET NULL,
    pagamento_id VARCHAR(120) UNIQUE,
    nome VARCHAR(180),
    email VARCHAR(220),
    valor NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(80),
    status_detail VARCHAR(120),
    metodo_pagamento VARCHAR(60),
    external_reference VARCHAR(255),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casamento_pagamentos_casamento
ON casamento_pagamentos(casamento_id);

-- O site de Paulo & Alana vira oficialmente o Template 01 / Casamento #1.
INSERT INTO casamentos (
    slug, noivo, noiva, data_casamento, horario,
    local_nome, local_endereco, template, status
)
VALUES (
    'paulo-e-alana',
    'Paulo',
    'Alana',
    '2026-09-07',
    '15:30',
    'Fazenda Santo Antônio',
    'Campo de Anilson, Onha / Muniz Ferreira, S/N',
    'template-01',
    'publicado'
)
ON CONFLICT (slug) DO UPDATE SET
    noivo = EXCLUDED.noivo,
    noiva = EXCLUDED.noiva,
    data_casamento = EXCLUDED.data_casamento,
    horario = EXCLUDED.horario,
    local_nome = EXCLUDED.local_nome,
    local_endereco = EXCLUDED.local_endereco,
    template = EXCLUDED.template,
    status = EXCLUDED.status,
    atualizado_em = NOW();