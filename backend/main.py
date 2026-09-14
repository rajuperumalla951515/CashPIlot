import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import date, datetime
import json
from typing import Literal, Optional, List, Dict, Any

import httpx
try:
    import jwt
except ImportError:
    jwt = None
from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

from db import (
    init_db,
    get_db_connection,
    calculate_health_score,
    calculate_aging,
    calculate_forecast,
    get_action_center_priorities,
    learn_from_payment,
    save_named_dataset,
    load_named_dataset_by_id,
    list_named_datasets,
    apply_dataset_to_tables,
    authenticate_user,
    log_audit_action,
    get_audit_logs,
    get_all_users_in_org,
    create_user_in_org,
    get_role_permissions,
    register_user
)

load_dotenv()

# Initialize DB schema on module load
init_db()

app = FastAPI(title="CashPilot Enterprise API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models ---

class Metric(BaseModel):
    label: str
    value: str
    note: str

class Forecast(BaseModel):
    range: Literal["30 days", "60 days", "90 days", "6 months"]
    projected_balance: str
    change_from_today: str
    confidence: int

class InsightRequest(BaseModel):
    question: str
    context: str = ""

class UserTokenData(BaseModel):
    user_id: str
    email: Optional[str] = None
    role: Optional[str] = "authenticated"

class InvoiceCreate(BaseModel):
    invoice_number: str
    customer_name: str
    amount: float
    issued_date: Optional[str] = None
    due_date: str
    status: Optional[str] = "open"
    notes: Optional[str] = None

class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    due_date: Optional[str] = None
    amount: Optional[float] = None
    notes: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    payment_score: Optional[int] = 75
    outstanding_amount: Optional[float] = 0.0
    risk_level: Optional[str] = "medium"

class ExpenseCreate(BaseModel):
    category: str
    supplier_name: Optional[str] = "Vendor"
    amount: float
    expense_date: Optional[str] = None
    payment_status: Optional[str] = "paid"
    is_unusual: Optional[bool] = False
    is_recurring: Optional[bool] = False
    notes: Optional[str] = None

class PromiseCreate(BaseModel):
    customer_name: str
    invoice_number: Optional[str] = None
    amount: float
    promised_date: str
    status: Optional[str] = "pending"
    notes: Optional[str] = None

class ReminderSendRequest(BaseModel):
    invoice_id: str
    customer_name: str
    invoice_number: str
    channel: Optional[str] = "whatsapp"
    message: str

class DatasetImportRequest(BaseModel):
    dataset_name: str
    description: Optional[str] = "User imported dataset"
    invoices: Optional[List[Dict[str, Any]]] = []
    customers: Optional[List[Dict[str, Any]]] = []
    expenses: Optional[List[Dict[str, Any]]] = []
    organization: Optional[Dict[str, Any]] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class LogoutRequest(BaseModel):
    user_id: str
    user_name: str
    user_role: str

class CreateUserRequest(BaseModel):
    full_name: str
    email: str
    role: str

class RegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    role: Optional[str] = "owner"
    org_name: Optional[str] = "ABC Digital Solutions"

def verify_bearer_token(authorization: Optional[str] = Header(None)) -> UserTokenData:
    if not authorization or not authorization.startswith("Bearer "):
        return UserTokenData(user_id="anonymous", email=None)
    token = authorization.split(" ")[1]
    try:
        if jwt:
            payload = jwt.decode(token, options={"verify_signature": False})
            user_id = payload.get("sub", "anonymous")
            email = payload.get("email")
            role = payload.get("role", "authenticated")
            return UserTokenData(user_id=user_id, email=email, role=role)
        return UserTokenData(user_id="anonymous", email=None)
    except Exception:
        return UserTokenData(user_id="anonymous", email=None)

# --- Real DB Authentication & Authorization Endpoints ---

@app.post("/api/v1/auth/register")
def register_new_account(req: RegisterRequest):
    try:
        user = register_user(req.full_name, req.email, req.password, req.role or "owner", req.org_name or "ABC Digital Solutions")
        log_audit_action(user["id"], user["full_name"], user["role"], "USER_REGISTERED", "Authentication System", f"New user {user['full_name']} registered account.")
        return {"status": "success", "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/auth/login")
def login_user(req: LoginRequest):
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    log_audit_action(user["id"], user["full_name"], user["role"], "USER_LOGIN", "Authentication System", f"User {user['full_name']} logged in successfully.")
    return {"status": "success", "user": user}

@app.post("/api/v1/auth/logout")
def logout_user(req: LogoutRequest):
    log_audit_action(req.user_id, req.user_name, req.user_role, "USER_LOGOUT", "Authentication System", f"User {req.user_name} logged out.")
    return {"status": "success", "message": "Logged out successfully"}

@app.get("/api/v1/auth/users")
def get_users_list():
    return get_all_users_in_org()

@app.post("/api/v1/auth/users")
def add_user_account(req: CreateUserRequest):
    new_user = create_user_in_org(req.full_name, req.email, req.role)
    log_audit_action(new_user["id"], req.full_name, req.role, "USER_CREATED", "Team Management", f"Created user {req.full_name} ({req.role}).")
    return {"status": "success", "user": new_user}

@app.get("/api/v1/audit-logs")
def fetch_audit_logs_list():
    return get_audit_logs()

# --- General System & Health ---

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "cashpilot-enterprise-api", "version": "1.0.0"}

