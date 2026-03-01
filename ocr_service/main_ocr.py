import sys
from PIL import Image
import pytesseract

# Ruta exacta al ejecutable de Tesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
# Si en tu PC está en otra carpeta, pon esa ruta exacta.

def leer_imagen(ruta):
    img = Image.open(ruta)
    texto = pytesseract.image_to_string(img, lang='spa')
    return texto

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python main_ocr.py ruta_imagen")
        sys.exit(1)

    ruta = sys.argv[1]
    texto = leer_imagen(ruta)
    print("===== TEXTO DETECTADO =====")
    print(texto)
