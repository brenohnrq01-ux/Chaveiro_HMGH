const express = require('express');
const app = express(); // Esta linha precisa vir antes de qualquer uso de 'app'

// Seus middlewares e rotas (linha 9 e adiante)
app.use(express.json());

// Exemplo de rota de login
app.post('/api/login', async (req, res) => {
  // sua lógica
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log('Servidor rodando localmente na porta 3000'));
}

module.exports = app;
