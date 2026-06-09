import pdfplumber
import io
import re
from typing import Optional


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract and clean text from a PDF file.
    Uses pdfplumber for accurate text extraction with layout awareness.
    """
    text_parts = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages):
            # Extract text with layout preservation
            page_text = page.extract_text(
                x_tolerance=3,
                y_tolerance=3,
                layout=True,
                x_density=7.25,
                y_density=13,
            )
            if page_text:
                text_parts.append(f"[Page {page_num + 1}]\n{page_text}")

            # Also extract tables if any
            tables = page.extract_tables()
            for table in tables:
                if table:
                    table_text = "\n".join(
                        " | ".join(str(cell) if cell else "" for cell in row)
                        for row in table
                        if any(cell for cell in row)
                    )
                    if table_text.strip():
                        text_parts.append(f"[Table]\n{table_text}")

    raw_text = "\n\n".join(text_parts)
    return clean_text(raw_text)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from a .docx file (paragraphs + table cells)."""
    from docx import Document  # imported lazily so the dep is only needed when used

    doc = Document(io.BytesIO(file_bytes))
    parts = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text and c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    return clean_text("\n".join(parts))


def clean_text(text: str) -> str:
    """Clean and normalize extracted text."""
    # Remove excessive whitespace while preserving structure
    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
        line = line.strip()
        # Skip lines with only special chars or very short noise
        if len(line) > 1 or line.isalnum():
            cleaned_lines.append(line)

    # Collapse multiple blank lines into one
    result = "\n".join(cleaned_lines)
    result = re.sub(r"\n{3,}", "\n\n", result)
    result = re.sub(r" {2,}", " ", result)

    return result.strip()


def extract_cv_metadata(text: str) -> dict:
    """
    Try to extract basic metadata from CV text for display purposes.
    Not used for scoring — just for UI enrichment.
    """
    metadata = {
        "email": None,
        "phone": None,
        "estimated_pages": text.count("[Page"),
    }

    # Email
    email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    emails = re.findall(email_pattern, text)
    if emails:
        metadata["email"] = emails[0]

    # Phone (French format)
    phone_pattern = r"(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}"
    phones = re.findall(phone_pattern, text)
    if phones:
        metadata["phone"] = phones[0]

    return metadata
