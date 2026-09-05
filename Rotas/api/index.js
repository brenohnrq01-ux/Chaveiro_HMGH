const express = require('express');
const { Pool } = require('pg');

const app = express();

// Middlewares essenciais
app.use(express.json());

// Configuração do Banco de Dados com Supabase (Pooler + SSL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Rota de Login (Texto Puro)
app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }

    const usuario = result.rows[0];
    
    if (usuario.senha !== senha) {
      return res.status(401).json({ erro: 'Senha incorreta' });
    }

    return res.json({ 
      sucesso: true,
      token: 'token_jwt_simulado_' + Date.now(),
      usuario: { nome: usuario.nome, email: usuario.email } 
    });

  } catch (err) {
    console.error("Erro interno no login:", err);
    return res.status(500).json({ 
      erro: 'Erro interno no servidor', 
      detalhes: err.message 
    });
  }
});

// Rota do Dashboard (Painel Principal corrigida)
app.get('/api/dashboard', async (req, res) => {
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
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error("Erro ao carregar dashboard:", err);
    return res.status(500).json({ erro: 'Erro interno ao carregar dados do painel: ' + err.message });
  }
});

// Rota de Chaves Atrasadas corrigida
app.get('/api/emprestimos/atrasados', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.numero_identificador,
        c.nome_chave AS nome_chave,
        p.nome AS pessoa_nome,
        p.telefone AS pessoa_telefone
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

// Rota de Chaves Atrasadas
app.get('/api/emprestimos/atrasados', async (req, res) => {
  try {
    const query = `
      SELECT 
        c.numero_identificador,
        c.nome AS nome_chave,
        p.nome AS pessoa_nome,
        p.telefone AS pessoa_telefone
      FROM emprestimos e
      JOIN chaves c ON c.id = e.chave_id
      JOIN pessoas_autorizadas p ON p.id = e.pessoa_autorizada_id
      WHERE e.data_devolucao IS NULL AND e.data_previsao_devolucao < NOW()
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar atrasados:", err);
    return res.status(500).json({ erro: 'Erro interno ao buscar chaves atrasadas' });
  }
});

// Rota para Registrar Empréstimo
app.post('/api/emprestimos', async (req, res) => {
  try {
    const { chave_id, pessoa_autorizada_id, data_previsao_devolucao } = req.body;

    await pool.query(
      `INSERT INTO emprestimos (chave_id, pessoa_autorizada_id, data_previsao_devolucao, data_emprestimo) 
       VALUES ($1, $2, $3, NOW())`,
      [chave_id, pessoa_autorizada_id, data_previsao_devolucao]
    );

    await pool.query(
      `UPDATE chaves SET status = 'emprestada' WHERE id = $1`,
      [chave_id]
    );

    return res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao registrar empréstimo:", err);
    return res.status(500).json({ erro: err.message });
  }
});

// Rota para Registrar Devolução
app.post('/api/emprestimos/:id/devolucao', async (req, res) => {
  try {
    const emprestimoId = req.params.id;

    const empResult = await pool.query('SELECT chave_id FROM emprestimos WHERE id = $1', [emprestimoId]);
    if (empResult.rows.length === 0) {
      return res.status(404).json({ erro: 'Empréstimo não encontrado' });
    }
    const chaveId = empResult.rows[0].chave_id;

    await pool.query('UPDATE emprestimos SET data_devolucao = NOW() WHERE id = $1', [emprestimoId]);
    await pool.query("UPDATE chaves SET status = 'guardada' WHERE id = $1", [chaveId]);

    return res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao registrar devolução:", err);
    return res.status(500).json({ erro: err.message });
  }
});

// Listener local para testes em desenvolvimento (ignorado pela Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log('Servidor rodando localmente na porta 3000');
  });
}

// OBRIGATÓRIO PARA A VERCEL (Deve ser sempre a última linha)
module.exports = app;
