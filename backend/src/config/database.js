/**
 * Configuración de conexión a PostgreSQL.
 *
 * Soporta dos modos:
 *   1. DATABASE_URL (Supabase / producción): una sola cadena de conexión
 *   2. Variables individuales (desarrollo local): DB_HOST, DB_PORT, etc.
 *
 * Supabase requiere SSL — se activa automáticamente cuando se usa DATABASE_URL
 * o cuando DB_SSL=true.
 */

const { Pool } = require("pg");

const isSSL = process.env.DB_SSL === "true" || !!process.env.DATABASE_URL;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || "asin_ocr_db",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
      ...(isSSL && { ssl: { rejectUnauthorized: false } }),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

pool.on("connect", () => {
  if (process.env.NODE_ENV !== "production") {
    console.log("  ✓ Conexión a PostgreSQL establecida" + (isSSL ? " (SSL)" : ""));
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
