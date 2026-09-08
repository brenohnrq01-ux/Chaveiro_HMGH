require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const pool = require('./config/database');

const app = express();

// Chave secreta para validação JWT
const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta';

// Middlewares Globais
app.use(cors());
app.use(express.json());

// ==========================================
// MIDDLEWARE DE AUTENTICAÇÃO (JWT)
// ==========================================
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, usuarioDecodificado) => {
    if (err) {
      return res.status(403).json({ erro: 'Token inválido ou expirado.' });
    }
    req.usuario = usuarioDecodificado;
    next();
  });
}

// ==========================================
// 1. ROTA DE LOGIN
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, permissao: usuario.permissao },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
});

// ==========================================
// 2. ROTA DO DASHBOARD (SETORES E CHAVES)
// ==========================================
app.get('/api/dashboard', autenticarToken, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        s.id AS setor_id,
        s.nome AS setor_nome,
        c.id AS chave_id,
        c.numero_identificador,
        c.nome_chave,
        c.status AS chave_status,
        e.id AS emprestimo_id,
        p.nome AS pessoa_com_chave
      FROM setores s
      LEFT JOIN chaves c ON s.id = c.setor_id
      LEFT JOIN emprestimos e ON c.id = e.chave_id AND e.data_devolucao IS NULL
      LEFT JOIN pessoas_autorizadas p ON e.pessoa_autorizada_id = p.id
      ORDER BY s.nome, c.numero_identificador;
    `;
    const result = await pool.query(queryText);
    return res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    return res.status(500).json({ erro: 'Erro ao carregar dados do painel.' });
  }
});

// ==========================================
// 3. ROTA DE REGISTRO DE EMPRÉSTIMO
// ==========================================
app.post('/api/emprestimos', autenticarToken, async (req, res) => {
  const { chave_id, pessoa_autorizada_id, data_previsao_devolucao } = req.body;
  const usuario_operador_id = req.usuario.id;

  if (!chave_id || !pessoa_autorizada_id || !data_previsao_devolucao) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const chaveResult = await client.query(
      'SELECT id, status FROM chaves WHERE id = $1 FOR UPDATE',
      [chave_id]
    );

    if (chaveResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Chave não encontrada.' });
    }

    if (chaveResult.rows[0].status !== 'guardada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Esta chave já está emprestada.' });
    }

    const novoEmprestimo = await client.query(
      `INSERT INTO emprestimos 
        (chave_id, pessoa_autorizada_id, usuario_operador_id, data_previsao_devolucao, status) 
       VALUES ($1, $2, $3, $4, 'ativo') 
       RETURNING *`,
      [chave_id, pessoa_autorizada_id, usuario_operador_id, data_previsao_devolucao]
    );

    await client.query("UPDATE chaves SET status = 'emprestada' WHERE id = $1", [chave_id]);
    await client.query('COMMIT');

    return res.status(201).json({
      mensagem: 'Empréstimo registrado com sucesso!',
      dados: novoEmprestimo.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro no empréstimo:', error);
    return res.status(500).json({ erro: 'Erro ao processar o empréstimo.' });
  } finally {
    client.release();
  }
});

// ==========================================
// 4. ROTA DE DEVOLUÇÃO DE CHAVE
// ==========================================
app.post('/api/emprestimos/:id/devolucao', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const emprestimoResult = await client.query(
      'SELECT * FROM emprestimos WHERE id = $1 AND data_devolucao IS NULL FOR UPDATE',
      [id]
    );

    if (emprestimoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Empréstimo ativo não encontrado ou já finalizado.' });
    }

    const emprestimo = emprestimoResult.rows[0];

    const devolucaoResult = await client.query(
      `UPDATE emprestimos 
       SET data_devolucao = CURRENT_TIMESTAMP, status = 'devolvido' 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    await client.query("UPDATE chaves SET status = 'guardada' WHERE id = $1", [emprestimo.chave_id]);
    await client.query('COMMIT');

    return res.json({
      mensagem: 'Chave devolvida com sucesso!',
      dados: devolucaoResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro na devolução:', error);
    return res.status(500).json({ erro: 'Erro ao processar devolução.' });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. ROTA DE CONSULTA DE ATRASOS
// ==========================================
app.get('/api/emprestimos/atrasados', autenticarToken, async (req, res) => {
  try {
    const queryText = `
      SELECT 
        e.id AS emprestimo_id,
        c.numero_identificador,
        c.nome_chave,
        p.nome AS pessoa_nome,
        p.setor AS pessoa_setor,
        e.data_emprestimo,
        e.data_previsao_devolucao
      FROM emprestimos e
      JOIN chaves c ON e.chave_id = c.id
      JOIN pessoas_autorizadas p ON e.pessoa_autorizada_id = p.id
      WHERE e.data_devolucao IS NULL 
        AND e.data_previsao_devolucao < CURRENT_TIMESTAMP;
    `;
    const result = await pool.query(queryText);
    return res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar atrasos:', error);
    return res.status(500).json({ erro: 'Erro ao carregar pendências.' });
  }
});

// ==========================================
// CONFIGURAÇÃO DO FRONTEND (RENDER)
// ==========================================
const rootDir = process.cwd();

// Rota para Relatório Mensal de Empréstimos
app.get(['/api/relatorios/mensal', '/relatorios/mensal'], autenticarToken, async (req, res) => {
  try {
    const { mes, ano } = req.query;
    const agora = new Date();
    const anoFiltro = ano || agora.getFullYear();
    const mesFiltro = mes ? String(mes).padStart(2, '0') : String(agora.getMonth() + 1).padStart(2, '0');

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
      WHERE EXTRACT(YEAR FROM e.data_emprestimo) = $1 
        AND EXTRACT(MONTH FROM e.data_emprestimo) = $2
      ORDER BY e.data_emprestimo DESC
    `;

    const result = await pool.query(query, [Number(anoFiltro), Number(mesFiltro)]);
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

// Serve os arquivos estáticos da pasta raiz
app.use(express.static(rootDir));

// Qualquer rota que não seja da API entrega o index.html (Fallback para SPA)
app.use((req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

// Porta do servidor
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log('Servidor rodando localmente na porta 3000'));
}
module.exports = app;
