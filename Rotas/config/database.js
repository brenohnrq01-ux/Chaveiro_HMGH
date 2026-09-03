const { Pool } = require('pg');

// Substitua a criação antiga do pool por esta:
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // O SSL é necessário quando o banco estiver hospedado no Render/Supabase/ElephantSQL
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

module.exports = pool;