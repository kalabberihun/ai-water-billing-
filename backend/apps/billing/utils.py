import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.units import inch

def generate_invoice_pdf(bill):
    """Generates a professional PDF invoice for a given Bill object."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Custom styles
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor("#3b82f6"),
        spaceAfter=12
    )
    
    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.grey,
        bold=True
    )
    
    value_style = ParagraphStyle(
        'ValueStyle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.black,
        spaceAfter=6
    )

    elements = []

    # --- Header ---
    elements.append(Paragraph("AI Water Billing", header_style))
    elements.append(Paragraph("Official Tax Invoice", styles['Heading4']))
    elements.append(Spacer(1, 0.2 * inch))
    
    # --- Bill Info & Customer Info ---
    bill_info = [
        [Paragraph(f"<b>BILL TO:</b>", label_style), Paragraph(f"<b>INVOICE DETAILS:</b>", label_style)],
        [Paragraph(f"{bill.customer.user.first_name} {bill.customer.user.last_name}", value_style), Paragraph(f"Invoice ID: {str(bill.id)[:8]}", value_style)],
        [Paragraph(f"{bill.customer.city or 'N/A'}", value_style), Paragraph(f"Date: {bill.created_at.strftime('%b %d, %Y')}", value_style)],
        [Paragraph(f"Phone: {bill.customer.phone}", value_style), Paragraph(f"Due Date: {bill.due_date.strftime('%b %d, %Y')}", value_style)],
    ]
    
    info_table = Table(bill_info, colWidths=[3.5 * inch, 3.5 * inch])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.4 * inch))

    # --- Items Table ---
    # Calculate average price per unit from actual bill data
    avg_price = (bill.subtotal / bill.consumption) if bill.consumption > 0 else 0
    
    data = [
        ['Description', 'Units', 'Reading Info', 'Price/Unit', 'Subtotal'],
        ['Water Consumption', f"{bill.consumption} m³", f"({bill.previous_reading} to {bill.current_reading})", f"ETB {avg_price:,.2f}", f"ETB {bill.subtotal:,.2f}"],
    ]
    
    t = Table(data, colWidths=[2.5*inch, 1*inch, 1.5*inch, 1*inch, 1.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f8fafc")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#64748b")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (-1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor("#e2e8f0")),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 10),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3 * inch))

    # --- Totals Section ---
    totals_data = [
        ['', 'Subtotal:', f"ETB {bill.subtotal:,.2f}"],
        ['', f'Tax ({bill.tax_rate*100:.0f}%):', f"ETB {bill.tax_amount:,.2f}"],
        ['', 'Penalty:', f"ETB {bill.penalty:,.2f}"],
        ['', Paragraph('<b>TOTAL AMOUNT:</b>', styles['Normal']), Paragraph(f'<b>ETB {bill.total_amount:,.2f}</b>', styles['Normal'])],
    ]
    
    totals_table = Table(totals_data, colWidths=[4*inch, 1.5*inch, 1.5*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TEXTCOLOR', (1, 3), (2, 3), colors.HexColor("#3b82f6")),
    ]))
    elements.append(totals_table)
    
    elements.append(Spacer(1, 1 * inch))
    
    # --- Footer ---
    footer_text = "Thank you for your business. Please pay by the due date to avoid service interruption."
    elements.append(Paragraph(footer_text, styles['Italic']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer
