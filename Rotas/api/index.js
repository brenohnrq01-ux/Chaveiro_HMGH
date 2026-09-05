// Proteja o listener local para não conflitar com a Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log('Servidor rodando localmente na porta 3000');
  });
}

// OBRIGATÓRIO: Exporta a instância do Express para a Vercel
module.exports = app;
