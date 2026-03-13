from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, BackgroundTasks
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import os
import logging
import httpx
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import base64

from models import (
    UserCreate, UserLogin, UserUpdate, UserResponse, TokenResponse, User,
    BudgetCreate, BudgetUpdate, Budget, MonthlyBudget,
    PaymentCreate, Payment,
    AuditLogCreate, AuditLog,
    NotificationConfig, NotificationConfigUpdate,
    DashboardKPI, MonthlyReport
)
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role, get_client_ip
)
from notifications import (
    send_budget_reminder, send_payment_notification,
    send_whatsapp_message, send_email
)
from pdf_generator import generate_payment_pdf, generate_monthly_report_pdf

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Sistema de Control Presupuestal")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== HELPER FUNCTIONS ==============
def clean_mongo_doc(doc: dict) -> dict:
    """Remove MongoDB _id and convert ObjectIds to strings"""
    if doc is None:
        return None
    cleaned = {}
    for key, value in doc.items():
        if key == '_id':
            continue
        if hasattr(value, '__str__') and type(value).__name__ == 'ObjectId':
            cleaned[key] = str(value)
        elif isinstance(value, dict):
            cleaned[key] = clean_mongo_doc(value)
        elif isinstance(value, list):
            cleaned[key] = [clean_mongo_doc(item) if isinstance(item, dict) else item for item in value]
        else:
            cleaned[key] = value
    return cleaned

async def create_audit_log(
    user_id: str, user_name: str, user_email: str,
    action_type: str, entity_type: str, ip_address: str,
    entity_id: str = None, monthly_period: str = None,
    previous_values: dict = None, new_values: dict = None, details: str = None
):
    # Clean any MongoDB ObjectIds from values
    clean_prev = clean_mongo_doc(previous_values) if previous_values else None
    clean_new = clean_mongo_doc(new_values) if new_values else None
    
    audit = AuditLog(
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        monthly_period=monthly_period,
        ip_address=ip_address,
        previous_values=clean_prev,
        new_values=clean_new,
        details=details
    )
    doc = audit.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)

def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")

def generate_monthly_periods(start_date: str, total_months: int) -> list:
    """Generate list of monthly periods from start date"""
    start = parse_date(start_date)
    periods = []
    for i in range(total_months):
        month = (start.month + i - 1) % 12 + 1
        year = start.year + (start.month + i - 1) // 12
        # Due date is last day of month
        if month == 12:
            due_date = datetime(year, 12, 31)
        else:
            due_date = datetime(year, month + 1, 1) - timedelta(days=1)
        periods.append({
            "month": month,
            "year": year,
            "due_date": due_date.strftime("%Y-%m-%d")
        })
    return periods

# ============== AUTH ROUTES ==============
@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate, request: Request):
    # Check if first user (only allow public registration for first user)
    user_count = await db.users.count_documents({})
    if user_count > 0:
        raise HTTPException(status_code=403, detail="El registro público está deshabilitado. Contacte al administrador.")
    
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # First user is always super_admin
    role = "super_admin"
    
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=role,
        is_active=True
    )
    
    doc = user.model_dump()
    doc['password_hash'] = hash_password(user_data.password)
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "role": role,
        "name": user.full_name
    })
    
    await create_audit_log(
        user.id, user.full_name, user.email,
        "crear", "usuario", get_client_ip(request),
        entity_id=user.id, details=f"Registro de usuario: {user.email}"
    )
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            role=role,
            is_active=True,
            created_at=user.created_at
        )
    )

@api_router.get("/auth/check-users")
async def check_users():
    """Check if registration is allowed (only if no users exist)"""
    user_count = await db.users.count_documents({})
    return {"allow_register": user_count == 0, "user_count": user_count}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, request: Request):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    
    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["full_name"]
    })
    
    await create_audit_log(
        user["id"], user["full_name"], user["email"],
        "login", "sesion", get_client_ip(request),
        details=f"Inicio de sesión: {user['email']}"
    )
    
    created_at = user["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            phone=user.get("phone"),
            role=user["role"],
            is_active=user.get("is_active", True),
            created_at=created_at
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    created_at = user["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        phone=user.get("phone"),
        role=user["role"],
        is_active=user.get("is_active", True),
        created_at=created_at
    )

# ============== USER MANAGEMENT ROUTES ==============
@api_router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_role(["super_admin"]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    result = []
    for u in users:
        created_at = u["created_at"]
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        result.append(UserResponse(
            id=u["id"],
            email=u["email"],
            full_name=u["full_name"],
            phone=u.get("phone"),
            role=u["role"],
            is_active=u.get("is_active", True),
            created_at=created_at
        ))
    return result

@api_router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    request: Request,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        is_active=True
    )
    
    doc = user.model_dump()
    doc['password_hash'] = hash_password(user_data.password)
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.users.insert_one(doc)
    
    await create_audit_log(
        current_user["sub"], current_user["name"], current_user["email"],
        "crear", "usuario", get_client_ip(request),
        entity_id=user.id, details=f"Usuario creado: {user.email}"
    )
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        role=user.role,
        is_active=True,
        created_at=user.created_at
    )

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    request: Request,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.users.update_one({"id": user_id}, {"$set": update_dict})
        
        await create_audit_log(
            current_user["sub"], current_user["name"], current_user["email"],
            "editar", "usuario", get_client_ip(request),
            entity_id=user_id, previous_values=user, new_values=update_dict
        )
    
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    created_at = updated_user["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    return UserResponse(
        id=updated_user["id"],
        email=updated_user["email"],
        full_name=updated_user["full_name"],
        phone=updated_user.get("phone"),
        role=updated_user["role"],
        is_active=updated_user.get("is_active", True),
        created_at=created_at
    )

