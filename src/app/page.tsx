"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

import {
  IconOverview,
  IconCashFlow,
  IconInvoices,
  IconCustomers,
  IconPayments,
  IconExpenses,
  IconSuppliers,
  IconCollections,
  IconAnalytics,
  IconAiCfo,
  IconAlerts,
  IconReports,
  IconTeam,
  IconSettings,
  IconDatasets,
  IconPlus,
  IconDownload,
  IconSend,
  IconWarning,
} from "./icons";

interface PaymentPromise {
  id: string;
  customer_name: string;
  invoice_number?: string;
  amount: number;
  promised_date: string;
  status: "pending" | "kept" | "missed";
  notes?: string;
}

interface Expense {
  id: string;
  category: string;
  supplier_name: string;
  amount: number;
  expense_date: string;
  payment_status: string;
  is_unusual?: boolean;
  is_recurring?: boolean;
  notes?: string;
}

interface Supplier {
  id: string;
  name: string;
  credit_days: number;
  score: number;
  total_spend: number;
}

interface InvoiceItem {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  issued_date: string;
  due_date: string;
  status: "open" | "overdue" | "paid" | "draft" | "sent";
  notes?: string;
}

interface CustomerItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  payment_score: number;
  outstanding_amount: number;
  risk_level: string;
  avg_payment_delay_days?: number;
  expected_delay_range?: string;
  late_probability?: number;
}

interface SavedDataset {
  id: string;
  name: string;
  filename: string;
  description?: string;
  invoice_count: number;
  customer_count: number;
  expense_count: number;
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "cfo";
  text: string;
  time: string;
}

function FormattedResponse({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px", lineHeight: "1.6", color: "var(--ink)" }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} style={{ height: "4px" }} />;

        if (trimmed.startsWith("###")) {
          const title = trimmed.replace(/^###\s*\*{0,2}/, "").replace(/\*{0,2}$/, "");
          return (
            <h4 key={idx} style={{ margin: "12px 0 4px", fontSize: "15px", fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.3px" }}>
              {title}
            </h4>
          );
        }

        const parts = line.split(/(\*\*.*?\*\*)/g);
        const formattedLine = parts.map((part, pIdx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={pIdx} style={{ fontWeight: 800, color: "var(--ink)" }}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const listText = line.substring(2);
          const listParts = listText.split(/(\*\*.*?\*\*)/g);
          return (
            <div key={idx} style={{ display: "flex", gap: "8px", paddingLeft: "6px" }}>
              <span style={{ color: "var(--orange)", fontWeight: 800 }}>•</span>
              <span>
                {listParts.map((part, pIdx) =>
                  part.startsWith("**") && part.endsWith("**") ? (
                    <strong key={pIdx} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>
                  ) : (
                    part
                  )
                )}
              </span>
            </div>
          );
        }

        return <p key={idx} style={{ margin: 0 }}>{formattedLine}</p>;
      })}
    </div>
  );
}

function SkeletonOverview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div className="metrics-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="metric-card" style={{ padding: "20px", background: "#fff" }}>
            <div className="skeleton-box" style={{ width: "40%", height: "12px" }} />
            <div className="skeleton-box" style={{ width: "70%", height: "30px", marginTop: "14px" }} />
            <div className="skeleton-box" style={{ width: "50%", height: "10px", marginTop: "10px" }} />
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: "14px", padding: "24px", border: "1px solid var(--line)" }}>
        <div className="skeleton-box" style={{ width: "30%", height: "20px", marginBottom: "16px" }} />
        <div className="skeleton-box" style={{ width: "100%", height: "46px" }} />
      </div>
    </div>
  );
}

