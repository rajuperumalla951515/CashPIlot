import json
import os
import sqlite3
from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "cashpilot.db")
DATASETS_DIR = os.path.join(os.path.dirname(__file__), "datasets")

os.makedirs(DATASETS_DIR, exist_ok=True)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        industry TEXT DEFAULT 'IT Services',
        currency TEXT DEFAULT 'INR',
        cash_balance REAL DEFAULT 840000.0,
        monthly_burn REAL DEFAULT 420000.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        payment_score INTEGER DEFAULT 75,
        outstanding_amount REAL DEFAULT 0.0,
        risk_level TEXT DEFAULT 'medium',
        avg_payment_delay_days INTEGER DEFAULT 12,
        late_probability INTEGER DEFAULT 65,
        total_invoices_paid INTEGER DEFAULT 3,
        on_time_payment_count INTEGER DEFAULT 2,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        amount REAL NOT NULL,
        issued_date DATE NOT NULL,
        due_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        supplier_name TEXT,
        amount REAL NOT NULL,
        expense_date DATE NOT NULL,
        payment_status TEXT DEFAULT 'paid',
        is_unusual INTEGER DEFAULT 0,
        is_recurring INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payment_promises (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        invoice_number TEXT,
        amount REAL NOT NULL,
        promised_date DATE NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        credit_days INTEGER DEFAULT 30,
        score INTEGER DEFAULT 85,
        total_spend REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reminder_logs (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        channel TEXT DEFAULT 'whatsapp',
        message TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS saved_datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        description TEXT,
        invoice_count INTEGER DEFAULT 0,
        customer_count INTEGER DEFAULT 0,
        expense_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        org_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()

    # Automatic Column Migrations for existing DB instances
    cursor.execute("PRAGMA table_info(customers)")
    existing_cols = [row[1] for row in cursor.fetchall()]
    if "avg_payment_delay_days" not in existing_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN avg_payment_delay_days INTEGER DEFAULT 12")
    if "late_probability" not in existing_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN late_probability INTEGER DEFAULT 65")
    if "total_invoices_paid" not in existing_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN total_invoices_paid INTEGER DEFAULT 3")
    if "on_time_payment_count" not in existing_cols:
        cursor.execute("ALTER TABLE customers ADD COLUMN on_time_payment_count INTEGER DEFAULT 2")
    conn.commit()

    # Check if empty; if so, seed default data
    cursor.execute("SELECT COUNT(*) FROM invoices")
    if cursor.fetchone()[0] == 0:
        seed_default_data(conn)

    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        seed_users_and_audits(conn)

    conn.close()

def seed_users_and_audits(conn):
    cursor = conn.cursor()
    users = [
        ("usr-1", "raju@abcdigital.com", "password123", "Raju", "owner", "org-1"),
        ("usr-2", "anil@abcdigital.com", "password123", "Anil", "admin", "org-1"),
        ("usr-3", "priya@abcdigital.com", "password123", "Priya", "finance_manager", "org-1"),
        ("usr-4", "kiran@abcdigital.com", "password123", "Kiran", "accountant", "org-1"),
        ("usr-5", "rahul@abcdigital.com", "password123", "Rahul", "collections_manager", "org-1"),
        ("usr-6", "ceo@abcdigital.com", "password123", "CEO", "viewer", "org-1"),
        ("usr-7", "admin@cashpilot.saas", "supersecret123", "CashPilot Super Admin", "super_admin", "org-saas"),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role, org_id) VALUES (?, ?, ?, ?, ?, ?)",
        users
    )

    initial_audits = [
        ("audit-101", "usr-7", "CashPilot Super Admin", "super_admin", "PLATFORM_HEALTH_CHECK", "SaaS Platform", "System health check initialized."),
        ("audit-102", "usr-1", "Raju", "owner", "ORG_CREATED", "ABC Digital Solutions", "Organization workspace initialized."),
        ("audit-103", "usr-3", "Priya", "finance_manager", "FORECAST_GENERATED", "Cash Forecast", "Generated 30-day cash forecast report."),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO audit_logs (id, user_id, user_name, user_role, action, resource, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        initial_audits
    )
    conn.commit()

def seed_default_data(conn):
    cursor = conn.cursor()
    
    cursor.execute(
        "INSERT OR IGNORE INTO organizations (id, name, industry, currency, cash_balance, monthly_burn) VALUES (?, ?, ?, ?, ?, ?)",
        ("org-1", "ABC Digital Solutions", "IT Services", "INR", 840000.0, 420000.0)
    )

    customers = [
        ("cust-1", "ABC Ltd", "finance@abcltd.com", "+91 9876543210", 34, 240000.0, "high", 20, 84, 5, 1),
        ("cust-2", "Northstar Studio", "billing@northstar.io", "+91 9876543211", 61, 142000.0, "medium", 14, 55, 4, 2),
        ("cust-3", "Pixel & Beam", "accounts@pixelbeam.design", "+91 9876543212", 92, 64500.0, "low", 2, 10, 8, 8),
        ("cust-4", "Global Dynamics", "contact@gdynamics.com", "+91 9876543213", 88, 310000.0, "low", 4, 15, 6, 5),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO customers (id, name, email, phone, payment_score, outstanding_amount, risk_level, avg_payment_delay_days, late_probability, total_invoices_paid, on_time_payment_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        customers
    )

    today = date.today()
    invoices = [
        ("INV-2841", "INV-2841", "ABC Ltd", 240000.0, str(today - timedelta(days=32)), str(today - timedelta(days=18)), "overdue", "Urgent follow-up needed"),
        ("INV-2835", "INV-2835", "Northstar Studio", 142000.0, str(today - timedelta(days=20)), str(today - timedelta(days=9)), "overdue", "Second reminder sent"),
        ("INV-2818", "INV-2818", "Pixel & Beam", 64500.0, str(today - timedelta(days=10)), str(today + timedelta(days=2)), "open", "Payment expected on time"),
        ("INV-2802", "INV-2802", "Global Dynamics", 310000.0, str(today - timedelta(days=5)), str(today + timedelta(days=25)), "open", "Milestone 1 invoice"),
        ("INV-2790", "INV-2790", "ABC Ltd", 150000.0, str(today - timedelta(days=60)), str(today - timedelta(days=45)), "paid", "Received via wire transfer"),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO invoices (id, invoice_number, customer_name, amount, issued_date, due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        invoices
    )

    expenses = [
        ("exp-1", "Software & Hosting", "CloudHost India", 118000.0, str(today - timedelta(days=5)), "paid", 1, 1, "Unusual 27% increase due to database scaleup"),
        ("exp-2", "Payroll", "Employee Salaries", 310000.0, str(today - timedelta(days=12)), "paid", 0, 1, "Monthly team payroll"),
        ("exp-3", "Office Rent", "CoSpace Ventures", 45000.0, str(today - timedelta(days=14)), "paid", 0, 1, "Monthly office space rental"),
        ("exp-4", "Marketing & Ads", "Google Ads", 35000.0, str(today - timedelta(days=2)), "paid", 0, 0, "Lead generation campaigns"),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO expenses (id, category, supplier_name, amount, expense_date, payment_status, is_unusual, is_recurring, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        expenses
    )

    promises = [
        ("prom-1", "ABC Ltd", "INV-2841", 100000.0, str(today + timedelta(days=3)), "pending", "Partial payment promised by CFO"),
        ("prom-2", "Northstar Studio", "INV-2835", 142000.0, str(today + timedelta(days=5)), "pending", "Confirmed via email call"),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO payment_promises (id, customer_name, invoice_number, amount, promised_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        promises
    )

    suppliers = [
        ("sup-1", "CloudHost India", 15, 94, 118000.0),
        ("sup-2", "CoSpace Ventures", 30, 88, 45000.0),
        ("sup-3", "Google Ads", 7, 98, 35000.0),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO suppliers (id, name, credit_days, score, total_spend) VALUES (?, ?, ?, ?, ?)",
        suppliers
    )

    default_dataset_id = "ds-default-001"
    cursor.execute(
        "INSERT OR IGNORE INTO saved_datasets (id, name, filename, description, invoice_count, customer_count, expense_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (default_dataset_id, "Default Enterprise Dataset (Initial)", "default_seed.json", "Standard sample business dataset with IT Services transactions.", 5, 4, 4)
    )

    users = [
        ("usr-1", "raju@abcdigital.com", "password123", "Raju", "owner", "org-1"),
        ("usr-2", "anil@abcdigital.com", "password123", "Anil", "admin", "org-1"),
        ("usr-3", "priya@abcdigital.com", "password123", "Priya", "finance_manager", "org-1"),
        ("usr-4", "kiran@abcdigital.com", "password123", "Kiran", "accountant", "org-1"),
        ("usr-5", "rahul@abcdigital.com", "password123", "Rahul", "collections_manager", "org-1"),
        ("usr-6", "ceo@abcdigital.com", "password123", "CEO", "viewer", "org-1"),
        ("usr-7", "admin@cashpilot.saas", "supersecret123", "CashPilot Super Admin", "super_admin", "org-saas"),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO users (id, email, password_hash, full_name, role, org_id) VALUES (?, ?, ?, ?, ?, ?)",
        users
    )

    initial_audits = [
        ("audit-101", "usr-7", "CashPilot Super Admin", "super_admin", "PLATFORM_HEALTH_CHECK", "SaaS Platform", "System health check initialized."),
        ("audit-102", "usr-1", "Raju", "owner", "ORG_CREATED", "ABC Digital Solutions", "Organization workspace initialized."),
        ("audit-103", "usr-3", "Priya", "finance_manager", "FORECAST_GENERATED", "Cash Forecast", "Generated 30-day cash forecast report."),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO audit_logs (id, user_id, user_name, user_role, action, resource, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        initial_audits
    )

    conn.commit()

# --- Feedback Learning Engine (Step 10) ---

def learn_from_payment(conn, customer_name: str, paid_amount: float, days_late: int) -> dict:
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE name = ?", (customer_name,))
    cust = cursor.fetchone()
    if not cust:
        return {}

    current_score = cust["payment_score"]
    paid_count = cust["total_invoices_paid"] + 1
    on_time_count = cust["on_time_payment_count"] + (1 if days_late <= 0 else 0)

    # Recalculate average delay
    old_avg = cust["avg_payment_delay_days"]
    new_avg = max(0, int((old_avg * (paid_count - 1) + days_late) / paid_count))

    # Recalculate late probability
    new_late_prob = max(5, min(95, int(((paid_count - on_time_count) / paid_count) * 100)))

    # Recalculate Risk Payment Score (0-100: higher = safer)
    if days_late <= 0:
        new_score = min(98, current_score + 8)  # Score improves e.g. 70 -> 78
    elif days_late <= 7:
        new_score = min(95, current_score + 3)
    else:
        new_score = max(10, current_score - 5)

    risk_level = "low" if new_score >= 80 else ("medium" if new_score >= 50 else "high")
    new_outstanding = max(0.0, cust["outstanding_amount"] - paid_amount)

    cursor.execute(
        "UPDATE customers SET payment_score = ?, avg_payment_delay_days = ?, late_probability = ?, total_invoices_paid = ?, on_time_payment_count = ?, risk_level = ?, outstanding_amount = ? WHERE name = ?",
        (new_score, new_avg, new_late_prob, paid_count, on_time_count, risk_level, new_outstanding, customer_name)
    )
    conn.commit()

    return {
        "customer_name": customer_name,
        "old_score": current_score,
        "new_score": new_score,
        "score_delta": new_score - current_score,
        "new_avg_delay": new_avg,
        "new_late_prob": new_late_prob,
        "risk_level": risk_level
    }

# --- Dynamic Calculation Helpers ---

def calculate_health_score(conn=None):
    close_at_end = False
    if conn is None:
        conn = get_db_connection()
        close_at_end = True

    cursor = conn.cursor()
    cursor.execute("SELECT cash_balance, monthly_burn FROM organizations LIMIT 1")
    org = cursor.fetchone()
    cash_balance = org["cash_balance"] if org else 840000.0
    monthly_burn = org["monthly_burn"] if org and org["monthly_burn"] > 0 else 420000.0

    cursor.execute("SELECT SUM(amount) FROM invoices WHERE status IN ('open', 'overdue')")
    total_receivables = cursor.fetchone()[0] or 0.0

    today_str = str(date.today())
    cursor.execute("SELECT SUM(amount) FROM invoices WHERE status = 'overdue' OR (status = 'open' AND due_date < ?)", (today_str,))
    overdue = cursor.fetchone()[0] or 0.0

    next_week_str = str(date.today() + timedelta(days=7))
    cursor.execute("SELECT SUM(amount) FROM invoices WHERE status = 'open' AND due_date BETWEEN ? AND ?", (today_str, next_week_str))
    due_this_week = cursor.fetchone()[0] or 0.0

    runway_days = int((cash_balance / monthly_burn) * 30)

    overdue_pct = (overdue / total_receivables * 100) if total_receivables > 0 else 0
    penalty = (overdue_pct * 0.4)
    if runway_days < 30:
        penalty += 25
    elif runway_days < 60:
        penalty += 10

    score = max(10, min(100, int(100 - penalty)))
    
    if score >= 80:
        status = "HEALTHY"
        color = "green"
    elif score >= 60:
        status = "WATCH"
        color = "yellow"
    else:
        status = "CRITICAL"
        color = "red"

    # Generate Explanatory Insight (Step 5 - WHY)
    explanation = f"Your cash risk is {status} ({score}/100) because ₹{overdue:,.0f} of receivables across active accounts are overdue, while monthly burn is ₹{monthly_burn:,.0f} with {runway_days} days of runway remaining."

    if close_at_end:
        conn.close()

    return {
        "score": score,
        "status": status,
        "color": color,
        "explanation": explanation,
        "metrics": {
            "cash_balance": f"₹{cash_balance:,.0f}",
            "raw_cash_balance": cash_balance,
            "receivables": f"₹{total_receivables:,.0f}",
            "raw_receivables": total_receivables,
            "overdue": f"₹{overdue:,.0f}",
            "raw_overdue": overdue,
            "due_this_week": f"₹{due_this_week:,.0f}",
            "raw_due_this_week": due_this_week,
            "cash_runway_days": runway_days,
            "monthly_burn": monthly_burn
        }
    }

def calculate_aging(conn=None):
    close_at_end = False
    if conn is None:
        conn = get_db_connection()
        close_at_end = True

    cursor = conn.cursor()
    today = date.today()

    cursor.execute("SELECT * FROM invoices WHERE status IN ('open', 'overdue')")
    invoices = cursor.fetchall()

    b_0_30 = 0.0
    b_31_60 = 0.0
    b_61_90 = 0.0
    b_90_plus = 0.0
    total = 0.0
    overdue_total = 0.0

    for inv in invoices:
        amt = inv["amount"]
        total += amt
        due = datetime.strptime(inv["due_date"], "%Y-%m-%d").date()
        days_diff = (today - due).days

        if days_diff <= 0:
            b_0_30 += amt
        elif days_diff <= 30:
            b_0_30 += amt
            overdue_total += amt
        elif days_diff <= 60:
            b_31_60 += amt
            overdue_total += amt
        elif days_diff <= 90:
            b_61_90 += amt
            overdue_total += amt
        else:
            b_90_plus += amt
            overdue_total += amt

    cursor.execute("SELECT * FROM customers ORDER BY payment_score ASC")
    customers = cursor.fetchall()
    customer_risk = []
    for c in customers:
        cdict = dict(c)
        days_late = 0
        cursor.execute("SELECT MIN(due_date) FROM invoices WHERE customer_name = ? AND status IN ('open', 'overdue')", (cdict["name"],))
        oldest_due = cursor.fetchone()[0]
        if oldest_due:
            d = datetime.strptime(oldest_due, "%Y-%m-%d").date()
            if d < today:
                days_late = (today - d).days

        avg_delay = cdict.get("avg_payment_delay_days") or 15
        late_prob = cdict.get("late_probability") or 50
        expected_min = max(1, avg_delay - 5)
        expected_max = avg_delay + 15
        expected_delay_range = f"{expected_min}–{expected_max} days"

        customer_risk.append({
            "id": cdict["id"],
            "name": cdict["name"],
            "outstanding": f"₹{cdict['outstanding_amount']:,.0f}",
            "raw_outstanding": cdict["outstanding_amount"],
            "days_late": days_late,
            "risk": (cdict.get("risk_level") or "medium").capitalize(),
            "score": cdict.get("payment_score") or 75,
            "avg_delay_days": avg_delay,
            "expected_delay_range": expected_delay_range,
            "late_probability": late_prob
        })

    if close_at_end:
        conn.close()

    return {
        "total_receivables": f"₹{total:,.0f}",
        "raw_total_receivables": total,
        "current": f"₹{(total - overdue_total):,.0f}",
        "overdue": f"₹{overdue_total:,.0f}",
        "high_risk": f"₹{b_61_90 + b_90_plus:,.0f}",
        "aging_buckets": {
            "0_30_days": f"₹{b_0_30:,.0f}",
            "31_60_days": f"₹{b_31_60:,.0f}",
            "61_90_days": f"₹{b_61_90:,.0f}",
            "90_plus_days": f"₹{b_90_plus:,.0f}"
        },
        "customer_risk": customer_risk
    }

def calculate_forecast(range_name: str, conn=None):
    close_at_end = False
    if conn is None:
        conn = get_db_connection()
        close_at_end = True

    cursor = conn.cursor()
    cursor.execute("SELECT cash_balance, monthly_burn FROM organizations LIMIT 1")
    org = cursor.fetchone()
    base_cash = org["cash_balance"] if org else 840000.0
    monthly_burn = org["monthly_burn"] if org else 420000.0

    days_map = {"30 days": 30, "60 days": 60, "90 days": 90, "6 months": 180}
    target_days = days_map.get(range_name, 30)

    target_date = str(date.today() + timedelta(days=target_days))
    cursor.execute("SELECT SUM(amount) FROM invoices WHERE status IN ('open', 'overdue') AND due_date <= ?", (target_date,))
    invoice_collections = cursor.fetchone()[0] or 0.0

    cursor.execute("SELECT SUM(amount) FROM payment_promises WHERE status = 'pending' AND promised_date <= ?", (target_date,))
    promised_collections = cursor.fetchone()[0] or 0.0

    total_expected_inflow = invoice_collections + promised_collections
    expected_outflow = (monthly_burn / 30.0) * target_days

    projected_balance = base_cash + total_expected_inflow - expected_outflow
    change = projected_balance - base_cash

    confidence = max(50, 90 - int(target_days * 0.15))

    timeline_points = []
    step_days = target_days // 4
    for i in range(5):
        d_offset = i * step_days
        d_date = date.today() + timedelta(days=d_offset)
        ratio = d_offset / target_days if target_days > 0 else 0
        point_inflow = total_expected_inflow * ratio
        point_outflow = expected_outflow * ratio
        bal = base_cash + point_inflow - point_outflow
        timeline_points.append({
            "day": d_offset,
            "date": d_date.strftime("%b %d"),
            "projected": round(bal),
            "inflow": round(point_inflow),
            "outflow": round(point_outflow)
        })

    if close_at_end:
        conn.close()

    change_sign = "+" if change >= 0 else ""
    return {
        "range": range_name,
        "projected_balance": f"₹{projected_balance:,.0f}",
        "raw_projected_balance": projected_balance,
        "change_from_today": f"{change_sign}₹{change:,.0f}",
        "confidence": confidence,
        "expected_inflow": f"₹{total_expected_inflow:,.0f}",
        "expected_outflow": f"₹{expected_outflow:,.0f}",
        "promised_inflow": f"₹{promised_collections:,.0f}",
        "timeline_points": timeline_points
    }

def get_alerts_summary(conn=None):
    close_at_end = False
    if conn is None:
        conn = get_db_connection()
        close_at_end = True

    cursor = conn.cursor()
    health = calculate_health_score(conn)
    aging = calculate_aging(conn)
    
    alerts = []

    # 1. Cash Shortage Warning Alert (Step 6)
    runway_days = health["metrics"]["cash_runway_days"]
    if runway_days < 35:
        alerts.append({
            "id": "alt-shortage",
            "type": "warning",
            "title": "Potential Cash Shortage Alert",
            "description": f"At current burn rate, potential cash dip identified in {runway_days} days unless ₹{health['metrics']['overdue']} overdue receivables are recovered.",
            "urgency": "High"
        })

    # 2. Expense Anomaly Alerts
    cursor.execute("SELECT * FROM expenses WHERE is_unusual = 1")
    unusual_exps = cursor.fetchall()
    for e in unusual_exps:
        alerts.append({
            "id": f"alt-exp-{e['id']}",
            "type": "anomaly",
            "title": f"Unusual Expense Surge in {e['category']}",
            "description": f"₹{e['amount']:,.0f} spend logged for {e['supplier_name']}. {e['notes'] or ''}",
            "urgency": "Medium"
        })

    # 3. High Risk Customer Alert
    for c in aging["customer_risk"]:
        if c["score"] < 50 and c["raw_outstanding"] > 100000:
            alerts.append({
                "id": f"alt-cust-{c['id']}",
                "type": "customer_risk",
                "title": f"High Default Risk: {c['name']}",
                "description": f"Outstanding ₹{c['outstanding']} with payment score {c['score']}/100 (Late probability: {c['late_probability']}%).",
                "urgency": "High"
            })

    if close_at_end:
        conn.close()

    return alerts

# --- Action Center & Collections Priorities (Step 6, 7 & 8) ---

def get_action_center_priorities(conn=None):
    close_at_end = False
    if conn is None:
        conn = get_db_connection()
        close_at_end = True

    cursor = conn.cursor()
    today = date.today()
    today_str = str(today)

    # Overdue Invoices
    cursor.execute("""
    SELECT i.*, c.email, c.phone, c.payment_score, c.risk_level, c.avg_payment_delay_days 
    FROM invoices i 
    LEFT JOIN customers c ON i.customer_name = c.name 
    WHERE i.status IN ('open', 'overdue') AND i.due_date < ? 
    ORDER BY i.amount DESC
    """, (today_str,))

    overdue_rows = cursor.fetchall()
    priorities = []
    total_recoverable = 0.0

    for r in overdue_rows:
        amt = r["amount"]
        total_recoverable += amt
        due = datetime.strptime(r["due_date"], "%Y-%m-%d").date()
        days_late = (today - due).days

        # Pre-drafted WhatsApp & Email Reminder Message (Step 7)
        reminder_msg = f"Hello {r['customer_name']}, this is a gentle reminder regarding invoice {r['invoice_number']} for ₹{amt:,.0f}, which is currently {days_late} days overdue. Please let us know if any information is needed to process payment today."

        priorities.append({
            "invoice_id": r["id"],
            "invoice_number": r["invoice_number"],
            "customer_name": r["customer_name"],
            "amount": f"₹{amt:,.0f}",
            "raw_amount": amt,
            "days_overdue": days_late,
            "due_date": r["due_date"],
            "risk_score": r["payment_score"] or 50,
            "risk_level": (r["risk_level"] or "medium").capitalize(),
            "avg_delay": r["avg_payment_delay_days"] or 15,
            "contact_email": r["email"] or "",
            "contact_phone": r["phone"] or "",
            "suggested_message": reminder_msg
        })

    summary_text = f"Today's Priority: Recover ₹{total_recoverable:,.0f} from {len(priorities)} high-priority overdue accounts."

    if close_at_end:
        conn.close()

    return {
        "summary": summary_text,
        "total_recoverable": f"₹{total_recoverable:,.0f}",
        "raw_total_recoverable": total_recoverable,
        "count": len(priorities),
        "items": priorities
    }

# --- Named Dataset Management Helpers ---

def save_named_dataset(dataset_name: str, description: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    ds_id = f"ds-{int(datetime.now().timestamp())}"
    safe_filename = f"{ds_id}_{dataset_name.replace(' ', '_').lower()}.json"
    file_path = os.path.join(DATASETS_DIR, safe_filename)

    invoices = data.get("invoices", [])
    customers = data.get("customers", [])
    expenses = data.get("expenses", [])

    dataset_payload = {
        "id": ds_id,
        "name": dataset_name,
        "description": description,
        "created_at": datetime.now().isoformat(),
        "data": {
            "invoices": invoices,
            "customers": customers,
            "expenses": expenses,
            "organization": data.get("organization", {})
        }
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(dataset_payload, f, indent=2)

    cursor.execute(
        "INSERT INTO saved_datasets (id, name, filename, description, invoice_count, customer_count, expense_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (ds_id, dataset_name, safe_filename, description, len(invoices), len(customers), len(expenses))
    )
    conn.commit()

    apply_dataset_to_tables(conn, data)
    conn.close()

    return {
        "id": ds_id,
        "name": dataset_name,
        "filename": safe_filename,
        "invoice_count": len(invoices),
        "customer_count": len(customers),
        "expense_count": len(expenses)
    }

def apply_dataset_to_tables(conn, data: Dict[str, Any]):
    cursor = conn.cursor()

    cursor.execute("DELETE FROM invoices")
    cursor.execute("DELETE FROM customers")
    cursor.execute("DELETE FROM expenses")
    cursor.execute("DELETE FROM payment_promises")

    for c in data.get("customers", []):
        cursor.execute(
            "INSERT INTO customers (id, name, email, phone, payment_score, outstanding_amount, risk_level, avg_payment_delay_days, late_probability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (c.get("id", f"c-{int(datetime.now().timestamp())}"), c["name"], c.get("email"), c.get("phone"), c.get("payment_score", 75), float(c.get("outstanding_amount", 0.0)), c.get("risk_level", "medium"), c.get("avg_payment_delay_days", 12), c.get("late_probability", 65))
        )

    for inv in data.get("invoices", []):
        cursor.execute(
            "INSERT INTO invoices (id, invoice_number, customer_name, amount, issued_date, due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (inv.get("id", f"inv-{inv.get('invoice_number')}"), inv["invoice_number"], inv["customer_name"], float(inv["amount"]), inv.get("issued_date", str(date.today())), inv["due_date"], inv.get("status", "open"), inv.get("notes"))
        )

    for exp in data.get("expenses", []):
        cursor.execute(
            "INSERT INTO expenses (id, category, supplier_name, amount, expense_date, payment_status, is_unusual, is_recurring, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (exp.get("id", f"exp-{int(datetime.now().timestamp())}"), exp["category"], exp.get("supplier_name", "Supplier"), float(exp["amount"]), exp.get("expense_date", str(date.today())), exp.get("payment_status", "paid"), 1 if exp.get("is_unusual") else 0, 1 if exp.get("is_recurring") else 0, exp.get("notes"))
        )

    org = data.get("organization")
    if org:
        cursor.execute(
            "UPDATE organizations SET cash_balance = ?, monthly_burn = ? WHERE id = 'org-1'",
            (float(org.get("cash_balance", 840000.0)), float(org.get("monthly_burn", 420000.0)))
        )

    conn.commit()

def load_named_dataset_by_id(ds_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT filename FROM saved_datasets WHERE id = ?", (ds_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False

    filepath = os.path.join(DATASETS_DIR, row["filename"])
    if not os.path.exists(filepath):
        conn.close()
        return False

    with open(filepath, "r", encoding="utf-8") as f:
        payload = json.load(f)

    apply_dataset_to_tables(conn, payload.get("data", {}))
    conn.close()
    return True

def list_named_datasets() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, filename, description, invoice_count, customer_count, expense_count, created_at FROM saved_datasets ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- 7-Role RBAC Architecture & Database Authentication System ---

ROLE_PERMISSIONS = {
    "super_admin": {
        "role_name": "CashPilot Super Admin",
        "scope": "SaaS Platform",
        "is_super_admin": True,
        "can_view_saas_metrics": True,
        "can_manage_orgs": True,
        "can_view_audit_logs": True,
        "can_manage_users": True,
        "can_view_all": True,
        "can_create_invoice": True,
        "can_edit_invoice": True,
        "can_delete_invoice": True,
        "can_manage_expenses": True,
        "can_send_reminders": True,
        "can_record_promises": True,
        "can_use_ai_cfo": True,
        "can_edit_settings": True,
        "can_delete_org": True,
    },
    "owner": {
        "role_name": "Owner",
        "scope": "Organization",
        "is_super_admin": False,
        "can_view_saas_metrics": False,
        "can_manage_orgs": False,
        "can_view_audit_logs": True,
        "can_manage_users": True,
        "can_view_all": True,
        "can_create_invoice": True,
        "can_edit_invoice": True,
        "can_delete_invoice": True,
        "can_manage_expenses": True,
        "can_send_reminders": True,
        "can_record_promises": True,
        "can_use_ai_cfo": True,
        "can_edit_settings": True,
        "can_delete_org": True,
    },
    "admin": {
        "role_name": "Admin",
        "scope": "Organization",
        "is_super_admin": False,
        "can_view_saas_metrics": False,
        "can_manage_orgs": False,
        "can_view_audit_logs": True,
        "can_manage_users": True,
        "can_view_all": True,
        "can_create_invoice": True,
        "can_edit_invoice": True,
        "can_delete_invoice": True,
        "can_manage_expenses": True,
        "can_send_reminders": True,
        "can_record_promises": True,
        "can_use_ai_cfo": True,
        "can_edit_settings": True,
        "can_delete_org": False,
    },
    "finance_manager": {
        "role_name": "Finance Manager",
        "scope": "Organization",
        "is_super_admin": False,
        "can_view_saas_metrics": False,
        "can_manage_orgs": False,
        "can_view_audit_logs": False,
        "can_manage_users": False,
        "can_view_all": True,
        "can_create_invoice": True,
        "can_edit_invoice": True,
        "can_delete_invoice": False,
        "can_manage_expenses": True,
        "can_send_reminders": True,
        "can_record_promises": True,
        "can_use_ai_cfo": True,
        "can_edit_settings": False,
        "can_delete_org": False,
    },
    "accountant": {
        "role_name": "Accountant",
        "scope": "Organization",
        "is_super_admin": False,
        "can_view_saas_metrics": False,
        "can_manage_orgs": False,
        "can_view_audit_logs": False,
        "can_manage_users": False,
        "can_view_all": True,
        "can_create_invoice": True,
        "can_edit_invoice": True,
        "can_delete_invoice": False,
        "can_manage_expenses": True,
        "can_send_reminders": False,
        "can_record_promises": False,
        "can_use_ai_cfo": True,
        "can_edit_settings": False,
        "can_delete_org": False,
    },
    "collections_manager": {
        "role_name": "Collections Manager",
        "scope": "Organization",
        "is_super_admin": False,
        "can_view_saas_metrics": False,
        "can_manage_orgs": False,
        "can_view_audit_logs": False,
        "can_manage_users": False,
        "can_view_all": True,
        "can_create_invoice": False,
        "can_edit_invoice": False,
        "can_delete_invoice": False,
        "can_manage_expenses": False,
        "can_send_reminders": True,
        "can_record_promises": True,
        "can_use_ai_cfo": True,
        "can_edit_settings": False,
        "can_delete_org": False,
    },
    "viewer": {
        "role_name": "Viewer",
        "scope": "Organization",
        "is_super_admin": False,
        "can_view_saas_metrics": False,
        "can_manage_orgs": False,
        "can_view_audit_logs": False,
        "can_manage_users": False,
        "can_view_all": True,
        "can_create_invoice": False,
        "can_edit_invoice": False,
        "can_delete_invoice": False,
        "can_manage_expenses": False,
        "can_send_reminders": False,
        "can_record_promises": False,
        "can_use_ai_cfo": True,
        "can_edit_settings": False,
        "can_delete_org": False,
    },
}

def get_role_permissions(role: str) -> Dict[str, Any]:
    return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["viewer"])

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email.strip().lower(),))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    udict = dict(row)
    if udict["password_hash"] != password:
        return None
    
    perms = get_role_permissions(udict["role"])
    udict["permissions"] = perms
    return udict

def log_audit_action(user_id: str, user_name: str, user_role: str, action: str, resource: str, details: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    aid = f"audit-{int(datetime.now().timestamp() * 1000)}"
    cursor.execute(
        "INSERT INTO audit_logs (id, user_id, user_name, user_role, action, resource, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (aid, user_id, user_name, user_role, action, resource, details)
    )
    conn.commit()
    conn.close()

def get_audit_logs() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_all_users_in_org(org_id: str = "org-1") -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, full_name, role, org_id, created_at FROM users")
    rows = cursor.fetchall()
    conn.close()
    res = []
    for r in rows:
        ud = dict(r)
        ud["permissions"] = get_role_permissions(ud["role"])
        res.append(ud)
    return res

def create_user_in_org(full_name: str, email: str, role: str, org_id: str = "org-1") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    uid = f"usr-{int(datetime.now().timestamp())}"
    pwd = "password123"
    cursor.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, org_id) VALUES (?, ?, ?, ?, ?, ?)",
        (uid, email.strip().lower(), pwd, full_name, role, org_id)
    )
    conn.commit()
    conn.close()
    return {
        "id": uid,
        "email": email.strip().lower(),
        "full_name": full_name,
        "role": role,
        "org_id": org_id,
        "permissions": get_role_permissions(role)
    }

def register_user(full_name: str, email: str, password: str, role: str = "owner", org_name: str = "ABC Digital Solutions") -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email.strip().lower(),))
    if cursor.fetchone():
        conn.close()
        raise ValueError("Email address already registered.")

    uid = f"usr-{int(datetime.now().timestamp() * 1000)}"
    org_id = "org-1"
    cursor.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, org_id) VALUES (?, ?, ?, ?, ?, ?)",
        (uid, email.strip().lower(), password, full_name, role, org_id)
    )
    conn.commit()
    conn.close()
    
    return {
        "id": uid,
        "email": email.strip().lower(),
        "password_hash": password,
        "full_name": full_name,
        "role": role,
        "org_id": org_id,
        "permissions": get_role_permissions(role)
    }
