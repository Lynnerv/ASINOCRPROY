"""
Servicio OCR para extracción de texto desde cartas de notificación escaneadas.

Este módulo se limita exclusivamente a extraer el texto contenido en
imágenes escaneadas. NO realiza clasificación, extracción de campos ni
interpretación del contenido. Esas tareas serán delegadas a un servicio
externo de IA (Gemini API).

Arquitectura:
    EasyOCR (CRAFT + CRNN) → Detección y reconocimiento de texto
    → Reconstrucción espacial de líneas → Texto plano del documento

Uso CLI:
    python main_ocr.py ../dataset_pruebas/example1.png
    python main_ocr.py --batch ../dataset_pruebas
    python main_ocr.py --batch ../dataset_pruebas -o resultado.json

Uso como módulo:
    from main_ocr import extract_text
    resultado = extract_text("ruta/imagen.png")
    print(resultado["texto"])
"""

import sys
import os
import json
import argparse
import easyocr
import cv2
import numpy as np
from typing import Optional


# ---------------------------------------------------------------------------
# INICIALIZACIÓN DEL READER (singleton)
# ---------------------------------------------------------------------------

_reader: Optional[easyocr.Reader] = None


def get_reader(gpu: bool = False) -> easyocr.Reader:
    """
    Inicializa el reader de EasyOCR una sola vez.
    Los modelos (~100MB) se descargan en la primera ejecución
    y se cachean en ~/.EasyOCR/.
    """
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(["es"], gpu=gpu, verbose=False)
    return _reader


# ---------------------------------------------------------------------------
# EXTRACCIÓN DE TEXTO
# ---------------------------------------------------------------------------

def extract_text(image_path: str, gpu: bool = False) -> dict:
    """
    Extrae el texto completo de una imagen escaneada.

    Pipeline:
        1. Carga de imagen en escala de grises
        2. Detección de regiones de texto (CRAFT - CNN)
        3. Reconocimiento de caracteres (CRNN)
        4. Reconstrucción espacial: ordenar detecciones de arriba
           hacia abajo y de izquierda a derecha, agrupándolas en
           líneas según su posición vertical.

    Args:
        image_path: Ruta a la imagen (PNG, JPG).
        gpu: Si True, usa GPU (CUDA) para inferencia.

    Returns:
        {
            "archivo": "example1.png",
            "texto": "Texto completo reconstruido...",
            "confianza_promedio": 0.85,
            "total_detecciones": 120,
            "estado": "procesado"
        }
    """
    if not os.path.isfile(image_path):
        return {
            "archivo": os.path.basename(image_path),
            "texto": None,
            "estado": "error",
            "error": f"Archivo no encontrado: {image_path}"
        }

    # 1. Cargar imagen en escala de grises
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return {
            "archivo": os.path.basename(image_path),
            "texto": None,
            "estado": "error",
            "error": f"No se pudo leer la imagen: {image_path}"
        }

    # 2-3. OCR: detección + reconocimiento
    reader = get_reader(gpu=gpu)
    detections = reader.readtext(img, detail=1, paragraph=False)

    if not detections:
        return {
            "archivo": os.path.basename(image_path),
            "texto": "",
            "confianza_promedio": 0.0,
            "total_detecciones": 0,
            "estado": "procesado"
        }

    # 4. Reconstrucción espacial del texto
    #    Cada detección: (bbox, texto, confianza)
    #    bbox = [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
    items = []
    for bbox, text, confidence in detections:
        y_top = min(p[1] for p in bbox)
        x_left = min(p[0] for p in bbox)
        items.append({
            "text": text,
            "confidence": confidence,
            "y": y_top,
            "x": x_left
        })

    # Ordenar por posición vertical, luego horizontal
    items.sort(key=lambda d: (d["y"], d["x"]))

    # Agrupar en líneas: detecciones con y_top similar pertenecen
    # a la misma línea del documento
    img_height = img.shape[0]
    line_tolerance = img_height * 0.008  # 0.8% de la altura

    lines = []
    current_line = [items[0]]

    for item in items[1:]:
        if abs(item["y"] - current_line[0]["y"]) <= line_tolerance:
            current_line.append(item)
        else:
            current_line.sort(key=lambda d: d["x"])
            lines.append(current_line)
            current_line = [item]

    current_line.sort(key=lambda d: d["x"])
    lines.append(current_line)

    # Unir texto
    full_text = "\n".join(
        " ".join(item["text"] for item in line)
        for line in lines
    )

    # Confianza promedio
    confidences = [item["confidence"] for item in items]
    avg_conf = sum(confidences) / len(confidences)

    return {
        "archivo": os.path.basename(image_path),
        "texto": full_text,
        "confianza_promedio": round(avg_conf, 4),
        "total_detecciones": len(items),
        "estado": "procesado"
    }


# ---------------------------------------------------------------------------
# PROCESAMIENTO POR LOTE
# ---------------------------------------------------------------------------

def extract_text_batch(image_paths: list, gpu: bool = False) -> list:
    """Procesa múltiples imágenes."""
    results = []
    total = len(image_paths)
    for idx, path in enumerate(image_paths, 1):
        print(f"  [{idx}/{total}] {os.path.basename(path)}...",
              file=sys.stderr)
        results.append(extract_text(path, gpu=gpu))
    return results


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Extracción de texto OCR desde imágenes escaneadas"
    )
    parser.add_argument(
        "imagenes", nargs="*",
        help="Imágenes a procesar (PNG, JPG)"
    )
    parser.add_argument(
        "--batch", metavar="DIR",
        help="Procesar todas las imágenes de un directorio"
    )
    parser.add_argument(
        "--gpu", action="store_true",
        help="Usar GPU (CUDA) para inferencia"
    )
    parser.add_argument(
        "-o", "--output", metavar="ARCHIVO",
        help="Guardar JSON en archivo (por defecto: stdout)"
    )

    args = parser.parse_args()

    # Resolver lista de imágenes
    paths = []
    if args.batch:
        if not os.path.isdir(args.batch):
            print(f"Error: '{args.batch}' no es un directorio.",
                  file=sys.stderr)
            sys.exit(1)
        paths = sorted([
            os.path.join(args.batch, f)
            for f in os.listdir(args.batch)
            if f.lower().endswith((".png", ".jpg", ".jpeg"))
        ])
    elif args.imagenes:
        paths = args.imagenes
    else:
        parser.print_help()
        sys.exit(1)

    if not paths:
        print("No se encontraron imágenes.", file=sys.stderr)
        sys.exit(1)

    # Procesar
    print(f"\nProcesando {len(paths)} imagen(es)...\n", file=sys.stderr)
    results = extract_text_batch(paths, gpu=args.gpu)

    # Resumen
    ok = sum(1 for r in results if r["estado"] == "procesado")
    print(f"\nResultado: {ok}/{len(results)} procesados.\n",
          file=sys.stderr)

    # Salida JSON
    output = json.dumps(results, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Guardado en: {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()