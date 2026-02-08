import io
import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from datetime import datetime
import base64

LOGO_URL = "https://customer-assets.emergentagent.com/job_audit-pay-track/artifacts/ha0eypok_ICONO-NEGATIVO--SIN-FONDO.png"
COMPANY_COLOR = colors.HexColor("#002D54")

def format_currency(value: float) -> str:
    """Format value as Colombian Peso style"""
    return f"${value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def get_month_name(month: int) -> str:
    months = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    }
    return months.get(month, "")

def generate_qr_code(data: str) -> io.BytesIO:
    """Generate QR code as image buffer"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer

def generate_payment_pdf(
    payment_id: str,
    verification_code: str,
    concept: str,
    month: int,
    year: int,
    budgeted_value: float,
    paid_value: float,
    difference: float,
    payment_date: str,
    payment_method: str,
    registered_by: str,
    observations: str = None
) -> bytes:
    """Generate payment receipt PDF with QR code and visual signature"""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=COMPANY_COLOR,
        alignment=TA_CENTER,
        spaceAfter=20,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.gray,
        alignment=TA_CENTER,
        spaceAfter=30
    )
    
    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.gray,
        fontName='Helvetica-Bold'
    )
    
    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.black,
        fontName='Helvetica'
    )
    
    money_style = ParagraphStyle(
        'Money',
        parent=styles['Normal'],
        fontSize=14,
        textColor=COMPANY_COLOR,
        fontName='Courier-Bold'
    )
    
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.gray,
        alignment=TA_CENTER
    )
    
    elements = []
    
    # Header
    elements.append(Paragraph("COMPROBANTE DE PAGO", title_style))
    elements.append(Paragraph(f"Sistema de Control Presupuestal", subtitle_style))
    
    # Verification code box
    verification_data = [
        [Paragraph("<b>CÓDIGO DE VERIFICACIÓN</b>", ParagraphStyle('', alignment=TA_CENTER, textColor=colors.white, fontSize=10))],
        [Paragraph(f"<b>{verification_code}</b>", ParagraphStyle('', alignment=TA_CENTER, fontSize=12, fontName='Courier-Bold'))]
    ]
    verification_table = Table(verification_data, colWidths=[3*inch])
    verification_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COMPANY_COLOR),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#F8F9FA")),
        ('BOX', (0, 0), (-1, -1), 1, COMPANY_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(verification_table)
    elements.append(Spacer(1, 20))
    
    # Payment details
    month_name = get_month_name(month)
    diff_text = format_currency(abs(difference))
    if difference > 0:
        diff_status = f"{diff_text} (Pagado de menos)"
        diff_color = colors.HexColor("#F59E0B")
    elif difference < 0:
        diff_status = f"{diff_text} (Pagado de más)"
        diff_color = colors.HexColor("#3B82F6")
    else:
        diff_status = "Sin diferencia"
        diff_color = colors.HexColor("#10B981")
    
    details_data = [
        ["PERÍODO", f"{month_name} {year}"],
        ["CONCEPTO", concept],
        ["VALOR PRESUPUESTADO", format_currency(budgeted_value)],
        ["VALOR PAGADO", format_currency(paid_value)],
        ["DIFERENCIA", diff_status],
        ["FECHA DE PAGO", payment_date],
        ["MÉTODO DE PAGO", payment_method],
        ["REGISTRADO POR", registered_by],
    ]
    
    if observations:
        details_data.append(["OBSERVACIONES", observations])
    
    details_table = Table(details_data, colWidths=[2.2*inch, 4.3*inch])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (1, 2), (1, 3), 'Courier-Bold'),  # Money values
        ('TEXTCOLOR', (1, 4), (1, 4), diff_color),  # Difference color
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 30))
    
    # QR Code and Signature section
    qr_data = f"PAGO:{payment_id}|COD:{verification_code}|FECHA:{payment_date}|VALOR:{paid_value}"
    qr_buffer = generate_qr_code(qr_data)
    qr_image = Image(qr_buffer, width=1.2*inch, height=1.2*inch)
    
    # Signature placeholder
    signature_text = f"""
    <b>FIRMA ELECTRÓNICA DEL SISTEMA</b><br/>
    <font size="8" color="gray">
    Documento generado electrónicamente<br/>
    Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}<br/>
    ID: {payment_id[:8]}
    </font>
    """
    
    footer_data = [
        [
            qr_image,
            Paragraph(signature_text, ParagraphStyle('', alignment=TA_CENTER, fontSize=10))
        ]
    ]
    footer_table = Table(footer_data, colWidths=[2*inch, 4.5*inch])
    footer_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(footer_table)
    elements.append(Spacer(1, 20))
    
    # Footer disclaimer
    elements.append(Paragraph(
        "Este documento es un comprobante oficial generado por el Sistema de Control Presupuestal. "
        "Escanee el código QR para verificar la autenticidad del documento.",
        footer_style
    ))
    
    doc.build(elements)
    return buffer.getvalue()

def generate_monthly_report_pdf(
    month: int,
    year: int,
    budgets: list,
    total_budgeted: float,
    total_executed: float,
    execution_percentage: float
) -> bytes:
    """Generate monthly budget report PDF"""
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.5*inch,
        leftMargin=0.5*inch,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=COMPANY_COLOR,
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName='Helvetica-Bold'
    )
    
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.gray,
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    elements = []
    
    month_name = get_month_name(month)
    elements.append(Paragraph("REPORTE MENSUAL DE PRESUPUESTO", title_style))
    elements.append(Paragraph(f"{month_name} {year}", subtitle_style))
    
    # Summary KPIs
    summary_data = [
        ["Total Presupuestado", "Total Ejecutado", "% Ejecución", "Diferencia"],
        [
            format_currency(total_budgeted),
            format_currency(total_executed),
            f"{execution_percentage:.1f}%",
            format_currency(total_budgeted - total_executed)
        ]
    ]
    summary_table = Table(summary_data, colWidths=[1.7*inch, 1.7*inch, 1.5*inch, 1.6*inch])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), COMPANY_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor("#F8F9FA")),
        ('FONTNAME', (0, 1), (-1, 1), 'Courier-Bold'),
        ('FONTSIZE', (0, 1), (-1, 1), 10),
        ('BOX', (0, 0), (-1, -1), 1, COMPANY_COLOR),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 20))
    
    # Detail table
    if budgets:
        header = ["Concepto", "Tipo", "Presupuestado", "Ejecutado", "Diferencia", "Estado"]
        table_data = [header]
        
        for b in budgets:
            status_map = {
                "pendiente": "Pendiente",
                "pagado": "Pagado",
                "pagado_con_diferencia": "Con Diferencia",
                "vencido": "Vencido"
            }
            table_data.append([
                b.get("concept", "")[:25],
                b.get("expense_type", "").capitalize(),
                format_currency(b.get("budgeted_value", 0)),
                format_currency(b.get("executed_value", 0)),
                format_currency(b.get("difference", 0)),
                status_map.get(b.get("payment_status", ""), "")
            ])
        
        detail_table = Table(table_data, colWidths=[1.8*inch, 0.8*inch, 1.2*inch, 1.2*inch, 1*inch, 1*inch])
        
        style_commands = [
            ('BACKGROUND', (0, 0), (-1, 0), COMPANY_COLOR),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('FONTNAME', (2, 1), (4, -1), 'Courier'),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('ALIGN', (2, 0), (-1, -1), 'RIGHT'),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]
        
        # Color rows by status
        for i, row in enumerate(table_data[1:], start=1):
            status = row[5]
            if status == "Vencido":
                style_commands.append(('BACKGROUND', (5, i), (5, i), colors.HexColor("#FEE2E2")))
            elif status == "Pagado":
                style_commands.append(('BACKGROUND', (5, i), (5, i), colors.HexColor("#D1FAE5")))
            elif status == "Con Diferencia":
                style_commands.append(('BACKGROUND', (5, i), (5, i), colors.HexColor("#FEF3C7")))
        
        detail_table.setStyle(TableStyle(style_commands))
        elements.append(detail_table)
    
    elements.append(Spacer(1, 20))
    
    # Footer
    footer_style = ParagraphStyle('Footer', fontSize=8, textColor=colors.gray, alignment=TA_CENTER)
    elements.append(Paragraph(
        f"Reporte generado el {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} - Sistema de Control Presupuestal",
        footer_style
    ))
    
    doc.build(elements)
    return buffer.getvalue()
