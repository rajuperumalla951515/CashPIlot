from datetime import date
import os
from typing import Literal, Optional

import httpx
import jwt
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CashPilot API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Metric(BaseModel):
    label: str
    value: str
    note: str


class Forecast(BaseModel):
    range: Literal["7 days", "30 days", "90 days"]
    projected_balance: str
    change_from_today: str
    confidence: int


class InsightRequest(BaseModel):
    question: str
    context: str = ""


class EmailRequest(BaseModel):
    to: EmailStr
    subject: str
    text: str


class WhatsAppRequest(BaseModel):
    to: str
    body: str


class UserTokenData(BaseModel):
    user_id: str
    email: Optional[str] = None
    role: Optional[str] = "authenticated"


# JWT Authorization Helper
def verify_bearer_token(authorization: Optional[str] = Header(None)) -> UserTokenData:
    if not authorization or not authorization.startswith("Bearer "):
        # Unauthenticated request
        return UserTokenData(user_id="anonymous", email=None)
    token = authorization.split(" ")[1]
    try:
        # Decode unverified header/claims for identity in development/SSR mode
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub", "anonymous")
        email = payload.get("email")
        role = payload.get("role", "authenticated")
        return UserTokenData(user_id=user_id, email=email, role=role)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Authorization Token")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "cashpilot-api", "version": "0.2.0"}


@app.get("/api/v1/auth/user")
def get_current_user(user: UserTokenData = Depends(verify_bearer_token)) -> dict[str, object]:
    return {
        "authenticated": user.user_id != "anonymous",
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role,
    }


@app.get("/api/v1/overview")
def overview(user: UserTokenData = Depends(verify_bearer_token)) -> dict[str, object]:
    return {
        "as_of": date.today().isoformat(),
        "status": "healthy",
        "runway_days": 42,
        "user_id": user.user_id,
        "metrics": [
            Metric(label="Cash available", value="₹8.4L", note="+12.8% vs last month"),
            Metric(label="Receivables", value="₹31.7L", note="₹7.9L overdue"),
            Metric(label="Payables", value="₹12.3L", note="₹4.1L due this week"),
            Metric(label="30-day inflow", value="₹24.8L", note="82% high confidence"),
        ],
        "priorities": [
            {"title": "Recover ₹2.4L", "detail": "5 overdue customers need attention", "severity": "urgent"},
            {"title": "Follow up with 8 customers", "detail": "₹4.1L due within 3 days", "severity": "warm"},
            {"title": "Delay ₹75K supplier payment", "detail": "Protect short-term cash runway", "severity": "cool"},
        ],
    }


@app.get("/api/v1/forecast", response_model=Forecast)
def forecast(range: Literal["7 days", "30 days", "90 days"] = "30 days") -> Forecast:
    projections = {
        "7 days": ("₹9.1L", "₹0.7L", 94),
        "30 days": ("₹11.2L", "₹2.8L", 82),
        "90 days": ("₹14.6L", "₹6.2L", 68),
    }
    balance, change, confidence = projections[range]
    return Forecast(range=range, projected_balance=balance, change_from_today=change, confidence=confidence)


@app.get("/api/v1/integrations/status")
def integration_status() -> dict[str, dict[str, object]]:
    return {
        "supabase": {"configured": bool(os.getenv("SUPABASE_URL") and (os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")))},
        "gemini": {"configured": bool(os.getenv("GEMINI_API_KEY"))},
        "resend": {"configured": bool(os.getenv("RESEND_API_KEY"))},
        "twilio": {"configured": bool(os.getenv("TWILIO_ACCOUNT_SID") and os.getenv("TWILIO_AUTH_TOKEN"))},
        "stripe": {"configured": bool(os.getenv("STRIPE_SECRET_KEY"))},
        "testmail": {"configured": bool(os.getenv("TESTMAIL_NAMESPACE")), "can_read": bool(os.getenv("TESTMAIL_API_KEY"))},
    }


@app.get("/api/v1/integrations/supabase/check")
async def supabase_check() -> dict[str, object]:
    project_url = os.getenv("SUPABASE_URL")
    publishable_key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not project_url or not publishable_key:
        return {"connected": False, "database_ready": False, "message": "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required."}

    headers = {"apikey": publishable_key, "Authorization": f"Bearer {publishable_key}"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{project_url}/rest/v1/organizations?select=id&limit=1", headers=headers)
    except httpx.HTTPError:
        return {"connected": False, "database_ready": False, "message": "Supabase could not be reached."}

    if response.status_code == 404:
        return {"connected": True, "database_ready": False, "message": "Supabase is reachable; run backend/supabase_schema.sql to create CashPilot tables."}
    if response.status_code in (401, 403):
        return {"connected": True, "database_ready": True, "auth_required": True, "message": "CashPilot tables are present; sign in to access workspace data."}
    if response.is_error:
        return {"connected": True, "database_ready": False, "message": "Supabase is reachable under current RLS configuration."}
    return {"connected": True, "database_ready": True, "message": "Supabase and CashPilot enterprise schema are connected."}


@app.get("/api/v1/testmail/address")
def testmail_address(tag: str = "cashpilot") -> dict[str, str | bool]:
    namespace = os.getenv("TESTMAIL_NAMESPACE")
    if not namespace:
        return {"configured": False, "message": "Set TESTMAIL_NAMESPACE to enable Testmail addresses."}
    return {"configured": True, "email": f"{namespace}.{tag}@inbox.testmail.app"}


@app.post("/api/v1/ai/insight")
async def ai_insight(request: InsightRequest) -> dict[str, str | bool]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"configured": False, "insight": "Gemini is not configured. Add GEMINI_API_KEY to enable AI insights."}

    prompt = f"You are CashPilot, an AI CFO for an IT agency. Answer concisely with a recommendation.\nQuestion: {request.question}\nContext: {request.context}"
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, params={"key": api_key}, json={"contents": [{"parts": [{"text": prompt}]}]})
    except httpx.HTTPError:
        return {"configured": True, "available": False, "insight": "Gemini could not be reached. Check network connection."}
    if response.is_error:
        return {"configured": True, "available": False, "insight": "Gemini rejected the request."}
    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"configured": True, "available": True, "insight": text}


@app.post("/api/v1/notifications/email")
async def send_email(request: EmailRequest) -> dict[str, str | bool]:
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        return {"configured": False, "status": "preview", "message": "Email provider is not configured."}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"from": os.getenv("RESEND_FROM_EMAIL", "CashPilot <updates@cashpilot.app>"), "to": [str(request.to)], "subject": request.subject, "text": request.text},
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail="Resend request failed")
    return {"configured": True, "status": "sent", "id": response.json().get("id", "")}


@app.post("/api/v1/notifications/whatsapp")
async def send_whatsapp(request: WhatsAppRequest) -> dict[str, str | bool]:
    sid, token, sender = os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"), os.getenv("TWILIO_WHATSAPP_FROM")
    if not sid or not token or not sender:
        return {"configured": False, "status": "preview", "message": "Twilio WhatsApp is not configured."}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            data={"From": f"whatsapp:{sender}", "To": f"whatsapp:{request.to}", "Body": request.body},
            auth=(sid, token),
        )
    if response.is_error:
        raise HTTPException(status_code=502, detail="Twilio request failed")
    return {"configured": True, "status": "sent", "sid": response.json().get("sid", "")}
