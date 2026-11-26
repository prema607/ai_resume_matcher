
import io

import pytesseract
from PIL import Image


pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


def extract_text_with_tesseract(image_bytes: bytes) -> str:
    """Extract text from a PDF page image using local Tesseract OCR."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    text = pytesseract.image_to_string(
        image,
        lang="eng",
        config="--psm 6",
    ).strip()

    if not text:
        raise ValueError("Tesseract could not extract text from the image.")

    return text
