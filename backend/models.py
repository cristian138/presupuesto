from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, timezone
import uuid

# Utility function for generating UUIDs
def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

# ============== USER MODELS ==============
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    role: Literal["super_admin", "accountant"] = "accountant"
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role: Literal["super_admin", "accountant"] = "accountant"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Literal["super_admin", "accountant"]] = None
    is_active: Optional[bool] = None

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=generate_uuid)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ============== BUDGET MODELS ==============
class BudgetBase(BaseModel):
    expense_type: Literal["fijo", "variable", "ocasional"]
    concept: str
    monthly_value: float
    periodicity: str = "mensual"
    total_months: int
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    responsible_id: str
    responsible_name: str
    status: Literal["activo", "inactivo", "completado"] = "activo"
    notes: Optional[str] = None

class BudgetCreate(BudgetBase):
    pass

class BudgetUpdate(BaseModel):
    expense_type: Optional[Literal["fijo", "variable", "ocasional"]] = None
    concept: Optional[str] = None
    monthly_value: Optional[float] = None
    total_months: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    responsible_id: Optional[str] = None
    responsible_name: Optional[str] = None
    status: Optional[Literal["activo", "inactivo", "completado"]] = None
    notes: Optional[str] = None

class Budget(BudgetBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=generate_uuid)
    created_by: str
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

# ============== MONTHLY BUDGET MODELS ==============
class MonthlyBudgetBase(BaseModel):
    budget_id: str
    concept: str
    month: int  # 1-12
    year: int
    budgeted_value: float
    expense_type: str
    responsible_id: str
    responsible_name: str
    due_date: str  # YYYY-MM-DD

class MonthlyBudget(MonthlyBudgetBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=generate_uuid)
    executed_value: float = 0.0
    difference: float = 0.0
    payment_status: Literal["pendiente", "pagado", "pagado_con_diferencia", "vencido"] = "pendiente"
    payment_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)

# ============== PAYMENT MODELS ==============
class PaymentCreate(BaseModel):
    monthly_budget_id: str
    payment_date: str  # YYYY-MM-DD
    paid_value: float
    payment_method: str
    observations: Optional[str] = None
    support_file_name: Optional[str] = None
    support_file_url: Optional[str] = None

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=generate_uuid)
    monthly_budget_id: str
    budget_id: str
    concept: str
    month: int
    year: int
    budgeted_value: float
    paid_value: float
    difference: float
    payment_date: str
    payment_method: str
    observations: Optional[str] = None
    support_file_name: Optional[str] = None
    support_file_url: Optional[str] = None
    pdf_url: Optional[str] = None
    verification_code: str = Field(default_factory=generate_uuid)
    registered_by: str
    registered_by_name: str
    created_at: datetime = Field(default_factory=utc_now)

# ============== AUDIT LOG MODELS ==============
class AuditLogCreate(BaseModel):
    user_id: str
    user_name: str
    user_email: str
    action_type: Literal["crear", "editar", "pagar", "eliminar", "login", "email_enviado", "whatsapp_enviado"]
    entity_type: str
    entity_id: Optional[str] = None
    monthly_period: Optional[str] = None  # "01/2024"
    ip_address: str
    previous_values: Optional[dict] = None
    new_values: Optional[dict] = None
    details: Optional[str] = None

class AuditLog(AuditLogCreate):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=generate_uuid)
    timestamp: datetime = Field(default_factory=utc_now)

# ============== NOTIFICATION CONFIG MODELS ==============
class NotificationConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=generate_uuid)
    whatsapp_enabled: bool = False
    email_enabled: bool = False
    days_before_due: int = 3
    notify_on_creation: bool = True
    notify_on_payment: bool = True
    notify_on_difference: bool = True
    notify_on_overdue: bool = True
    updated_at: datetime = Field(default_factory=utc_now)
    updated_by: Optional[str] = None

class NotificationConfigUpdate(BaseModel):
    whatsapp_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    days_before_due: Optional[int] = None
    notify_on_creation: Optional[bool] = None
    notify_on_payment: Optional[bool] = None
    notify_on_difference: Optional[bool] = None
    notify_on_overdue: Optional[bool] = None

# ============== DASHBOARD MODELS ==============
class DashboardKPI(BaseModel):
    total_budgeted: float
    total_executed: float
    execution_percentage: float
    total_difference: float
    pending_count: int
    paid_count: int
    overdue_count: int
    with_difference_count: int

class MonthlyReport(BaseModel):
    month: int
    year: int
    budgeted: float
    executed: float
    difference: float
    execution_percentage: float
