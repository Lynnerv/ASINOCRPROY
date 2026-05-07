"""
Módulo de extracción de campos mediante Gemini API.

Recibe el texto crudo del OCR y utiliza Gemini (LLM) para identificar
y extraer los campos estructurados de la carta de notificación.

Justificación técnica (para la tesis):
    Se separan las responsabilidades del pipeline en dos etapas:
    1. OCR (EasyOCR): Digitalización del documento → texto plano.
    2. LLM (Gemini): Comprensión semántica → datos estructurados.

    Esta separación permite:
    - Evaluar independientemente la calidad del OCR vs la del LLM.
    - Sustituir el motor OCR sin afectar la lógica de extracción.
    - Manejar variaciones en formato, errores OCR y ruido textual
      sin necesidad de expresiones regulares frágiles.

Reglas de negocio aplicadas:
    - RN-08: Los datos se conservan tal como aparecen en el documento.
    - RN-09: Si un dato no es identificable, se devuelve como null.
    - RN-10: No se infiere, completa ni corrige datos faltantes.

Dependencias:
    pip install google-generativeai python-dotenv
"""

import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()

# ---------------------------------------------------------------------------
# CONFIGURACIÓN
# ---------------------------------------------------------------------------

# Modelo recomendado: gemini-2.0-flash (rápido, económico, suficiente
# para extracción de campos de texto estructurado)
DEFAULT_MODEL = "gemini-2.5-flash"

# Prompt del sistema: define el comportamiento del LLM
SYSTEM_PROMPT = """Eres un sistema de extracción de datos que procesa texto OCR de cartas de notificación de SEDAPAL (Servicio de Agua Potable y Alcantarillado de Lima).

Tu ÚNICA tarea es extraer campos específicos del texto proporcionado y devolverlos en formato JSON.

CONTEXTO DEL DOMINIO:
Existen dos tipos de cartas según el D.S. N° 010-2019-VIVIENDA:
- Anexo 1: "Notificación de cobro adicional por exceso de concentración". La carta tiene sufijo (F). La tabla muestra filas por parámetro con columnas: Parámetro Excedido, Unidad de Medida, VMA Normado, Resultado Valor. Ejemplos de parámetros: DBO5, DQO, SST, AYG, entre otros.
- Anexo 2: "Notificación Preventiva del Proceso de Suspensión Temporal del Servicio de agua potable y alcantarillado sanitario". La carta tiene sufijo (C). La tabla muestra columnas por parámetro con filas: Unidad de medida, Expresión, Valor VMA, Valor Excedido. Los parámetros varían según el caso (pueden ser Manganeso, pH, Nitrógeno Amoniacal, Sulfuros, Cromo, Plomo, Cianuro, u OTROS no listados aquí). Debes extraer TODOS los parámetros que aparezcan en la tabla, sin importar cuáles sean.

REGLAS ESTRICTAS:
1. Si un campo no se puede identificar en el texto, devuelve null para ese campo.
2. NUNCA inventes, infieras ni completes datos que no estén presentes en el texto.
3. Ignora el ruido del OCR (logos, firmas digitales, sellos de certificación AENOR, encabezados repetidos, texto de sidebar, marcas de agua como "CARGO").
4. Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown, sin explicaciones.
5. CORRECCIÓN DE ERRORES OCR: El texto proviene de un motor OCR que comete errores de reconocimiento. Para los siguientes campos, DEBES corregir errores evidentes del OCR y devolver el valor correcto del documento original:
   - Nombres de parámetros VMA: Usa siempre la nomenclatura técnica correcta:
     * "Demanda Bioquímica de Oxígeno (DBO5)" (no "DBOsE", "DBOs", "DBO5E", etc.)
     * "Demanda Química de Oxígeno (DQO)" (no "DQo", "DO0", "DQ0", etc.)
     * "Sólidos Suspendidos Totales (SST)" (no "SSI", "Sólidos_Suspendidos", etc.)
     * "Aceites y Grasas (AYG)" (no "Aceites Grasas", etc.)
     * Para parámetros de Anexo 2, corregir igualmente si el nombre está distorsionado.
   - Unidades de medida: Siempre "mg/L" (no "mqIL", "mqL", "mgIL", "ma/t", "mgLL", etc.) o "Unidad" para pH.
   - Distrito: Corregir errores evidentes (ejemplo: "Uma" → "Lima", "Urnna" → "Lima").
   - Nombre del cliente: Corregir solo errores evidentes de OCR, como "S.AC" → "S.A.C."
   - Número de carta: Usar siempre el formato correcto XXXX-YYYY-EEC-AR (corregir "EFC-AR" → "EEC-AR", "EECAR" → "EEC-AR", espacios innecesarios, etc.)
   IMPORTANTE: Esta corrección aplica SOLO a errores evidentes del OCR. No modifiques datos que sean correctos. No inventes datos que no existan en el texto."""

