const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const autenticarToken = require('../middlewares/auth'); // Importa o middleware

/**
 * ROTA DE EMPRÉSTIMO PROTEGIDA
 * POST /api/emprestimos
 */
router.post('/emprestimos', autenticarToken, async (req, res) => {
  const { chave_id, pessoa_autorizada_id, data_previsao_devolucao } = req.body;

  // O ID do operador logado é capturado do token verificado
  const usuario_operador_id = req.usuario.id;

  if (!chave_id || !pessoa_autorizada_id || !data_previsao_devolucao) {
    return res.status(400).json({ erro: 'Todos os campos obrigatórios devem ser preenchidos.' });
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
      return res.status(400).json({ erro: 'Esta chave já se encontra emprestada.' });
    }

    // Registra usando o usuario_operador_id seguro vindo do JWT
    const novoEmprestimo = await client.query(
      `INSERT INTO emprestimos 
        (chave_id, pessoa_autorizada_id, usuario_operador_id, data_previsao_devolucao, status) 
       VALUES ($1, $2, $3, $4, 'ativo') 
       RETURNING *`,
      [chave_id, pessoa_autorizada_id, usuario_operador_id, data_previsao_devolucao]
    );

    await client.query(
      "UPDATE chaves SET status = 'emprestada' WHERE id = $1",
      [chave_id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      mensagem: 'Empréstimo registrado com sucesso!',
      dados: novoEmprestimo.rows[0],
      registrado_por: req.usuario.nome // Exibe o nome do operador responsável
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro no empréstimo:', error);
    return res.status(500).json({ erro: 'Erro interno ao processar o empréstimo.' });
  } finally {
    client.release();
  }
});

module.exports = router;