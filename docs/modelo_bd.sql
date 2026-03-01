CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    rol VARCHAR(50) NOT NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE expedientes (
    id SERIAL PRIMARY KEY,
    nis VARCHAR(20) NOT NULL,
    cliente VARCHAR(150) NOT NULL,
    estado VARCHAR(30) NOT NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE documentos (
    id SERIAL PRIMARY KEY,
    expediente_id INT NOT NULL REFERENCES expedientes(id),
    tipo VARCHAR(50) NOT NULL,
    ruta_archivo VARCHAR(255) NOT NULL,
    texto_ocr TEXT,
    extraido_json TEXT,
    creado_en TIMESTAMP DEFAULT NOW()
);
