-- Limpa os dados existentes mantendo a estrutura (opcional, para testes limpos)
TRUNCATE TABLE notificacoes, emprestimos, chaves, pessoas_autorizadas, usuarios, setores RESTART IDENTITY CASCADE;

-- 1. INSERIR SETORES
INSERT INTO setores (nome, descricao) VALUES
('TI / Infraestrutura', 'Setor responsável pelos servidores e suporte técnico'),
('Administração', 'Diretoria, RH e setores administrativos'),
('Manutenção', 'Equipe de manutenção predial e limpeza');

-- 2. INSERIR USUÁRIOS / OPERADORES
-- Senha para ambos: 123456
INSERT INTO usuarios (nome, email, senha_hash, permissao) VALUES
('João Silva', 'admin@empresa.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', 'admin'),
('Maria Santos', 'operador@empresa.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeg6Lruj3vjPGga31lW', 'operador');

-- 3. INSERIR PESSOAS AUTORIZADAS
INSERT INTO pessoas_autorizadas (nome, documento, telefone, email, setor_id) VALUES
('Carlos Andrade', '11122233344', '(62) 99999-1111', 'carlos@empresa.com', 1), -- Autorizado no setor TI
('Ana Lima', '55566677788', '(62) 99999-2222', 'ana@empresa.com', 2),       -- Autorizada na Adm
('Roberto Souza', '99988877766', '(62) 99999-3333', 'roberto@empresa.com', 3); -- Autorizado na Manutenção

-- 4. INSERIR CHAVES
INSERT INTO chaves (numero_identificador, nome_chave, setor_id, status) VALUES
('CH-101', 'Data Center', 1, 'guardada'),
('CH-102', 'Suporte Técnico', 1, 'guardada'),
('CH-201', 'Arquivo Central', 2, 'guardada'),
('CH-301', 'Almoxarifado Central', 3, 'guardada');