# Prompt del usuario: template con instrucciones de extracción
USER_PROMPT_TEMPLATE = """Extrae los siguientes campos del texto OCR de esta carta de notificación de SEDAPAL.

CAMPOS A EXTRAER:
- numero_carta: Número de carta (formato: XXXX-YYYY-EEC-AR, ejemplo: "1628-2025-EEC-AR")
- fecha: Fecha de la carta (ejemplo: "09 de octubre de 2025")
- cliente: Nombre o razón social del destinatario (aparece después de "Señores" o "Señor" o "Señora"). No incluir la dirección ni el distrito.
- direccion_cliente: Dirección del destinatario. Se ubica en la línea inmediatamente posterior al nombre del cliente, antes del distrito. Comienza típicamente con "Jr.", "Av.", "Calle", "Mz.", etc. Incluye número, urbanización, etc. Ignora texto basura del OCR (como "AENOR") que pueda aparecer intercalado.
- distrito: Distrito del destinatario. Se ubica en la línea posterior a la dirección, antes del campo "Asunto". Ejemplos: "Lima (Cercado)", "Ate", "San Juan de Lurigancho", "Miraflores".
- nis: Número Interno de Suministro de agua (solo dígitos)
- nia: Número de Identificación del Alcantarillado (solo dígitos)
- tipo_notificacion: Tipo de notificación según el campo Asunto. Valores posibles:
    - "Cobro adicional por exceso de concentración" (Anexo 1)
    - "Suspensión Temporal del Servicio de agua potable y alcantarillado sanitario" (Anexo 2)
- anexo: Indica de qué anexo se trata según el tipo de notificación:
    - "Anexo 1" si es cobro adicional por exceso de concentración
    - "Anexo 2" si es notificación preventiva de suspensión temporal
- numero_acta: Número del acta de toma de muestra (ejemplo: "042185")
- fecha_muestra: Fecha de la toma de muestra (ejemplo: "28/08/2025")
- numero_informe: Número del informe de ensayo del laboratorio (ejemplo: "93257")
- parametros_vma: Lista de TODOS los parámetros VMA excedidos que aparezcan en la tabla del documento, sin importar cuáles sean. Cada parámetro debe tener:
    - parametro: Nombre del parámetro tal como aparece en el documento (ejemplos: "Demanda Bioquímica de Oxígeno (DBO5)", "Manganeso Total", "pH", "Sulfuros", o cualquier otro)
    - unidad: Unidad de medida (ejemplo: "mg/L", "Unidad")
    - expresion: Expresión del parámetro si está disponible (ejemplo: "Mn", "N-NH3", "S", "pH"). Poner null si no aparece (las cartas Anexo 1 normalmente no tienen este campo).
    - vma_normado: Valor máximo admisible normado (ejemplo: "500", "4", "6-9")
    - resultado_valor: Resultado obtenido en el ensayo / valor excedido (ejemplo: "816.8", "4.0888", "5.56")

FORMATO DE RESPUESTA (JSON):
{{
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
        {{
            "parametro": "string",
            "unidad": "string",
            "expresion": "string o null",
            "vma_normado": "string",
            "resultado_valor": "string"
        }}
    ] o null
}}

TEXTO OCR:
{texto_ocr}"""


# ---------------------------------------------------------------------------
# INICIALIZACIÓN
# ---------------------------------------------------------------------------

def _configure_api(api_key: str = None):
    """
    Configura la API de Gemini con la key proporcionada.

    Orden de búsqueda de la API key:
        1. Parámetro api_key
        2. Variable de entorno GEMINI_API_KEY
    """
    key = api_key or os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError(
            "API key de Gemini no encontrada. "
            "Configúrala como variable de entorno GEMINI_API_KEY "
            "o en un archivo .env en la carpeta del proyecto."
        )
    genai.configure(api_key=key)


# ---------------------------------------------------------------------------
# EXTRACCIÓN
# ---------------------------------------------------------------------------

def extract_fields(
    texto_ocr: str,
    api_key: str = None,
    model_name: str = DEFAULT_MODEL
) -> dict:
    """
    Envía el texto OCR a Gemini y obtiene los campos estructurados.

    Args:
        texto_ocr: Texto completo extraído por OCR del documento.
        api_key: API key de Gemini (opcional si está en env).
        model_name: Nombre del modelo de Gemini a utilizar.

    Returns:
        Diccionario con los campos extraídos.
        Campos no identificados se devuelven como null.

    Raises:
        ValueError: Si no hay API key configurada.
        Exception: Si la llamada a Gemini falla.
    """
    _configure_api(api_key)

    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.0,  # Determinístico: misma entrada → misma salida
        ),
    )

    user_prompt = USER_PROMPT_TEMPLATE.format(texto_ocr=texto_ocr)

    response = model.generate_content(user_prompt)

    # Parsear la respuesta JSON
    raw_text = response.text.strip()

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        # Intentar limpiar markdown si Gemini lo agrega
        cleaned = raw_text
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()
        result = json.loads(cleaned)

    return result


def extract_fields_batch(
    textos_ocr: list,
    api_key: str = None,
    model_name: str = DEFAULT_MODEL
) -> list:
    """
    Procesa múltiples textos OCR.

    Args:
        textos_ocr: Lista de diccionarios con al menos
                    {"archivo": str, "texto": str}.
        api_key: API key de Gemini.
        model_name: Modelo de Gemini.

    Returns:
        Lista de diccionarios con campos extraídos por documento.
    """
    results = []
    for item in textos_ocr:
        archivo = item.get("archivo", "desconocido")
        texto = item.get("texto", "")

        if not texto:
            results.append({
                "archivo": archivo,
                "estado": "error",
                "error": "Texto OCR vacío"
            })
            continue

        try:
            fields = extract_fields(
                texto_ocr=texto,
                api_key=api_key,
                model_name=model_name
            )
            fields["archivo"] = archivo
            fields["estado"] = "procesado"
            results.append(fields)
        except Exception as e:
            results.append({
                "archivo": archivo,
                "estado": "error",
                "error": f"{type(e).__name__}: {str(e)}"
            })

    return results