# ============== BUDGET ROUTES ==============
@api_router.post("/budgets", response_model=dict)
async def create_budget(
    budget_data: BudgetCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    # Create main budget
    budget = Budget(
        **budget_data.model_dump(),
        created_by=current_user["sub"]
    )
    
    doc = budget.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.budgets.insert_one(doc)
    
    # Generate monthly periods
    periods = generate_monthly_periods(budget_data.start_date, budget_data.total_months)
    monthly_budgets = []
    
    for period in periods:
        monthly = MonthlyBudget(
            budget_id=budget.id,
            concept=budget_data.concept,
            month=period["month"],
            year=period["year"],
            budgeted_value=budget_data.monthly_value,
            expense_type=budget_data.expense_type,
            responsible_id=budget_data.responsible_id,
            responsible_name=budget_data.responsible_name,
            due_date=period["due_date"]
        )
        monthly_doc = monthly.model_dump()
        monthly_doc['created_at'] = monthly_doc['created_at'].isoformat()
        monthly_doc['updated_at'] = monthly_doc['updated_at'].isoformat()
        monthly_budgets.append(monthly_doc)
    
    if monthly_budgets:
        await db.monthly_budgets.insert_many(monthly_budgets)
    
    await create_audit_log(
        current_user["sub"], current_user["name"], current_user["email"],
        "crear", "presupuesto", get_client_ip(request),
        entity_id=budget.id, new_values=doc,
        details=f"Presupuesto creado: {budget_data.concept} - {budget_data.total_months} meses"
    )
    
    # Send notification if enabled
    config = await db.notification_config.find_one({}, {"_id": 0})
    if config and config.get("notify_on_creation") and config.get("email_enabled"):
        responsible = await db.users.find_one({"id": budget_data.responsible_id}, {"_id": 0})
        if responsible and responsible.get("email"):
            # Queue notification for first month
            first_period = periods[0] if periods else None
            if first_period:
                background_tasks.add_task(
                    send_budget_reminder,
                    responsible.get("phone", ""),
                    responsible.get("email", ""),
                    budget_data.concept,
                    first_period["month"],
                    first_period["year"],
                    budget_data.monthly_value,
                    first_period["due_date"],
                    "pendiente"
                )
    
    return {"id": budget.id, "message": "Presupuesto creado exitosamente", "monthly_periods": len(periods)}

@api_router.get("/budgets", response_model=List[dict])
async def list_budgets(current_user: dict = Depends(get_current_user)):
    budgets = await db.budgets.find({}, {"_id": 0}).to_list(1000)
    for b in budgets:
        if isinstance(b.get('created_at'), str):
            b['created_at'] = datetime.fromisoformat(b['created_at'])
        if isinstance(b.get('updated_at'), str):
            b['updated_at'] = datetime.fromisoformat(b['updated_at'])
    return budgets

@api_router.get("/budgets/{budget_id}", response_model=dict)
async def get_budget(budget_id: str, current_user: dict = Depends(get_current_user)):
    budget = await db.budgets.find_one({"id": budget_id}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return budget

@api_router.put("/budgets/{budget_id}", response_model=dict)
async def update_budget(
    budget_id: str,
    update_data: BudgetUpdate,
    request: Request,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    budget = await db.budgets.find_one({"id": budget_id}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.budgets.update_one({"id": budget_id}, {"$set": update_dict})
        
        # Update monthly budgets if concept or responsible changed
        monthly_updates = {}
        if "concept" in update_dict:
            monthly_updates["concept"] = update_dict["concept"]
        if "responsible_id" in update_dict:
            monthly_updates["responsible_id"] = update_dict["responsible_id"]
        if "responsible_name" in update_dict:
            monthly_updates["responsible_name"] = update_dict["responsible_name"]
        
        if monthly_updates:
            await db.monthly_budgets.update_many(
                {"budget_id": budget_id},
                {"$set": monthly_updates}
            )
        
        await create_audit_log(
            current_user["sub"], current_user["name"], current_user["email"],
            "editar", "presupuesto", get_client_ip(request),
            entity_id=budget_id, previous_values=budget, new_values=update_dict
        )
    
    return {"message": "Presupuesto actualizado exitosamente"}

@api_router.delete("/budgets/{budget_id}")
async def delete_budget(
    budget_id: str,
    request: Request,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    budget = await db.budgets.find_one({"id": budget_id}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    
    # Check if any payments exist
    payments = await db.monthly_budgets.find_one({"budget_id": budget_id, "payment_id": {"$ne": None}})
    if payments:
        raise HTTPException(status_code=400, detail="No se puede eliminar un presupuesto con pagos registrados")
    
    await db.monthly_budgets.delete_many({"budget_id": budget_id})
    await db.budgets.delete_one({"id": budget_id})
    
    await create_audit_log(
        current_user["sub"], current_user["name"], current_user["email"],
        "eliminar", "presupuesto", get_client_ip(request),
        entity_id=budget_id, previous_values=budget,
        details=f"Presupuesto eliminado: {budget.get('concept')}"
    )
    
    return {"message": "Presupuesto eliminado exitosamente"}

# ============== MONTHLY BUDGET ROUTES ==============
@api_router.get("/monthly-budgets", response_model=List[dict])
async def list_monthly_budgets(
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    if status:
        query["payment_status"] = status
    
    # Update overdue status
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.monthly_budgets.update_many(
        {"due_date": {"$lt": today}, "payment_status": "pendiente"},
        {"$set": {"payment_status": "vencido"}}
    )
    
    budgets = await db.monthly_budgets.find(query, {"_id": 0}).sort([("year", 1), ("month", 1)]).to_list(1000)
    return budgets

@api_router.get("/monthly-budgets/{monthly_id}", response_model=dict)
async def get_monthly_budget(monthly_id: str, current_user: dict = Depends(get_current_user)):
    budget = await db.monthly_budgets.find_one({"id": monthly_id}, {"_id": 0})
    if not budget:
        raise HTTPException(status_code=404, detail="Presupuesto mensual no encontrado")
    return budget

# ============== PAYMENT ROUTES ==============
@api_router.post("/payments", response_model=dict)
async def create_payment(
    payment_data: PaymentCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    # Get monthly budget
    monthly = await db.monthly_budgets.find_one({"id": payment_data.monthly_budget_id}, {"_id": 0})
    if not monthly:
        raise HTTPException(status_code=404, detail="Presupuesto mensual no encontrado")
    
    if monthly.get("payment_id"):
        raise HTTPException(status_code=400, detail="Ya existe un pago registrado para este período")
    
    # Calculate difference
    difference = monthly["budgeted_value"] - payment_data.paid_value
    
    # Determine payment status
    if difference == 0:
        payment_status = "pagado"
    else:
        payment_status = "pagado_con_diferencia"
    
    # Create payment
    payment = Payment(
        monthly_budget_id=payment_data.monthly_budget_id,
        budget_id=monthly["budget_id"],
        concept=monthly["concept"],
        month=monthly["month"],
        year=monthly["year"],
        budgeted_value=monthly["budgeted_value"],
        paid_value=payment_data.paid_value,
        difference=difference,
        payment_date=payment_data.payment_date,
        payment_method=payment_data.payment_method,
        observations=payment_data.observations,
        support_file_name=payment_data.support_file_name,
        support_file_url=payment_data.support_file_url,
        registered_by=current_user["sub"],
        registered_by_name=current_user["name"]
    )
    
    # Generate PDF
    pdf_data = generate_payment_pdf(
        payment.id,
        payment.verification_code,
        payment.concept,
        payment.month,
        payment.year,
        payment.budgeted_value,
        payment.paid_value,
        payment.difference,
        payment.payment_date,
        payment.payment_method,
        payment.registered_by_name,
        payment.observations
    )
    
    # Store PDF as base64
    pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
    payment.pdf_url = f"data:application/pdf;base64,{pdf_base64}"
    
    payment_doc = payment.model_dump()
    payment_doc['created_at'] = payment_doc['created_at'].isoformat()
    
    await db.payments.insert_one(payment_doc)
    
    # Update monthly budget
    await db.monthly_budgets.update_one(
        {"id": payment_data.monthly_budget_id},
        {"$set": {
            "payment_id": payment.id,
            "executed_value": payment_data.paid_value,
            "difference": difference,
            "payment_status": payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await create_audit_log(
        current_user["sub"], current_user["name"], current_user["email"],
        "pagar", "pago", get_client_ip(request),
        entity_id=payment.id,
        monthly_period=f"{monthly['month']:02d}/{monthly['year']}",
        new_values={"concept": payment.concept, "paid_value": payment.paid_value, "difference": difference}
    )
    
    # ============== NOTIFICAR A TALENTO HUMANO SI PROVIENE DE UNA CUENTA DE COBRO ==============
    th_payment_id = monthly.get("th_payment_id")
    th_notified = False
    if th_payment_id:
        # Este pago proviene de una cuenta de cobro de TH, notificar automáticamente
        background_tasks.add_task(
            notify_th_payment_completed,
            th_payment_id,
            payment.id,
            payment.pdf_url,
            payment.payment_date,
            payment.paid_value,
            payment.payment_method,
            payment.verification_code
        )
        th_notified = True
        
        # Marcar como notificado (se actualizará en la tarea de fondo)
        await db.payments.update_one(
            {"id": payment.id},
            {"$set": {
                "th_payment_id": th_payment_id,
                "th_notification_scheduled": True
            }}
        )
        
        logger.info(f"Notificación a TH programada para pago {payment.id} -> TH payment {th_payment_id}")
    # ========================================================================================
    
    # Send notification if enabled
    config = await db.notification_config.find_one({}, {"_id": 0})
    if config and config.get("notify_on_payment"):
        responsible = await db.users.find_one({"id": monthly["responsible_id"]}, {"_id": 0})
        if responsible:
            phone = responsible.get("phone", "") if config.get("whatsapp_enabled") else ""
            email = responsible.get("email", "") if config.get("email_enabled") else ""
            
            if phone or email:
                background_tasks.add_task(
                    send_payment_notification,
                    phone,
                    email,
                    payment.concept,
                    payment.month,
                    payment.year,
                    payment.budgeted_value,
                    payment.paid_value,
                    payment.difference,
                    payment.payment_date,
                    pdf_data if email else None
                )
    
    return {
        "id": payment.id,
        "verification_code": payment.verification_code,
        "message": "Pago registrado exitosamente",
        "pdf_url": payment.pdf_url,
        "th_notification_scheduled": th_notified,
        "th_payment_id": th_payment_id if th_notified else None
    }

# Función auxiliar para notificar a TH automáticamente
async def notify_th_payment_completed(
    th_payment_id: str,
    payment_id: str,
    pdf_url: str,
    payment_date: str,
    paid_value: float,
    payment_method: str,
    verification_code: str
):
    """Notifica automáticamente al sistema de TH cuando se completa un pago de cuenta de cobro"""
    try:
        webhook_data = {
            "source": "presupuesto",
            "event_type": "payment_support_uploaded",
            "payment_id": th_payment_id,
            "support_file_url": pdf_url,
            "support_file_name": f"comprobante_{payment_id}.pdf",
            "payment_date": payment_date,
            "paid_value": paid_value,
            "payment_method": payment_method,
            "verification_code": verification_code
        }
        
        logger.info(f"Notificando automáticamente a TH: {webhook_data}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://th.academiajotuns.com/api/webhook/presupuesto",
                json=webhook_data
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Notificación a TH exitosa para pago {th_payment_id}")
                return True
            else:
                logger.error(f"Error notificando a TH: {response.status_code}")
                return False
    except Exception as e:
        logger.error(f"Error al notificar a TH: {e}")
        return False

@api_router.get("/payments", response_model=List[dict])
async def list_payments(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    payments = await db.payments.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return payments

@api_router.get("/payments/{payment_id}", response_model=dict)
async def get_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return payment

@api_router.get("/payments/{payment_id}/pdf")
async def get_payment_pdf(payment_id: str, current_user: dict = Depends(get_current_user)):
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    # Regenerate PDF
    pdf_data = generate_payment_pdf(
        payment["id"],
        payment["verification_code"],
        payment["concept"],
        payment["month"],
        payment["year"],
        payment["budgeted_value"],
        payment["paid_value"],
        payment["difference"],
        payment["payment_date"],
        payment["payment_method"],
        payment["registered_by_name"],
        payment.get("observations")
    )
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=comprobante_{payment_id}.pdf"}
    )

# ============== DASHBOARD ROUTES ==============
@api_router.get("/dashboard/kpi", response_model=DashboardKPI)
async def get_dashboard_kpi(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    # Update overdue status
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.monthly_budgets.update_many(
        {"due_date": {"$lt": today}, "payment_status": "pendiente"},
        {"$set": {"payment_status": "vencido"}}
    )
    
    query = {}
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    budgets = await db.monthly_budgets.find(query, {"_id": 0}).to_list(10000)
    
    total_budgeted = sum(b.get("budgeted_value", 0) for b in budgets)
    total_executed = sum(b.get("executed_value", 0) for b in budgets)
    total_difference = total_budgeted - total_executed
    execution_percentage = (total_executed / total_budgeted * 100) if total_budgeted > 0 else 0
    
    pending_count = sum(1 for b in budgets if b.get("payment_status") == "pendiente")
    paid_count = sum(1 for b in budgets if b.get("payment_status") == "pagado")
    overdue_count = sum(1 for b in budgets if b.get("payment_status") == "vencido")
    with_difference_count = sum(1 for b in budgets if b.get("payment_status") == "pagado_con_diferencia")
    
    return DashboardKPI(
        total_budgeted=total_budgeted,
        total_executed=total_executed,
        execution_percentage=round(execution_percentage, 2),
        total_difference=total_difference,
        pending_count=pending_count,
        paid_count=paid_count,
        overdue_count=overdue_count,
        with_difference_count=with_difference_count
    )

@api_router.get("/dashboard/monthly-summary", response_model=List[MonthlyReport])
async def get_monthly_summary(
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    if not year:
        year = datetime.now().year
    
    pipeline = [
        {"$match": {"year": year}},
        {"$group": {
            "_id": {"month": "$month", "year": "$year"},
            "budgeted": {"$sum": "$budgeted_value"},
            "executed": {"$sum": "$executed_value"}
        }},
        {"$sort": {"_id.month": 1}}
    ]
    
    results = await db.monthly_budgets.aggregate(pipeline).to_list(12)
    
    reports = []
    for r in results:
        budgeted = r.get("budgeted", 0)
        executed = r.get("executed", 0)
        reports.append(MonthlyReport(
            month=r["_id"]["month"],
            year=r["_id"]["year"],
            budgeted=budgeted,
            executed=executed,
            difference=budgeted - executed,
            execution_percentage=round((executed / budgeted * 100) if budgeted > 0 else 0, 2)
        ))
    
    return reports

# ============== AUDIT ROUTES ==============
@api_router.get("/audit-logs")
async def list_audit_logs(
    page: int = 1,
    limit: int = 50,
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    query = {}
    if action_type:
        query["action_type"] = action_type
    if entity_type:
        query["entity_type"] = entity_type
    
    skip = (page - 1) * limit
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    # Clean any ObjectIds from stored data
    cleaned_logs = [clean_mongo_doc(log) for log in logs]
    return cleaned_logs

@api_router.get("/audit-logs/count")
async def count_audit_logs(
    action_type: Optional[str] = None,
    entity_type: Optional[str] = None,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    query = {}
    if action_type:
        query["action_type"] = action_type
    if entity_type:
        query["entity_type"] = entity_type
    
    count = await db.audit_logs.count_documents(query)
    return {"count": count}

# ============== NOTIFICATION CONFIG ROUTES ==============
@api_router.get("/notification-config")
async def get_notification_config(current_user: dict = Depends(require_role(["super_admin"]))):
    config = await db.notification_config.find_one({}, {"_id": 0})
    if not config:
        # Create default config
        default_config = NotificationConfig()
        config_doc = default_config.model_dump()
        config_doc['updated_at'] = config_doc['updated_at'].isoformat()
        await db.notification_config.insert_one(config_doc)
        return config_doc
    return clean_mongo_doc(config)

@api_router.put("/notification-config", response_model=dict)
async def update_notification_config(
    update_data: NotificationConfigUpdate,
    request: Request,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict:
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        update_dict["updated_by"] = current_user["sub"]
        
        await db.notification_config.update_one(
            {},
            {"$set": update_dict},
            upsert=True
        )
        
        await create_audit_log(
            current_user["sub"], current_user["name"], current_user["email"],
            "editar", "configuracion_notificaciones", get_client_ip(request),
            new_values=update_dict
        )
    
    config = await db.notification_config.find_one({}, {"_id": 0})
    return config

# ============== REPORTS ROUTES ==============
@api_router.get("/reports/monthly-pdf")
async def get_monthly_report_pdf(
    month: int,
    year: int,
    current_user: dict = Depends(get_current_user)
):
    budgets = await db.monthly_budgets.find(
        {"month": month, "year": year},
        {"_id": 0}
    ).to_list(1000)
    
    total_budgeted = sum(b.get("budgeted_value", 0) for b in budgets)
    total_executed = sum(b.get("executed_value", 0) for b in budgets)
    execution_percentage = (total_executed / total_budgeted * 100) if total_budgeted > 0 else 0
    
    pdf_data = generate_monthly_report_pdf(
        month, year, budgets,
        total_budgeted, total_executed, execution_percentage
    )
    
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=reporte_{month:02d}_{year}.pdf"}
    )

# ============== TEST NOTIFICATION ROUTES ==============
@api_router.post("/test/whatsapp")
async def test_whatsapp(
    phone: str,
    message: str = "Mensaje de prueba del Sistema de Control Presupuestal",
    current_user: dict = Depends(require_role(["super_admin"]))
):
    result = await send_whatsapp_message(phone, message)
    return result

@api_router.post("/test/email")
async def test_email(
    email: str,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    html = """
    <html>
    <body>
        <h1>Prueba de correo</h1>
        <p>Este es un mensaje de prueba del Sistema de Control Presupuestal.</p>
    </body>
    </html>
    """
    result = await send_email(email, "Prueba - Sistema de Control Presupuestal", html)
    return result

# ============== WEBHOOK DESDE SISTEMA DE TALENTO HUMANO ==============

class TalentoHumanoWebhookPayload(BaseModel):
    source: str
    event_type: str
    payment_id: str
    concept: str
    monthly_value: float  # Valor en miles
    expense_type: str
    total_months: int
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    responsible_name: str
    notes: Optional[str] = None
    approval_date: Optional[str] = None

# Responsable fijo para las cuentas de cobro
RESPONSABLE_COBROS = "Sharon Alejandra Cardenas Ospina"

@api_router.post("/webhook/talento-humano")
async def webhook_from_talento_humano(
    payload: TalentoHumanoWebhookPayload,
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Webhook receptor desde el sistema de Talento Humano.
    Cuando se aprueba una cuenta de cobro en TH, este endpoint crea automáticamente
    un presupuesto y su registro mensual correspondiente.
    
    Datos esperados:
    - Concepto: "Cuenta de Cobro - [Nombre colaborador]"
    - Valor en miles
    - Tipo de gasto: Fijo
    - Número de meses: 1
    - Fecha inicio: día de aprobación
    - Fecha fin: 48 horas después
    - Responsable: Sharon Alejandra Cardenas Ospina
    """
    if payload.source != "talento_humano":
        raise HTTPException(status_code=400, detail="Fuente no válida")
    
    if payload.event_type != "payment_approved":
        raise HTTPException(status_code=400, detail="Tipo de evento no soportado")
    
    logger.info(f"Webhook recibido desde TH: {payload.model_dump()}")
    
    try:
        # Buscar el usuario responsable (Sharon) en el sistema
        responsible = await db.users.find_one({"full_name": RESPONSABLE_COBROS}, {"_id": 0})
        
        if not responsible:
            # Si no existe el responsable, crear un usuario de referencia
            responsible_id = "th-integration-user"
            responsible_name = RESPONSABLE_COBROS
            logger.warning(f"Usuario responsable '{RESPONSABLE_COBROS}' no encontrado, usando ID de referencia")
        else:
            responsible_id = responsible["id"]
            responsible_name = responsible["full_name"]
        
        # Crear el presupuesto principal
        budget = Budget(
            expense_type=payload.expense_type,
            concept=payload.concept,
            monthly_value=payload.monthly_value,
            periodicity="mensual",
            total_months=payload.total_months,
            start_date=payload.start_date,
            end_date=payload.end_date,
            responsible_id=responsible_id,
            responsible_name=responsible_name,
            status="activo",
            notes=payload.notes,
            created_by="talento-humano-integration"
        )
        
        budget_doc = budget.model_dump()
        budget_doc['created_at'] = budget_doc['created_at'].isoformat()
        budget_doc['updated_at'] = budget_doc['updated_at'].isoformat()
        budget_doc['th_payment_id'] = payload.payment_id  # Referencia al pago en TH
        budget_doc['th_approval_date'] = payload.approval_date
        budget_doc['source'] = 'talento_humano'
        
        await db.budgets.insert_one(budget_doc)
        logger.info(f"Presupuesto creado: {budget.id}")
        
        # Crear el presupuesto mensual
        start_date = datetime.strptime(payload.start_date, "%Y-%m-%d")
        
        monthly = MonthlyBudget(
            budget_id=budget.id,
            concept=payload.concept,
            month=start_date.month,
            year=start_date.year,
            budgeted_value=payload.monthly_value,
            expense_type=payload.expense_type,
            responsible_id=responsible_id,
            responsible_name=responsible_name,
            due_date=payload.end_date
        )
        
        monthly_doc = monthly.model_dump()
        monthly_doc['created_at'] = monthly_doc['created_at'].isoformat()
        monthly_doc['updated_at'] = monthly_doc['updated_at'].isoformat()
        monthly_doc['th_payment_id'] = payload.payment_id  # Referencia al pago en TH
        monthly_doc['source'] = 'talento_humano'
        
        await db.monthly_budgets.insert_one(monthly_doc)
        logger.info(f"Presupuesto mensual creado: {monthly.id}")
        
        # Registrar en auditoría
        await create_audit_log(
            user_id="talento-humano-integration",
            user_name="Sistema de Talento Humano",
            user_email="th@academiajotuns.com",
            action_type="crear",
            entity_type="presupuesto_th",
            ip_address=get_client_ip(request),
            entity_id=budget.id,
            new_values={
                "concept": payload.concept,
                "monthly_value": payload.monthly_value,
                "th_payment_id": payload.payment_id
            },
            details=f"Presupuesto creado automáticamente desde cuenta de cobro aprobada en TH: {payload.payment_id}"
        )
        
        # Enviar notificación si está configurado
        config = await db.notification_config.find_one({}, {"_id": 0})
        if config and config.get("notify_on_creation") and config.get("email_enabled"):
            if responsible and responsible.get("email"):
                background_tasks.add_task(
                    send_budget_reminder,
                    responsible.get("phone", ""),
                    responsible.get("email", ""),
                    payload.concept,
                    start_date.month,
                    start_date.year,
                    payload.monthly_value,
                    payload.end_date,
                    "pendiente"
                )
        
        return {
            "success": True,
            "message": "Presupuesto creado exitosamente desde cuenta de cobro",
            "budget_id": budget.id,
            "monthly_budget_id": monthly.id
        }
        
    except Exception as e:
        logger.error(f"Error procesando webhook de TH: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar webhook: {str(e)}")


@api_router.post("/payments/{payment_id}/notify-th")
async def notify_payment_to_th(
    payment_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Envía notificación al sistema de Talento Humano cuando se registra un pago
    que proviene de una cuenta de cobro de TH.
    """
    # Buscar el pago
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    # Buscar el presupuesto mensual relacionado
    monthly = await db.monthly_budgets.find_one({"id": payment["monthly_budget_id"]}, {"_id": 0})
    if not monthly:
        raise HTTPException(status_code=404, detail="Presupuesto mensual no encontrado")
    
    # Verificar si proviene de TH
    th_payment_id = monthly.get("th_payment_id")
    if not th_payment_id:
        return {"success": False, "message": "Este pago no proviene del sistema de Talento Humano"}
    
    try:
        # Enviar webhook a TH
        webhook_data = {
            "source": "presupuesto",
            "event_type": "payment_support_uploaded",
            "payment_id": th_payment_id,
            "support_file_url": payment.get("pdf_url"),
            "support_file_name": f"comprobante_{payment_id}.pdf",
            "payment_date": payment.get("payment_date"),
            "paid_value": payment.get("paid_value"),
            "payment_method": payment.get("payment_method"),
            "verification_code": payment.get("verification_code")
        }
        
        logger.info(f"Enviando notificación de pago a TH: {webhook_data}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://th.academiajotuns.com/api/webhook/presupuesto",
                json=webhook_data
            )
            
            if response.status_code in [200, 201]:
                # Marcar como notificado
                await db.payments.update_one(
                    {"id": payment_id},
                    {"$set": {
                        "th_notified": True,
                        "th_notified_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                await create_audit_log(
                    user_id=current_user["sub"],
                    user_name=current_user["name"],
                    user_email=current_user["email"],
                    action_type="email_enviado",
                    entity_type="webhook_th",
                    ip_address=get_client_ip(request),
                    entity_id=payment_id,
                    details=f"Soporte de pago enviado a TH para cuenta de cobro: {th_payment_id}"
                )
                
                return {
                    "success": True,
                    "message": "Soporte de pago enviado exitosamente a Talento Humano"
                }
            else:
                logger.error(f"Error enviando a TH: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Error al enviar a TH: {response.text}"
                }
                
    except httpx.RequestError as e:
        logger.error(f"Error de conexión con TH: {e}")
        return {
            "success": False,
            "message": f"Error de conexión con Talento Humano: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Error inesperado: {e}")
        return {
            "success": False,
            "message": f"Error inesperado: {str(e)}"
        }

# ============== PANEL DE MONITOREO DE INTEGRACIÓN ==============

@api_router.get("/integration/status")
async def get_integration_status(
    current_user: dict = Depends(require_role(["super_admin"]))
):
    """
    Obtiene el estado de la integración con el sistema de Talento Humano.
    Muestra presupuestos recibidos desde TH y pagos notificados.
    """
    # Obtener presupuestos que vienen de TH
    th_budgets = await db.budgets.find(
        {"source": "talento_humano"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Obtener presupuestos mensuales de TH
    th_monthly = await db.monthly_budgets.find(
        {"source": "talento_humano"},
        {"_id": 0}
    ).to_list(100)
    
    monthly_map = {m["budget_id"]: m for m in th_monthly}
    
    pending_payment = []
    paid = []
    notified_th = []
    
    for budget in th_budgets:
        monthly = monthly_map.get(budget["id"], {})
        payment_id = monthly.get("payment_id")
        
        budget_info = {
            "id": budget["id"],
            "concept": budget.get("concept", ""),
            "monthly_value": budget.get("monthly_value", 0),
            "th_payment_id": budget.get("th_payment_id"),
            "th_approval_date": budget.get("th_approval_date"),
            "created_at": budget.get("created_at"),
            "responsible_name": budget.get("responsible_name"),
            "monthly_id": monthly.get("id"),
            "payment_status": monthly.get("payment_status", "pendiente"),
            "payment_id": payment_id
        }
        
        if payment_id:
            # Verificar si se notificó a TH
            payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
            if payment:
                budget_info["payment_date"] = payment.get("payment_date")
                budget_info["paid_value"] = payment.get("paid_value")
                budget_info["th_notified"] = payment.get("th_notified", False)
                budget_info["th_notified_at"] = payment.get("th_notified_at")
                
                if payment.get("th_notified"):
                    notified_th.append(budget_info)
                else:
                    paid.append(budget_info)
        else:
            pending_payment.append(budget_info)
    
    return {
        "total_from_th": len(th_budgets),
        "pending_payment_count": len(pending_payment),
        "paid_count": len(paid),
        "notified_th_count": len(notified_th),
        "pending_payment": pending_payment,
        "paid": paid,
        "notified_th": notified_th,
        "th_url": "https://th.academiajotuns.com"
    }

@api_router.post("/integration/notify-th/{payment_id}")
async def manual_notify_th(
    payment_id: str,
    request: Request,
    current_user: dict = Depends(require_role(["super_admin"]))
):
    """
    Envía manualmente la notificación a TH para un pago.
    Útil si la notificación automática falló.
    """
    # Buscar el pago
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    
    # Buscar el presupuesto mensual relacionado
    monthly = await db.monthly_budgets.find_one({"id": payment["monthly_budget_id"]}, {"_id": 0})
    if not monthly:
        raise HTTPException(status_code=404, detail="Presupuesto mensual no encontrado")
    
    # Verificar si proviene de TH
    th_payment_id = monthly.get("th_payment_id")
    if not th_payment_id:
        raise HTTPException(status_code=400, detail="Este pago no proviene del sistema de Talento Humano")
    
    try:
        # Enviar webhook a TH
        webhook_data = {
            "source": "presupuesto",
            "event_type": "payment_support_uploaded",
            "payment_id": th_payment_id,
            "support_file_url": payment.get("pdf_url"),
            "support_file_name": f"comprobante_{payment_id}.pdf",
            "payment_date": payment.get("payment_date"),
            "paid_value": payment.get("paid_value"),
            "payment_method": payment.get("payment_method"),
            "verification_code": payment.get("verification_code")
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://th.academiajotuns.com/api/webhook/presupuesto",
                json=webhook_data
            )
            
            if response.status_code in [200, 201]:
                # Marcar como notificado
                await db.payments.update_one(
                    {"id": payment_id},
                    {"$set": {
                        "th_notified": True,
                        "th_notified_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                await create_audit_log(
                    current_user["sub"], current_user["name"], current_user["email"],
                    "email_enviado", "webhook_th", get_client_ip(request),
                    entity_id=payment_id,
                    details=f"Notificación manual a TH para pago: {th_payment_id}"
                )
                
                return {
                    "success": True,
                    "message": "Notificación enviada exitosamente a Talento Humano"
                }
            else:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Error al enviar a TH: {response.status_code} - {response.text}"
                )
                
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Error de conexión con TH: {str(e)}")

@api_router.get("/integration/health")
async def check_th_health():
    """
    Verifica la conectividad con el sistema de Talento Humano.
    Endpoint público para monitoreo.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("https://th.academiajotuns.com/api/health")
            
            if response.status_code == 200:
                return {
                    "status": "online",
                    "th_reachable": True,
                    "response_time_ms": response.elapsed.total_seconds() * 1000,
                    "message": "Sistema de Talento Humano accesible"
                }
            else:
                return {
                    "status": "degraded",
                    "th_reachable": True,
                    "http_status": response.status_code,
                    "message": f"Sistema responde pero con código {response.status_code}"
                }
    except httpx.TimeoutException:
        return {
            "status": "timeout",
            "th_reachable": False,
            "message": "Timeout al conectar con sistema de Talento Humano"
        }
    except Exception as e:
        return {
            "status": "error",
            "th_reachable": False,
            "message": f"Error de conexión: {str(e)}"
        }

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
