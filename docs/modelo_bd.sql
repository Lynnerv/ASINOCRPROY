-- ============================================================================
-- MODELO DE BASE DE DATOS - Sistema de Gestion Documental con OCR + IA
-- Proyecto de Tesis - Asin Solutions
-- PostgreSQL 15+
-- ============================================================================
-- Version: 3.0
--
-- Cambios respecto a v2.0:
--   - NUEVA: tabla clientes (datos fijos por NIS)
--   - expedientes: referencia cliente_id, 1 expediente = 1 servicio/carga
--   - Un mismo cliente (NIS) puede tener multiples expedientes
--   - Cada carga de 1-2 cartas crea un expediente nuevo
-- ============================================================================

-- Limpiar tablas si existen (para desarrollo/pruebas)
DROP TABLE IF EXISTS historial_acciones CASCADE;
DROP TABLE IF EXISTS resultados_parametros CASCADE;
DROP TABLE IF EXISTS catalogo_parametros CASCADE;
DROP TABLE IF EXISTS cartas_poder CASCADE;
DROP TABLE IF EXISTS documentos CASCADE;
DROP TABLE IF EXISTS expedientes CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- ============================================================================
-- 1. USUARIOS
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

CREATE INDEX idx_usuarios_correo ON usuarios(correo);

-- ============================================================================
-- 2. CLIENTES
-- ============================================================================
-- Datos fijos del usuario de desague (no cambian entre servicios).
-- Un cliente se identifica por su NIS (Numero Interno de Suministro).
-- Se crea automaticamente al procesar la primera carta de un NIS nuevo.
-- Si el NIS ya existe, se reutiliza el mismo registro de cliente.
-- ============================================================================
CREATE TABLE clientes (
    id              SERIAL PRIMARY KEY,
    nis             VARCHAR(20) UNIQUE NOT NULL,
    nia             VARCHAR(20),
    nombre          VARCHAR(200) NOT NULL,
    direccion       VARCHAR(300),
    distrito        VARCHAR(100),
    creado_en       TIMESTAMP DEFAULT NOW(),
    actualizado_en  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clientes_nis ON clientes(nis);
CREATE INDEX idx_clientes_nombre ON clientes(nombre);

-- ============================================================================
-- 3. EXPEDIENTES
-- ============================================================================
-- Un expediente = un servicio solicitado por un cliente.
-- Se crea al momento de subir cartas (1 carga = 1 expediente).
-- Un mismo cliente (NIS) puede tener multiples expedientes en el tiempo.
--
-- Contiene 1-2 documentos (cartas):
--   - Solo Anexo 1 (cobro adicional)
--   - Solo Anexo 2 (suspension temporal)
--   - Ambos (Anexo 1 + Anexo 2)
--
-- Cada expediente genera su propia carta poder y reporte final.
-- ============================================================================
CREATE TABLE expedientes (
    id              SERIAL PRIMARY KEY,
    cliente_id      INT REFERENCES clientes(id),
    estado          VARCHAR(30) NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'procesado', 'en_revision',
                                      'completo', 'cerrado')),
    observaciones   TEXT,
    creado_por      INT REFERENCES usuarios(id),
    creado_en       TIMESTAMP DEFAULT NOW(),
    actualizado_en  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expedientes_cliente ON expedientes(cliente_id);
CREATE INDEX idx_expedientes_estado ON expedientes(estado);
CREATE INDEX idx_expedientes_creado ON expedientes(creado_en);