# --- Dynamic Analytics & Explanations (Step 5) ---

@app.get("/api/v1/health-score")
def cash_health_score() -> dict[str, object]:
    return calculate_health_score()

@app.get("/api/v1/receivables/aging")
def receivables_aging() -> dict[str, object]:
    return calculate_aging()

@app.get("/api/v1/forecast")
def forecast(range: Literal["30 days", "60 days", "90 days", "6 months"] = "30 days") -> dict[str, object]:
    return calculate_forecast(range)

# --- Step 6 & 7: Collections Action Center Endpoints ---

@app.get("/api/v1/collections/priorities")
def get_collections_priorities():
    return get_action_center_priorities()

@app.post("/api/v1/collections/send-reminder")
def send_reminder(req: ReminderSendRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    rem_id = f"rem-{int(datetime.now().timestamp())}"
    cursor.execute(
        "INSERT INTO reminder_logs (id, customer_name, invoice_number, channel, message) VALUES (?, ?, ?, ?, ?)",
        (rem_id, req.customer_name, req.invoice_number, req.channel, req.message)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "id": rem_id, "message": f"Reminder sent to {req.customer_name} via {req.channel.upper()}!"}

# --- Invoice CRUD with Automated Feedback Learning (Step 9 & 10) ---

@app.get("/api/v1/invoices")
def get_invoices():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM invoices ORDER BY due_date ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/v1/invoices")
def create_invoice(inv: InvoiceCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    inv_id = f"inv-{inv.invoice_number}"
    issued = inv.issued_date or str(date.today())
    
    cursor.execute(
        "INSERT INTO invoices (id, invoice_number, customer_name, amount, issued_date, due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (inv_id, inv.invoice_number, inv.customer_name, inv.amount, issued, inv.due_date, inv.status, inv.notes)
    )

    cursor.execute("SELECT * FROM customers WHERE name = ?", (inv.customer_name,))
    cust = cursor.fetchone()
    if cust:
        new_out = cust["outstanding_amount"] + inv.amount if inv.status in ("open", "overdue") else cust["outstanding_amount"]
        cursor.execute("UPDATE customers SET outstanding_amount = ? WHERE name = ?", (new_out, inv.customer_name))
    else:
        cursor.execute(
            "INSERT INTO customers (id, name, outstanding_amount, risk_level) VALUES (?, ?, ?, ?)",
            (f"c-{int(datetime.now().timestamp())}", inv.customer_name, inv.amount, "medium")
        )

    conn.commit()
    conn.close()
    return {"status": "success", "id": inv_id, "message": "Invoice created successfully"}

@app.patch("/api/v1/invoices/{invoice_id}")
def update_invoice(invoice_id: str, inv_update: InvoiceUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Invoice not found")

    new_status = inv_update.status or existing["status"]
    new_due = inv_update.due_date or existing["due_date"]
    new_amount = inv_update.amount if inv_update.amount is not None else existing["amount"]
    new_notes = inv_update.notes if inv_update.notes is not None else existing["notes"]

    # Step 9 & 10: Feedback Loop on Payment Receipt
    learning_result = {}
    if existing["status"] != "paid" and new_status == "paid":
        due_dt = datetime.strptime(existing["due_date"], "%Y-%m-%d").date()
        days_late = max(0, (date.today() - due_dt).days)
        
        # Increase cash balance
        cursor.execute("UPDATE organizations SET cash_balance = cash_balance + ? WHERE id = 'org-1'", (existing["amount"],))
        
        # Trigger ML Feedback learning loop for customer score update
        learning_result = learn_from_payment(conn, existing["customer_name"], existing["amount"], days_late)

    cursor.execute(
        "UPDATE invoices SET status = ?, due_date = ?, amount = ?, notes = ? WHERE id = ?",
        (new_status, new_due, new_amount, new_notes, invoice_id)
    )
    conn.commit()
    conn.close()
    return {
        "status": "success", 
        "message": f"Invoice status updated to {new_status.upper()}!", 
        "feedback": learning_result
    }

@app.get("/api/v1/alerts")
def get_alerts():
    from db import get_alerts_summary
    return get_alerts_summary()

@app.get("/api/v1/analytics/risk-model")
def get_risk_model_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers ORDER BY payment_score ASC")
    customers = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT status, COUNT(*), SUM(amount) FROM invoices GROUP BY status")
    invoice_stats = [{"status": r[0], "count": r[1], "total": r[2] or 0.0} for r in cursor.fetchall()]
    conn.close()

    high_risk_count = sum(1 for c in customers if c["risk_level"] == "high")
    medium_risk_count = sum(1 for c in customers if c["risk_level"] == "medium")
    low_risk_count = sum(1 for c in customers if c["risk_level"] == "low")

    return {
        "customer_count": len(customers),
        "risk_distribution": {
            "high": high_risk_count,
            "medium": medium_risk_count,
            "low": low_risk_count
        },
        "invoice_stats": invoice_stats,
        "customers": customers
    }

@app.delete("/api/v1/invoices/{invoice_id}")
def delete_invoice(invoice_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM invoices WHERE id = ?", (invoice_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Invoice deleted"}

# --- Customer CRUD & ML Learning History ---

@app.get("/api/v1/customers")
def get_customers():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers ORDER BY payment_score ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/v1/customers")
def create_customer(c: CustomerCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cid = f"c-{int(datetime.now().timestamp())}"
    cursor.execute(
        "INSERT INTO customers (id, name, email, phone, payment_score, outstanding_amount, risk_level) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (cid, c.name, c.email, c.phone, c.payment_score, c.outstanding_amount, c.risk_level)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "id": cid, "message": "Customer created"}

@app.delete("/api/v1/customers/{customer_id}")
def delete_customer(customer_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Customer deleted"}

# --- Expense Endpoints ---

@app.get("/api/v1/expenses")
def get_expenses():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expenses ORDER BY expense_date DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/v1/expenses")
def create_expense(e: ExpenseCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    eid = f"exp-{int(datetime.now().timestamp())}"
    exp_date = e.expense_date or str(date.today())
    cursor.execute(
        "INSERT INTO expenses (id, category, supplier_name, amount, expense_date, payment_status, is_unusual, is_recurring, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (eid, e.category, e.supplier_name, e.amount, exp_date, e.payment_status, 1 if e.is_unusual else 0, 1 if e.is_recurring else 0, e.notes)
    )

    if e.payment_status == "paid":
        cursor.execute("UPDATE organizations SET cash_balance = cash_balance - ? WHERE id = 'org-1'", (e.amount,))

    conn.commit()
    conn.close()
    return {"status": "success", "id": eid, "message": "Expense logged successfully"}

@app.delete("/api/v1/expenses/{expense_id}")
def delete_expense(expense_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Expense deleted"}

# --- Payment Promises (Step 8) & Suppliers ---

@app.get("/api/v1/promises")
def get_promises():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM payment_promises ORDER BY promised_date ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/v1/promises")
def create_promise(p: PromiseCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    pid = f"prom-{int(datetime.now().timestamp())}"
    cursor.execute(
        "INSERT INTO payment_promises (id, customer_name, invoice_number, amount, promised_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (pid, p.customer_name, p.invoice_number, p.amount, p.promised_date, p.status, p.notes)
    )
    conn.commit()
    conn.close()
    return {"status": "success", "id": pid, "message": "Payment promise recorded! Cash forecast updated."}

@app.get("/api/v1/suppliers")
def get_suppliers():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM suppliers ORDER BY total_spend DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- Named Dataset Management Endpoints ---

@app.get("/api/v1/datasets")
def list_datasets():
    return list_named_datasets()

@app.post("/api/v1/datasets/import")
def import_dataset(payload: DatasetImportRequest):
    data = {
        "invoices": payload.invoices or [],
        "customers": payload.customers or [],
        "expenses": payload.expenses or [],
        "organization": payload.organization
    }
    result = save_named_dataset(payload.dataset_name, payload.description or "", data)
    return {"status": "success", "message": f"Dataset '{payload.dataset_name}' saved and applied successfully!", "dataset": result}

@app.post("/api/v1/datasets/{dataset_id}/load")
def load_dataset(dataset_id: str):
    success = load_named_dataset_by_id(dataset_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"status": "success", "message": f"Dataset '{dataset_id}' loaded into active workspace!"}

@app.post("/api/v1/datasets/reset")
def reset_dataset():
    from db import seed_default_data
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM invoices")
    cursor.execute("DELETE FROM customers")
    cursor.execute("DELETE FROM expenses")
    cursor.execute("DELETE FROM payment_promises")
    cursor.execute("DELETE FROM organizations")
    seed_default_data(conn)
    conn.close()
    return {"status": "success", "message": "Workspace reset to default seed dataset"}

@app.get("/api/v1/datasets/export")
def export_dataset():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM invoices")
    invs = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM customers")
    custs = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM expenses")
    exps = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT * FROM organizations LIMIT 1")
    org = dict(cursor.fetchone()) if cursor.fetchone() else {}
    conn.close()

    return {
        "dataset_name": "Exported Workspace Dataset",
        "exported_at": datetime.now().isoformat(),
        "invoices": invs,
        "customers": custs,
        "expenses": exps,
        "organization": org
    }

# --- Dynamic AI CFO Agent Endpoint ---

@app.post("/api/v1/ai/cfo")
async def ai_cfo_agent(request: InsightRequest) -> dict[str, object]:
    q_lower = request.question.strip().lower().rstrip("!.")
    greetings = {"hello", "hi", "hey", "good morning", "good afternoon", "good evening", "greetings", "hi there", "hello there", "thanks", "thank you"}
    
    if q_lower in greetings or q_lower.startswith("hello ") or q_lower.startswith("hi ") or q_lower.startswith("hey "):
        return {
            "question": request.question,
            "insight": "### **AI CFO Assistant**\n\nHello! I am your **AI CFO Assistant**. How can I help you analyze cash flow, track receivables, or optimize expenses today?",
            "live_metrics_used": {}
        }

    openai_key = os.getenv("OPENAI_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    health_data = calculate_health_score()
    aging_data = calculate_aging()
    action_data = get_action_center_priorities()
    forecast_30 = calculate_forecast("30 days")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT invoice_number, customer_name, amount, due_date, status FROM invoices ORDER BY due_date ASC")
    inv_rows = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT category, supplier_name, amount, expense_date, is_unusual FROM expenses ORDER BY expense_date DESC")
    exp_rows = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT customer_name, invoice_number, amount, promised_date, status FROM payment_promises")
    prom_rows = [dict(r) for r in cursor.fetchall()]
    
    cursor.execute("SELECT name, credit_days, score, total_spend FROM suppliers")
    sup_rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    metrics = health_data["metrics"]
    cash_bal = metrics["cash_balance"]
    receivables = metrics["receivables"]
    overdue = metrics["overdue"]
    runway = metrics["cash_runway_days"]
    health_score = health_data["score"]
    health_status = health_data["status"]
    explanation = health_data["explanation"]

    top_customers = aging_data.get("customer_risk", [])
    cust_str = "; ".join([f"{c['name']}: Outstanding {c['outstanding']} (Score {c['score']}/100, Risk {c['risk']}, Avg Delay {c['avg_delay_days']}d, Late Prob {c['late_probability']}%)" for c in top_customers])
    inv_str = "; ".join([f"{i['invoice_number']} ({i['customer_name']}): ₹{i['amount']:,.0f}, Due {i['due_date']}, Status {i['status'].upper()}" for i in inv_rows])
    exp_str = "; ".join([f"{e['category']} ({e['supplier_name']}): ₹{e['amount']:,.0f}" + (" [UNUSUAL]" if e['is_unusual'] else "") for e in exp_rows])
    prom_str = "; ".join([f"{p['customer_name']}: Promised ₹{p['amount']:,.0f} on {p['promised_date']} ({p['status']})" for p in prom_rows]) if prom_rows else "None"
    sup_str = "; ".join([f"{s['name']}: {s['credit_days']}d credit, Score {s['score']}/100, Total Spend ₹{s['total_spend']:,.0f}" for s in sup_rows]) if sup_rows else "None"

    full_sys_context = f"""
Complete Live CashPilot Application Database State:
- Cash Balance: {cash_bal} (Monthly Burn: ₹{metrics['monthly_burn']:,.0f})
- Receivables Total: {receivables} (Overdue: {overdue}, Due This Week: {metrics['due_this_week']})
- Cash Runway: {runway} Days | Health Score: {health_score}/100 ({health_status})
- Health Root Cause: {explanation}
- 30-Day Projected Balance: {forecast_30['projected_balance']} (Expected Inflow {forecast_30['expected_inflow']}, Outflow {forecast_30['expected_outflow']})
- Today's Action Priority: {action_data['summary']}

Detailed Database Records across All 14 Modules:
1. Customer Accounts ({len(top_customers)}): {cust_str}
2. Invoices Ledger ({len(inv_rows)}): {inv_str}
3. Expenses Log ({len(exp_rows)}): {exp_str}
4. Promises to Pay ({len(prom_rows)}): {prom_str}
5. Suppliers Directory ({len(sup_rows)}): {sup_str}
"""

    format_instruction = """
ROLE & CONVERSATIONAL RULES:
- You are CashPilot's **AI CFO Assistant**. Never mention Gemini, OpenAI, or internal AI model names.
- Provide a direct, highly customized response that specifically answers the user's input.
- Avoid repeated, generic, or scripted intro/outro templates across different user prompts. Jump straight into the specific answer requested.
- If the user says "hello", "hi", or a simple greeting, respond warmly in 1-2 short sentences without dumping data.
- If the user asks a specific targeted question (e.g., "What is my cash runway?", "Who owes me overdue payments?", "Audit CloudHost expense surge"), focus exclusively on answering that exact question using exact numbers from the live database context.
- Format all section headings with **Bold Headings** (e.g. `### **Cash Runway Analysis**`).
- Always highlight key figures, metric scores, dates, customer names, and money amounts in **bold text** (e.g., **₹8,40,000**, **89/100**, **60 days**, **Northstar Studio**).
"""

    insight = ""
    if gemini_key:
        prompt = f"You are CashPilot, an expert enterprise AI CFO assistant.\n{full_sys_context}\n\nUSER QUESTION: '{request.question}'\n\n{format_instruction}"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={gemini_key}"
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
                if response.status_code == 200:
                    data = response.json()
                    insight = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as e:
            print("Gemini API call failed:", e)

    if not insight and openai_key:
        prompt = f"You are CashPilot, an expert enterprise AI CFO assistant.\n{full_sys_context}\n\nUSER QUESTION: '{request.question}'\n\n{format_instruction}"
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {openai_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "You are CashPilot, an expert enterprise AI CFO."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 600
        }
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    insight = data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print("OpenAI API call failed:", e)

    if not insight:
        q = request.question.lower()
        if "runway" in q:
            insight = f"### **Cash Runway Analysis**\n\nYour operational cash runway is **{runway} Days**.\n\n### **Financial Breakdown**\n- **Current Cash Balance**: **{cash_bal}**\n- **Monthly Cash Burn**: **₹{metrics['monthly_burn']:,.0f}**\n- **Health Index**: **{health_score}/100** ({health_status})"
        elif "overdue" in q or "who owes" in q or "customer" in q:
            overdue_custs = [c for c in top_customers if c.get("outstanding") and c.get("outstanding") != "₹0"]
            cust_lines = "\n".join([f"- **{c['name']}**: **{c['outstanding']}** overdue (Risk: **{c['risk']}**, Avg Delay: **{c['avg_delay_days']}d**)" for c in overdue_custs[:3]])
            insight = f"### **Overdue Receivables Audit**\n\nTotal overdue payments stand at **{overdue}** across high-risk customer accounts:\n\n{cust_lines}\n\n### **Recommended Action**\n{action_data['summary']}"
        elif "expense" in q or "cloudhost" in q or "spend" in q:
            unusual_exps = [e for e in exp_rows if e.get("is_unusual")]
            exp_lines = "\n".join([f"- **{e['category']}** ({e['supplier_name']}): **₹{e['amount']:,.0f}** [UNUSUAL SPEND]" for e in unusual_exps[:3]])
            insight = f"### **Expense & Spend Audit**\n\nUnusual spend anomalies detected in recent log:\n\n{exp_lines or '- No unusual spikes recorded in latest cycle.'}"
        elif "why" in q or "decrease" in q or "health" in q:
            insight = f"### **Financial Health Diagnosis**\n\nYour current business health score is **{health_score}/100 ({health_status})**.\n\n### **Root Cause Explanation**\n{explanation}"
        else:
            insight = f"### **CFO Analysis for '{request.question}'**\n\nBased on your live business ledger:\n- **Cash Balance**: **{cash_bal}**\n- **Total Receivables**: **{receivables}** (Overdue: **{overdue}**)\n- **Operational Runway**: **{runway} Days**\n- **Health Status**: **{health_score}/100** ({health_status})"

    return {
        "question": request.question,
        "insight": insight,
        "live_metrics_used": {
            "cash_balance": cash_bal,
            "receivables": receivables,
            "overdue": overdue,
            "health_score": health_score,
            "runway_days": runway
        }
    }
