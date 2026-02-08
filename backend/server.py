from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, BackgroundTasks
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
async def create_audit_log(
    user_id: str, user_name: str, user_email: str,
    action_type: str, entity_type: str, ip_address: str,
    entity_id: str = None, monthly_period: str = None,
    previous_values: dict = None, new_values: dict = None, details: str = None
):
    audit = AuditLog(
        user_id=user_id,
        user_name=user_name,
        user_email=user_email,
        action_type=action_type,
        entity_type=entity_type,
        entity_id=entity_id,
        monthly_period=monthly_period,
        ip_address=ip_address,
        previous_values=previous_values,
        new_values=new_values,
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
    # Check if email exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    # Check if first user (make super_admin)
    user_count = await db.users.count_documents({})
    role = "super_admin" if user_count == 0 else user_data.role
    
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
        "pdf_url": payment.pdf_url
    }

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
@api_router.get("/audit-logs", response_model=List[dict])
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
    return logs

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
@api_router.get("/notification-config", response_model=dict)
async def get_notification_config(current_user: dict = Depends(require_role(["super_admin"]))):
    config = await db.notification_config.find_one({}, {"_id": 0})
    if not config:
        # Create default config
        default_config = NotificationConfig()
        config_doc = default_config.model_dump()
        config_doc['updated_at'] = config_doc['updated_at'].isoformat()
        await db.notification_config.insert_one(config_doc)
        return config_doc
    return config

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
