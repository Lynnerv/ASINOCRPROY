-- ============================================================================
-- MIGRACIÓN: Agregar campos de recuperación de contraseña (HU-02)
-- Ejecutar solo si la BD ya existe y no quieres recrearla completa.
-- Si vas a recrear la BD con modelo_bd.sql v3, este archivo NO es necesario.
-- ============================================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS reset_token_expira TIMESTAMP;
