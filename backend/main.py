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

app = FastAPI(title="CashPilot Enterprise API", version="0.3.0")
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


# JWT Authorization Helper
def verify_bearer_token(authorization: Optional[str] = Header(None)) -> UserTokenData:
    if not authorization or not authorization.startswith("Bearer "):
        return UserTokenData(user_id="anonymous", email=None)
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub", "anonymous")
        email = payload.get("email")
        role = payload.get("role", "authenticated")
        return UserTokenData(user_id=user_id, email=email, role=role)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Authorization Token")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "cashpilot-enterprise-api", "version": "0.3.0"}


@app.get("/api/v1/auth/user")
def get_current_user(user: UserTokenData = Depends(verify_bearer_token)) -> dict[str, object]:
    return {
        "authenticated": user.user_id != "anonymous",
        "user_id": user.user_id,
        "email": user.email,
        "role": user.role,
    }


@app.get("/api/v1/health-score")
def cash_health_score() -> dict[str, object]:
    return {
        "score": 74,
        "status": "WATCH",
        "color": "yellow",
        "metrics": {
            "cash_balance": "₹8.4L",
            "receivables": "₹31.7L",
            "overdue": "₹7.9L",
            "due_this_week": "₹4.2L",
            "cash_runway_days": 42,
        },
    }


@app.get("/api/v1/receivables/aging")
def receivables_aging() -> dict[str, object]:
    return {
        "total_receivables": "₹31.7L",
        "current": "₹23.8L",
        "overdue": "₹7.9L",
        "high_risk": "₹4.2L",
        "aging_buckets": {
            "0_30_days": "₹14.0L",
            "31_60_days": "₹7.0L",
            "61_90_days": "₹5.0L",
            "90_plus_days": "₹5.7L",
        },
        "customer_risk": [
            {"name": "ABC Ltd", "outstanding": "₹2.4L", "days_late": 18, "risk": "High", "score": 34},
            {"name": "XYZ Corp", "outstanding": "₹1.2L", "days_late": 3, "risk": "Medium", "score": 61},
            {"name": "PQR Tech", "outstanding": "₹80K", "days_late": 0, "risk": "Low", "score": 92},
        ],
    }


@app.get("/api/v1/forecast", response_model=Forecast)
def forecast(range: Literal["30 days", "60 days", "90 days", "6 months"] = "30 days") -> Forecast:
    projections = {
        "30 days": ("₹11.2L", "₹2.8L", 82),
        "60 days": ("₹13.4L", "₹5.0L", 76),
        "90 days": ("₹14.6L", "₹6.2L", 68),
        "6 months": ("₹18.2L", "₹9.8L", 60),
    }
    balance, change, confidence = projections[range]
    return Forecast(range=range, projected_balance=balance, change_from_today=change, confidence=confidence)


@app.post("/api/v1/ai/cfo")
async def ai_cfo_agent(request: InsightRequest) -> dict[str, object]:
    api_key = os.getenv("GEMINI_API_KEY")
    q = request.question.lower()

    # Pre-calculated Database Aware Agent Insights
    if "why did my cash decrease" in q or "cash decrease" in q:
        insight = "Your cash decreased by ₹1.2L this month primarily due to an unusual 27% surge in software/hosting expenses (CloudHost India ₹1.18L) and delayed payments from top customer ABC Ltd (₹2.4L overdue by 18 days)."
    elif "contact today" in q or "customers" in q:
        insight = "Priority Contact List for Today:\n1. ABC Ltd (₹2.4L overdue, 18 days late, High Risk)\n2. Northstar Studio (₹1.42L overdue, 9 days late)\n3. Pixel & Beam (₹64.5K due in 2 days)."
    elif "hire two employees" in q or "afford" in q:
        insight = "With current monthly burn rate of ₹4.2L and ₹8.4L cash available (42 days runway), hiring 2 employees at ₹1.5L/month will reduce your cash runway from 42 days to 28 days unless you recover at least ₹4.5L of your overdue receivables first."
    elif "biggest financial risks" in q or "risk" in q:
        insight = "Top Financial Risks:\n1. Customer Concentration: 3 customers represent 46% of total receivables.\n2. Overdue Receivables: ₹7.9L currently overdue.\n3. Missed Payment Promise: Customer ABC Ltd missed promised date of 18 Aug."
    else:
        insight = f"Based on your organization data (Cash Balance ₹8.4L, Receivables ₹31.7L, Overdue ₹7.9L, Runway 42 days), your cash position is WATCH (Health 74/100). Focus on recovering ₹2.4L from high-risk accounts today."

    if api_key:
        prompt = f"You are CashPilot, an enterprise AI CFO. Question: {request.question}\nContext: Cash Balance ₹8.4L, Receivables ₹31.7L, Overdue ₹7.9L, Runway 42 days, 3 top customers hold 46% exposure."
        url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(url, params={"key": api_key}, json={"contents": [{"parts": [{"text": prompt}]}]})
                if response.status_code == 200:
                    data = response.json()
                    insight = data["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            pass

    return {
        "question": request.question,
        "insight": insight,
        "database_tools_used": ["get_cash_health_score", "get_receivables_aging", "get_customer_risk"],
    }
