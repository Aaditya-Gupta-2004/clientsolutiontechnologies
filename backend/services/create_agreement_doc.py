import os
import sys
from pathlib import Path
from fpdf import FPDF
from datetime import datetime

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

from database import SessionLocal, engine, Base
import models
from models.document import Document, DocumentStatus
from models.user import User, UserRole


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


class AgreementPDF(FPDF):
    def header(self):
        # Top Header branding
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(30, 40, 70)
        self.cell(80, 8, "SOLUTION TECHNOLOGIES", align="L")
        
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 140)
        self.cell(0, 8, "Agreement No.: ST-2026-001", align="R", new_x="LMARGIN", new_y="NEXT")
        
        self.set_draw_color(220, 225, 235)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(220, 225, 235)
        self.line(10, self.get_y(), 200, self.get_y())
        self.set_font("Helvetica", "", 8)
        self.set_text_color(140, 140, 150)
        self.cell(100, 10, "Solution Technologies | Software Development & Technology Services Agreement", align="L")
        self.cell(0, 10, f"Page {self.page_no()}", align="R", new_x="LMARGIN", new_y="NEXT")


def generate_agreement_pdf(output_path: str, client_name: str = "Client", effective_date: str = None) -> str:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    if not effective_date:
        effective_date = datetime.now().strftime("%d/%m/%Y")
        
    pdf = AgreementPDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()
    
    # Title Box
    pdf.set_fill_color(245, 247, 252)
    pdf.rect(10, pdf.get_y(), 190, 26, "F")
    pdf.set_y(pdf.get_y() + 4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(20, 30, 60)
    pdf.cell(0, 7, "SOFTWARE DEVELOPMENT & TECHNOLOGY SERVICES AGREEMENT", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 110, 130)
    pdf.cell(0, 6, f"Effective Date: {effective_date}  |  Agreement No.: ST-2026-001", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)
    
    def section_title(num, title):
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(79, 142, 247)
        pdf.cell(0, 6, f"{num}. {title.upper()}", new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(230, 235, 245)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(2)

    def body_text(txt):
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(40, 45, 55)
        pdf.multi_cell(0, 4.5, clean_text(txt))
        pdf.ln(2)

    # 1. Parties
    section_title("1", "Parties")
    body_text(
        f"This Agreement is entered into between Solution Technologies (\"Service Provider\"), having its registered technology "
        f"business operations, and {client_name} (\"Client\"), collectively referred to as the \"Parties\"."
    )
    
    # 2. Purpose of Agreement
    section_title("2", "Purpose of Agreement")
    body_text(
        "The purpose of this Agreement is to establish the terms and conditions under which Solution Technologies will provide "
        "software development, web application engineering, API integration, data engineering, automation, consulting, and other "
        "technology-related services as specified in one or more Statements of Work (SOW)."
    )

    # 3. Definitions
    section_title("3", "Definitions")
    body_text(
        "- \"Services\": Software engineering, consulting, and tech tasks described in the applicable SOW.\n"
        "- \"Deliverables\": Source code, applications, documentation, APIs, and configurations delivered to Client.\n"
        "- \"SOW\": Statement of Work detailing specific features, deadlines, milestones, and fees.\n"
        "- \"Client Data\": All materials, credentials, branding, and information supplied by Client.\n"
        "- \"Confidential Information\": Proprietary non-public business, financial, and technical information."
    )

    # 4. Scope of Services & SOW
    section_title("4", "Scope of Services")
    body_text(
        "Specific Services and Deliverables shall be described in applicable Statements of Work. "
        "Each SOW executed by the Parties shall be subject to the terms of this Agreement."
    )

    # 5. Project Timeline & Client Dependencies
    section_title("5", "Project Timeline & Client Dependencies")
    body_text(
        "Project timelines and milestone dates are dependent upon timely receipt of requirements, credentials, third-party accounts, "
        "and feedback from the Client. Delays by the Client in supplying required materials shall adjust delivery schedules accordingly."
    )

    # 6. Fees, Milestone Payments & Terms
    section_title("6", "Fees & Payment Terms")
    body_text(
        "Project fees and billing schedules are set forth in Schedule B. Standard schedule:\n"
        " - 40% Advance upon Project Commencement\n"
        " - 30% Milestone Completion (Development & Backend)\n"
        " - 20% User Acceptance Testing (UAT)\n"
        " - 10% Final Delivery & Deployment\n"
        "Invoices are payable within 15 calendar days. Undisputed unpaid balances may result in temporary suspension of services."
    )

    # 7. Change Requests
    section_title("7", "Change Requests")
    body_text(
        "Any feature, design revision, or integration not specified in the agreed SOW shall be considered a Change Request. "
        "Change Requests will be documented via Schedule C and may incur additional fees and timeline extensions."
    )

    # 8. Acceptance, Bug Fixes & 30-Day Warranty
    section_title("8", "Acceptance & 30-Day Warranty")
    body_text(
        "Client shall review Deliverables within 7 business days of receipt. Deliverables are deemed accepted if no material "
        "non-conformity is reported within this period. Solution Technologies provides a 30-day bug-fix warranty for material defects "
        "after final acceptance, excluding new feature requests or third-party outages."
    )

    # 9. Intellectual Property Rights
    section_title("9", "Intellectual Property Rights")
    body_text(
        "Client retains ownership of all Client Data and pre-existing materials. Solution Technologies retains ownership of reusable "
        "frameworks, generic components, and developer tooling. Upon receipt of full payment, rights and licenses in the custom "
        "Deliverables transfer to Client as specified in the SOW."
    )

    # 10. Third-Party Services & Hosting
    section_title("10", "Third-Party Services & Hosting")
    body_text(
        "Hosting fees, domain registrations, cloud services (AWS, VPS, PostgreSQL), payment processor transaction fees, "
        "and third-party API subscriptions are the responsibility of the Client unless explicitly bundled in the SOW."
    )

    # 11. Confidentiality, Data Protection & Liability
    section_title("11", "Confidentiality & Limitation of Liability")
    body_text(
        "Both Parties agree to maintain strict confidentiality of proprietary data. Neither party shall be liable for indirect, "
        "consequential, or punitive damages. Total aggregate liability under this Agreement shall not exceed the total fees paid under the applicable SOW."
    )

    # 12. Termination & Governing Law
    section_title("12", "Termination & Governing Law")
    body_text(
        "Either Party may terminate with 30 days written notice or immediately upon uncured material breach. "
        "This Agreement shall be governed by and construed in accordance with the Laws of India."
    )

    pdf.ln(4)

    # 13. Execution & Signature Block
    section_title("13", "Execution & Signatures")
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(100, 100, 110)
    pdf.cell(0, 5, "IN WITNESS WHEREOF, the Parties have executed this Agreement digitally as of the date written below.", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)

    # Two columns for signature
    y_sig = pdf.get_y()
    
    # Left box: Service Provider (Founder & CEO Aaditya Gupta)
    pdf.set_draw_color(200, 205, 220)
    pdf.set_fill_color(248, 250, 254)
    pdf.rect(10, y_sig, 92, 45, "DF")
    pdf.set_xy(12, y_sig + 2)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(20, 30, 60)
    pdf.cell(88, 4.5, "SERVICE PROVIDER: Solution Technologies", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(60, 65, 75)
    pdf.cell(88, 4, "Name: Aaditya Gupta", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(88, 4, "Title: Founder & CEO", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(88, 4, f"Date: {effective_date}", new_x="LMARGIN", new_y="NEXT")

    # Embed Founder Signature Image
    founder_sig_path = Path("storage/assets/founder_signature.png")
    if founder_sig_path.exists():
        pdf.image(str(founder_sig_path), x=14, y=y_sig + 19, w=42)
    else:
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_xy(14, y_sig + 22)
        pdf.cell(88, 4, "[Signed by Aaditya Gupta, Founder & CEO]", new_x="LMARGIN", new_y="NEXT")

    # Right box: Client E-Sign Box
    pdf.set_draw_color(79, 142, 247)
    pdf.set_fill_color(244, 248, 255)
    pdf.rect(108, y_sig, 92, 42, "DF")
    pdf.set_xy(110, y_sig + 2)
    pdf.set_font("Helvetica", "B", 8.5)
    pdf.set_text_color(20, 30, 60)
    pdf.cell(88, 5, f"CLIENT: {client_name}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(60, 65, 75)
    pdf.cell(88, 4.5, "Designation: Authorized Signatory", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(88, 4.5, "E-Sign Status: [Awaiting Client Signature]", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(88, 4.5, "Date: ________________________", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(79, 142, 247)
    pdf.cell(88, 5, "Client Digital Signature Field (Sign in Portal)", new_x="LMARGIN", new_y="NEXT")

    # Save PDF
    pdf.output(output_path)
    print(f"Agreement PDF successfully generated: {output_path}")
    return output_path


def seed_agreement_document():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == UserRole.superadmin).first()
        client = db.query(User).filter(User.role == UserRole.client).first()
        
        # If no client, create a demo client
        if not client:
            from services.auth_service import hash_password
            client = User(
                name="Aaditya Sharma",
                email="client@example.com",
                hashed_password=hash_password("Client@1234"),
                role=UserRole.client,
                company="Client Tech Solutions",
                created_by_id=admin.id if admin else None
            )
            db.add(client)
            db.commit()
            db.refresh(client)
            print("Demo client created: client@example.com / Client@1234")

        # Generate agreement PDF
        pdf_path = "storage/documents/software_development_agreement_ST_2026_001.pdf"
        generate_agreement_pdf(pdf_path, client_name=client.name)

        # Check if already added
        existing = db.query(Document).filter(Document.title.like("%Software Development & Technology Services Agreement%")).first()
        if not existing:
            doc = Document(
                title="Software Development & Technology Services Agreement (ST-2026-001)",
                description="Professional Software & Technology Services Agreement with SOW, Payment Schedule, and 30-Day Warranty.",
                file_path=pdf_path,
                created_by_id=admin.id if admin else client.id,
                client_id=client.id,
                status=DocumentStatus.sent,
                sent_at=datetime.utcnow(),
            )
            db.add(doc)
            db.commit()
            print("Agreement Document added to DB with status 'sent' (ready to e-sign)!")
        else:
            existing.title = "Software Development & Technology Services Agreement (ST-2026-001)"
            existing.file_path = pdf_path
            existing.client_id = client.id
            existing.status = DocumentStatus.sent
            db.commit()
            print("Agreement Document updated in DB!")
            
    finally:
        db.close()


if __name__ == "__main__":
    seed_agreement_document()
