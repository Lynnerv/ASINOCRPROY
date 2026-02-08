/**
 * Configuración de conexión a PostgreSQL.
 *
 * Utiliza pg.Pool para manejar un pool de conexiones reutilizables,
 * evitando abrir/cerrar conexiones por cada consulta.
 */

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "asin_ocr_db",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log de conexión exitosa (solo al iniciar)
pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("  ✓ Conexión a PostgreSQL establecida");
  }
});

pool.on("error", (err) => {
  console.error("Error inesperado en el pool de PostgreSQL:", err.message);
});

/**
 * Ejecuta una consulta SQL parametrizada.
 * @param {string} text - Consulta SQL con placeholders ($1, $2, ...)
 * @param {Array} params - Valores para los placeholders
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
