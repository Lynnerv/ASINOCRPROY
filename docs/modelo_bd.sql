-- ============================================================================
-- MODELO DE BASE DE DATOS - Sistema de Gestión Documental con OCR + IA
-- Proyecto de Tesis - Asin Solutions
-- PostgreSQL 15+
-- ============================================================================
-- Versión: 2.0 (reemplaza modelo_bd.sql del Sprint 0)
--
-- Cambios respecto a v1.0:
--   - usuarios: agregado password_hash, activo, ultimo_acceso
--   - expedientes: agregado nia, direccion, distrito, campos de carta poder
--   - documentos: campos extraídos por pipeline OCR+Gemini
--   - NUEVA: parametros_vma (relación 1:N con documentos)
--   - NUEVA: cartas_poder (flujo híbrido: borrador + PDF firmado)
--   - NUEVA: historial_acciones (auditoría)
-- ============================================================================

-- Limpiar tablas si existen (para desarrollo/pruebas)
DROP TABLE IF EXISTS historial_acciones CASCADE;
DROP TABLE IF EXISTS resultados_parametros CASCADE;
DROP TABLE IF EXISTS catalogo_parametros CASCADE;
DROP TABLE IF EXISTS cartas_poder CASCADE;
DROP TABLE IF EXISTS documentos CASCADE;
DROP TABLE IF EXISTS expedientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================================================
-- 1. USUARIOS
-- ============================================================================
-- Roles:
--   'administrador': Gestión completa (usuarios, expedientes, reportes)
--   'operador': Sube documentos, consulta expedientes, genera reportes
-- ============================================================================

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    correo          VARCHAR(150) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'operador')),
    activo          BOOLEAN DEFAULT TRUE,
    ultimo_acceso   TIMESTAMP,
    creado_en       TIMESTAMP DEFAULT NOW(),
    actualizado_en  TIMESTAMP DEFAULT NOW()
);

-- Índice para búsqueda por correo (login)
CREATE INDEX idx_usuarios_correo ON usuarios(correo);

-- ============================================================================
-- 2. EXPEDIENTES
-- ============================================================================
-- Un expediente agrupa todos los documentos de un mismo NIS (RN-03).
-- Se crea automáticamente al procesar el primer documento de un NIS nuevo.
-- ============================================================================

CREATE TABLE expedientes (
    id              SERIAL PRIMARY KEY,
    nis             VARCHAR(20) UNIQUE NOT NULL,
    nia             VARCHAR(20),
    cliente         VARCHAR(200) NOT NULL,
    direccion       VARCHAR(300),
    distrito        VARCHAR(100),
    estado          VARCHAR(30) NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo', 'en_proceso', 'cerrado')),
    creado_por      INT REFERENCES usuarios(id),
    creado_en       TIMESTAMP DEFAULT NOW(),
    actualizado_en  TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas frecuentes
CREATE INDEX idx_expedientes_nis ON expedientes(nis);
CREATE INDEX idx_expedientes_cliente ON expedientes(cliente);
CREATE INDEX idx_expedientes_estado ON expedientes(estado);

-- ============================================================================
-- 3. DOCUMENTOS
-- ============================================================================
-- Cada documento es una carta de notificación procesada por el pipeline
-- OCR + Gemini. Almacena tanto la ruta del archivo original como los
-- campos extraídos.
--
-- Reglas de negocio:
--   RN-05: Documentos entran como PDF (conversión interna a imagen)
--   RN-06: PDF puede contener múltiples páginas
--   RN-11: Registro con ID, fecha, usuario, estado
--   RN-12: Procesamiento OCR automático al subir documento
-- ============================================================================

CREATE TABLE documentos (
    id                  SERIAL PRIMARY KEY,
    expediente_id       INT REFERENCES expedientes(id),

    -- Archivo original
    ruta_archivo        VARCHAR(500) NOT NULL,
    nombre_archivo      VARCHAR(255) NOT NULL,
    tipo_archivo        VARCHAR(10) NOT NULL DEFAULT 'pdf'
                        CHECK (tipo_archivo IN ('pdf', 'png', 'jpg', 'jpeg')),
    tamano_bytes        BIGINT,

    -- Campos extraídos por pipeline OCR + Gemini
    numero_carta        VARCHAR(50),
    fecha_carta         DATE,
    tipo_notificacion   VARCHAR(100),
    anexo               VARCHAR(10) CHECK (anexo IN ('Anexo 1', 'Anexo 2')),

    -- Datos de referencia (acta y laboratorio)
    numero_acta         VARCHAR(20),
    fecha_muestra       DATE,
    numero_informe      VARCHAR(20),

    -- Metadatos del procesamiento OCR
    texto_ocr           TEXT,
    confianza_ocr       DECIMAL(5,4),
    extraido_json       JSONB,

    -- Control de procesamiento
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'procesando', 'procesado',
                                          'validado', 'error')),
    observaciones       TEXT,

    -- Auditoría
    subido_por          INT REFERENCES usuarios(id),
    validado_por        INT REFERENCES usuarios(id),
    fecha_validacion    TIMESTAMP,
    creado_en           TIMESTAMP DEFAULT NOW(),
    actualizado_en      TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_documentos_expediente ON documentos(expediente_id);
