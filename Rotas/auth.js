const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

// Defina a chave secreta em uma variável de ambiente (.env)
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura';

router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
  }

  try {
    // 1. Busca o usuário no banco
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const usuario = result.rows[0];

    // 2. Compara a senha informada com o hash salvo no banco
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    // 3. Gera o Token JWT contendo o ID e informações do operador
    const token = jwt.sign(
      { 
        id: usuario.id, 
        nome: usuario.nome, 
        email: usuario.email, 
        permissao: usuario.permissao 
      },
      JWT_SECRET,
      { expiresIn: '8h' } // Token válido por 8 horas (1 turno de trabalho)
    );

    return res.json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        permissao: usuario.permissao
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

module.exports = router;