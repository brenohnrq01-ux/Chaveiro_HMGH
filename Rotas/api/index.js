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

app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }

    const usuario = result.rows[0];
    
    // Comparação direta de texto puro (sem bcrypt)
    if (usuario.senha_hash !== senha) {
      return res.status(401).json({ erro: 'Senha incorreta' });
    }

    return res.json({ 
      sucesso: true, 
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

// Rota do Dashboard (Painel Principal)
app.get('/dashboard', async (req, res) => {
  try {
    // Exemplo de consultas básicas ao banco para preencher os cards
    const setoresCount = await pool.query('SELECT COUNT(*) FROM setores');
    const chavesDisponiveis = await pool.query("SELECT COUNT(*) FROM chaves WHERE status = 'disponivel'");
    const chavesEmprestadas = await pool.query("SELECT COUNT(*) FROM chaves WHERE status = 'emprestada'");

    return res.json({
      totalSetores: parseInt(setoresCount.rows[0].count),
      chavesDisponiveis: parseInt(chavesDisponiveis.rows[0].count),
      chavesEmprestadas: parseInt(chavesEmprestadas.rows[0].count)
    });
  } catch (err) {
    console.error("Erro ao carregar dashboard:", err);
    return res.status(500).json({ erro: 'Erro interno ao carregar dados do painel' });
  }
});

// Rota de Chaves Atrasadas
app.get('/atrasados', async (req, res) => {
  try {
    // Ajuste a query de acordo com as colunas da sua tabela de empréstimos/chaves
    const result = await pool.query("SELECT * FROM emprestimos WHERE status = 'atrasado'");
    return res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar atrasados:", err);
    return res.status(500).json({ erro: 'Erro interno ao buscar chaves atrasadas' });
  }
});

// Listener local para testes em desenvolvimento (ignorado pela Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log('Servidor rodando localmente na porta 3000');
  });
}

// OBRIGATÓRIO PARA A VERCEL
module.exports = app;
