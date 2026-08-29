import os
import uuid
import base64
from pathlib import Path
from typing import Optional
from fpdf import FPDF
from PIL import Image, ImageFilter, ImageOps
import io
import pypdf
from datetime import datetime
from config import get_settings

settings = get_settings()
STORAGE = Path(settings.storage_path)
STORAGE.mkdir(parents=True, exist_ok=True)
(STORAGE / "documents").mkdir(exist_ok=True)
(STORAGE / "signed").mkdir(exist_ok=True)


def save_uploaded_pdf(file_bytes: bytes, original_filename: str) -> str:
    """Save an uploaded PDF and return its relative storage path."""
    filename = f"{uuid.uuid4()}_{original_filename}"
    file_path = STORAGE / "documents" / filename
    with open(file_path, "wb") as f:
        f.write(file_bytes)
    return str(file_path)


def create_placeholder_pdf(title: str, description: str = "") -> str:
    """Generate a simple PDF document when no file is uploaded."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_fill_color(30, 30, 60)
    pdf.rect(0, 0, 210, 297, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 20, "", ln=True)
    pdf.cell(0, 20, title, ln=True, align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(200, 200, 220)
    pdf.cell(0, 10, "", ln=True)
    if description:
        pdf.multi_cell(0, 8, description, align="C")
    pdf.cell(0, 30, "", ln=True)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(150, 150, 170)
    pdf.cell(0, 10, "Please review and sign this document.", ln=True, align="C")
    pdf.cell(0, 60, "", ln=True)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "Signature: _______________________________", ln=True, align="C")
    pdf.cell(0, 10, "Date: ___________________", ln=True, align="C")

    filename = f"{uuid.uuid4()}_document.pdf"
    file_path = STORAGE / "documents" / filename
    pdf.output(str(file_path))
    return str(file_path)


def overlay_signature_on_pdf(
    original_path: str,
    signature_b64: str,
    signer_name: str,
    placement: Optional[dict] = None
) -> str:
    """Overlay a base64 signature image onto the PDF using dynamic anchors or visual placement."""
    try:
        if not Path(original_path).exists():
            return original_path

        # Decode and process signature image with universal adaptive background subtraction
        if "," in signature_b64:
            signature_b64 = signature_b64.split(",")[1]
        sig_bytes = base64.b64decode(signature_b64)
        raw_img = Image.open(io.BytesIO(sig_bytes))

        # Check if the image already has transparency (from frontend cutout or drawn signature)
        has_transparency = False
        if raw_img.mode in ('RGBA', 'LA') or (raw_img.mode == 'P' and 'transparency' in raw_img.info):
            # Check if any pixel actually has alpha < 255
            extrema = raw_img.getextrema()
            if len(extrema) == 4 and extrema[3][0] < 255:
                has_transparency = True

        if has_transparency:
            # Frontend already processed it or it's a drawn PNG. Just use it directly!
            sig_image = raw_img.convert("RGBA")
        else:
            # Convert to grayscale and apply Gaussian blur to estimate local paper lighting
            gray = raw_img.convert("L")
            w, h = gray.size
            
            # Adaptive background estimate
            bg_estimate = gray.filter(ImageFilter.GaussianBlur(radius=max(6, min(24, int(min(w, h) / 25)))))
            
            cutout_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            px_g = gray.load()
            px_bg = bg_estimate.load()
            px_c = cutout_img.load()

            for y in range(h):
                for x in range(w):
                    g_val = px_g[x, y]
                    bg_val = px_bg[x, y]
                    diff = int(bg_val) - int(g_val)
                    # True handwritten ink has a sharp local contrast vs surrounding paper
                    if diff > 14:
                        alpha = min(255, max(0, int(diff * 6.5)))
                        px_c[x, y] = (15, 23, 42, alpha)
                    else:
                        px_c[x, y] = (0, 0, 0, 0) # 100% transparent paper & shadow

            sig_image = cutout_img

        # Crop to tight bounding box of ink
        bbox = sig_image.getbbox()
        if bbox:
            sig_image = sig_image.crop(bbox)

        # Save signature as temp PNG
        sig_id = uuid.uuid4().hex
        sig_path = STORAGE / "signed" / f"sig_{sig_id}.png"
        sig_image.save(str(sig_path))

        reader_base = pypdf.PdfReader(str(original_path))
        total_pages = len(reader_base.pages)

        sig_w, sig_h = sig_image.size
        aspect = sig_h / max(1, sig_w)

        # Detect target signature page index
        target_page_idx = None
        is_seven_page_contract = False

        for idx, p in enumerate(reader_base.pages):
            txt = p.extract_text() or ""
            if "CLIENT AUTHORIZED SIGNATORY" in txt or "Click / E-Sign" in txt:
                target_page_idx = idx
                is_seven_page_contract = True
                break

        if target_page_idx is None:
            for idx, p in enumerate(reader_base.pages):
                txt = p.extract_text() or ""
                if "Execution & Signatures" in txt or "EXECUTION & SIGNATURES" in txt or "IN WITNESS WHEREOF" in txt:
                    target_page_idx = idx
                    break

        if target_page_idx is None:
            target_page_idx = total_pages - 1

        mb_target = reader_base.pages[target_page_idx].mediabox
        pw_target = float(mb_target.width)
        ph_target = float(mb_target.height)

        overlay_temp_path_7 = None

        if is_seven_page_contract:
            # Point-based coordinates for 7-page SOLUSHAN contract layout (Page 6)
            # Precisely centered inside the right-side dotted box:
            overlay_pdf = FPDF(unit="pt", format=[pw_target, ph_target])
            overlay_pdf.add_page()
            overlay_pdf.image(str(sig_path), x=340, y=300, w=145)

            # Also stamp Page 7 (Schedule A)
            overlay_pdf_7 = FPDF(unit="pt", format=[pw_target, ph_target])
            overlay_pdf_7.add_page()
            # Client signature line is at y=675 pt (FPDF top-down), x=405 pt on Page 7
            overlay_pdf_7.image(str(sig_path), x=405, y=675, w=110)
            overlay_temp_path_7 = STORAGE / "signed" / f"overlay_p7_{sig_id}.pdf"
            overlay_pdf_7.output(str(overlay_temp_path_7))
        else:
            # Standard mm-based coordinates
            overlay_pdf = FPDF()
            overlay_pdf.add_page()
            target_w = 44
            target_h = min(18, target_w * aspect)
            target_y = 205 + max(0, (18 - target_h) / 2)
            overlay_pdf.image(str(sig_path), x=112, y=target_y, w=target_w)

        overlay_temp_path = STORAGE / "signed" / f"overlay_{sig_id}.pdf"
        overlay_pdf.output(str(overlay_temp_path))

        # Merge with original PDF
        reader_over = pypdf.PdfReader(str(overlay_temp_path))
        reader_over_7 = pypdf.PdfReader(str(overlay_temp_path_7)) if overlay_temp_path_7 else None
        writer = pypdf.PdfWriter()

        for idx, page in enumerate(reader_base.pages):
            if idx == target_page_idx:
                page.merge_page(reader_over.pages[0])
            elif is_seven_page_contract and idx == target_page_idx + 1 and reader_over_7:
                page.merge_page(reader_over_7.pages[0])
            writer.add_page(page)

        signed_filename = f"signed_{sig_id}.pdf"
        signed_path = STORAGE / "signed" / signed_filename
        with open(str(signed_path), "wb") as f_out:
            writer.write(f_out)

        # Cleanup temp files
        sig_path.unlink(missing_ok=True)
        overlay_temp_path.unlink(missing_ok=True)
        if overlay_temp_path_7:
            overlay_temp_path_7.unlink(missing_ok=True)

        return str(signed_path)

    except Exception as e:
        print(f"Error overlaying signature: {e}")
        return original_path


def get_document_url(file_path: str) -> str:
    """Convert absolute file path to a URL-friendly path segment."""
    p = Path(file_path)
    return p.name