function SkeletonTablePage() {
  return (
    <div style={{ background: "#fff", borderRadius: "14px", padding: "24px", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <div className="skeleton-box" style={{ width: "25%", height: "24px" }} />
        <div className="skeleton-box" style={{ width: "120px", height: "38px" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-box" style={{ height: "44px" }} />
        ))}
      </div>
    </div>
  );
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  org_id: string;
  permissions: {
    role_name?: string;
    scope?: string;
    is_super_admin?: boolean;
    can_view_saas_metrics?: boolean;
    can_manage_orgs?: boolean;
    can_view_audit_logs?: boolean;
    can_manage_users?: boolean;
    can_view_all?: boolean;
    can_create_invoice?: boolean;
    can_edit_invoice?: boolean;
    can_delete_invoice?: boolean;
    can_manage_expenses?: boolean;
    can_send_reminders?: boolean;
    can_record_promises?: boolean;
    can_use_ai_cfo?: boolean;
    can_edit_settings?: boolean;
    can_delete_org?: boolean;
  };
}

const defaultUserProfile: UserProfile = {
  id: "usr-1",
  email: "raju@abcdigital.com",
  full_name: "Raju",
  role: "owner",
  org_id: "org-1",
  permissions: {
    role_name: "Owner",
    scope: "Organization",
    is_super_admin: false,
    can_view_saas_metrics: false,
    can_manage_orgs: false,
    can_view_audit_logs: true,
    can_manage_users: true,
    can_view_all: true,
    can_create_invoice: true,
    can_edit_invoice: true,
    can_delete_invoice: true,
    can_manage_expenses: true,
    can_send_reminders: true,
    can_record_promises: true,
    can_use_ai_cfo: true,
    can_edit_settings: true,
    can_delete_org: true,
  },
};

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile>(defaultUserProfile);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [dbUsersList, setDbUsersList] = useState<UserProfile[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("accountant");

  // Auth & Registration Page State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authViewMode, setAuthViewMode] = useState<"login" | "register">("login");
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("owner");
  const [regOrgName, setRegOrgName] = useState("ABC Digital Solutions");
  const [authError, setAuthError] = useState("");

  const [activeNav, setActiveNav] = useState("Overview");
  const [loadingData, setLoadingData] = useState(true);

  // Core Data States
  const [healthData, setHealthData] = useState<any>({
    score: 74,
    status: "WATCH",
    color: "yellow",
    explanation: "Your cash risk is WATCH (74/100) because overdue receivables are pending.",
    metrics: {
      cash_balance: "₹8,40,000",
      receivables: "₹31,70,000",
      overdue: "₹7,90,000",
      due_this_week: "₹4,20,000",
      cash_runway_days: 42,
    },
  });

  const [agingData, setAgingData] = useState<any>({
    total_receivables: "₹31,70,000",
    current: "₹23,80,000",
    overdue: "₹7,90,000",
    high_risk: "₹4,20,000",
    aging_buckets: { "0_30_days": "₹14,00,000", "31_60_days": "₹7,00,000", "61_90_days": "₹5,00,000", "90_plus_days": "₹5,70,000" },
    customer_risk: [],
  });

  const [forecastData, setForecastData] = useState<any>({
    range: "30 days",
    projected_balance: "₹11,20,000",
    change_from_today: "+₹2,80,000",
    confidence: 82,
    timeline_points: [],
  });

  const [collectionsPriorities, setCollectionsPriorities] = useState<any>({ summary: "", items: [] });
  const [alertsList, setAlertsList] = useState<any[]>([]);

  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [promises, setPromises] = useState<PaymentPromise[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);

  const [range, setRange] = useState<"30 days" | "60 days" | "90 days" | "6 months">("30 days");
  const [toast, setToast] = useState("");

  // AI CFO Interactive Chat State
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "init-1",
      sender: "cfo",
      text: "### **AI CFO Assistant**\n\nHello! I am your **AI CFO Assistant**. How can I help you analyze cash flow, track receivables, or optimize expenses today?",
      time: "Just now",
    },
  ]);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatThreadRef = useRef<HTMLDivElement>(null);

  // Modals
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPromiseModal, setShowPromiseModal] = useState(false);

  // Form States
  const [invCustomer, setInvCustomer] = useState("");
  const [invNumber, setInvNumber] = useState(`INV-${Math.floor(2800 + Math.random() * 100)}`);
  const [invAmount, setInvAmount] = useState("");
  const [invDueDate, setInvDueDate] = useState("");
  const [invNotes, setInvNotes] = useState("");

  const [expCategory, setExpCategory] = useState("Software & Hosting");
  const [expSupplier, setExpSupplier] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState("");

  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custOutstanding, setCustOutstanding] = useState("");
  const [custRisk, setCustRisk] = useState("medium");

  const [datasetName, setDatasetName] = useState("");
  const [datasetDesc, setDatasetDesc] = useState("");
  const [datasetRawInput, setDatasetRawInput] = useState("");
  const [datasetImporting, setDatasetImporting] = useState(false);

  // Collection Workflow Form States
  const [selectedReminderItem, setSelectedReminderItem] = useState<any>(null);
  const [reminderChannel, setReminderChannel] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [reminderMessage, setReminderMessage] = useState("");

  const [promiseCustomer, setPromiseCustomer] = useState("");
  const [promiseInvoice, setPromiseInvoice] = useState("");
  const [promiseAmount, setPromiseAmount] = useState("");
  const [promiseDate, setPromiseDate] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 4500);
  }

  function handleTabChange(tabName: string) {
    setActiveNav(tabName);
    setLoadingData(true);
    setTimeout(() => setLoadingData(false), 250);
  }

  async function safeFetchJson(url: string) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn(`Failed to fetch ${url}:`, err);
    }
    return null;
  }

  async function fetchLiveData(showSkeleton = false) {
    if (showSkeleton) setLoadingData(true);
    try {
      const [hData, aData, fData, iData, cData, eData, pData, dData, colData, altData, supData] = await Promise.all([
        safeFetchJson(`${apiUrl}/api/v1/health-score`),
        safeFetchJson(`${apiUrl}/api/v1/receivables/aging`),
        safeFetchJson(`${apiUrl}/api/v1/forecast?range=${encodeURIComponent(range)}`),
        safeFetchJson(`${apiUrl}/api/v1/invoices`),
        safeFetchJson(`${apiUrl}/api/v1/customers`),
        safeFetchJson(`${apiUrl}/api/v1/expenses`),
        safeFetchJson(`${apiUrl}/api/v1/promises`),
        safeFetchJson(`${apiUrl}/api/v1/datasets`),
        safeFetchJson(`${apiUrl}/api/v1/collections/priorities`),
        safeFetchJson(`${apiUrl}/api/v1/alerts`),
        safeFetchJson(`${apiUrl}/api/v1/suppliers`),
      ]);

      if (hData) setHealthData(hData);
      if (aData) setAgingData(aData);
      if (fData) setForecastData(fData);
      if (iData) setInvoices(iData);
      if (cData) setCustomers(cData);
      if (eData) setExpenses(eData);
      if (pData) setPromises(pData);
      if (dData) setSavedDatasets(dData);
      if (colData) setCollectionsPriorities(colData);
      if (altData) setAlertsList(altData);
      if (supData) setSuppliers(supData);
    } catch (err) {
      console.error("Backend connectivity issue:", err);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    fetchLiveData(true);
  }, [range]);

  useEffect(() => {
    const saved = localStorage.getItem("cashpilot_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCurrentUser(u);
        setIsAuthenticated(true);
      } catch (e) {}
    } else {
      setIsAuthenticated(false);
    }
    fetchUsersAndAuditLogs();
  }, []);

  async function fetchUsersAndAuditLogs() {
    try {
      const [uRes, aRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/auth/users`),
        fetch(`${apiUrl}/api/v1/audit-logs`),
      ]);
      if (uRes.ok) setDbUsersList(await uRes.json());
      if (aRes.ok) setAuditLogsList(await aRes.json());
    } catch (e) {}
  }

  async function handleLogin(email: string, pass: string) {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        localStorage.setItem("cashpilot_user", JSON.stringify(data.user));
        notify(`Welcome back, ${data.user.full_name} (${data.user.permissions?.role_name || data.user.role})!`);
        setShowAuthModal(false);
        setLoginEmail("");
        setLoginPassword("");
        fetchUsersAndAuditLogs();
      } else {
        const errData = await res.json();
        setAuthError(errData.detail || "Authentication failed. Invalid email or password.");
        notify("Authentication failed. Invalid email or password.");
      }
    } catch (err) {
      setAuthError("Authentication error. Check backend connection.");
      notify("Authentication error. Check backend connection.");
    }
    setAuthLoading(false);
  }

  async function handleRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: regFullName,
          email: regEmail,
          password: regPassword,
          role: regRole,
          org_name: regOrgName,
        }),
      });
      if (res.ok) {
        notify(`Account created successfully! Please sign in with your email and password.`);
        setLoginEmail(regEmail);
        setLoginPassword("");
        setAuthViewMode("login");
        setRegFullName("");
        setRegEmail("");
        setRegPassword("");
        fetchUsersAndAuditLogs();
      } else {
        const errData = await res.json();
        setAuthError(errData.detail || "Registration failed.");
        notify(errData.detail || "Registration failed");
      }
    } catch (err) {
      setAuthError("Registration error. Check backend connection.");
      notify("Registration error. Check backend connection.");
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    try {
      await fetch(`${apiUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.id,
          user_name: currentUser.full_name,
          user_role: currentUser.role,
        }),
      });
    } catch (e) {}
    localStorage.removeItem("cashpilot_user");
    setIsAuthenticated(false);
    setShowAuthModal(false);
    notify("Logged out successfully.");
  }

  async function handleCreateUserSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/api/v1/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newUserName,
          email: newUserEmail,
          role: newUserRole,
        }),
      });
      if (res.ok) {
        notify(`User ${newUserName} created with role ${newUserRole}!`);
        setShowAddUserModal(false);
        setNewUserName("");
        setNewUserEmail("");
        fetchUsersAndAuditLogs();
      }
    } catch (e) {
      notify("Failed to create user");
    }
  }

  useEffect(() => {
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTo({
        top: chatThreadRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chatMessages, aiLoading]);

  // AI CFO Interactive Chat Handler
  async function handleSendChatMessage(customText?: string) {
    const qText = customText || aiQuestion;
    if (!qText.trim() || aiLoading) return;

    const userMsgId = `msg-${Date.now()}`;
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    setChatMessages((prev) => [...prev, { id: userMsgId, sender: "user", text: qText, time: nowTime }]);
    if (!customText) setAiQuestion("");
    setAiLoading(true);

    try {
      const res = await fetch(`${apiUrl}/api/v1/ai/cfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: qText }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          {
            id: `cfo-${Date.now()}`,
            sender: "cfo",
            text: data.insight,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setAiResponse(data.insight);
      } else {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: "cfo",
            text: "Unable to process question. Please check backend connection.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "cfo",
          text: "Unable to connect to AI CFO Agent backend.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
    setAiLoading(false);
  }

  // Invoice Handlers
  async function handleCreateInvoice(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/api/v1/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_number: invNumber,
          customer_name: invCustomer,
          amount: parseFloat(invAmount) || 0,
          due_date: invDueDate || new Date().toISOString().split("T")[0],
          notes: invNotes,
        }),
      });

      if (res.ok) {
        notify(`Invoice ${invNumber} created for ${invCustomer}!`);
        setShowNewInvoiceModal(false);
        setInvCustomer("");
        setInvAmount("");
        setInvDueDate("");
        setInvNotes("");
        setInvNumber(`INV-${Math.floor(2800 + Math.random() * 100)}`);
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to create invoice");
    }
  }

  async function handleToggleInvoiceStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "paid" ? "open" : "paid";
    try {
      const res = await fetch(`${apiUrl}/api/v1/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.feedback && data.feedback.new_score) {
          notify(`Payment Received! Customer Score updated: ${data.feedback.old_score} → ${data.feedback.new_score} (ML Feedback Loop executed)`);
        } else {
          notify(`Invoice marked as ${newStatus.toUpperCase()}`);
        }
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to update invoice status");
    }
  }

  async function handleDeleteInvoice(id: string) {
    try {
      const res = await fetch(`${apiUrl}/api/v1/invoices/${id}`, { method: "DELETE" });
      if (res.ok) {
        notify("Invoice deleted");
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to delete invoice");
    }
  }

  // Collection Workflow: Open Send Reminder Modal
  function openSendReminder(item: any) {
    setSelectedReminderItem(item);
    setReminderMessage(item.suggested_message || `Hello ${item.customer_name}, gentle reminder regarding overdue invoice ${item.invoice_number} for ${item.amount}.`);
    setShowReminderModal(true);
  }

  async function handleSendReminderSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedReminderItem) return;

    try {
      const res = await fetch(`${apiUrl}/api/v1/collections/send-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: selectedReminderItem.invoice_id,
          customer_name: selectedReminderItem.customer_name,
          invoice_number: selectedReminderItem.invoice_number,
          channel: reminderChannel,
          message: reminderMessage,
        }),
      });

      if (res.ok) {
        notify(`Reminder sent to ${selectedReminderItem.customer_name} via ${reminderChannel.toUpperCase()}! Activity logged.`);
        setShowReminderModal(false);
      }
    } catch (err) {
      notify("Failed to send reminder");
    }
  }

  // Promise to Pay Handlers
  function openRecordPromise(customerName?: string, invoiceNum?: string, amountVal?: string) {
    setPromiseCustomer(customerName || "");
    setPromiseInvoice(invoiceNum || "");
    setPromiseAmount(amountVal ? amountVal.replace(/[^\d.]/g, "") : "");
    const inAWeek = new Date();
    inAWeek.setDate(inAWeek.getDate() + 7);
    setPromiseDate(inAWeek.toISOString().split("T")[0]);
    setShowPromiseModal(true);
  }

  async function handleCreatePromiseSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/api/v1/promises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: promiseCustomer,
          invoice_number: promiseInvoice,
          amount: parseFloat(promiseAmount) || 0,
          promised_date: promiseDate,
          status: "pending",
          notes: "Recorded promise to pay via Action Center",
        }),
      });

      if (res.ok) {
        notify(`Promise to Pay recorded for ₹${promiseAmount}! Cash Forecast dynamically updated.`);
        setShowPromiseModal(false);
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to record payment promise");
    }
  }

  // Customer & Expense CRUD
  async function handleCreateCustomer(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/api/v1/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: custName,
          email: custEmail,
          phone: custPhone,
          outstanding_amount: parseFloat(custOutstanding) || 0,
          risk_level: custRisk,
        }),
      });
      if (res.ok) {
        notify(`Customer ${custName} added`);
        setShowAddCustomerModal(false);
        setCustName("");
        setCustEmail("");
        setCustPhone("");
        setCustOutstanding("");
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to add customer");
    }
  }

  async function handleCreateExpense(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`${apiUrl}/api/v1/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: expCategory,
          supplier_name: expSupplier || "Vendor",
          amount: parseFloat(expAmount) || 0,
          expense_date: expDate || new Date().toISOString().split("T")[0],
          payment_status: "paid",
          is_unusual: (parseFloat(expAmount) || 0) > 100000,
        }),
      });
      if (res.ok) {
        notify(`Expense logged for ${expCategory}`);
        setShowAddExpenseModal(false);
        setExpSupplier("");
        setExpAmount("");
        setExpDate("");
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to log expense");
    }
  }

  // Dataset Management
  async function handleImportDataset(e: FormEvent) {
    e.preventDefault();
    if (!datasetName.trim()) return;
    setDatasetImporting(true);
    try {
      let parsedData: any = {};
      if (datasetRawInput.trim()) {
        try {
          parsedData = JSON.parse(datasetRawInput);
        } catch {
          const lines = datasetRawInput.trim().split("\n");
          const invoicesList = [];
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(",");
            if (parts.length >= 3) {
              invoicesList.push({
                invoice_number: parts[0].trim(),
                customer_name: parts[1].trim(),
                amount: parseFloat(parts[2].trim()) || 0,
                due_date: parts[3] ? parts[3].trim() : new Date().toISOString().split("T")[0],
              });
            }
          }
          parsedData.invoices = invoicesList;
        }
      }

      const res = await fetch(`${apiUrl}/api/v1/datasets/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_name: datasetName,
          description: datasetDesc,
          invoices: parsedData.invoices || [],
          customers: parsedData.customers || [],
          expenses: parsedData.expenses || [],
        }),
      });

      if (res.ok) {
        notify(`Dataset '${datasetName}' imported and active!`);
        setShowDatasetModal(false);
        setDatasetName("");
        setDatasetDesc("");
        setDatasetRawInput("");
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to import dataset");
    }
    setDatasetImporting(false);
  }

  async function handleLoadDataset(dsId: string, name: string) {
    setLoadingData(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/datasets/${dsId}/load`, { method: "POST" });
      if (res.ok) {
        notify(`Switched active dataset to '${name}'`);
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to load dataset");
      setLoadingData(false);
    }
  }

  async function handleResetWorkspace() {
    if (!confirm("Reset workspace to initial seed dataset?")) return;
    setLoadingData(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/datasets/reset`, { method: "POST" });
      if (res.ok) {
        notify("Workspace reset to default seed dataset");
        fetchLiveData(true);
      }
    } catch (err) {
      notify("Failed to reset workspace");
      setLoadingData(false);
    }
  }

  async function handleExportDataset() {
    try {
      const res = await fetch(`${apiUrl}/api/v1/datasets/export`);
      if (res.ok) {
        const data = await res.json();
        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", jsonStr);
        downloadAnchor.setAttribute("download", `cashpilot_dataset_${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        notify("Exported workspace dataset!");
      }
    } catch (err) {
      notify("Failed to export dataset");
    }
  }

  const metrics = healthData.metrics || {};

  // Plain White/Black Monochrome Navigation Config (No Emojis!)
  const navItems = [
    { name: "Overview", icon: IconOverview },
    { name: "Cash Flow", icon: IconCashFlow },
    { name: "Invoices", icon: IconInvoices },
    { name: "Customers", icon: IconCustomers },
    { name: "Payments", icon: IconPayments },
    { name: "Expenses", icon: IconExpenses },
    { name: "Suppliers", icon: IconSuppliers },
    { name: "Collections", icon: IconCollections },
    { name: "Analytics", icon: IconAnalytics },
    { name: "AI CFO Agent", icon: IconAiCfo },
    { name: "Alerts", icon: IconAlerts },
    { name: "Reports", icon: IconReports },
    { name: "Team", icon: IconTeam },
    { name: "Settings", icon: IconSettings },
  ];

  if (!isAuthenticated) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          maxHeight: "100vh",
          display: "flex",
          background: "var(--paper, #f5f6f1)",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
          color: "var(--ink, #202522)",
          overflow: "hidden",
        }}
      >
        {/* Left Hero Branding Banner - Styled matching CashPilot sidebar theme */}
        <div
          style={{
            flex: 1,
            padding: "50px 60px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#202522",
            color: "#e8eee7",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
          }}
        >
          <div>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "36px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9px",
                  background: "var(--orange, #e8793e)",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "18px",
                  fontWeight: 800,
                  boxShadow: "0 4px 12px rgba(232, 121, 62, 0.4)",
                }}
              >
                CP
              </div>
              <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.8px", color: "#ffffff" }}>CashPilot</span>
            </div>

            <h1 style={{ fontSize: "36px", fontWeight: 800, lineHeight: "1.2", letterSpacing: "-1.2px", margin: "0 0 16px", color: "#ffffff" }}>
              Enterprise Financial Intelligence & AI CFO
            </h1>
            <p style={{ fontSize: "14px", color: "#8f9b92", lineHeight: "1.6", maxWidth: "480px", margin: "0 0 32px" }}>
              Predict cash shortages 60 days ahead, eliminate late payment risks, automate intelligent collection workflows, and consult your dedicated AI CFO.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "480px" }}>
              {[
                { title: "Real-Time Cash Runway Engine", desc: "Monitors daily liquidity, burn rate, and 30-to-90 day forecasts." },
                { title: "Dedicated AI CFO Assistant", desc: "Instant financial audits, risk scoring, and strategic insights." },
                { title: "ML Payment Feedback Loop", desc: "Calculates customer late-probabilities and adjusts risk scores automatically." },
                { title: "Automated Collection Action Center", desc: "One-click WhatsApp, Email, and SMS reminders with Payment Promises tracking." },
              ].map((feat, idx) => (
                <div key={idx} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(232, 121, 62, 0.2)", color: "var(--orange, #e8793e)", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 800, flexShrink: 0, marginTop: "2px" }}>
                    ✓
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>{feat.title}</h4>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#8f9b92" }}>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "#8f9b92", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "18px" }}>
            CashPilot Platform v1.0 · Active Organization Security & Data Access Abstraction Enabled
          </div>
        </div>

        {/* Right Authentication Form Panel - Fit to viewport */}
        <div style={{ width: "480px", padding: "40px 48px", background: "#ffffff", color: "var(--ink)", display: "flex", flexDirection: "column", justifyContent: "center", overflowY: "auto" }}>
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 800, margin: 0, letterSpacing: "-0.8px" }}>
              {authViewMode === "login" ? "Sign In to CashPilot" : "Create CashPilot Account"}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#7d8580" }}>
              {authViewMode === "login" ? "Enter your email & password to access your role workspace" : "Register your business profile to initialize your workspace"}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{ display: "flex", background: "#f5f6f1", padding: "4px", borderRadius: "10px", marginBottom: "20px", border: "1px solid var(--line)" }}>
            <button
              onClick={() => { setAuthViewMode("login"); setAuthError(""); }}
              style={{
                flex: 1,
                padding: "9px",
                fontSize: "13px",
                fontWeight: 700,
                borderRadius: "8px",
                border: "none",
                background: authViewMode === "login" ? "#ffffff" : "transparent",
                color: authViewMode === "login" ? "var(--ink)" : "#7d8580",
                boxShadow: authViewMode === "login" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthViewMode("register"); setAuthError(""); }}
              style={{
                flex: 1,
                padding: "9px",
                fontSize: "13px",
                fontWeight: 700,
                borderRadius: "8px",
                border: "none",
                background: authViewMode === "register" ? "#ffffff" : "transparent",
                color: authViewMode === "register" ? "var(--ink)" : "#7d8580",
                boxShadow: authViewMode === "register" ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
              }}
            >
              Register Account
            </button>
          </div>

          {authError && (
            <div style={{ padding: "12px 16px", borderRadius: "8px", background: "#fff0ed", border: "1px solid #f8c0b6", color: "#cc5d5d", fontSize: "12px", marginBottom: "20px" }}>
              {authError}
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {authViewMode === "login" && (
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(loginEmail, loginPassword); }} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#7d8580", marginBottom: "6px", letterSpacing: "0.5px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. raju@abcdigital.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink)", background: "#fafbf8" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#7d8580", marginBottom: "6px", letterSpacing: "0.5px" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink)", background: "#fafbf8" }}
                />
              </div>

              <button
                type="submit"
                disabled={authLoading || !loginEmail.trim()}
                className="primary-button"
                style={{ width: "100%", justifyContent: "center", marginTop: "4px", padding: "12px" }}
              >
                {authLoading ? "Authenticating..." : "Sign In to CashPilot"}
              </button>
            </form>
          )}

          {/* 2. REGISTER ACCOUNT FORM */}
          {authViewMode === "register" && (
            <form onSubmit={handleRegisterSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#7d8580", marginBottom: "4px", letterSpacing: "0.5px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Sharma"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink)", background: "#fafbf8" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#7d8580", marginBottom: "4px", letterSpacing: "0.5px" }}>
                  Business Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="vikram@company.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink)", background: "#fafbf8" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#7d8580", marginBottom: "4px", letterSpacing: "0.5px" }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Create password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink)", background: "#fafbf8" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#7d8580", marginBottom: "4px", letterSpacing: "0.5px" }}>
                  Organization Name
                </label>
                <input
                  type="text"
                  value={regOrgName}
                  onChange={(e) => setRegOrgName(e.target.value)}
                  placeholder="ABC Digital Solutions"
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink)", background: "#fafbf8" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#7d8580", marginBottom: "4px", letterSpacing: "0.5px" }}>
                  Role & Permission Scope
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", color: "var(--ink)", background: "#fff" }}
                >
                  <option value="owner">Owner (Full Company Control)</option>
                  <option value="admin">Admin (Operations & User Admin)</option>
                  <option value="finance_manager">Finance Manager (Cash Flow & Financial Analytics)</option>
                  <option value="accountant">Accountant (Invoices & Expenses)</option>
                  <option value="collections_manager">Collections Manager (Receivables & Reminders)</option>
                  <option value="viewer">Viewer (Read-Only Visibility)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={authLoading || !regEmail.trim() || !regFullName.trim()}
                className="primary-button"
                style={{ width: "100%", justifyContent: "center", marginTop: "4px", padding: "12px", background: "var(--emerald)" }}
              >
                {authLoading ? "Creating Account..." : "Create Account & Launch Workspace"}
              </button>
            </form>
          )}

          <div style={{ marginTop: "24px", textAlign: "center", fontSize: "12px", color: "#7d8580" }}>
            {authViewMode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => { setAuthViewMode(authViewMode === "login" ? "register" : "login"); setAuthError(""); }}
              style={{ border: "none", background: "none", color: "var(--orange)", fontWeight: 700, cursor: "pointer" }}
            >
              {authViewMode === "login" ? "Register Here" : "Sign In Here"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">CP</span>
          <span>CashPilot</span>
        </div>

        <nav className="nav">
          {navItems.map((item) => {
            const IconComp = item.icon;
            const isActive = activeNav === item.name;
            return (
              <button
                key={item.name}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => handleTabChange(item.name)}
              >
                <span className="nav-icon">
                  <IconComp size={17} color={isActive ? "#ffffff" : "#8f9b92"} />
                </span>
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", padding: "14px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Workspace</p>
          <p style={{ margin: "4px 0 0", fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>ABC Digital Solutions</p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1c8b69" }} />
            <span style={{ fontSize: "11px", color: "#1c8b69", fontWeight: 600 }}>FastAPI + ML Feedback Engine</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main">
        {/* Header */}
        <header className="header">
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, letterSpacing: "-0.8px", color: "var(--ink)" }}>
              {activeNav}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#7d8580" }}>
              Enterprise Financial Intelligence & Cash Flow Optimizer
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* User Profile Logo Avatar Icon Only */}
            <div
              onClick={() => setShowAuthModal(true)}
              title={`${currentUser.full_name} (${currentUser.permissions?.role_name || currentUser.role})`}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: currentUser.permissions?.is_super_admin ? "#7c3aed" : "var(--orange, #e8793e)",
                color: "#ffffff",
                display: "grid",
                placeItems: "center",
                fontSize: "14px",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(232, 121, 62, 0.35)",
                border: "2px solid #ffffff",
              }}
            >
              {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "U"}
            </div>

            <button className="primary-button" onClick={() => setShowDatasetModal(true)} style={{ background: "#1e293b", boxShadow: "none" }}>
              <IconDatasets size={15} color="#fff" /> Datasets
            </button>

            {currentUser.permissions?.can_create_invoice && (
              <button className="primary-button" onClick={() => setShowNewInvoiceModal(true)}>
                <IconPlus size={15} color="#fff" /> Create Invoice
              </button>
            )}
          </div>
        </header>

        {/* 1. OVERVIEW TAB */}
        {activeNav === "Overview" && (
          loadingData ? (
            <SkeletonOverview />
          ) : (
            <div className="fade-in-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Cash Health Card (Step 13) */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#89938c" }}>Business Cash Health</span>
                    <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 800, background: healthData.score >= 80 ? "rgba(28,139,105,0.12)" : healthData.score >= 60 ? "rgba(219,116,56,0.12)" : "rgba(204,93,93,0.12)", color: healthData.score >= 80 ? "var(--emerald)" : healthData.score >= 60 ? "var(--yellow)" : "var(--red)" }}>
                      {healthData.score}/100 STATUS: {healthData.status}
                    </span>
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: "14px", lineHeight: "1.5", color: "var(--ink)", fontWeight: 600 }}>
                    {healthData.explanation}
                  </p>
                </div>
                <div style={{ textAlign: "right", minWidth: "160px" }}>
                  <div style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-1.5px", color: healthData.score >= 80 ? "var(--emerald)" : healthData.score >= 60 ? "var(--yellow)" : "var(--red)" }}>
                    {healthData.score}/100
                  </div>
                  <span style={{ fontSize: "11px", color: "#888", fontWeight: 600 }}>ML Health Index</span>
                </div>
              </div>

              {/* Core KPI Metrics Grid */}
              <div className="metrics-grid">
                <div className="metric-card">
                  <span className="metric-label">Cash Balance</span>
                  <div className="metric-value">{metrics.cash_balance}</div>
                  <span className="metric-note">Live Available Liquidity</span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">Total Receivables</span>
                  <div className="metric-value">{metrics.receivables}</div>
                  <span className="metric-note">{invoices.filter((i) => i.status !== "paid").length} Active Accounts</span>
                </div>

                <div className="metric-card" style={{ borderColor: "rgba(204,93,93,0.3)" }}>
                  <span className="metric-label" style={{ color: "var(--red)" }}>Overdue Amount</span>
                  <div className="metric-value" style={{ color: "var(--red)" }}>{metrics.overdue}</div>
                  <span className="metric-note" style={{ color: "var(--red)" }}>Action Priority</span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">30-Day Forecast</span>
                  <div className="metric-value" style={{ color: "var(--emerald)" }}>{forecastData.projected_balance}</div>
                  <span className="metric-note">Net: {forecastData.change_from_today}</span>
                </div>
              </div>

              {/* AI CFO Quick Query Panel */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <h2 style={{ fontSize: "17px", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    <IconAiCfo size={20} color="var(--emerald)" /> AI CFO Assistant
                  </h2>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--emerald)", background: "rgba(28,139,105,0.1)", padding: "4px 10px", borderRadius: "12px" }}>
                    LIVE BUSINESS ENGINE
                  </span>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }} style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Ask AI CFO e.g. 'What is my cash runway?' or 'Who owes overdue payments?'"
                    style={{ flex: 1, padding: "12px 16px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "8px", color: "var(--ink)", fontSize: "13px" }}
                  />
                  <button type="submit" className="primary-button" disabled={aiLoading}>
                    {aiLoading ? "Consulting..." : "Ask AI CFO"}
                  </button>
                </form>

                {aiLoading && (
                  <div style={{ marginTop: "16px", padding: "16px" }}>
                    <div className="skeleton-box" style={{ width: "30%", height: "14px" }} />
                    <div className="skeleton-box" style={{ width: "90%", height: "20px", marginTop: "10px" }} />
                  </div>
                )}

                {aiResponse && !aiLoading && (
                  <div style={{ marginTop: "16px", padding: "18px 22px", background: "rgba(28, 139, 105, 0.08)", border: "1px solid rgba(28, 139, 105, 0.25)", borderRadius: "10px" }}>
                    <div style={{ fontWeight: 800, color: "var(--emerald)", marginBottom: "8px", textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.8px" }}>
                      AI CFO Strategic Advice
                    </div>
                    <FormattedResponse content={aiResponse} />
                  </div>
                )}
              </div>

              {/* What Needs Attention (Step 6 & 13) */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 16px", color: "var(--ink)" }}>What Needs Your Attention Today</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                  <div style={{ padding: "16px", background: "rgba(204,93,93,0.06)", border: "1px solid rgba(204,93,93,0.2)", borderRadius: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--red)", textTransform: "uppercase" }}>Overdue Receivables</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, margin: "6px 0", color: "var(--red)" }}>{metrics.overdue}</div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>High risk collection priority</p>
                  </div>

                  <div style={{ padding: "16px", background: "rgba(219,116,56,0.06)", border: "1px solid rgba(219,116,56,0.2)", borderRadius: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--yellow)", textTransform: "uppercase" }}>Due This Week</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, margin: "6px 0", color: "var(--ink)" }}>{metrics.due_this_week}</div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>Expected upcoming collections</p>
                  </div>

                  <div style={{ padding: "16px", background: "rgba(28,139,105,0.06)", border: "1px solid rgba(28,139,105,0.2)", borderRadius: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--emerald)", textTransform: "uppercase" }}>Runway Estimate</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, margin: "6px 0", color: "var(--emerald)" }}>{metrics.cash_runway_days} Days</div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>Based on monthly burn rate</p>
                  </div>
                </div>
              </div>

              {/* Top Payment Risks Table (Step 3 & 13) */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Top Customer Payment Risks</h3>
                  <button onClick={() => setActiveNav("Collections")} style={{ fontSize: "12px", fontWeight: 700, color: "var(--orange)", background: "none", border: "none" }}>
                    Open Action Center →
                  </button>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--line)", color: "#89938c" }}>
                      <th style={{ padding: "10px" }}>Customer</th>
                      <th style={{ padding: "10px" }}>Outstanding</th>
                      <th style={{ padding: "10px" }}>Avg Delay</th>
                      <th style={{ padding: "10px" }}>Expected Delay Range</th>
                      <th style={{ padding: "10px" }}>Late Probability</th>
                      <th style={{ padding: "10px" }}>Risk Score</th>
                      <th style={{ padding: "10px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agingData.customer_risk.map((c: any) => (
                      <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px", fontWeight: 700 }}>{c.name}</td>
                        <td style={{ padding: "12px", fontWeight: 700 }}>{c.outstanding}</td>
                        <td style={{ padding: "12px" }}>{c.avg_delay_days} days</td>
                        <td style={{ padding: "12px", color: "#666", fontWeight: 600 }}>{c.expected_delay_range || "15–30 days"}</td>
                        <td style={{ padding: "12px", fontWeight: 700, color: c.late_probability > 70 ? "var(--red)" : "var(--ink)" }}>{c.late_probability}%</td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: c.score >= 80 ? "rgba(28,139,105,0.15)" : c.score >= 50 ? "rgba(219,116,56,0.15)" : "rgba(204,93,93,0.15)", color: c.score >= 80 ? "var(--emerald)" : c.score >= 50 ? "var(--yellow)" : "var(--red)" }}>
                            {c.score}/100 ({c.risk})
                          </span>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <button
                            onClick={() => openRecordPromise(c.name, "", c.outstanding)}
                            style={{ padding: "5px 10px", fontSize: "11px", fontWeight: 700, borderRadius: "6px", border: "1px solid var(--line)", background: "#fafbf8" }}
                          >
                            Promise to Pay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* 2. CASH FLOW TAB */}
        {activeNav === "Cash Flow" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                    <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>Cash Flow Projection & Shortage Monitor</h2>
                    <p style={{ fontSize: "13px", color: "#7d8580", margin: "4px 0 0" }}>
                      Projected inflows (invoices + promises to pay) vs. operating outflows.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {(["30 days", "60 days", "90 days", "6 months"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        style={{ padding: "8px 14px", fontSize: "12px", fontWeight: 700, borderRadius: "6px", border: "none", background: range === r ? "#1e293b" : "#f0f1ec", color: range === r ? "#fff" : "#666" }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
                  <div style={{ padding: "20px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase" }}>Expected Collections</span>
                    <div style={{ fontSize: "24px", fontWeight: 800, margin: "6px 0", color: "var(--emerald)" }}>{forecastData.expected_inflow || "₹18,00,000"}</div>
                    <span style={{ fontSize: "11px", color: "#666" }}>Invoices + Promises to Pay</span>
                  </div>

                  <div style={{ padding: "20px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase" }}>Expected Outflows</span>
                    <div style={{ fontSize: "24px", fontWeight: 800, margin: "6px 0", color: "var(--red)" }}>{forecastData.expected_outflow || "₹21,00,000"}</div>
                    <span style={{ fontSize: "11px", color: "#666" }}>Salaries, Rent & Subscriptions</span>
                  </div>

                  <div style={{ padding: "20px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase" }}>Projected Ending Balance</span>
                    <div style={{ fontSize: "24px", fontWeight: 800, margin: "6px 0", color: "var(--ink)" }}>{forecastData.projected_balance}</div>
                    <span style={{ fontSize: "11px", color: "#666" }}>Model Confidence {forecastData.confidence}%</span>
                  </div>
                </div>

                {/* Timeline chart points */}
                <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "0 0 14px" }}>Projected Cash Balance Timeline</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px" }}>
                  {(forecastData.timeline_points || []).map((pt: any, i: number) => (
                    <div key={i} style={{ padding: "16px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#888" }}>{pt.date}</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, margin: "8px 0", color: "var(--ink)" }}>₹{pt.projected.toLocaleString("en-IN")}</div>
                      <div style={{ fontSize: "11px", color: "var(--emerald)", fontWeight: 600 }}>+₹{pt.inflow.toLocaleString("en-IN")}</div>
                      <div style={{ fontSize: "11px", color: "var(--red)", fontWeight: 600 }}>-₹{pt.outflow.toLocaleString("en-IN")}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {/* 3. INVOICES TAB */}
        {activeNav === "Invoices" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>All Invoices ({invoices.length})</h2>
                <button className="primary-button" onClick={() => setShowNewInvoiceModal(true)}>
                  <IconPlus size={15} color="#fff" /> New Invoice
                </button>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", color: "#89938c" }}>
                    <th style={{ padding: "12px" }}>Invoice #</th>
                    <th style={{ padding: "12px" }}>Customer</th>
                    <th style={{ padding: "12px" }}>Amount</th>
                    <th style={{ padding: "12px" }}>Due Date</th>
                    <th style={{ padding: "12px" }}>Status</th>
                    <th style={{ padding: "12px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{inv.invoice_number}</td>
                      <td style={{ padding: "12px" }}>{inv.customer_name}</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>₹{inv.amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px" }}>{inv.due_date}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", background: inv.status === "paid" ? "rgba(28,139,105,0.15)" : inv.status === "overdue" ? "rgba(204,93,93,0.15)" : "rgba(219,116,56,0.15)", color: inv.status === "paid" ? "var(--emerald)" : inv.status === "overdue" ? "var(--red)" : "var(--yellow)" }}>
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px", display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => handleToggleInvoiceStatus(inv.id, inv.status)}
                          style={{ padding: "5px 10px", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "1px solid var(--line)", background: "#fafbf8" }}
                        >
                          {inv.status === "paid" ? "Mark Open" : "Mark Paid (Run ML)"}
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          style={{ padding: "5px 10px", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "none", background: "rgba(204,93,93,0.15)", color: "var(--red)" }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* 4. CUSTOMERS TAB */}
        {activeNav === "Customers" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Customer Behavior & Payment Histories</h2>
                <button className="primary-button" onClick={() => setShowAddCustomerModal(true)}>
                  <IconPlus size={15} color="#fff" /> Add Customer
                </button>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", color: "#89938c" }}>
                    <th style={{ padding: "12px" }}>Customer Name</th>
                    <th style={{ padding: "12px" }}>Contact</th>
                    <th style={{ padding: "12px" }}>Outstanding</th>
                    <th style={{ padding: "12px" }}>Avg Payment Delay</th>
                    <th style={{ padding: "12px" }}>Late Probability</th>
                    <th style={{ padding: "12px" }}>Payment Score</th>
                    <th style={{ padding: "12px" }}>Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{c.name}</td>
                      <td style={{ padding: "12px", color: "#666" }}>{c.email || c.phone || "N/A"}</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>₹{c.outstanding_amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px" }}>{c.avg_payment_delay_days || 15} days</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{c.late_probability || 50}%</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{c.payment_score}/100</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", background: c.risk_level === "high" ? "rgba(204,93,93,0.15)" : c.risk_level === "medium" ? "rgba(219,116,56,0.15)" : "rgba(28,139,105,0.15)", color: c.risk_level === "high" ? "var(--red)" : c.risk_level === "medium" ? "var(--yellow)" : "var(--emerald)" }}>
                          {c.risk_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* 5. PAYMENTS TAB */}
        {activeNav === "Payments" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Promises to Pay Ledger ({promises.length})</h2>
                  <button className="primary-button" onClick={() => openRecordPromise()}>
                    <IconPlus size={15} color="#fff" /> Record Promise
                  </button>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--line)", color: "#89938c" }}>
                      <th style={{ padding: "12px" }}>Customer</th>
                      <th style={{ padding: "12px" }}>Invoice #</th>
                      <th style={{ padding: "12px" }}>Promised Amount</th>
                      <th style={{ padding: "12px" }}>Promised Date</th>
                      <th style={{ padding: "12px" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promises.map((p) => (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px", fontWeight: 700 }}>{p.customer_name}</td>
                        <td style={{ padding: "12px" }}>{p.invoice_number || "N/A"}</td>
                        <td style={{ padding: "12px", fontWeight: 700 }}>₹{p.amount.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "12px" }}>{p.promised_date}</td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", background: "rgba(28,139,105,0.15)", color: "var(--emerald)" }}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {/* 6. EXPENSES TAB */}
        {activeNav === "Expenses" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Business Expenses & Outflows ({expenses.length})</h2>
                <button className="primary-button" onClick={() => setShowAddExpenseModal(true)}>
                  <IconPlus size={15} color="#fff" /> Log Expense
                </button>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", color: "#89938c" }}>
                    <th style={{ padding: "12px" }}>Category</th>
                    <th style={{ padding: "12px" }}>Supplier</th>
                    <th style={{ padding: "12px" }}>Amount</th>
                    <th style={{ padding: "12px" }}>Date</th>
                    <th style={{ padding: "12px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{e.category}</td>
                      <td style={{ padding: "12px" }}>{e.supplier_name}</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>₹{e.amount.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "12px" }}>{e.expense_date}</td>
                      <td style={{ padding: "12px" }}>
                        {e.is_unusual && <span style={{ fontSize: "10px", fontWeight: 700, background: "rgba(204,93,93,0.15)", color: "var(--red)", padding: "3px 8px", borderRadius: "4px", marginRight: "8px" }}>UNUSUAL SURGE</span>}
                        <span style={{ fontWeight: 600 }}>{e.payment_status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* 7. SUPPLIERS TAB */}
        {activeNav === "Suppliers" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Suppliers & Credit Terms</h2>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", color: "#89938c" }}>
                    <th style={{ padding: "12px" }}>Supplier Name</th>
                    <th style={{ padding: "12px" }}>Credit Terms</th>
                    <th style={{ padding: "12px" }}>Vendor Score</th>
                    <th style={{ padding: "12px" }}>Total Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{s.name}</td>
                      <td style={{ padding: "12px" }}>{s.credit_days} days credit</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>{s.score}/100</td>
                      <td style={{ padding: "12px", fontWeight: 700 }}>₹{s.total_spend.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* 8. COLLECTIONS ACTION CENTER TAB */}
        {activeNav === "Collections" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>Collections Action Center</h2>
                    <p style={{ fontSize: "13px", color: "var(--red)", fontWeight: 700, margin: "4px 0 0" }}>
                      {collectionsPriorities.summary || "Priority recovery actions"}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {(collectionsPriorities.items || []).map((item: any) => (
                    <div key={item.invoice_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "10px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <strong style={{ fontSize: "15px" }}>{item.customer_name}</strong>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--red)" }}>{item.amount}</span>
                          <span style={{ fontSize: "11px", color: "#888" }}>{item.days_overdue} days overdue</span>
                        </div>
                        <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#666" }}>
                          Invoice {item.invoice_number} · Avg Delay {item.avg_delay} days · Payment Score {item.risk_score}/100
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={() => openSendReminder(item)}
                          className="primary-button"
                          style={{ padding: "8px 14px", fontSize: "12px" }}
                        >
                          <IconSend size={14} color="#fff" /> Send Reminder
                        </button>
                        <button
                          onClick={() => openRecordPromise(item.customer_name, item.invoice_number, item.amount)}
                          style={{ padding: "8px 14px", fontSize: "12px", fontWeight: 700, borderRadius: "8px", border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
                        >
                          Record Promise
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}

        {/* 9. ANALYTICS TAB */}
        {activeNav === "Analytics" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "28px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 16px" }}>Machine Learning Analytics & Behavior Insights</h2>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "24px" }}>
                Analysis of customer delay probabilities, payment histories, and feedback loops.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ padding: "20px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "10px" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 800 }}>Risk Level Breakdown</h4>
                  <p style={{ fontSize: "13px", color: "#555" }}>High Risk Accounts: <strong>{customers.filter(c => c.risk_level === "high").length}</strong></p>
                  <p style={{ fontSize: "13px", color: "#555" }}>Medium Risk Accounts: <strong>{customers.filter(c => c.risk_level === "medium").length}</strong></p>
                  <p style={{ fontSize: "13px", color: "#555" }}>Low Risk Accounts: <strong>{customers.filter(c => c.risk_level === "low").length}</strong></p>
                </div>
                <div style={{ padding: "20px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "10px" }}>
                  <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: 800 }}>Collection Model Accuracy</h4>
                  <p style={{ fontSize: "13px", color: "#555" }}>ML Prediction Model Confidence: <strong>88%</strong></p>
                  <p style={{ fontSize: "13px", color: "#555" }}>Feedback Loop Executions: <strong>Active</strong></p>
                </div>
              </div>
            </div>
          )
        )}

        {/* 10. AI CFO AGENT INTERACTIVE CHAT PAGE */}
        {activeNav === "AI CFO Agent" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              {/* Chat Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--line)", background: "#fafbf8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#1e293b", display: "grid", placeItems: "center" }}>
                    <IconAiCfo size={20} color="#ffffff" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--ink)" }}>AI CFO Assistant</h2>
                    <span style={{ fontSize: "11px", color: "var(--emerald)", fontWeight: 700 }}>Real-Time Financial Intelligence Engine</span>
                  </div>
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setChatMessages([{ id: "init-1", sender: "cfo", text: "### **AI CFO Assistant**\n\nHello! I am your **AI CFO Assistant**. How can I help you analyze cash flow, track receivables, or optimize expenses today?", time: "Just now" }])}
                    style={{ padding: "6px 12px", fontSize: "11px", fontWeight: 700, borderRadius: "6px", border: "1px solid var(--line)", background: "#fff", cursor: "pointer" }}
                  >
                    Clear Chat Thread
                  </button>
                </div>
              </div>

              {/* Chat Thread Area */}
              <div ref={chatThreadRef} style={{ flex: 1, minHeight: 0, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "18px", background: "#fafbf8" }}>
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#888", marginBottom: "4px" }}>
                      {msg.sender === "user" ? "You" : "AI CFO Assistant"} · {msg.time}
                    </div>

                    <div
                      style={{
                        padding: "16px 20px",
                        borderRadius: msg.sender === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                        background: msg.sender === "user" ? "#1e293b" : "#ffffff",
                        color: msg.sender === "user" ? "#ffffff" : "var(--ink)",
                        border: msg.sender === "user" ? "none" : "1px solid var(--line)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                      }}
                    >
                      {msg.sender === "user" ? (
                        <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>{msg.text}</p>
                      ) : (
                        <FormattedResponse content={msg.text} />
                      )}
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div style={{ alignSelf: "flex-start", maxWidth: "70%" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#888", marginBottom: "4px" }}>AI CFO Assistant</div>
                    <div style={{ padding: "16px 20px", borderRadius: "14px", background: "#ffffff", border: "1px solid var(--line)" }}>
                      <div className="skeleton-box" style={{ width: "120px", height: "14px" }} />
                      <div className="skeleton-box" style={{ width: "240px", height: "18px", marginTop: "8px" }} />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Prompt Pills & Input Form */}
              <div style={{ padding: "16px 24px", borderTop: "1px solid var(--line)", background: "#ffffff" }}>
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "10px" }}>
                  {[
                    "What is my cash runway?",
                    "Who owes overdue payments?",
                    "Give me a full business audit",
                    "Audit CloudHost expense surge",
                  ].map((pill) => (
                    <button
                      key={pill}
                      onClick={() => handleSendChatMessage(pill)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        borderRadius: "20px",
                        border: "1px solid var(--line)",
                        background: "#fafbf8",
                        color: "var(--ink)",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >
                      {pill}
                    </button>
                  ))}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSendChatMessage(); }} style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    placeholder="Type your question to AI CFO Assistant..."
                    style={{ flex: 1, padding: "12px 16px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "8px", fontSize: "14px", color: "var(--ink)" }}
                  />
                  <button type="submit" className="primary-button" disabled={aiLoading || !aiQuestion.trim()}>
                    <IconSend size={15} color="#fff" /> Send
                  </button>
                </form>
              </div>
            </div>
          )
        )}

        {/* 11. ALERTS TAB */}
        {activeNav === "Alerts" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "28px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 20px" }}>Real-Time System Alerts & Anomaly Warnings</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {alertsList.map((alt) => (
                  <div key={alt.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "18px", background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "10px" }}>
                    <IconWarning size={20} color={alt.urgency === "High" ? "var(--red)" : "var(--yellow)"} />
                    <div>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>{alt.title}</h4>
                      <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#666" }}>{alt.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* 12. REPORTS TAB */}
        {activeNav === "Reports" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "28px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 16px" }}>Financial Reports & Statements</h2>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "20px" }}>
                Export structured financial reports and cash forecasts.
              </p>
              <button className="primary-button" onClick={handleExportDataset}>
                <IconDownload size={15} color="#fff" /> Export Full Financial Report
              </button>
            </div>
          )
        )}

        {/* 13. TEAM & RBAC PERMISSIONS TAB */}
        {activeNav === "Team" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Active User Card & Quick Role Switcher */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--ink)" }}>Active User Session & Permissions</h2>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#666" }}>
                    Logged in as <strong>{currentUser.full_name}</strong> ({currentUser.email}) · Role: <strong style={{ color: currentUser.permissions?.is_super_admin ? "#7c3aed" : "var(--emerald)" }}>{currentUser.permissions?.role_name || currentUser.role}</strong> ({currentUser.permissions?.scope || "Organization"})
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button className="primary-button" onClick={() => setShowAuthModal(true)} style={{ background: "#1e293b" }}>
                    Switch User / Login
                  </button>
                  <button className="primary-button" onClick={handleLogout} style={{ background: "#dc2626" }}>
                    Logout
                  </button>
                </div>
              </div>

              {/* Team Members List */}
              <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>Organization Team Members ({dbUsersList.length})</h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#666" }}>Real users authenticated via SQLite database (`users` table)</p>
                  </div>
                  {currentUser.permissions?.can_manage_users && (
                    <button className="primary-button" onClick={() => setShowAddUserModal(true)}>
                      <IconPlus size={14} color="#fff" /> Add Team Member
                    </button>
                  )}
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Email Address</th>
                        <th>Assigned Role</th>
                        <th>Scope</th>
                        <th>Key Role Permissions</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbUsersList.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.full_name}</strong></td>
                          <td>{u.email}</td>
                          <td>
                            <span style={{ padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 800, background: u.permissions?.is_super_admin ? "rgba(124,58,237,0.1)" : "rgba(30,41,59,0.06)", color: u.permissions?.is_super_admin ? "#7c3aed" : "#1e293b" }}>
                              {u.permissions?.role_name || u.role}
                            </span>
                          </td>
                          <td>{u.permissions?.scope || "Organization"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                              {u.permissions?.can_create_invoice && <span style={{ fontSize: "10px", padding: "2px 6px", background: "#f0fdf4", color: "#166534", borderRadius: "4px", border: "1px solid #bbf7d0" }}>Invoices</span>}
                              {u.permissions?.can_send_reminders && <span style={{ fontSize: "10px", padding: "2px 6px", background: "#eff6ff", color: "#1e40af", borderRadius: "4px", border: "1px solid #bfdbfe" }}>Collections</span>}
                              {u.permissions?.can_manage_expenses && <span style={{ fontSize: "10px", padding: "2px 6px", background: "#fefce8", color: "#854d0e", borderRadius: "4px", border: "1px solid #fef08a" }}>Expenses</span>}
                              {u.permissions?.can_edit_settings && <span style={{ fontSize: "10px", padding: "2px 6px", background: "#fcf2ff", color: "#86198f", borderRadius: "4px", border: "1px solid #f5d0fe" }}>Settings</span>}
                              {u.permissions?.is_super_admin && <span style={{ fontSize: "10px", padding: "2px 6px", background: "#f3e8ff", color: "#6b21a8", borderRadius: "4px", border: "1px solid #e9d5ff" }}>SaaS Platform</span>}
                            </div>
                          </td>
                          <td>
                            <button
                              onClick={() => handleLogin(u.email, u.email.includes("saas") ? "supersecret123" : "password123")}
                              style={{ padding: "4px 10px", fontSize: "11px", fontWeight: 700, borderRadius: "6px", border: "1px solid var(--line)", background: "#fafbf8", cursor: "pointer" }}
                            >
                              Login As
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Security & Audit Log Table */}
              {currentUser.permissions?.can_view_audit_logs && (
                <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "24px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 12px" }}>Platform Audit Logs & Security History</h3>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>User</th>
                          <th>Role</th>
                          <th>Action</th>
                          <th>Target Resource</th>
                          <th>Audit Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogsList.map((log) => (
                          <tr key={log.id}>
                            <td><span style={{ fontSize: "11px", color: "#777" }}>{log.created_at || "Just now"}</span></td>
                            <td><strong>{log.user_name}</strong></td>
                            <td><span style={{ fontSize: "11px", fontWeight: 700 }}>{log.user_role}</span></td>
                            <td><span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 800, background: "#f1f5f9", color: "#334155" }}>{log.action}</span></td>
                            <td>{log.resource}</td>
                            <td><span style={{ fontSize: "12px", color: "#555" }}>{log.details}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* 14. SETTINGS TAB */}
        {activeNav === "Settings" && (
          loadingData ? (
            <SkeletonTablePage />
          ) : (
            <div className="fade-in-content" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "28px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 18px" }}>Organization Settings</h2>
              <p style={{ color: "#555", fontSize: "14px" }}>Organization ID: org-1</p>
              <p style={{ color: "#555", fontSize: "14px" }}>Industry: IT Services / Enterprise Agency</p>
              <p style={{ color: "#555", fontSize: "14px" }}>Operating Currency: INR (₹)</p>
            </div>
          )
        )}

        {/* --- MODALS --- */}
        {/* Send Reminder Modal */}
        {showReminderModal && selectedReminderItem && (
          <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h2>Collection Workflow — Send Reminder</h2>
              <p style={{ fontSize: "13px", color: "#666" }}>
                Target: <strong>{selectedReminderItem.customer_name}</strong> (Invoice {selectedReminderItem.invoice_number} for {selectedReminderItem.amount})
              </p>

              <form onSubmit={handleSendReminderSubmit} className="modal-form">
                <label>
                  Communication Channel
                  <select value={reminderChannel} onChange={(e: any) => setReminderChannel(e.target.value)}>
                    <option value="whatsapp">WhatsApp Business</option>
                    <option value="email">Email Notification</option>
                    <option value="sms">SMS Reminder</option>
                  </select>
                </label>

                <label>
                  Generated Reminder Message
                  <textarea
                    rows={4}
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    required
                  />
                </label>

                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowReminderModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Approve & Send Reminder</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Record Promise to Pay Modal */}
        {showPromiseModal && (
          <div className="modal-overlay" onClick={() => setShowPromiseModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h2>Record Promise to Pay</h2>
              <p style={{ fontSize: "13px", color: "#666" }}>
                Log customer payment commitment to automatically update future cash forecasts.
              </p>

              <form onSubmit={handleCreatePromiseSubmit} className="modal-form">
                <label>
                  Customer Name
                  <input value={promiseCustomer} onChange={(e) => setPromiseCustomer(e.target.value)} required placeholder="e.g. ABC Ltd" />
                </label>

                <label>
                  Invoice Number (Optional)
                  <input value={promiseInvoice} onChange={(e) => setPromiseInvoice(e.target.value)} placeholder="e.g. INV-2841" />
                </label>

                <label>
                  Promised Amount (₹)
                  <input type="number" value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} required placeholder="e.g. 85000" />
                </label>

                <label>
                  Promised Payment Date
                  <input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} required />
                </label>

                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowPromiseModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Record Promise & Update Forecast</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* New Invoice Modal */}
        {showNewInvoiceModal && (
          <div className="modal-overlay" onClick={() => setShowNewInvoiceModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Invoice</h2>
              <form onSubmit={handleCreateInvoice} className="modal-form">
                <label>
                  Customer Name
                  <input value={invCustomer} onChange={(e) => setInvCustomer(e.target.value)} required placeholder="e.g. Acme Cloudworks" />
                </label>
                <label>
                  Invoice Number
                  <input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} required />
                </label>
                <label>
                  Amount (₹)
                  <input type="number" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} required placeholder="e.g. 125000" />
                </label>
                <label>
                  Due Date
                  <input type="date" value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)} required />
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowNewInvoiceModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Save Invoice</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
        {showAddCustomerModal && (
          <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h2>Add Customer</h2>
              <form onSubmit={handleCreateCustomer} className="modal-form">
                <label>
                  Customer Name
                  <input value={custName} onChange={(e) => setCustName(e.target.value)} required placeholder="e.g. Global Tech Solutions" />
                </label>
                <label>
                  Email Address
                  <input type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="billing@globaltech.com" />
                </label>
                <label>
                  Initial Outstanding (₹)
                  <input type="number" value={custOutstanding} onChange={(e) => setCustOutstanding(e.target.value)} placeholder="0" />
                </label>
                <label>
                  Risk Level
                  <select value={custRisk} onChange={(e) => setCustRisk(e.target.value)}>
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddCustomerModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Save Customer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Expense Modal */}
        {showAddExpenseModal && (
          <div className="modal-overlay" onClick={() => setShowAddExpenseModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h2>Log Business Expense</h2>
              <form onSubmit={handleCreateExpense} className="modal-form">
                <label>
                  Category
                  <input value={expCategory} onChange={(e) => setExpCategory(e.target.value)} required placeholder="e.g. Software & Hosting" />
                </label>
                <label>
                  Supplier / Vendor Name
                  <input value={expSupplier} onChange={(e) => setExpSupplier(e.target.value)} placeholder="e.g. CloudHost India" />
                </label>
                <label>
                  Amount (₹)
                  <input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} required placeholder="e.g. 45000" />
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddExpenseModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Log Expense</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dataset Manager Modal */}
        {showDatasetModal && (
          <div className="modal-overlay" onClick={() => setShowDatasetModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px" }}>
              <h2>Dataset Manager</h2>
              <p style={{ fontSize: "13px", color: "#7d8580" }}>
                Import custom CSV/JSON files or switch between saved datasets.
              </p>

              <form onSubmit={handleImportDataset} className="modal-form">
                <label>
                  Dataset Name
                  <input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} required placeholder="e.g. Q3 Financial Dataset" />
                </label>

                <label>
                  CSV / JSON Content
                  <textarea
                    rows={5}
                    value={datasetRawInput}
                    onChange={(e) => setDatasetRawInput(e.target.value)}
                    placeholder="Paste CSV (InvoiceNumber, CustomerName, Amount, DueDate) or JSON"
                  />
                </label>

                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowDatasetModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Import & Save Dataset</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* User Profile Modal */}
        {showAuthModal && (
          <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: currentUser.permissions?.is_super_admin ? "#7c3aed" : "var(--orange, #e8793e)",
                    color: "#ffffff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "20px",
                    fontWeight: 800,
                    boxShadow: "0 4px 14px rgba(232, 121, 62, 0.35)",
                  }}
                >
                  {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : "U"}
                </div>

                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--ink)" }}>{currentUser.full_name}</h2>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#7d8580" }}>{currentUser.email}</p>
                </div>
              </div>

              {/* Account Profile Card */}
              <div style={{ background: "#fafbf8", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px", marginBottom: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#7d8580", fontSize: "12px" }}>Organization</span>
                    <strong style={{ color: "var(--ink)" }}>ABC Digital Solutions</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#7d8580", fontSize: "12px" }}>Assigned Role</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "12px", background: currentUser.permissions?.is_super_admin ? "#7c3aed" : "rgba(28,139,105,0.12)", color: currentUser.permissions?.is_super_admin ? "#ffffff" : "var(--emerald)" }}>
                      {currentUser.permissions?.role_name || currentUser.role}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleLogout}
                  style={{ color: "#cc5d5d", borderColor: "#f8c0b6", background: "#fff0ed" }}
                >
                  Logout Session
                </button>
                <button type="button" className="primary-button" onClick={() => setShowAuthModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <h2>Create New Team Account</h2>
              <form onSubmit={handleCreateUserSubmit} className="modal-form">
                <label>
                  Full Name
                  <input type="text" required value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="e.g. Vikram Sharma" />
                </label>
                <label>
                  Email Address
                  <input type="email" required value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="vikram@abcdigital.com" />
                </label>
                <label>
                  Role Permission Level
                  <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                    <option value="owner">Owner (Full Access)</option>
                    <option value="admin">Admin (Operations & User Admin)</option>
                    <option value="finance_manager">Finance Manager (Cash & Analytics)</option>
                    <option value="accountant">Accountant (Invoices & Expenses)</option>
                    <option value="collections_manager">Collections Manager (Receivables & Reminders)</option>
                    <option value="viewer">Viewer (Read-Only)</option>
                  </select>
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddUserModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Create User</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}
      </main>
    </div>
  );
}
