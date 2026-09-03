const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_super_segura';

function autenticarToken(req, res, next) {
  // Extrai o cabeçalho Authorization
  const authHeader = req.headers['authorization'];
  // Formato esperado: "Bearer <TOKEN>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
  }

  // Valida o token
  jwt.verify(token, JWT_SECRET, (err, usuarioDecodificado) => {
    if (err) {
      return res.status(403).json({ erro: 'Token inválido ou expirado.' });
    }

    // Injeta os dados do operador decodificados no objeto da requisição (req)
    req.usuario = usuarioDecodificado;
    
    // Prossegue para o próximo handler (a rota desejada)
    next();
  });
}

module.exports = autenticarToken;