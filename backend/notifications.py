import os
import httpx
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
import logging

logger = logging.getLogger(__name__)

TEXTMEBOT_API_KEY = os.environ.get("TEXTMEBOT_API_KEY", "")
SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.office365.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")

async def send_whatsapp_message(phone_number: str, message: str) -> dict:
    """
    Send WhatsApp message using TextMeBot API
    """
    if not TEXTMEBOT_API_KEY:
        logger.warning("TextMeBot API key not configured")
        return {"success": False, "error": "API key not configured"}
    
    try:
        # Format phone number (remove + if present, ensure no spaces)
        formatted_phone = phone_number.replace("+", "").replace(" ", "").replace("-", "")
        
        url = "https://api.textmebot.com/send.php"
        params = {
            "recipient": formatted_phone,
            "apikey": TEXTMEBOT_API_KEY,
            "text": message
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                logger.info(f"WhatsApp message sent to {phone_number}")
                return {"success": True, "response": response.text}
            else:
                logger.error(f"WhatsApp send failed: {response.status_code} - {response.text}")
                return {"success": False, "error": response.text}
                
    except Exception as e:
        logger.error(f"WhatsApp send error: {str(e)}")
        return {"success": False, "error": str(e)}

async def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    attachment_data: bytes = None,
    attachment_filename: str = None
) -> dict:
    """
    Send email using SMTP Office 365
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured")
        return {"success": False, "error": "SMTP credentials not configured"}
    
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = to_email
        msg["Subject"] = subject
        
        # Add HTML content
        msg.attach(MIMEText(html_content, "html", "utf-8"))
        
        # Add attachment if provided
        if attachment_data and attachment_filename:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment_data)
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename={attachment_filename}"
            )
            msg.attach(part)
        
        # Send email
        await aiosmtplib.send(
            msg,
            hostname=SMTP_SERVER,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=True
        )
        
        logger.info(f"Email sent to {to_email}")
        return {"success": True}
        
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return {"success": False, "error": str(e)}

def format_currency(value: float) -> str:
    """Format value as Colombian Peso style"""
    return f"${value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def get_month_name(month: int) -> str:
    """Get Spanish month name"""
    months = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    }
    return months.get(month, "")

async def send_budget_reminder(
    phone: str,
    email: str,
    concept: str,
    month: int,
    year: int,
    budgeted_value: float,
    due_date: str,
    status: str
) -> dict:
    """Send budget reminder via WhatsApp and/or Email"""
    month_name = get_month_name(month)
    formatted_value = format_currency(budgeted_value)
    
    # WhatsApp message
    whatsapp_msg = f"""📋 *RECORDATORIO DE GASTO PRESUPUESTAL*

📅 Período: {month_name} {year}
📝 Concepto: {concept}
💰 Valor Presupuestado: {formatted_value}
📆 Fecha Límite: {due_date}
🔔 Estado: {status.upper()}

Por favor, registre el pago correspondiente en el sistema.

_Sistema de Control Presupuestal_"""

    # Email HTML
    email_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #002D54; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Recordatorio de Gasto Presupuestal</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Período:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">{month_name} {year}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Concepto:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">{concept}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Valor Presupuestado:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 16px;">{formatted_value}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Fecha Límite:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">{due_date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px;"><strong>Estado:</strong></td>
                        <td style="padding: 10px; color: {'#EF4444' if status == 'vencido' else '#F59E0B'};">{status.upper()}</td>
                    </tr>
                </table>
                <p style="margin-top: 20px; color: #666;">Por favor, registre el pago correspondiente en el sistema.</p>
            </div>
            <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666;">
                Sistema de Control Presupuestal
            </div>
        </div>
    </body>
    </html>
    """
    
    results = {"whatsapp": None, "email": None}
    
    if phone:
        results["whatsapp"] = await send_whatsapp_message(phone, whatsapp_msg)
    
    if email:
        results["email"] = await send_email(
            email,
            f"Recordatorio: {concept} - {month_name} {year}",
            email_html
        )
    
    return results

async def send_payment_notification(
    phone: str,
    email: str,
    concept: str,
    month: int,
    year: int,
    budgeted_value: float,
    paid_value: float,
    difference: float,
    payment_date: str,
    pdf_data: bytes = None
) -> dict:
    """Send payment confirmation via WhatsApp and/or Email"""
    month_name = get_month_name(month)
    formatted_budgeted = format_currency(budgeted_value)
    formatted_paid = format_currency(paid_value)
    formatted_diff = format_currency(abs(difference))
    
    diff_text = ""
    if difference > 0:
        diff_text = f"⚠️ Pagado de menos: {formatted_diff}"
    elif difference < 0:
        diff_text = f"ℹ️ Pagado de más: {formatted_diff}"
    else:
        diff_text = "✅ Monto exacto"
    
    # WhatsApp message
    whatsapp_msg = f"""✅ *PAGO REGISTRADO*

📅 Período: {month_name} {year}
📝 Concepto: {concept}
💰 Valor Presupuestado: {formatted_budgeted}
💵 Valor Pagado: {formatted_paid}
📊 Diferencia: {diff_text}
📆 Fecha de Pago: {payment_date}

_Sistema de Control Presupuestal_"""

    # Email HTML
    diff_color = "#10B981" if difference == 0 else "#F59E0B" if difference > 0 else "#3B82F6"
    email_html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #002D54; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Pago Registrado</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Período:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">{month_name} {year}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Concepto:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">{concept}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Valor Presupuestado:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">{formatted_budgeted}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Valor Pagado:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; font-family: monospace;">{formatted_paid}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Diferencia:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; color: {diff_color};">{formatted_diff}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px;"><strong>Fecha de Pago:</strong></td>
                        <td style="padding: 10px;">{payment_date}</td>
                    </tr>
                </table>
            </div>
            <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666;">
                Sistema de Control Presupuestal
            </div>
        </div>
    </body>
    </html>
    """
    
    results = {"whatsapp": None, "email": None}
    
    if phone:
        results["whatsapp"] = await send_whatsapp_message(phone, whatsapp_msg)
    
    if email:
        results["email"] = await send_email(
            email,
            f"Pago Registrado: {concept} - {month_name} {year}",
            email_html,
            pdf_data,
            f"comprobante_{concept.replace(' ', '_')}_{month}_{year}.pdf" if pdf_data else None
        )
    
    return results
