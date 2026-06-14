"""
Modulo de extraccion directa por Gemini Vision (fallback).

Se usa cuando EasyOCR excede el tiempo limite en entornos con
recursos limitados. Envia la imagen directamente a Gemini Vision,
que realiza el reconocimiento y la extraccion en un solo paso.

Reutiliza el SYSTEM_PROMPT de gemini_extractor para mantener
consistencia en las reglas de extraccion.
"""

import os
import json
import sys
from google import genai
from google.genai import types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gemini_extractor import SYSTEM_PROMPT, DEFAULT_MODEL

VISION_PROMPT = """Analiza esta imagen de una carta de notificacion VMA de SEDAPAL y extrae los siguientes campos en formato JSON:

- numero_carta, fecha, cliente, direccion_cliente, distrito, nis, nia
- tipo_notificacion, anexo, numero_acta, fecha_muestra, numero_informe
- parametros_vma: lista con parametro, unidad, expresion, vma_normado, resultado_valor

Responde UNICAMENTE con el JSON, sin texto adicional ni markdown.

FORMATO:
{
  "numero_carta": "string o null",
  "fecha": "string o null",
  "cliente": "string o null",
  "direccion_cliente": "string o null",
  "distrito": "string o null",
  "nis": "string o null",
  "nia": "string o null",
  "tipo_notificacion": "string o null",
  "anexo": "string o null",
  "numero_acta": "string o null",
  "fecha_muestra": "string o null",
  "numero_informe": "string o null",
  "parametros_vma": [
    {"parametro": "string", "unidad": "string", "expresion": "string o null", "vma_normado": "string", "resultado_valor": "string"}
  ]
}"""


def extract_from_image(image_path, api_key=None, model_name=DEFAULT_MODEL):
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("API key de Gemini no encontrada")

    client = genai.Client(api_key=key)

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    ext = os.path.splitext(image_path)[1].lower()
    mime = "image/png" if ext == ".png" else "image/jpeg"

    response = client.models.generate_content(
        model=model_name,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
            types.Part.from_text(text=VISION_PROMPT),
        ],
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            temperature=0.0,
        ),
    )

    raw_text = response.text.strip()
    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        cleaned = raw_text
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        result = json.loads(cleaned.strip())

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"estado": "error", "error": "Falta ruta de imagen"}))
        sys.exit(1)

    try:
        fields = extract_from_image(sys.argv[1])
        fields["archivo"] = os.path.basename(sys.argv[1])
        fields["estado"] = "procesado"
        fields["metodo"] = "gemini_vision"
        fields["confianza_ocr"] = None
        print(json.dumps([fields], ensure_ascii=False))
    except Exception as e:
        print(json.dumps([{
            "archivo": os.path.basename(sys.argv[1]),
            "estado": "error",
            "metodo": "gemini_vision",
            "error": f"{type(e).__name__}: {str(e)}"
        }], ensure_ascii=False))
