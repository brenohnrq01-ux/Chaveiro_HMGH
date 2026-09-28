const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// Middlewares essenciais
app.use(cors());
app.use(express.json());

// Configuração do Banco de Dados com Supabase (Pooler + SSL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Middleware simples para verificação de token nas rotas protegidas
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
  }

  // Em produção real, utilize a biblioteca 'jsonwebtoken' (jwt.verify)
  if (!token.startsWith('token_jwt_simulado_')) {
    return res.status(403).json({ erro: 'Token inválido ou expirado.' });
  }

  next();
};

// Rota de Login (Pública)
app.post(['/api/login', '/login'], async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    }

    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }

    const usuario = result.rows[0];

    // Validação da senha
    if (usuario.senha_hash !== senha && usuario.senha !== senha) {
      return res.status(401).json({ erro: 'Senha incorreta' });
    }

    return res.json({
      sucesso: true,
      token: 'token_jwt_simulado_' + Date.now(),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });

  } catch (err) {
    console.error("Erro interno no login:", err);
    return res.status(500).json({
      erro: 'Erro interno no servidor',
      detalhes: err.message
    });
  }
});

// Rota do Dashboard (Protegida)
app.get(['/api/dashboard', '/dashboard'], autenticarToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        s.nome AS setor_nome,
        c.id AS chave_id,
        c.numero_identificador,
        c.nome_chave AS nome_chave,
        c.status AS chave_status,
        p.nome AS pessoa_com_chave,
        e.id AS emprestimo_id
      FROM setores s
      LEFT JOIN chaves c ON c.setor_id = s.id
      LEFT JOIN emprestimos e ON e.chave_id = c.id AND e.data_devolucao IS NULL
      LEFT JOIN pessoas_autorizadas p ON p.id = e.pessoa_autorizada_id
      ORDER BY s.nome, c.numero_identificador
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error("Erro ao carregar dashboard:", err);
    return res.status(500).json({ erro: 'Erro interno ao carregar dados do painel: ' + err.message });
  }
});

// Rota de Chaves Atrasadas (Protegida)
app.get(['/api/emprestimos/atrasados', '/emprestimos/atrasados'], autenticarToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        c.numero_identificador,
        c.nome_chave AS nome_chave,
        p.nome AS pessoa_nome,
        p.setor AS pessoa_setor
      FROM emprestimos e
      JOIN chaves c ON c.id = e.chave_id
      JOIN pessoas_autorizadas p ON p.id = e.pessoa_autorizada_id
      WHERE e.data_devolucao IS NULL AND e.data_previsao_devolucao < NOW()
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar atrasados:", err);
    return res.status(500).json({ erro: 'Erro interno ao buscar chaves atrasadas: ' + err.message });
  }
});

// Rota para Registrar Empréstimo (Protegida + Transação SQL)
app.post(['/api/emprestimos', '/emprestimos'], autenticarToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { chave_id, pessoa_autorizada_id, data_previsao_devolucao, usuario_operador_id } = req.body;
    const operadorId = Number(usuario_operador_id) || 1;

    if (!chave_id || !pessoa_autorizada_id || !data_previsao_devolucao) {
      return res.status(400).json({ erro: 'Dados incompletos para empréstimo.' });
    }

    await client.query('BEGIN');

    // Verificar se a chave já está emprestada
    const checkKey = await client.query('SELECT status FROM chaves WHERE id = $1', [chave_id]);
    if (checkKey.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Chave não encontrada.' });
    }

    if (checkKey.rows[0].status === 'emprestada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Esta chave já se encontra emprestada.' });
    }

    // Registar o empréstimo
    await client.query(
      `INSERT INTO emprestimos (chave_id, pessoa_autorizada_id, usuario_operador_id, data_previsao_devolucao, data_emprestimo) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [chave_id, pessoa_autorizada_id, operadorId, data_previsao_devolucao]
    );

    // Atualizar estado da chave
    await client.query(
      `UPDATE chaves SET status = 'emprestada' WHERE id = $1`,
      [chave_id]
    );

    await client.query('COMMIT');
    return res.json({ sucesso: true, mensagem: 'Empréstimo registrado com sucesso.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro ao registrar empréstimo:", err);
    return res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

// Rota para Registrar Devolução (Protegida + Transação SQL)
app.post(['/api/emprestimos/:id/devolucao', '/emprestimos/:id/devolucao'], autenticarToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const emprestimoId = req.params.id;

    await client.query('BEGIN');

    const empResult = await client.query('SELECT chave_id FROM emprestimos WHERE id = $1 AND data_devolucao IS NULL', [emprestimoId]);
    if (empResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Empréstimo ativo não encontrado ou já devolvido.' });
    }
    
    const chaveId = empResult.rows[0].chave_id;

    // Atualizar data de devolução e estado da chave
    await client.query('UPDATE emprestimos SET data_devolucao = NOW() WHERE id = $1', [emprestimoId]);
    await client.query("UPDATE chaves SET status = 'guardada' WHERE id = $1", [chaveId]);

    await client.query('COMMIT');
    return res.json({ sucesso: true, mensagem: 'Devolução registrada com sucesso.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erro ao registrar devolução:", err);
    return res.status(500).json({ erro: err.message });
  } finally {
    client.release();
  }
});

// Rota para Relatório Mensal de Empréstimos (Protegida)
app.get(['/api/relatorios/mensal', '/relatorios/mensal'], autenticarToken, async (req, res) => {
  try {
    const { mes, ano } = req.query;
    
    const agora = new Date();
    const anoFiltro = ano || agora.getFullYear();
    const mesFiltro = mes ? String(mes).padStart(2, '0') : String(agora.getMonth() + 1).padStart(2, '0');

    const dataReferencia = `${anoFiltro}-${mesFiltro}-01`;

    const query = `
      SELECT 
        e.id AS emprestimo_id,
        c.numero_identificador,
        c.nome_chave,
        p.nome AS pessoa_nome,
        p.setor AS pessoa_setor,
        TO_CHAR(e.data_emprestimo, 'DD/MM/YYYY') AS dia_emprestimo,
        TO_CHAR(e.data_emprestimo, 'HH24:MI') AS hora_emprestimo,
        TO_CHAR(e.data_devolucao, 'DD/MM/YYYY HH24:MI') AS data_devolucao,
        u.nome AS operador_nome
      FROM emprestimos e
      JOIN chaves c ON c.id = e.chave_id
      JOIN pessoas_autorizadas p ON p.id = e.pessoa_autorizada_id
      LEFT JOIN usuarios u ON u.id = e.usuario_operador_id
      WHERE date_trunc('month', e.data_emprestimo) = date_trunc('month', $1::date)
      ORDER BY e.data_emprestimo DESC
    `;

    const result = await pool.query(query, [dataReferencia]);
    return res.json({
      mes: mesFiltro,
      ano: anoFiltro,
      total_registros: result.rowCount,
      dados: result.rows
    });

  } catch (err) {
    console.error("Erro ao gerar relatório mensal:", err);
    return res.status(500).json({ erro: 'Erro ao gerar relatório mensal: ' + err.message });
  }
});

// Listener local para desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log('Servidor rodando localmente na porta 3000');
  });
}

module.exports = app;
