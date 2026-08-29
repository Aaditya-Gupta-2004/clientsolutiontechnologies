import os
from pathlib import Path
from fpdf import FPDF
from datetime import datetime
from config import get_settings

settings = get_settings()
STORAGE = Path(settings.storage_path)
(STORAGE / "invoices").mkdir(parents=True, exist_ok=True)


def clean_text(text: str) -> str:
    """Sanitize unicode characters for standard FPDF core fonts."""
    if not text:
        return ""
    replacements = {
        "—": "-",
        "–": "-",
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
        "₹": "INR ",
        "•": "-",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text.encode("latin-1", "replace").decode("latin-1")


class InvoicePDF(FPDF):
    def header(self):
        # Header with SOLUSHAN logo wordmark + TECHNOLOGIES
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(161, 15, 43)  # Burgundy Red
        self.cell(5, 8, "S", align="L")
        self.set_text_color(20, 25, 40)   # Dark Black
        self.cell(32, 8, "OLUSHAN", align="L")
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(79, 142, 247)
        self.cell(45, 8, "TECHNOLOGIES", align="L")
        
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(79, 142, 247)
        self.cell(0, 8, "TAX INVOICE", align="R", new_x="LMARGIN", new_y="NEXT")
        
        self.set_draw_color(225, 230, 240)
        self.set_line_width(0.5)
        self.line(10, self.get_y() + 2, 200, self.get_y() + 2)
        self.ln(6)

    def footer(self):
        self.set_y(-20)
        self.set_draw_color(225, 230, 240)
        self.line(10, self.get_y(), 200, self.get_y())
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(140, 145, 160)
        self.cell(100, 8, "Solution Technologies | Software & IT Services | Confidential", align="L")
        self.cell(0, 8, f"Page {self.page_no()}", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 7.5)
        self.cell(0, 4, "Thank you for your business. For queries, contact support@solutiontechnologies.com", align="C")


def generate_invoice_pdf(payment) -> str:
    invoice_filename = f"invoice_INV_{payment.id:04d}.pdf"
    file_path = STORAGE / "invoices" / invoice_filename
    
    pdf = InvoicePDF()
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_page()
    
    # Invoice Meta Box & Dates
    inv_num = f"INV-2026-{payment.id:04d}"
    created_str = payment.created_at.strftime("%d %b %Y") if payment.created_at else datetime.now().strftime("%d %b %Y")
    due_str = payment.due_date.strftime("%d %b %Y") if payment.due_date else "Upon Receipt"
    paid_str = payment.paid_at.strftime("%d %b %Y, %H:%M UTC") if payment.paid_at else None
    
    # Status Banner
    is_paid = payment.status.value == "paid"
    if is_paid:
        pdf.set_fill_color(240, 253, 244)
        pdf.set_draw_color(34, 197, 94)
        pdf.set_text_color(22, 101, 52)
        status_text = clean_text(f"STATUS: PAID IN FULL  (Settled: {paid_str})")
    else:
        pdf.set_fill_color(254, 243, 199)
        pdf.set_draw_color(245, 158, 11)
        pdf.set_text_color(180, 83, 9)
        status_text = clean_text(f"STATUS: PAYMENT PENDING  (Due Date: {due_str})")
        
    pdf.rect(10, pdf.get_y(), 190, 14, "DF")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_y(pdf.get_y() + 3.5)
    pdf.cell(0, 7, status_text, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    
    # Left & Right Info Columns
    y_start = pdf.get_y()
    
    # Billed By
    pdf.set_xy(10, y_start)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(100, 110, 130)
    pdf.cell(90, 5, "BILLED BY:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(20, 25, 40)
    pdf.cell(90, 5, "Solution Technologies", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(80, 85, 100)
    pdf.cell(90, 4.5, "Software Engineering & IT Consulting Services", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(90, 4.5, "Email: contact@solutiontechnologies.com", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(90, 4.5, "Website: https://solutiontechnologies.com", new_x="LMARGIN", new_y="NEXT")
    
    # Billed To
    pdf.set_xy(110, y_start)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(100, 110, 130)
    pdf.cell(90, 5, "BILLED TO (CLIENT):", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(20, 25, 40)
    client_name = clean_text(payment.client.name if payment.client else "Client")
    client_email = clean_text(payment.client.email if payment.client else "N/A")
    client_comp = clean_text(payment.client.company if payment.client and payment.client.company else "Direct Client")
    pdf.cell(90, 5, client_name, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(80, 85, 100)
    pdf.cell(90, 4.5, f"Company: {client_comp}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(90, 4.5, f"Email: {client_email}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(90, 4.5, f"Invoice #: {inv_num}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(90, 4.5, f"Invoice Date: {created_str}", new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(10)
    
    # Table Header
    pdf.set_fill_color(240, 244, 255)
    pdf.set_draw_color(210, 220, 240)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(30, 40, 70)
    pdf.cell(15, 8, "Item", 1, 0, "C", fill=True)
    pdf.cell(105, 8, "Description / Service Deliverable", 1, 0, "L", fill=True)
    pdf.cell(30, 8, "Currency", 1, 0, "C", fill=True)
    pdf.cell(40, 8, "Amount", 1, 1, "R", fill=True)
    
    # Table Body
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(40, 45, 60)
    pdf.cell(15, 10, "01", 1, 0, "C")
    
    desc = clean_text(payment.title)
    if payment.description:
        desc += f" - {clean_text(payment.description)}"
    if len(desc) > 60:
        desc = desc[:57] + "..."
        
    curr = (payment.currency or "inr").upper()
    prefix = "INR " if curr == "INR" else "EUR " if curr == "EUR" else "GBP " if curr == "GBP" else "$"

    pdf.cell(105, 10, desc, 1, 0, "L")
    pdf.cell(30, 10, curr, 1, 0, "C")
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(40, 10, f"{prefix}{payment.amount:,.2f}", 1, 1, "R")
    
    # Subtotal & Total
    pdf.set_fill_color(248, 250, 255)
    pdf.cell(120, 8, "", 0, 0)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.cell(30, 8, "Subtotal:", 1, 0, "R", fill=True)
    pdf.cell(40, 8, f"{prefix}{payment.amount:,.2f}", 1, 1, "R", fill=True)
    
    pdf.cell(120, 8, "", 0, 0)
    pdf.cell(30, 8, "Taxes / GST:", 1, 0, "R", fill=True)
    pdf.cell(40, 8, f"{prefix}0.00", 1, 1, "R", fill=True)
    
    pdf.set_fill_color(235, 242, 255)
    pdf.cell(120, 10, "", 0, 0)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(79, 142, 247)
    pdf.cell(30, 10, "Total Due:", 1, 0, "R", fill=True)
    pdf.cell(40, 10, f"{prefix}{payment.amount:,.2f} {curr}", 1, 1, "R", fill=True)
    
    pdf.ln(12)
    
    # Payment Instructions Box
    pdf.set_draw_color(220, 225, 235)
    pdf.set_fill_color(250, 252, 255)
    pdf.rect(10, pdf.get_y(), 190, 32, "DF")
    pdf.set_y(pdf.get_y() + 3)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(20, 30, 60)
    pdf.cell(0, 5, "PAYMENT INSTRUCTIONS & TERMS:", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(70, 75, 90)
    pdf.cell(0, 4.5, "1. Payments can be settled directly in the Solution Technologies Project Portal.", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4.5, "2. For queries regarding milestone deliverables, contact your assigned Project Manager at Solution Technologies.", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 4.5, "3. This invoice constitutes an official tax and payment receipt under Technology Services Agreement.", new_x="LMARGIN", new_y="NEXT")
    
    pdf.output(str(file_path))
    return str(file_path)