-- ============================================================================
-- 4. DOCUMENTOS
-- ============================================================================
-- Cada documento es una carta de notificacion individual.
-- Un expediente tiene 1-2 documentos.
--
-- Lo que varia entre documentos del mismo expediente:
--   - anexo (Anexo 1 o Anexo 2)
--   - numero_carta, numero_acta, numero_informe, fecha_muestra
--   - resultados de parametros VMA
--
-- Lo que es igual (datos del cliente):
--   - NIS, NIA, nombre, direccion, distrito → tabla clientes
-- ============================================================================
CREATE TABLE documentos (
    id                  SERIAL PRIMARY KEY,
    expediente_id       INT NOT NULL REFERENCES expedientes(id),

    -- Archivo original
    ruta_archivo        VARCHAR(500) NOT NULL,
    nombre_archivo      VARCHAR(255) NOT NULL,
    tipo_archivo        VARCHAR(10) NOT NULL DEFAULT 'png'
                        CHECK (tipo_archivo IN ('pdf', 'png', 'jpg', 'jpeg')),
    tamano_bytes        BIGINT,

    -- Campos extraidos por pipeline OCR + Gemini
    numero_carta        VARCHAR(50),
    fecha_carta         DATE,
    tipo_notificacion   VARCHAR(100),
    anexo               VARCHAR(10) CHECK (anexo IN ('Anexo 1', 'Anexo 2')),

    -- Datos de referencia (varian por carta)
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

    -- Auditoria
    subido_por          INT REFERENCES usuarios(id),
    validado_por        INT REFERENCES usuarios(id),
    fecha_validacion    TIMESTAMP,
    creado_en           TIMESTAMP DEFAULT NOW(),
    actualizado_en      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documentos_expediente ON documentos(expediente_id);
CREATE INDEX idx_documentos_numero_carta ON documentos(numero_carta);
CREATE INDEX idx_documentos_estado ON documentos(estado);
CREATE INDEX idx_documentos_anexo ON documentos(anexo);

-- ============================================================================
-- 5. CATALOGO DE PARAMETROS VMA
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

-- Anexo 1
INSERT INTO catalogo_parametros (codigo, nombre_completo, unidad, expresion, vma_normado, anexo) VALUES
    ('DBO5',  'Demanda Bioquimica de Oxigeno (DBO5)',  'mg/L', 'DBO5',  '500',  'Anexo 1'),
    ('DQO',   'Demanda Quimica de Oxigeno (DQO)',      'mg/L', 'DQO',   '1000', 'Anexo 1'),
    ('SST',   'Solidos Suspendidos Totales (SST)',      'mg/L', 'SST',   '500',  'Anexo 1'),
    ('AYG',   'Aceites y Grasas (AYG)',                 'mg/L', 'AYG',   '100',  'Anexo 1');

-- Anexo 2
INSERT INTO catalogo_parametros (codigo, nombre_completo, unidad, expresion, vma_normado, anexo) VALUES
    ('MN',    'Manganeso Total',                        'mg/L',   'Mn',    '4',    'Anexo 2'),
    ('PH',    'pH',                                     'Unidad', 'pH',    '6-9',  'Anexo 2'),
    ('NH3',   'Nitrogeno Amoniacal',                    'mg/L',   'N-NH3', '80',   'Anexo 2'),
    ('S',     'Sulfuros',                               'mg/L',   'S',     '5',    'Anexo 2'),
    ('CR',    'Cromo Hexavalente',                      'mg/L',   'Cr+6',  '0.5',  'Anexo 2'),
    ('CR_T',  'Cromo Total',                            'mg/L',   'Cr',    '10',   'Anexo 2'),
    ('PB',    'Plomo',                                  'mg/L',   'Pb',    '0.5',  'Anexo 2'),
    ('CN',    'Cianuro',                                'mg/L',   'CN-',   '1',    'Anexo 2'),
    ('HG',    'Mercurio',                               'mg/L',   'Hg',    '0.02', 'Anexo 2'),
    ('CD',    'Cadmio',                                 'mg/L',   'Cd',    '0.2',  'Anexo 2'),
    ('AS',    'Arsenico',                               'mg/L',   'As',    '0.5',  'Anexo 2'),
    ('NI',    'Niquel',                                 'mg/L',   'Ni',    '4',    'Anexo 2'),
    ('ZN',    'Zinc',                                   'mg/L',   'Zn',    '10',   'Anexo 2'),
    ('AL',    'Aluminio',                               'mg/L',   'Al',    '10',   'Anexo 2'),
    ('B',     'Boro',                                   'mg/L',   'B',     '4',    'Anexo 2');

-- ============================================================================
-- 6. RESULTADOS DE PARAMETROS (por documento)
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
-- 7. CARTAS PODER (1 por expediente)
-- ============================================================================
CREATE TABLE cartas_poder (
    id                  SERIAL PRIMARY KEY,
    expediente_id       INT NOT NULL REFERENCES expedientes(id),

    ruta_borrador       VARCHAR(500),
    fecha_borrador      TIMESTAMP,

    ruta_pdf_firmado    VARCHAR(500),
    fecha_subida        TIMESTAMP,

    fecha_emision       DATE,
    fecha_vencimiento   DATE,
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente', 'borrador', 'firmado',
                                          'vigente', 'vencido')),

    generado_por        INT REFERENCES usuarios(id),
    subido_por          INT REFERENCES usuarios(id),
    creado_en           TIMESTAMP DEFAULT NOW(),
    actualizado_en      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cartas_poder_expediente ON cartas_poder(expediente_id);

-- ============================================================================
-- 8. HISTORIAL DE ACCIONES
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

-- ============================================================================
-- 9. DATOS INICIALES
-- ============================================================================
INSERT INTO usuarios (nombre, correo, password_hash, rol)
VALUES (
    'Administrador',
    'admin@asin.com',
    '$2b$10$placeholder_hash_cambiar_en_produccion',
    'administrador'
);

-- ============================================================================
-- MODELO DE RELACIONES
-- ============================================================================
--
--  clientes (NIS unico, datos fijos del usuario de desague)
--    |
--    +-- expediente A (servicio agosto 2025)
--    |     +-- doc: carta Anexo 1 (DBO5 excedido)
--    |     +-- doc: carta Anexo 2 (Sulfuros excedido)
--    |     +-- carta poder (generada de estas 2 cartas)
--    |
--    +-- expediente B (servicio enero 2026, mismo cliente)
--          +-- doc: carta Anexo 1 (DQO excedido)
--          +-- carta poder (generada de esta carta)
--
-- FLUJO:
--   1. Operador sube 1-2 cartas → crea 1 expediente + N documentos
--   2. Procesar → OCR+Gemini extrae datos
--   3. Con el NIS extraido: encuentra o crea el cliente
--   4. Vincula expediente al cliente
--   5. Inserta parametros VMA normalizados
--   6. Genera carta poder de ESE expediente
--   7. Genera reporte final
-- ============================================================================
