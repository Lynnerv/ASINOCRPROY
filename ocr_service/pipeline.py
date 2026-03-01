"""
Pipeline completo: Imagen → OCR (EasyOCR) → IA (Gemini) → JSON estructurado.

Este es el punto de entrada principal del servicio OCR-IA.
Orquesta los dos módulos del pipeline:
    1. main_ocr.py: Extracción de texto desde imagen escaneada.
    2. gemini_extractor.py: Extracción de campos mediante Gemini LLM.

Uso CLI:
    # Procesar una imagen
    python pipeline.py ../dataset_pruebas/example1.png

    # Procesar todas las imágenes de un directorio
    python pipeline.py --batch ../dataset_pruebas

    # Guardar resultado en archivo JSON
    python pipeline.py --batch ../dataset_pruebas -o resultados.json

Uso como módulo (desde el backend Node.js):
    from pipeline import process_image, process_batch
    resultado = process_image("ruta/imagen.png")
"""

import sys
import os
import json
import argparse
import time

# Forzar UTF-8 en stdout/stderr (Windows usa cp1252 por defecto)
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main_ocr import extract_text
from gemini_extractor import extract_fields


# ---------------------------------------------------------------------------
# PROCESAMIENTO INDIVIDUAL
# ---------------------------------------------------------------------------

def process_image(image_path: str, gpu: bool = False, api_key: str = None) -> dict:
    """
    Pipeline completo para una imagen.

    Flujo:
        Imagen → EasyOCR (texto) → Gemini (campos) → JSON

    Args:
        image_path: Ruta a la imagen (PNG, JPG).
        gpu: Usar GPU para OCR.
        api_key: API key de Gemini (opcional si está en .env).

    Returns:
        {
            "archivo": "example1.png",
            "estado": "procesado",
            "confianza_ocr": 0.61,
            "numero_carta": "1628-2025-EEC-AR",
            "fecha": "09 de octubre de 2025",
            "cliente": "ASOCIACION COMERCIANTES EL ZAPATÓN DE GRAU",
            "nis": "6365933",
            "nia": "21147187",
            "tipo_notificacion": "...",
            "parametros_vma": [...]
        }
    """
    archivo = os.path.basename(image_path)

    # --- ETAPA 1: OCR ---
    ocr_result = extract_text(image_path, gpu=gpu)

    if ocr_result.get("estado") == "error":
        return {
            "archivo": archivo,
            "estado": "error",
            "etapa": "ocr",
            "error": ocr_result.get("error", "Error desconocido en OCR")
        }

    texto_ocr = ocr_result.get("texto", "")
    if not texto_ocr.strip():
        return {
            "archivo": archivo,
            "estado": "error",
            "etapa": "ocr",
            "error": "OCR no extrajo texto de la imagen"
        }

    # --- ETAPA 2: GEMINI ---
    try:
        fields = extract_fields(texto_ocr=texto_ocr, api_key=api_key)
    except Exception as e:
        return {
            "archivo": archivo,
            "estado": "error",
            "etapa": "gemini",
            "error": f"{type(e).__name__}: {str(e)}",
            "confianza_ocr": ocr_result.get("confianza_promedio"),
            "texto_ocr": texto_ocr
        }

    # --- RESULTADO ---
    fields["archivo"] = archivo
    fields["estado"] = "procesado"
    fields["confianza_ocr"] = ocr_result.get("confianza_promedio")

    return fields


# ---------------------------------------------------------------------------
# PROCESAMIENTO POR LOTE
# ---------------------------------------------------------------------------

def process_batch(
    image_paths: list,
    gpu: bool = False,
    api_key: str = None
) -> list:
    """Procesa múltiples imágenes."""
    results = []
    total = len(image_paths)

    for idx, path in enumerate(image_paths, 1):
        nombre = os.path.basename(path)
        print(f"  [{idx}/{total}] {nombre}...", file=sys.stderr)

        start = time.time()
        result = process_image(path, gpu=gpu, api_key=api_key)
        elapsed = time.time() - start

        result["tiempo_procesamiento"] = round(elapsed, 2)
        results.append(result)

        print(f"           → {result['estado']} ({elapsed:.1f}s)",
              file=sys.stderr)

    return results


# ---------------------------------------------------------------------------
# RESUMEN
# ---------------------------------------------------------------------------

def print_summary(results: list):
    """Imprime resumen en stderr."""
    print("\n" + "=" * 60, file=sys.stderr)
    print("  RESUMEN DEL PIPELINE OCR + GEMINI", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    for r in results:
        archivo = r.get("archivo", "?")
        estado = r.get("estado", "?")
        tiempo = r.get("tiempo_procesamiento", 0)

        if estado == "procesado":
            confianza = r.get("confianza_ocr", 0)
            campos = [
                "numero_carta", "fecha", "cliente", "direccion_cliente",
                "distrito", "nis", "nia", "tipo_notificacion", "anexo",
                "numero_acta", "fecha_muestra", "numero_informe"
            ]
            ok = sum(1 for c in campos if r.get(c) is not None)
            vma = r.get("parametros_vma") or []
            anexo = r.get("anexo", "?")

            print(f"\n  ✓ {archivo}  ({tiempo}s)", file=sys.stderr)
            print(f"    Tipo: {anexo}", file=sys.stderr)
            print(f"    Confianza OCR: {confianza:.1%}", file=sys.stderr)
            print(f"    Campos extraídos: {ok}/{len(campos)}", file=sys.stderr)
            print(f"    Parámetros VMA: {len(vma)} detectados", file=sys.stderr)
        else:
            etapa = r.get("etapa", "?")
            error = r.get("error", "?")
            print(f"\n  ✗ {archivo}  (error en {etapa})", file=sys.stderr)
            print(f"    {error}", file=sys.stderr)

    total = len(results)
    ok = sum(1 for r in results if r["estado"] == "procesado")
    print(f"\n  Total: {ok}/{total} procesados", file=sys.stderr)
    print("=" * 60 + "\n", file=sys.stderr)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Pipeline OCR + IA: Imagen → Texto → Campos estructurados"
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
        help="Usar GPU para OCR"
    )
    parser.add_argument(
        "--api-key", metavar="KEY",
        help="API key de Gemini (o usar GEMINI_API_KEY en .env)"
    )
    parser.add_argument(
        "-o", "--output", metavar="ARCHIVO",
        help="Guardar JSON en archivo"
    )

    args = parser.parse_args()

    # Resolver imágenes
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

    print(f"\n Pipeline OCR + Gemini", file=sys.stderr)
    print(f" {len(paths)} imagen(es) a procesar\n", file=sys.stderr)

    results = process_batch(paths, gpu=args.gpu, api_key=args.api_key)
    print_summary(results)

    # Salida JSON (sin texto_ocr para mantener limpio)
    clean_results = []
    for r in results:
        clean = {k: v for k, v in r.items() if k != "texto_ocr"}
        clean_results.append(clean)

    output = json.dumps(clean_results, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Guardado en: {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()