CREATE INDEX idx_documentos_numero_carta ON documentos(numero_carta);
CREATE INDEX idx_documentos_estado ON documentos(estado);
CREATE INDEX idx_documentos_anexo ON documentos(anexo);

-- ============================================================================
-- 4. CATÁLOGO DE PARÁMETROS VMA
-- ============================================================================
-- Tabla de referencia con los datos fijos de cada parámetro según el
-- D.S. N° 010-2019-VIVIENDA, Reglamento de VMA.
--
-- Normalización: unidad, expresión y vma_normado son constantes para
-- cada parámetro, por lo que se almacenan una sola vez aquí.
-- Solo el resultado_valor varía por documento.
--
-- Soporta Anexo 1 (DBO5, DQO, SST, AYG, etc.),
-- Anexo 2 (Manganeso, pH, Nitrógeno Amoniacal, Sulfuros, etc.)
-- y cualquier parámetro futuro que se agregue.
-- ============================================================================

CREATE TABLE catalogo_parametros (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(20) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    unidad          VARCHAR(20) NOT NULL,
    expresion       VARCHAR(20),
    vma_normado     VARCHAR(20) NOT NULL,
    anexo           VARCHAR(10) NOT NULL CHECK (anexo IN ('Anexo 1', 'Anexo 2')),
    activo          BOOLEAN DEFAULT TRUE,
    creado_en       TIMESTAMP DEFAULT NOW()
);

-- Datos iniciales: Anexo 1 (D.S. N° 010-2019-VIVIENDA)
INSERT INTO catalogo_parametros (codigo, nombre_completo, unidad, expresion, vma_normado, anexo) VALUES
    ('DBO5',  'Demanda Bioquímica de Oxígeno',  'mg/L', 'DBO5',  '500',  'Anexo 1'),
    ('DQO',   'Demanda Química de Oxígeno',      'mg/L', 'DQO',   '1000', 'Anexo 1'),
    ('SST',   'Sólidos Suspendidos Totales',      'mg/L', 'SST',   '500',  'Anexo 1'),
    ('AYG',   'Aceites y Grasas',                 'mg/L', 'AYG',   '100',  'Anexo 1');

-- Datos iniciales: Anexo 2 (D.S. N° 010-2019-VIVIENDA)
INSERT INTO catalogo_parametros (codigo, nombre_completo, unidad, expresion, vma_normado, anexo) VALUES
    ('MN',    'Manganeso Total',                        'mg/L',   'Mn',    '4',    'Anexo 2'),
    ('PH',    'pH',                                     'Unidad', 'pH',    '6-9',  'Anexo 2'),
    ('NH3',   'Nitrógeno Amoniacal',                    'mg/L',   'N-NH3', '80',   'Anexo 2'),
    ('S',     'Sulfuros',                               'mg/L',   'S',     '5',    'Anexo 2'),
    ('CR',    'Cromo Hexavalente',                      'mg/L',   'Cr+6',  '0.5',  'Anexo 2'),
    ('CR_T',  'Cromo Total',                            'mg/L',   'Cr',    '10',   'Anexo 2'),
    ('PB',    'Plomo',                                  'mg/L',   'Pb',    '0.5',  'Anexo 2'),
    ('CN',    'Cianuro',                                'mg/L',   'CN-',   '1',    'Anexo 2'),
    ('HG',    'Mercurio',                               'mg/L',   'Hg',    '0.02', 'Anexo 2'),
    ('CD',    'Cadmio',                                 'mg/L',   'Cd',    '0.2',  'Anexo 2'),
    ('AS',    'Arsénico',                               'mg/L',   'As',    '0.5',  'Anexo 2'),
    ('NI',    'Níquel',                                 'mg/L',   'Ni',    '4',    'Anexo 2'),
    ('ZN',    'Zinc',                                   'mg/L',   'Zn',    '10',   'Anexo 2'),
    ('AL',    'Aluminio',                               'mg/L',   'Al',    '10',   'Anexo 2'),
    ('B',     'Boro',                                   'mg/L',   'B',     '4',    'Anexo 2');

