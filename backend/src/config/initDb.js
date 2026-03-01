/**
 * Script de inicialización de la base de datos.
 *
 * Ejecutar después de crear las tablas con modelo_bd.sql:
 *   1. psql -U postgres -d asin_ocr_db -f ../docs/modelo_bd.sql
 *   2. npm run db:init
 *
 * Genera el hash bcrypt correcto para el usuario administrador.
 */

require("dotenv").config({ override: true });
const bcrypt = require("bcrypt");
const { pool } = require("./database");

const SALT_ROUNDS = 10;

async function initDb() {
  try {
    console.log("Inicializando base de datos...\n");

    // Verificar conexión
    const { rows } = await pool.query("SELECT NOW() AS now");
    console.log(`  ✓ Conectado a PostgreSQL: ${rows[0].now}`);

    // Verificar que las tablas existen
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`  ✓ Tablas encontradas: ${tables.rows.map((r) => r.table_name).join(", ")}`);

    // Crear usuario administrador con hash real
    const adminPassword = "admin123";
    const hash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    await pool.query(
      `UPDATE usuarios 
       SET password_hash = $1 
       WHERE correo = 'admin@asin.com'`,
      [hash]
    );

    console.log(`\n  ✓ Usuario administrador actualizado:`);
    console.log(`    Correo:   admin@asin.com`);
    console.log(`    Password: ${adminPassword}`);
    console.log(`    (Cambiar en producción)\n`);

    console.log("Base de datos inicializada correctamente.\n");
  } catch (err) {
    console.error("Error al inicializar:", err.message);
  } finally {
    await pool.end();
  }
}

initDb();
