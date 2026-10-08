#!/usr/bin/env python3
"""
Generates demo_document.pdf for Acme Technologies — Employee Rules & Workplace Handbook.
A realistic 7-page company policy PDF with clean professional typography,
page numbers, running headers/footers, and distinct sections designed for RAG evaluation.
"""

import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and draw total page count
    along with running header and footer on pages 2..N.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        # Skip decorative header/footer on cover page (Page 1)
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))  # Slate grey

        # Running Header
        self.drawString(54, 750, "Acme Technologies — Employee Rules & Workplace Handbook (v2.1)")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(54, 744, 558, 744)

        # Running Footer
        self.line(54, 46, 558, 46)
        self.drawString(54, 34, "Internal & Confidential — For Acme Technologies Employees Only")
        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(558, 34, page_str)

        self.restoreState()


def create_demo_pdf(filename: str = "demo_document.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=30,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=12,
    )

    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=13,
        leading=18,
        textColor=colors.HexColor("#334155"),
        spaceAfter=24,
    )

    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569"),
    )

    meta_val = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#0F172A"),
    )

    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#1E293B"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=7,
    )

    bullet_style = ParagraphStyle(
        "Bullet_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#334155"),
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    story = []

    # =========================================================================
    # PAGE 1: TITLE & COVER INFORMATION
    # =========================================================================
    story.append(Spacer(1, 80))
    story.append(Paragraph("Acme Technologies", ParagraphStyle(
        "CompanyBrand", fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=colors.HexColor("#2563EB")
    )))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Employee Rules & Workplace Handbook", title_style))
    story.append(Paragraph("Comprehensive Internal Operating Guidelines, Employment Policies, and Professional Workplace Standards", subtitle_style))
    story.append(Spacer(1, 40))

    meta_data = [
        [Paragraph("Document Title:", meta_label), Paragraph("Employee Rules & Workplace Handbook", meta_val)],
        [Paragraph("Document Identifier:", meta_label), Paragraph("ACME-HR-POL-2026-v2.1", meta_val)],
        [Paragraph("Version Number:", meta_label), Paragraph("Version 2.1", meta_val)],
        [Paragraph("Effective Date:", meta_label), Paragraph("January 15, 2026", meta_val)],
        [Paragraph("Document Owner:", meta_label), Paragraph("Department of Human Resources & Corporate Compliance", meta_val)],
        [Paragraph("Approved By:", meta_label), Paragraph("Executive Leadership & Legal Operations Committee", meta_val)],
        [Paragraph("Classification:", meta_label), Paragraph("Internal Company Document — Restricted Distribution", meta_val)],
    ]
    meta_table = Table(meta_data, colWidths=[140, 364])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 40))
    story.append(Paragraph("Handbook Purpose & Scope", h2_style))
    story.append(Paragraph(
        "This employee handbook sets forth the operational policies, behavioral expectations, and procedural requirements governing all personnel employed by Acme Technologies. It is intended to foster a transparent, respectful, compliant, and productive work environment across all office facilities and remote work locations. Every employee, whether full-time, part-time, or fixed-term contractor, is required to read, understand, and comply with all policies outlined herein.",
        body_style
    ))
    story.append(Paragraph(
        "Failure to adhere to company policies may result in disciplinary action up to and including termination of employment. Inquiries regarding the interpretation or application of any provision in this handbook should be directed to Human Resources.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 2: 1. WORKING HOURS & ATTENDANCE
    # =========================================================================
    story.append(Paragraph("1. Working Hours & Attendance Policy", h1_style))
    story.append(Paragraph(
        "Acme Technologies maintains defined operational hours to ensure predictable customer support, synchronous team collaboration, and fair workload distribution across departments.",
        body_style
    ))

    story.append(Paragraph("1.1 Standard Working Hours & Workweek", h2_style))
    story.append(Paragraph(
        "Standard working hours are strictly from 9:00 AM to 6:00 PM, Monday to Friday. The standard workweek comprises five consecutive business days, totaling 40 working hours per week, excluding designated meal breaks.",
        body_style
    ))

    story.append(Paragraph("1.2 Lunch Break & Rest Intervals", h2_style))
    story.append(Paragraph(
        "A designated lunch break is observed daily from 1:00 PM to 2:00 PM. Employees are encouraged to fully step away from their workstations during this one-hour interval. Short refreshment breaks of up to 15 minutes during morning and afternoon periods are permitted, provided operational duties remain attended.",
        body_style
    ))

    story.append(Paragraph("1.3 Core Collaboration Hours", h2_style))
    story.append(Paragraph(
        "To enable effective cross-functional coordination, standups, and client engagements, all staff—including remote employees—must observe Core Collaboration Hours from 10:00 AM to 4:00 PM. Synchronous team meetings, project reviews, and mandatory company town halls must be scheduled strictly within this window.",
        body_style
    ))

    story.append(Paragraph("1.4 Tardiness & Delay Notification Protocol", h2_style))
    story.append(Paragraph(
        "Employees are expected to be at their workstations and logged into company systems by 9:00 AM. In the event of unforeseen personal delays or transit disruptions, employees should inform their manager before 9:15 AM via the designated team messaging channel or email. Persistent unexcused delays exceeding three occurrences per calendar month will result in a formal attendance review.",
        body_style
    ))

    story.append(Paragraph("1.5 Remote Employee Attendance & Availability", h2_style))
    story.append(Paragraph(
        "Remote employees must remain available and responsive on approved corporate communication tools throughout standard working hours. An active online status on team messaging platforms is required during core hours, and any absence from the workstation exceeding 30 minutes outside the official lunch break requires prior notification to the immediate supervisor.",
        body_style
    ))

    story.append(Paragraph("1.6 Overtime & Extended Hours", h2_style))
    story.append(Paragraph(
        "Overtime work is strictly voluntary and must receive written pre-authorization from the department head. Eligible non-exempt team members performing authorized overtime beyond 45 hours in a single business week will receive compensatory time off or standard statutory compensation in accordance with local employment laws.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 3: 2. LEAVE POLICY
    # =========================================================================
    story.append(Paragraph("2. Comprehensive Leave Policy", h1_style))
    story.append(Paragraph(
        "Acme Technologies recognizes the importance of rest, personal health, and work-life harmony. The company provides paid leave allowances governed by fair administrative standards.",
        body_style
    ))

    story.append(Paragraph("2.1 Casual Leave Allowance", h2_style))
    story.append(Paragraph(
        "All permanent employees are entitled to 12 days of Casual Leave per calendar year. Casual leave is intended for short personal obligations, family events, and routine personal administration. For employees joining mid-year, casual leave is credited on a pro-rata basis of one day per completed month of service.",
        body_style
    ))

    story.append(Paragraph("2.2 Sick Leave Allowance & Medical Reporting", h2_style))
    story.append(Paragraph(
        "Employees are entitled to 10 days of Sick Leave per calendar year for illness, medical appointments, or recovery. Emergency sick leave should be reported to the manager as soon as practical on the morning of absence, and no later than 10:00 AM. For sick leave absences exceeding two consecutive working days, a formal medical practitioner certificate must be uploaded to the HR portal upon resumption of duties.",
        body_style
    ))

    story.append(Paragraph("2.3 Planned Leave Advance Notice", h2_style))
    story.append(Paragraph(
        "To ensure business continuity and uninterrupted client service, employees should submit planned leave at least 2 working days in advance through the employee self-service portal. For extended leaves exceeding four continuous business days, a minimum of two weeks of advance written notification to the reporting manager is mandatory.",
        body_style
    ))

    story.append(Paragraph("2.4 Year-End Expiration & Non-Encashment", h2_style))
    story.append(Paragraph(
        "Unused casual leave expires at the end of the calendar year on December 31. Casual leave cannot be encashed, accumulated across calendar years, or carried forward into the subsequent calendar year. Sick leave balances may be carried forward up to a statutory ceiling of 15 cumulative days, but remain strictly non-encashable upon resignation or contract termination.",
        body_style
    ))

    story.append(Paragraph("2.5 Public Holidays & Compensatory Off", h2_style))
    story.append(Paragraph(
        "The company publishes an official schedule of 10 paid statutory public holidays at the beginning of each calendar year. Employees required to perform critical maintenance or on-call duties on an official public holiday will receive one day of compensatory off, which must be utilized within 60 calendar days of accrual.",
        body_style
    ))

    story.append(Paragraph("2.6 Unpaid Leave of Absence", h2_style))
    story.append(Paragraph(
        "In extraordinary circumstances where all accrued paid leave balances have been exhausted, an employee may request an unpaid leave of absence of up to 30 days. Such requests require concurrent approval from the Department Vice President and the Head of Human Resources.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 4: 3. INFORMATION SECURITY
    # =========================================================================
    story.append(Paragraph("3. Information Security & Data Governance", h1_style))
    story.append(Paragraph(
        "Information security is a paramount corporate commitment at Acme Technologies. Safeguarding enterprise systems, confidential client intellectual property, and proprietary source code requires strict employee compliance.",
        body_style
    ))

    story.append(Paragraph("3.1 Corporate Account Usage Mandate", h2_style))
    story.append(Paragraph(
        "Employees must use company-managed accounts for company work exclusively. Conducting official business, transmitting company code, or communicating with clients using personal email accounts, personal instant messaging apps, or personal telephone numbers is strictly prohibited.",
        body_style
    ))

    story.append(Paragraph("3.2 Password Confidentiality & Credential Hygiene", h2_style))
    story.append(Paragraph(
        "Passwords must never be shared under any circumstances, even among close team members or supervisors. Passwords must consist of a minimum of 14 characters including alphanumeric characters and symbols, must not be recorded on sticky notes or unencrypted files, and must be rotated every 90 days in accordance with identity management policies.",
        body_style
    ))

    story.append(Paragraph("3.3 Mandatory Multi-Factor Authentication (MFA)", h2_style))
    story.append(Paragraph(
        "Multi-Factor Authentication (MFA) is required for company systems, including email, source repositories, cloud infrastructure, internal databases, and remote VPN gateways. Employees must register an approved hardware security key or authenticator application and may not bypass MFA via unauthorized session tokens.",
        body_style
    ))

    story.append(Paragraph("3.4 Workstation Physical Security & Screen Lock", h2_style))
    story.append(Paragraph(
        "Company laptops must use screen lock when unattended. Whenever an employee steps away from their laptop in either corporate offices, co-working spaces, or public venues, they must immediately lock the operating system using standard shortcuts (e.g., Win+L or Cmd+Ctrl+Q). Workstations automatically lock after 5 minutes of inactivity.",
        body_style
    ))

    story.append(Paragraph("3.5 Cloud Storage & Data Transfer Restrictions", h2_style))
    story.append(Paragraph(
        "Confidential files must not be uploaded to personal cloud storage such as Google Drive, Dropbox, iCloud, or personal GitHub repositories. USB flash drives, unapproved external storage drives, and unauthorized peer-to-peer file transfer utilities are blocked on all enterprise endpoints.",
        body_style
    ))

    story.append(Paragraph("3.6 Security Incident Reporting Procedure", h2_style))
    story.append(Paragraph(
        "Security incidents, suspected phishing emails, malware alerts, lost laptops, or potential data leaks must be reported to IT Security immediately via security@acme-tech.internal or the 24/7 internal emergency hotline. Prompt reporting within one hour of detection is crucial to contain threats and preserve audit forensics.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 5: 4. WORKPLACE CONDUCT & PROFESSIONALISM
    # =========================================================================
    story.append(Paragraph("4. Workplace Conduct & Professionalism", h1_style))
    story.append(Paragraph(
        "Acme Technologies is dedicated to maintaining an inclusive, collaborative, and dignified environment where all employees can perform their best work without intimidation or disruption.",
        body_style
    ))

    story.append(Paragraph("4.1 Respectful Communication Standards", h2_style))
    story.append(Paragraph(
        "Employees must communicate respectfully in all verbal exchanges, written communications, code reviews, and digital chat channels. Constructive feedback should focus on technical and business deliverables rather than personal attributes. Abusive language, derogatory remarks, and aggressive behavior are zero-tolerance violations.",
        body_style
    ))

    story.append(Paragraph("4.2 Anti-Harassment & Non-Discrimination Policy", h2_style))
    story.append(Paragraph(
        "Harassment and discrimination are prohibited across all operations. The company strictly forbids discrimination or harassment based on race, gender, religion, age, sexual orientation, disability, nationality, or any legally protected characteristic. Retaliation against any employee reporting a good-faith concern is subject to immediate disciplinary termination.",
        body_style
    ))

    story.append(Paragraph("4.3 Meeting Discipline & Time Management", h2_style))
    story.append(Paragraph(
        "Meetings should start and end on time. Meeting organizers are required to circulate a clear written agenda at least two hours prior to the call, limit attendance to essential contributors, and conclude discussions five minutes prior to the scheduled ending time to permit transitions between sessions.",
        body_style
    ))

    story.append(Paragraph("4.4 Clean Desk & Shared Workspace Maintenance", h2_style))
    story.append(Paragraph(
        "Employees should keep shared workspaces reasonably clean. Conference rooms, kitchen facilities, phone booths, and shared hot-desking stations must be tidied after use. No sensitive papers, whiteboards with architecture diagrams, or confidential documents may be left exposed in public office areas overnight.",
        body_style
    ))

    story.append(Paragraph("4.5 Dispute & Grievance Resolution Escalation", h2_style))
    story.append(Paragraph(
        "Conflicts should first be raised with the relevant manager or HR. If an employee experiences an interpersonal disagreement or managerial impasse, they are encouraged to initiate an informal dialogue. If unresolved, a formal written grievance may be filed with the Employee Relations Division for impartial investigation.",
        body_style
    ))

    story.append(Paragraph("4.6 Substance Abuse & Workplace Safety", h2_style))
    story.append(Paragraph(
        "The possession, sale, or consumption of alcohol, illegal narcotics, or unprescribed controlled substances on company premises or during business activities is strictly forbidden. Employees must follow all posted emergency evacuation guidelines, fire safety drills, and building access protocols.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 6: 5. EQUIPMENT & EXPENSE RULES
    # =========================================================================
    story.append(Paragraph("5. Equipment Usage & Expense Reimbursement Rules", h1_style))
    story.append(Paragraph(
        "Corporate physical assets, IT hardware, and financial resources are entrusted to employees to accomplish organizational objectives under accountable stewardship.",
        body_style
    ))

    story.append(Paragraph("5.1 Company Hardware Provisioning & Usage Limits", h2_style))
    story.append(Paragraph(
        "Company laptops are provided for authorized business use. Hardware assets remain the exclusive property of Acme Technologies at all times and must be returned upon cessation of employment. Installation of unauthorized software, operating system modifications, or disabling device management profiles is prohibited.",
        body_style
    ))

    story.append(Paragraph("5.2 Damaged Equipment Reporting Deadline", h2_style))
    story.append(Paragraph(
        "Employees must report damaged equipment within 1 business day to the IT Asset Helpdesk. In the event of accidental liquid damage, physical breakage, hardware malfunction, or loss, an official incident ticket must be logged immediately so that loaner equipment can be dispatched and enterprise warranty repairs initiated.",
        body_style
    ))

    story.append(Paragraph("5.3 Business Travel Expense Submission Deadline", h2_style))
    story.append(Paragraph(
        "Business travel expenses must be submitted within 10 calendar days of journey completion through the corporate expense management portal. Submissions must include itemized tax invoices, original boarding passes, and receipts. Expense claims filed beyond 30 calendar days will be rejected automatically.",
        body_style
    ))

    story.append(Paragraph("5.4 Expense Pre-Approval Threshold (₹10,000 Rule)", h2_style))
    story.append(Paragraph(
        "Expenses above ₹10,000 require manager approval before purchase. Any single purchase, software license, client hospitality, training program, or hardware accessory that exceeds ₹10,000 without prior written purchase authorization from an authorized budget holder will not be reimbursed by corporate finance.",
        body_style
    ))

    story.append(Paragraph("5.5 Non-Reimbursable Personal Purchases", h2_style))
    story.append(Paragraph(
        "Personal purchases are not reimbursable unless explicitly approved in writing by the Chief Financial Officer. Non-allowable expenses include personal clothing, minibar charges, traffic citations, entertainment streaming subscriptions, and personal travel extensions.",
        body_style
    ))

    story.append(Paragraph("5.6 Asset Inventory Audits", h2_style))
    story.append(Paragraph(
        "The IT Logistics department conducts bi-annual hardware audits. Employees must confirm their assigned serial numbers via the online asset verification tool within five business days of receiving the audit notification.",
        body_style
    ))
    story.append(PageBreak())

    # =========================================================================
    # PAGE 7: 6. REMOTE WORK & GENERAL POLICIES & DOCUMENT CONTROL
    # =========================================================================
    story.append(Paragraph("6. Remote Work & General Administrative Policies", h1_style))
    story.append(Paragraph(
        "Flexible working arrangements require shared trust, operational discipline, and continuous compliance with corporate standards.",
        body_style
    ))

    story.append(Paragraph("6.1 Remote Work Eligibility & Approval", h2_style))
    story.append(Paragraph(
        "Remote work requires manager approval. Eligibility is determined on a role-by-role basis depending on operational dependencies and satisfactory ongoing performance. Management reserves the right to modify or revoke remote working arrangements with two weeks of advance notice.",
        body_style
    ))

    story.append(Paragraph("6.2 Ergonomic & Home Workspace Standards", h2_style))
    story.append(Paragraph(
        "Employees working remotely must maintain a professional workspace that is quiet, well-lit, ergonomically sound, and free from background distractions. Employees are responsible for maintaining a reliable high-speed broadband internet connection with adequate bandwidth for video calls.",
        body_style
    ))

    story.append(Paragraph("6.3 Approved Communication Platforms", h2_style))
    story.append(Paragraph(
        "Company meetings must use approved communication tools such as the official enterprise video conferencing platform and corporate chat application. Recording internal meetings without prior explicit consent from all active participants is strictly prohibited.",
        body_style
    ))

    story.append(Paragraph("6.4 Continuous Policy Compliance", h2_style))
    story.append(Paragraph(
        "Employees must follow all applicable company security policies regardless of whether they are working on-site, at client offices, or from remote home locations. Physical documents containing customer or company records must be stored under lock and key.",
        body_style
    ))

    story.append(Paragraph("6.5 Policy Inquiries & HR Contacts", h2_style))
    story.append(Paragraph(
        "Questions about these rules should be directed to HR via hr@acme-tech.internal or by booking an appointment through the HR service desk. We welcome feedback and suggestions to improve workplace operations.",
        body_style
    ))

    story.append(Spacer(1, 14))
    story.append(Paragraph("7. Document Control & Revision History", h1_style))

    doc_history = [
        [Paragraph("Version", meta_label), Paragraph("Release Date", meta_label), Paragraph("Author / Dept", meta_label), Paragraph("Summary of Changes", meta_label)],
        [Paragraph("1.0", meta_val), Paragraph("Jan 10, 2024", meta_val), Paragraph("HR Policy Group", meta_val), Paragraph("Initial company handbook release for all personnel.", meta_val)],
        [Paragraph("2.0", meta_val), Paragraph("Jan 12, 2025", meta_val), Paragraph("HR & Legal", meta_val), Paragraph("Added comprehensive remote work guidelines and core hours.", meta_val)],
        [Paragraph("2.1", meta_val), Paragraph("Jan 15, 2026", meta_val), Paragraph("HR & Compliance", meta_val), Paragraph("Updated information security controls, MFA rules, and ₹10,000 expense threshold.", meta_val)],
    ]
    history_table = Table(doc_history, colWidths=[50, 75, 95, 284])
    history_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
    ]))
    story.append(history_table)

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {filename} with 7 pages.")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "demo_document.pdf"
    create_demo_pdf(out_file)