-- ============================================================================
-- 5. RESULTADOS DE PARÁMETROS (por documento)
-- ============================================================================
-- Solo almacena el resultado_valor, referenciando al catálogo para
-- los datos fijos del parámetro.
-- ============================================================================

CREATE TABLE resultados_parametros (
    id              SERIAL PRIMARY KEY,
    documento_id    INT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    parametro_id    INT NOT NULL REFERENCES catalogo_parametros(id),
    resultado_valor VARCHAR(20) NOT NULL,
    creado_en       TIMESTAMP DEFAULT NOW(),

    UNIQUE (documento_id, parametro_id)
);

CREATE INDEX idx_resultados_documento ON resultados_parametros(documento_id);
CREATE INDEX idx_resultados_parametro ON resultados_parametros(parametro_id);

-- ============================================================================
-- 6. CARTAS PODER
-- ============================================================================
-- Flujo híbrido (RN-04):
--   1. El sistema genera un borrador automático reutilizando datos del
--      expediente (NIS, cliente, dirección) para facilitar la firma.
--   2. El operador sube el PDF firmado final.
--   3. El PDF firmado se vincula al expediente como requisito legal.
--
-- Una carta poder válida debe existir antes de generar el reporte final.
-- ============================================================================

CREATE TABLE cartas_poder (
    id                  SERIAL PRIMARY KEY,
    expediente_id       INT NOT NULL REFERENCES expedientes(id),

    -- Borrador generado por el sistema
    ruta_borrador       VARCHAR(500),
    fecha_borrador      TIMESTAMP,

    -- PDF firmado subido por el operador
    ruta_pdf_firmado    VARCHAR(500),
    fecha_subida        TIMESTAMP,

    -- Vigencia y estado
    fecha_emision       DATE,
    fecha_vencimiento   DATE,
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'borrador', 'firmado',
                                          'vigente', 'vencido')),

    -- Auditoría
    generado_por        INT REFERENCES usuarios(id),
    subido_por          INT REFERENCES usuarios(id),
    creado_en           TIMESTAMP DEFAULT NOW(),
    actualizado_en      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cartas_poder_expediente ON cartas_poder(expediente_id);
CREATE INDEX idx_cartas_poder_estado ON cartas_poder(estado);

-- ============================================================================
-- 7. HISTORIAL DE ACCIONES (Auditoría)
-- ============================================================================
-- Registra acciones relevantes del sistema para trazabilidad.
-- ============================================================================

CREATE TABLE historial_acciones (
    id              SERIAL PRIMARY KEY,
    usuario_id      INT REFERENCES usuarios(id),
    accion          VARCHAR(50) NOT NULL,
    entidad         VARCHAR(50) NOT NULL,
    entidad_id      INT,
    detalle         JSONB,
    ip_address      VARCHAR(45),
    creado_en       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_historial_usuario ON historial_acciones(usuario_id);
CREATE INDEX idx_historial_entidad ON historial_acciones(entidad, entidad_id);
CREATE INDEX idx_historial_fecha ON historial_acciones(creado_en);

-- ============================================================================
-- 8. DATOS INICIALES
-- ============================================================================
-- Usuario administrador por defecto.
-- Password: admin123 (hash bcrypt, cambiar en producción)
-- ============================================================================

INSERT INTO usuarios (nombre, correo, password_hash, rol)
VALUES (
    'Administrador',
    'admin@asin.com',
    '$2b$10$placeholder_hash_cambiar_en_produccion',
    'administrador'
);

-- ============================================================================
-- NOTAS DE IMPLEMENTACIÓN
-- ============================================================================
-- 
-- 1. FLUJO DE PROCESAMIENTO:
--    a) Usuario sube PDF → se crea registro en documentos (estado: pendiente)
--    b) Pipeline OCR+Gemini procesa → actualiza campos + parametros_vma
--       (estado: procesado)
--    c) Usuario valida datos → (estado: validado)
--
-- 2. EXPEDIENTES AUTOMÁTICOS:
--    Al procesar un documento, si el NIS no existe en expedientes,
--    se crea uno nuevo automáticamente con los datos extraídos.
--    Si ya existe, el documento se vincula al expediente existente.
--
-- 3. ALMACENAMIENTO DE ARCHIVOS:
--    - Por ahora: disco local del servidor
--    - Estructura: /uploads/{año}/{mes}/{nis}/{archivo}
--    - Futuro: migrar a Azure Blob Storage
--
-- 4. CAMPO extraido_json (JSONB):
--    Almacena la respuesta completa de Gemini como backup.
--    Permite reprocesar o agregar campos sin modificar el esquema.
--
-- 5. CARTA PODER (RN-04):
--    El reporte final NO se puede generar si no existe una carta
--    poder con estado 'vigente' vinculada al expediente.
-- ============================================================================