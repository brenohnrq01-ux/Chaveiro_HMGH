# 🔑 Chaveiro HMGH

<p align="center">
  Sistema web para controle de empréstimos e devoluções de chaves em uma portaria hospitalar.
</p>

<p align="center">
  <a href="https://chaveiro-hmgh-pndc-lovat.vercel.app">
    <img src="https://img.shields.io/badge/🌐_Acessar_Sistema-Vercel-000000?style=for-the-badge" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" />
</p>

## 🏥 Sobre o projeto

O **Chaveiro HMGH** foi desenvolvido para apoiar a rotina de uma portaria hospitalar, centralizando o controle de chaves por setor e registrando quem retirou cada chave, quando ocorreu o empréstimo e a previsão de devolução.

O sistema combina uma interface web responsiva com uma API em Node.js e persistência em PostgreSQL.

## ✨ Funcionalidades

- 🔐 Login com autenticação JWT
- 🔒 Senhas verificadas com `bcryptjs`
- 🗂️ Organização das chaves por setor
- 🔑 Visualização do status de cada chave
- 📤 Registro de empréstimos
- 📥 Registro de devoluções
- ⏰ Identificação de empréstimos atrasados
- 📊 Relatório mensal de movimentações
- 👤 Registro do operador responsável
- 📱 Recursos de PWA com `manifest.json` e Service Worker
- 🔄 Operações críticas protegidas por transações no PostgreSQL

## 🧱 Arquitetura

```text
Interface Web
    ↓
API Express / Node.js
    ↓
Autenticação JWT
    ↓
PostgreSQL
```

## 🛠️ Tecnologias

**Frontend:** HTML5, CSS3 e JavaScript  
**Backend:** Node.js e Express 5  
**Banco de dados:** PostgreSQL  
**Segurança:** JWT + bcryptjs  
**Deploy:** Vercel  
**Outros:** CORS, dotenv e PWA

## 📁 Estrutura principal

```text
Rotas/
├── api/
├── config/
├── middleweras/
├── index.html
├── Emprestimos.js
├── auth.js
├── manifest.json
├── sw.js
├── package.json
└── vercel.json
```

## 🚀 Executando localmente

```bash
git clone https://github.com/brenohnrq01-ux/Chaveiro_HMGH.git
cd Chaveiro_HMGH/Rotas
npm install
```

Configure as variáveis de ambiente necessárias para conexão com o banco e autenticação e execute a API em ambiente de desenvolvimento.

## 🔐 Segurança

Credenciais, strings de conexão e segredos JWT devem permanecer em variáveis de ambiente e nunca ser versionados no repositório.

## 📌 Status

Projeto em desenvolvimento e disponível para demonstração online.

---

<p align="center">
  Desenvolvido por <strong>Breno Henrique</strong>
</p>
