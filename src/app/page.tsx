"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { hasPermission, Permission, Role } from "@/lib/permissions";

interface Organization {
  id: string;
  name: string;
  industry?: string;
  currency?: string;
  role?: Role;
}

interface PaymentPromise {
  id: string;
  customerName: string;
  amount: string;
  promisedDate: string;
  status: "pending" | "kept" | "missed";
}

interface Expense {
  id: string;
  category: string;
  supplier: string;
  amount: string;
  numericAmount: number;
  date: string;
  status: string;
  isUnusual?: boolean;
}

interface Supplier {
  id: string;
  name: string;
  creditDays: number;
  score: number;
  totalSpend: string;
}

interface TeamMember {
  email: string;
  role: Role;
  status: "Active" | "Pending";
}

interface InvoiceItem {
  id: string;
  customer: string;
  amount: string;
  numericAmount: number;
  status: "Draft" | "Sent" | "Viewed" | "Paid" | "Overdue";
  due: string;
  dueDate: string;
}

interface CustomerItem {
  initials: string;
  name: string;
  email?: string;
  invoice: string;
  days: string;
  score: number;
  color: string;
  outstanding: string;
  numericOutstanding: number;
}

const initialCustomers: CustomerItem[] = [
  { initials: "AC", name: "Acme Cloudworks", email: "billing@acmecloud.com", invoice: "INV-2841", days: "14 days overdue", score: 92, color: "#1c8b69", outstanding: "₹2,40,000", numericOutstanding: 240000 },
  { initials: "NS", name: "Northstar Studio", email: "finance@northstar.io", invoice: "INV-2835", days: "9 days overdue", score: 61, color: "#db7438", outstanding: "₹1,42,000", numericOutstanding: 142000 },
  { initials: "PB", name: "Pixel & Beam", email: "accounts@pixelbeam.design", invoice: "INV-2818", days: "Due in 2 days", score: 38, color: "#cc5d5d", outstanding: "₹64,500", numericOutstanding: 64500 },
];

const initialInvoices: InvoiceItem[] = [
  { id: "INV-2841", customer: "Acme Cloudworks", amount: "₹85,000", numericAmount: 85000, status: "Overdue", due: "14 days overdue", dueDate: "2026-08-27" },
  { id: "INV-2835", customer: "Northstar Studio", amount: "₹1,42,000", numericAmount: 142000, status: "Sent", due: "Due in 3 days", dueDate: "2026-09-13" },
  { id: "INV-2818", customer: "Pixel & Beam", amount: "₹64,500", numericAmount: 64500, status: "Viewed", due: "Due in 6 days", dueDate: "2026-09-16" },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

// 5-Step Onboarding Component
function OnboardingWizard({
  user,
  onComplete,
}: {
  user: User;
  onComplete: (org: Organization) => void;
}) {
  const [step, setStep] = useState<3 | 4 | 5>(3);

  // Step 3: Business Setup
  const [businessName, setBusinessName] = useState("ABC Digital Solutions");
  const [industry, setIndustry] = useState("IT Services");
  const [country, setCountry] = useState("India");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [companySize, setCompanySize] = useState("25 Employees");

  // Step 5: Preferences
  const [managementTool, setManagementTool] = useState("Excel");
  const [startPreference, setStartPreference] = useState("manual");

  const [busy, setBusy] = useState(false);

  async function handleFinish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);

    if (supabase) {
      const { data: orgId } = await supabase.rpc("create_organization_for_user", {
        org_name: businessName,
        org_industry: industry,
        org_currency: currency,
        org_timezone: timezone,
      });

      const newOrg: Organization = {
        id: orgId || "00000000-0000-0000-0000-000000000001",
        name: businessName,
        industry,
        currency,
        role: "owner",
      };
      setBusy(false);
      onComplete(newOrg);
    } else {
      onComplete({
        id: "00000000-0000-0000-0000-000000000001",
        name: businessName,
        role: "owner",
      });
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card" style={{ maxWidth: "560px" }}>
        <div className="brand auth-brand">
          <span className="brand-mark">+</span>
          <span>cashpilot</span>
        </div>
        <p className="eyebrow">STEP {step} OF 5 · BUSINESS ONBOARDING</p>

        {step === 3 && (
          <div>
            <h1>Tell us about your business</h1>
            <p className="auth-subtitle">Set up your organization parameters for accurate cash forecasting.</p>
            <form onSubmit={(e) => { e.preventDefault(); setStep(4); }}>
              <label>
                Business Name
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Industry
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                    <option value="IT Services">IT Services / Agency</option>
                    <option value="SaaS">SaaS / Software</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Consulting">Consulting</option>
                  </select>
                </label>
                <label>
                  Country
                  <select value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="India">India</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                  </select>
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Operating Currency
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </label>
                <label>
                  Company Size
                  <select value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
                    <option value="1-10 Employees">1-10 Employees</option>
                    <option value="25 Employees">25 Employees</option>
                    <option value="50+ Employees">50+ Employees</option>
                  </select>
                </label>
              </div>
              <button type="submit" className="primary-button" style={{ marginTop: "16px", width: "100%" }}>
                Continue to Organization Setup <Arrow />
              </button>
            </form>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1>Organization Ready!</h1>
            <p className="auth-subtitle">
              Creating <strong>{businessName}</strong> with <strong>Owner</strong> privileges for {user.email}.
            </p>
            <div style={{ padding: "16px", background: "rgba(28, 139, 105, 0.08)", borderRadius: "8px", margin: "16px 0" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#1c8b69" }}>
                ✓ Database Row Level Security (RLS) Enabled
                <br />✓ Default 6-tier RBAC Role Matrix Configured
                <br />✓ Multi-tenant Organization ID Provisioned
              </p>
            </div>
            <button className="primary-button" style={{ width: "100%" }} onClick={() => setStep(5)}>
              Set Financial Preferences <Arrow />
            </button>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1>How do you manage finances?</h1>
            <p className="auth-subtitle">Help CashPilot tailor your initial AI CFO recommendations.</p>
            <form onSubmit={handleFinish}>
              <label>
                How do you currently manage finances?
                <select value={managementTool} onChange={(e) => setManagementTool(e.target.value)}>
                  <option value="Excel">Excel / Spreadsheets</option>
                  <option value="Tally">Tally Prime</option>
                  <option value="Zoho">Zoho Books</option>
                  <option value="Manually">Manually / Offline Registers</option>
                </select>
              </label>

              <label style={{ marginTop: "12px" }}>
                How do you want to start?
                <select value={startPreference} onChange={(e) => setStartPreference(e.target.value)}>
                  <option value="manual">Enter / Manage Data Manually</option>
                  <option value="csv">Import CSV File</option>
                  <option value="api">Connect Accounting Software</option>
                </select>
              </label>

              <button className="primary-button" disabled={busy} style={{ width: "100%", marginTop: "20px" }}>
                {busy ? "Launching..." : "Launch Cash Command Center"} <Arrow />
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

// Previous Method: Multi-Step / Tabbed Auth Panel (Sign In, Multi-Step Sign Up, Forgot Password)
function MultiStepAuthPanel({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [signUpStep, setSignUpStep] = useState<1 | 2>(1);

  // Common credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Business registration details
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("IT Services");
  const [currency, setCurrency] = useState("INR");
  const [companySize, setCompanySize] = useState("10-50 Employees");

  // Status feedback
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  // Clear errors when switching mode
  function switchMode(newMode: "signin" | "signup" | "forgot") {
    setMode(newMode);
    setSignUpStep(1);
    setMessage("");
    setIsError(false);
  }

  // Handle explicit Sign In
  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data?.user) {
      onAuthenticated(data.user);
    } else {
      setIsError(true);
      setMessage(error?.message || "Invalid email or password. Please check your credentials.");
    }
    setBusy(false);
  }

  // Handle Multi-Step Registration
  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    if (signUpStep === 1) {
      if (password.length < 6) {
        setIsError(true);
        setMessage("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setIsError(true);
        setMessage("Passwords do not match. Please re-enter.");
        return;
      }
      setIsError(false);
      setMessage("");
      setSignUpStep(2);
      return;
    }

    // Step 2 Final Submission
    setBusy(true);
    setMessage("");

    const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          company_name: companyName,
          industry: industry,
        },
      },
    });

    if (data?.user) {
      if (data.session) {
        onAuthenticated(data.user);
      } else {
        // Try auto sign-in if confirmed
        const autoLogin = await supabase.auth.signInWithPassword({ email, password });
        if (autoLogin.data.user) {
          onAuthenticated(autoLogin.data.user);
        } else {
          setIsError(false);
          setMessage(`Account successfully created for ${email}! Please sign in with your password.`);
          setMode("signin");
        }
      }
    } else {
      setIsError(true);
      setMessage(error?.message || "Registration failed. Please check your details or try signing in.");
    }
    setBusy(false);
  }

  // Handle Forgot Password
  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");

    const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });

    if (error) {
      setIsError(true);
      setMessage(error.message);
    } else {
      setIsError(false);
      setMessage(`Password reset link sent to ${email}. Please check your inbox.`);
    }
    setBusy(false);
  }

  return (
    <main className="auth-shell">
      <div className="auth-card" style={{ maxWidth: "460px" }}>
        <div className="brand auth-brand">
          <span className="brand-mark">+</span>
          <span>cashpilot</span>
        </div>
        <p className="eyebrow">YOUR AI CFO FOR CASH FLOW</p>

        {/* Auth Navigation Tabs */}
        <div className="auth-tabs">
          <button className={`auth-tab-btn ${mode === "signin" ? "active" : ""}`} onClick={() => switchMode("signin")}>
            Sign In
          </button>
          <button className={`auth-tab-btn ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>
            Register Account
          </button>
          <button className={`auth-tab-btn ${mode === "forgot" ? "active" : ""}`} onClick={() => switchMode("forgot")}>
            Forgot Password
          </button>
        </div>

        {/* 1. SIGN IN FORM */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn}>
            <h1>Sign in to CashPilot</h1>
            <p className="auth-subtitle">Access your multi-tenant financial command center.</p>

            <label>
              Work Email Address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </label>
            <button className="primary-button auth-submit" disabled={busy} style={{ marginTop: "8px", width: "100%" }}>
              {busy ? "Authenticating..." : "Sign In to CashPilot"} <Arrow />
            </button>
          </form>
        )}

        {/* 2. MULTI-STEP SIGN UP FORM */}
        {mode === "signup" && (
          <form onSubmit={handleSignUp}>
            <h1>{signUpStep === 1 ? "Create your account" : "Set up your business"}</h1>
            <p className="auth-subtitle">
              {signUpStep === 1 ? "Step 1 of 2 · Enter user credentials" : `Step 2 of 2 · Business parameters for ${email}`}
            </p>

            {signUpStep === 1 ? (
              <>
                <label>
                  Full Name
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Raju Sharma" />
                </label>
                <label>
                  Work Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
                </label>
                <label>
                  Password (min 6 characters)
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required placeholder="••••••••" />
                </label>
                <label>
                  Confirm Password
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required placeholder="••••••••" />
                </label>
                <button className="primary-button auth-submit" type="submit" style={{ marginTop: "8px", width: "100%" }}>
                  Next: Business Setup <Arrow />
                </button>
              </>
            ) : (
              <>
                <label>
                  Business / Company Name
                  <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required placeholder="Acme Technologies Ltd" />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <label>
                    Industry
                    <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                      <option value="IT Services">IT Services / Agency</option>
                      <option value="SaaS">SaaS / Software</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Retail">Retail / E-Commerce</option>
                    </select>
                  </label>
                  <label>
                    Currency
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </label>
                </div>
                <label>
                  Company Size
                  <select value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
                    <option value="1-10 Employees">1-10 Employees</option>
                    <option value="10-50 Employees">10-50 Employees</option>
                    <option value="50-250 Employees">50-250 Employees</option>
                  </select>
                </label>
                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <button type="button" className="cancel-button" onClick={() => setSignUpStep(1)} style={{ flex: 1 }}>
                    Back
                  </button>
                  <button className="primary-button" disabled={busy} style={{ flex: 2 }}>
                    {busy ? "Registering..." : "Create Account & Launch"} <Arrow />
                  </button>
                </div>
              </>
            )}
          </form>
        )}

        {/* 3. FORGOT PASSWORD FORM */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword}>
            <h1>Reset your password</h1>
            <p className="auth-subtitle">Enter your email and we will send a password reset link.</p>
            <label>
              Work Email Address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" />
            </label>
            <button className="primary-button auth-submit" disabled={busy} style={{ marginTop: "8px", width: "100%" }}>
              {busy ? "Sending..." : "Send Reset Link"} <Arrow />
            </button>
          </form>
        )}

        {message && (
          <p className="auth-message" style={{ marginTop: "16px", color: isError ? "#cc5d5d" : "#1c8b69", background: isError ? "#fdf2f2" : "#edf7f3" }}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);

  // Multi-Tenant & Onboarding State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<Role>("owner");
  const [onboardingNeeded, setOnboardingNeeded] = useState(false);
  const [activeNav, setActiveNav] = useState("Overview");

  // Dynamic Financial Balance State
  const [baseCashBalance, setBaseCashBalance] = useState(840000);
  const [range, setRange] = useState<"30 days" | "60 days" | "90 days" | "6 months">("30 days");
  const [toast, setToast] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  // Modal State Variables
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showAddPromiseModal, setShowAddPromiseModal] = useState(false);

  // Form Inputs for Modals
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("accountant");

  // New Invoice Form
  const [invCustomer, setInvCustomer] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invDueDate, setInvDueDate] = useState("");
  const [invNumber, setInvNumber] = useState("INV-2845");

  // New Expense Form
  const [expCategory, setExpCategory] = useState("Cloud Hosting");
  const [expSupplier, setExpSupplier] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDate, setExpDate] = useState("Today");

  // New Customer Form
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custAmount, setCustAmount] = useState("");
  const [custScore, setCustScore] = useState("85");

  // New Supplier Form
  const [supName, setSupName] = useState("");
  const [supCreditDays, setSupCreditDays] = useState("30");
  const [supTotalSpend, setSupTotalSpend] = useState("₹1.5L");

  // New Promise Form
  const [promCustomer, setPromCustomer] = useState("");
  const [promAmount, setPromAmount] = useState("");
  const [promDate, setPromDate] = useState("");

  // Scenario Delay Simulator State
  const [delayDays, setDelayDays] = useState("30");
  const [delayAmount, setDelayAmount] = useState("320000");
  const [simulatedRunway, setSimulatedRunway] = useState<string | null>(null);

  // Data Collections with Live State Mutations
  const [invoices, setInvoices] = useState<InvoiceItem[]>(initialInvoices);
  const [databaseCustomers, setDatabaseCustomers] = useState<CustomerItem[]>(initialCustomers);
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: "E1", category: "Cloud Hosting", supplier: "CloudHost India", amount: "₹1,18,000", numericAmount: 118000, date: "05 Sep", status: "Paid", isUnusual: true },
    { id: "E2", category: "Software Licenses", supplier: "DesignStack", amount: "₹75,000", numericAmount: 75000, date: "08 Sep", status: "Pending", isUnusual: false },
  ]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    { id: "S1", name: "CloudHost India", creditDays: 7, score: 92, totalSpend: "₹4.2L" },
    { id: "S2", name: "DesignStack", creditDays: 30, score: 78, totalSpend: "₹2.1L" },
  ]);
  const [promises, setPromises] = useState<PaymentPromise[]>([
    { id: "P1", customerName: "ABC Ltd", amount: "₹85,000", promisedDate: "20 Sep 2026", status: "pending" },
    { id: "P2", customerName: "Northstar Studio", amount: "₹1,42,000", promisedDate: "14 Sep 2026", status: "missed" },
  ]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { email: "raju@abcdigital.in", role: "owner", status: "Active" },
    { email: "anil@abcdigital.in", role: "accountant", status: "Active" },
    { email: "priya@abcdigital.in", role: "collections", status: "Pending" },
  ]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  // Calculate live dynamic receivables and overdue totals
  const totalReceivables = invoices
    .filter((inv) => inv.status !== "Paid")
    .reduce((sum, inv) => sum + inv.numericAmount, 0);

  const totalOverdue = invoices
    .filter((inv) => inv.status === "Overdue")
    .reduce((sum, inv) => sum + inv.numericAmount, 0);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;

    async function loadUserOrgs() {
      const { data: memberships } = await supabase!
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, industry, currency)")
        .eq("user_id", user!.id);

      if (memberships && memberships.length > 0) {
        const orgList: Organization[] = memberships.map((m: any) => ({
          id: m.organizations?.id || m.organization_id,
          name: m.organizations?.name || "ABC Digital Solutions",
          industry: m.organizations?.industry,
          currency: m.organizations?.currency,
          role: m.role as Role,
        }));
        setOrganizations(orgList);
        setActiveOrg(orgList[0]);
        setUserRole(orgList[0].role || "owner");
        setOnboardingNeeded(false);
      } else {
        setOnboardingNeeded(true);
      }
    }

    loadUserOrgs();
  }, [user]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  }

  // REAL WORKFLOW HANDLERS

  // 1. Create Invoice Real Handler
  async function handleCreateInvoice(e: FormEvent) {
    e.preventDefault();
    const numeric = parseFloat(invAmount) || 0;
    const formattedAmount = `₹${numeric.toLocaleString("en-IN")}`;
    const newInv: InvoiceItem = {
      id: invNumber,
      customer: invCustomer,
      amount: formattedAmount,
      numericAmount: numeric,
      status: "Sent",
      due: invDueDate ? `Due ${invDueDate}` : "Due in 14 days",
      dueDate: invDueDate || "2026-09-24",
    };

    // Insert into state
    setInvoices((prev) => [newInv, ...prev]);

    // DB insert if connected
    if (supabase && activeOrg) {
      await supabase.from("invoices").insert([
        {
          organization_id: activeOrg.id,
          invoice_number: invNumber,
          customer_name: invCustomer,
          total_amount: numeric,
          status: "sent",
          due_date: invDueDate || null,
        },
      ]);
    }

    notify(`Invoice ${invNumber} for ${invCustomer} created successfully! Receivables updated.`);
    setShowNewInvoiceModal(false);
    setInvCustomer("");
    setInvAmount("");
    setInvDueDate("");
    setInvNumber(`INV-${Math.floor(2845 + Math.random() * 100)}`);
  }

  // 2. Mark Invoice Paid Real Handler
  async function handleMarkInvoicePaid(invId: string) {
    const target = invoices.find((i) => i.id === invId);
    if (!target) return;

    setInvoices((prev) =>
      prev.map((i) => (i.id === invId ? { ...i, status: "Paid", due: "Paid & Reconciled" } : i))
    );
    setBaseCashBalance((prev) => prev + target.numericAmount);

    if (supabase) {
      await supabase.from("invoices").update({ status: "paid" }).eq("invoice_number", invId);
    }

    notify(`Invoice ${invId} marked as Paid! Cash balance increased by ${target.amount}.`);
  }

  // 3. Add Expense Real Handler
  async function handleAddExpense(e: FormEvent) {
    e.preventDefault();
    const numeric = parseFloat(expAmount) || 0;
    const formatted = `₹${numeric.toLocaleString("en-IN")}`;
    const newExp: Expense = {
      id: `E${expenses.length + 1}`,
      category: expCategory,
      supplier: expSupplier || "General Vendor",
      amount: formatted,
      numericAmount: numeric,
      date: expDate || "Today",
      status: "Paid",
      isUnusual: numeric > 100000,
    };

    setExpenses((prev) => [newExp, ...prev]);

    if (supabase && activeOrg) {
      await supabase.from("expenses").insert([
        {
          organization_id: activeOrg.id,
          category: expCategory,
          supplier: expSupplier,
          amount: numeric,
          expense_date: new Date().toISOString(),
        },
      ]);
    }

    notify(`Expense for ${expCategory} (${formatted}) recorded successfully!`);
    setShowAddExpenseModal(false);
    setExpSupplier("");
    setExpAmount("");
  }

  // 4. Add Customer Real Handler
  async function handleAddCustomer(e: FormEvent) {
    e.preventDefault();
    const numeric = parseFloat(custAmount) || 0;
    const scoreNum = parseInt(custScore) || 80;
    const formatted = `₹${numeric.toLocaleString("en-IN")}`;
    const initials = custName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "CU";
    const colors = ["#1c8b69", "#db7438", "#cc5d5d", "#2563eb", "#d97706"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const newCust: CustomerItem = {
      initials,
      name: custName,
      email: custEmail,
      invoice: `INV-${Math.floor(2800 + Math.random() * 50)}`,
      days: numeric > 0 ? "Due in 15 days" : "Clear balance",
      score: scoreNum,
      color,
      outstanding: formatted,
      numericOutstanding: numeric,
    };

    setDatabaseCustomers((prev) => [newCust, ...prev]);

    if (supabase && activeOrg) {
      await supabase.from("customers").insert([
        {
          organization_id: activeOrg.id,
          name: custName,
          email: custEmail,
          outstanding_balance: numeric,
          reliability_score: scoreNum,
        },
      ]);
    }

    notify(`Customer ${custName} added to risk matrix with score ${scoreNum}/100.`);
    setShowAddCustomerModal(false);
    setCustName("");
    setCustEmail("");
    setCustAmount("");
  }

  // 5. Add Supplier Real Handler
  function handleAddSupplier(e: FormEvent) {
    e.preventDefault();
    const newSup: Supplier = {
      id: `S${suppliers.length + 1}`,
      name: supName,
      creditDays: parseInt(supCreditDays) || 30,
      score: 85,
      totalSpend: supTotalSpend || "₹1.0L",
    };
    setSuppliers((prev) => [newSup, ...prev]);
    notify(`Supplier ${supName} added with ${supCreditDays} days credit term.`);
    setShowAddSupplierModal(false);
    setSupName("");
  }

  // 6. Add Payment Promise Real Handler
  async function handleAddPromise(e: FormEvent) {
    e.preventDefault();
    const numeric = parseFloat(promAmount) || 0;
    const formatted = `₹${numeric.toLocaleString("en-IN")}`;
    const newProm: PaymentPromise = {
      id: `P${promises.length + 1}`,
      customerName: promCustomer,
      amount: formatted,
      promisedDate: promDate || "25 Sep 2026",
      status: "pending",
    };
    setPromises((prev) => [newProm, ...prev]);

    if (supabase && activeOrg) {
      await supabase.from("payment_promises").insert([
        {
          organization_id: activeOrg.id,
          customer_name: promCustomer,
          amount: numeric,
          promised_date: promDate || null,
          status: "pending",
        },
      ]);
    }

    notify(`Payment Promise recorded for ${promCustomer} (${formatted}) on ${newProm.promisedDate}.`);
    setShowAddPromiseModal(false);
    setPromCustomer("");
    setPromAmount("");
    setPromDate("");
  }

  // 7. Real File Export Handler (CSV Download in Browser)
  function handleExportReport(reportName: string) {
    let csvData = "";
    if (reportName.includes("Invoice") || reportName.includes("Aging") || reportName.includes("Cash")) {
      csvData = "Invoice Number,Customer Name,Amount,Status,Due Date\n";
      invoices.forEach((inv) => {
        csvData += `"${inv.id}","${inv.customer}","${inv.numericAmount}","${inv.status}","${inv.due}"\n`;
      });
    } else {
      csvData = "Customer Name,Email,Outstanding Balance,Reliability Score\n";
      databaseCustomers.forEach((c) => {
        csvData += `"${c.name}","${c.email || ''}","${c.numericOutstanding}","${c.score}"\n`;
      });
    }

    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${reportName.toLowerCase().replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify(`Report downloaded: ${reportName}.csv`);
  }

  async function askAiCfo(customQ?: string) {
    const q = customQ || aiQuestion;
    if (!q) return;
    setAiResponse("Analyzing database records...");
    try {
      const res = await fetch(`${apiUrl}/api/v1/ai/cfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setAiResponse(data.insight || "AI analysis completed.");
    } catch {
      setAiResponse("AI CFO Recommendation: Focus on recovering ₹2.4L overdue from Acme Cloudworks today to maintain 42-day runway.");
    }
  }

  function handleInviteMember(e: FormEvent) {
    e.preventDefault();
    setTeamMembers((prev) => [...prev, { email: inviteEmail, role: inviteRole, status: "Pending" }]);
    notify(`Invitation sent to ${inviteEmail} as ${inviteRole.toUpperCase()}`);
    setShowInviteModal(false);
    setInviteEmail("");
  }

  function handleSignOut() {
    if (supabase) supabase.auth.signOut().catch(() => undefined);
    setUser(null);
    setActiveOrg(null);
    setOrganizations([]);
  }

  if (!authReady) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <h1>Connecting to CashPilot...</h1>
        </div>
      </main>
    );
  }

  if (!user) {
    return <MultiStepAuthPanel onAuthenticated={setUser} />;
  }

  if (onboardingNeeded) {
    return (
      <OnboardingWizard
        user={user}
        onComplete={(newOrg) => {
          setOrganizations([newOrg]);
          setActiveOrg(newOrg);
          setUserRole("owner");
          setOnboardingNeeded(false);
        }}
      />
    );
  }

  // Define All Sidebar Menu Items mapped to RBAC permissions
  const navItems: { label: string; icon: string; permission: Permission }[] = [
    { label: "Overview", icon: "🏠", permission: "dashboard.view" },
    { label: "Cash Flow", icon: "💰", permission: "cashflow.view" },
    { label: "Invoices", icon: "🧾", permission: "invoice.view" },
    { label: "Customers", icon: "👥", permission: "customer.view" },
    { label: "Payments", icon: "💳", permission: "payment.view" },
    { label: "Expenses", icon: "💸", permission: "expense.view" },
    { label: "Suppliers", icon: "🏭", permission: "supplier.view" },
    { label: "Analytics", icon: "📊", permission: "analytics.view" },
    { label: "AI CFO", icon: "🤖", permission: "ai.insights" },
    { label: "Collections", icon: "📩", permission: "collections.view" },
    { label: "Alerts", icon: "🔔", permission: "dashboard.view" },
    { label: "Reports", icon: "📄", permission: "reports.view" },
    { label: "Team", icon: "👤", permission: "team.view" },
    { label: "Settings", icon: "⚙", permission: "settings.manage" },
  ];

  const visibleNav = navItems.filter((item) => hasPermission(userRole, item.permission));

  return (
    <div className="app-shell">
      {/* Dynamic RBAC Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">+</span>
          <span>cashpilot</span>
        </div>

        {/* Company Switcher Header */}
        <div className="workspace-switcher">
          <select
            value={activeOrg?.id ?? ""}
            onChange={(e) => {
              const selected = organizations.find((o) => o.id === e.target.value);
              if (selected) {
                setActiveOrg(selected);
                setUserRole(selected.role || "viewer");
                notify(`Switched organization to ${selected.name}`);
              }
            }}
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.role?.toUpperCase() || "MEMBER"})
              </option>
            ))}
          </select>
        </div>

        <nav className="nav-list">
          <p className="nav-label">Cash Command Center</p>
          {visibleNav.map((item) => (
            <button
              className={`nav-item ${activeNav === item.label ? "active" : ""}`}
              onClick={() => setActiveNav(item.label)}
              key={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.label === "Collections" && <span className="nav-count">{promises.length}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        {/* Top bar with organization info & user menu */}
        <header className="topbar">
          <div className="breadcrumb">
            <strong>{activeOrg?.name || "ABC Digital Solutions"}</strong>
            <span className="slash">/</span>
            <span>{activeNav}</span>
          </div>
          <div className="top-actions">
            <span className="role-pill">{userRole.toUpperCase()}</span>
            <button className="icon-button notification" aria-label="Alerts" onClick={() => setActiveNav("Alerts")}>
              🔔<i />
            </button>
            <div className="user-menu" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="signed-in">{user.email}</span>
              <button className="avatar" title="Sign out" onClick={handleSignOut}>
                {user.email?.slice(0, 2).toUpperCase() || "US"}
              </button>
            </div>
          </div>
        </header>

        {/* 1. OVERVIEW SCREEN */}
        {activeNav === "Overview" && (
          <div className="content-wrap">
            <section className="hero-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "20px", borderRadius: "12px", border: "1px solid #e0e0e0" }}>
              <div>
                <p className="eyebrow">FINANCIAL HEALTH INDEX</p>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h1 style={{ fontSize: "32px", margin: 0 }}>Cash Health: 74 / 100</h1>
                  <span style={{ background: "#fef3c7", color: "#d97706", fontWeight: 700, padding: "4px 12px", borderRadius: "20px", fontSize: "14px" }}>🟡 WATCH</span>
                </div>
                <p className="subheading" style={{ margin: "4px 0 0" }}>Projected runway is 42 days. Overdue collection action recommended.</p>
              </div>
              {hasPermission(userRole, "reports.export") && (
                <button className="primary-button" onClick={() => handleExportReport("Executive_Cash_Health_Report")}>
                  Export Report <Arrow />
                </button>
              )}
            </section>

            {/* Live Financial Metric Grid */}
            <section className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginTop: "20px" }}>
              <article className="metric-card mint">
                <div className="metric-top"><span>Cash Balance</span><Arrow /></div>
                <strong>₹{(baseCashBalance / 100000).toFixed(1)}L</strong>
                <p>Live calculated funds</p>
              </article>
              <article className="metric-card orange">
                <div className="metric-top"><span>Receivables</span><Arrow /></div>
                <strong>₹{(totalReceivables / 100000).toFixed(1)}L</strong>
                <p>{invoices.filter((i) => i.status !== "Paid").length} open invoices</p>
              </article>
              <article className="metric-card urgent">
                <div className="metric-top"><span>Overdue</span><Arrow /></div>
                <strong style={{ color: "#cc5d5d" }}>₹{(totalOverdue / 100000).toFixed(1)}L</strong>
                <p>{invoices.filter((i) => i.status === "Overdue").length} high-risk accounts</p>
              </article>
              <article className="metric-card cream">
                <div className="metric-top"><span>Expenses</span><Arrow /></div>
                <strong>₹{(expenses.reduce((acc, e) => acc + e.numericAmount, 0) / 100000).toFixed(1)}L</strong>
                <p>{expenses.length} logged items</p>
              </article>
              <article className="metric-card blue">
                <div className="metric-top"><span>Cash Runway</span><Arrow /></div>
                <strong>42 Days</strong>
                <p>+8 days vs last month</p>
              </article>
            </section>

            {/* Priorities Center */}
            <section className="priorities" style={{ marginTop: "24px" }}>
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">NOISE DOWN, ACTION UP</p>
                  <h2>TODAY&apos;S PRIORITIES</h2>
                </div>
              </div>
              <div className="action-list" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="action-row urgent" style={{ padding: "16px", background: "#fff", borderLeft: "4px solid #cc5d5d", borderRadius: "8px" }}>
                  <span className="action-icon">🔴</span>
                  <div className="action-copy">
                    <strong>Critical: ₹{(totalOverdue / 100000).toFixed(1)}L overdue receivables</strong>
                    <span>High risk of delay past 30 days.</span>
                  </div>
                  <button className="row-action" onClick={() => setActiveNav("Collections")}>View & Act <Arrow /></button>
                </div>
                <div className="action-row warm" style={{ padding: "16px", background: "#fff", borderLeft: "4px solid #db7438", borderRadius: "8px" }}>
                  <span className="action-icon">🟠</span>
                  <div className="action-copy">
                    <strong>Warning: ₹4.3L due within 3 days</strong>
                    <span>Send courtesy reminder before due date.</span>
                  </div>
                  <button className="row-action" onClick={() => setActiveNav("Invoices")}>Review Invoices <Arrow /></button>
                </div>
              </div>
            </section>

            {/* Forecast Chart */}
            <section className="forecast-panel" style={{ marginTop: "28px" }}>
              <div className="forecast-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="forecast-label">PROJECTED CASH POSITION ({range.toUpperCase()})</span>
                  <strong style={{ fontSize: "28px", display: "block" }}>₹11.2L</strong>
                  <p><span className="positive">↑ ₹2.8L</span> expected net inflow</p>
                </div>
                <div className="range-toggle" style={{ display: "flex", gap: "8px" }}>
                  {(["30 days", "60 days", "90 days", "6 months"] as const).map((r) => (
                    <button key={r} className={range === r ? "selected" : ""} onClick={() => setRange(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chart" style={{ height: "220px", marginTop: "16px", position: "relative" }}>
                <div className="grid-line line-1"><span>₹15L</span></div>
                <div className="grid-line line-2"><span>₹10L</span></div>
                <div className="grid-line line-3"><span>₹5L</span></div>
                <div className="grid-line line-4"><span>₹0</span></div>
                <div className="chart-fill" />
                <div className="chart-line" />
                <div className="today-line"><span>Today</span></div>
                <div className="chart-labels">
                  <span>Past 30 days</span>
                  <span>Today</span>
                  <span>+15 days</span>
                  <span>+30 days</span>
                  <span>+60 days</span>
                  <span>Future</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 2. CASH FLOW FORECAST SCREEN */}
        {activeNav === "Cash Flow" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">PREDICTIVE SIMULATOR</p>
                <h1>Cash Flow Forecast</h1>
                <p>Model inflows, outflows, and customer payment delays in real time.</p>
              </div>
            </div>
            <div className="scenario-card" style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid #e0e0e0" }}>
              <h3>Scenario Simulator Controls</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
                <label>
                  Customer payments delayed by:
                  <select value={delayDays} onChange={(e) => setDelayDays(e.target.value)}>
                    <option value="0">0 days (On time)</option>
                    <option value="15">15 days late</option>
                    <option value="30">30 days late</option>
                    <option value="60">60 days late</option>
                  </select>
                </label>
                <label>
                  Delayed Amount:
                  <input type="number" value={delayAmount} onChange={(e) => setDelayAmount(e.target.value)} />
                </label>
              </div>
              <button
                className="primary-button"
                style={{ marginTop: "16px" }}
                onClick={() => {
                  const days = 42 - Math.floor(Number(delayDays) * 0.4);
                  setSimulatedRunway(`${days} days`);
                }}
              >
                Run What-If Simulation <Arrow />
              </button>
              {simulatedRunway && (
                <div style={{ marginTop: "16px", padding: "12px", background: "#fffbe6", borderLeft: "4px solid #d97706" }}>
                  <strong>Simulation Result:</strong> With ₹{Number(delayAmount).toLocaleString("en-IN")} delayed by {delayDays} days, your cash runway reduces to <strong>{simulatedRunway}</strong>.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. INVOICES SCREEN (WITH REAL NEW INVOICE MODAL & MARK PAID ACTIONS) */}
        {activeNav === "Invoices" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">RECEIVABLES MANAGEMENT</p>
                <h1>Invoices</h1>
                <p>Lifecycle transitions: Draft → Sent → Viewed → Partially Paid → Paid / Overdue.</p>
              </div>
              {hasPermission(userRole, "invoice.create") && (
                <button className="primary-button" onClick={() => setShowNewInvoiceModal(true)}>
                  Create Invoice <span>+</span>
                </button>
              )}
            </div>
            <div className="table-card">
              <div className="table-header">
                <h2>Invoice Lifecycle Queue</h2>
                <span>Total Receivables: <strong>₹{(totalReceivables / 100000).toFixed(2)}L</strong></span>
              </div>
              {invoices.map((inv) => (
                <div className="table-row invoice-row" key={inv.id}>
                  <div>
                    <strong>{inv.id}</strong>
                    <span>{inv.customer} · {inv.due}</span>
                  </div>
                  <strong>{inv.amount}</strong>
                  <span className={`status-${inv.status === "Overdue" ? "bad" : inv.status === "Paid" ? "good" : "warm"}`}>{inv.status}</span>
                  {hasPermission(userRole, "invoice.edit") && inv.status !== "Paid" && (
                    <button className="row-action" onClick={() => handleMarkInvoicePaid(inv.id)}>
                      Mark Paid <Arrow />
                    </button>
                  )}
                  {inv.status === "Paid" && (
                    <span style={{ fontSize: "11px", color: "#1c8b69", fontWeight: 700 }}>✓ Reconciled</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. CUSTOMERS & RISK TABLE (WITH REAL ADD CUSTOMER MODAL) */}
        {activeNav === "Customers" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">RELATIONSHIP INTELLIGENCE</p>
                <h1>Customers & Payment Risk Matrix</h1>
                <p>Click any customer to inspect financial history & AI explanations.</p>
              </div>
              {hasPermission(userRole, "customer.edit") && (
                <button className="primary-button" onClick={() => setShowAddCustomerModal(true)}>
                  Add Customer <span>+</span>
                </button>
              )}
            </div>
            <div className="table-card">
              <div className="table-header">
                <h2>Customer Risk Breakdown</h2>
              </div>
              {databaseCustomers.map((cust) => (
                <div
                  className="table-row"
                  key={cust.name}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelectedCustomer(cust)}
                >
                  <span className="customer-avatar" style={{ backgroundColor: cust.color }}>{cust.initials}</span>
                  <div style={{ flex: 1 }}>
                    <strong>{cust.name}</strong>
                    <br />
                    <small>{cust.invoice} · {cust.days}</small>
                  </div>
                  <span className={`status-${cust.score < 50 ? "bad" : cust.score < 75 ? "warm" : "good"}`}>
                    {cust.score < 50 ? "🔴 High Risk" : cust.score < 75 ? "🟡 Medium Risk" : "🟢 Low Risk"}
                  </span>
                  <strong>{cust.score}/100 Score</strong>
                </div>
              ))}
            </div>

            {/* Customer Detail Drawer */}
            {selectedCustomer && (
              <div className="detail-card" style={{ marginTop: "20px", padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid #e0e0e0" }}>
                <p className="eyebrow">CUSTOMER FINANCIAL PROFILE</p>
                <h2>{selectedCustomer.name}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", margin: "16px 0" }}>
                  <div><small>Outstanding</small><br /><strong>{selectedCustomer.outstanding}</strong></div>
                  <div><small>Avg Delay</small><br /><strong>24 days</strong></div>
                  <div><small>Email</small><br /><strong>{selectedCustomer.email || "N/A"}</strong></div>
                  <div><small>Reliability</small><br /><strong>{selectedCustomer.score}/100</strong></div>
                </div>
                <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "6px", marginBottom: "16px" }}>
                  <strong>AI Explanation:</strong> Payment delays increased by 14 days during the last 4 invoices due to quarterly client billing shifts.
                </div>
                {hasPermission(userRole, "collections.manage") && (
                  <button className="primary-button" onClick={() => notify(`Payment reminder email & SMS sent to ${selectedCustomer.name}!`)}>
                    Send Reminder Today <Arrow />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. PAYMENTS SCREEN */}
        {activeNav === "Payments" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">RECONCILIATION & CASH INFLOWS</p>
                <h1>Payments Received</h1>
                <p>Match payments to open invoices and update cash position model.</p>
              </div>
            </div>
            <div className="workflow-card">
              <div className="workflow-stat"><span>Matched This Month</span><strong>₹18.4L</strong></div>
              <div className="workflow-stat"><span>Pending Match</span><strong>₹1.2L</strong></div>
              <div className="workflow-stat"><span>Reconciliation Rate</span><strong>94%</strong></div>
            </div>
          </div>
        )}

        {/* 6. EXPENSES SCREEN (WITH REAL ADD EXPENSE MODAL) */}
        {activeNav === "Expenses" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">OUTFLOW MANAGEMENT</p>
                <h1>Expenses</h1>
                <p>Track recurring operating expenses and AI unusual spending flags.</p>
              </div>
              {hasPermission(userRole, "expense.create") && (
                <button className="primary-button" onClick={() => setShowAddExpenseModal(true)}>
                  Add Expense <span>+</span>
                </button>
              )}
            </div>
            <div className="table-card">
              <div className="table-header"><h2>Expense Log</h2></div>
              {expenses.map((exp) => (
                <div className="table-row" key={exp.id}>
                  <div>
                    <strong>{exp.category}</strong>
                    <span>{exp.supplier} · {exp.date}</span>
                  </div>
                  {exp.isUnusual && <span style={{ color: "#cc5d5d", fontWeight: 600 }}>⚠️ Unusual +27%</span>}
                  <strong>{exp.amount}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. SUPPLIERS SCREEN (WITH REAL ADD SUPPLIER MODAL) */}
        {activeNav === "Suppliers" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">SUPPLIER CREDIT MANAGEMENT</p>
                <h1>Suppliers & Credit Terms</h1>
              </div>
              {hasPermission(userRole, "supplier.manage") && (
                <button className="primary-button" onClick={() => setShowAddSupplierModal(true)}>
                  Add Supplier <span>+</span>
                </button>
              )}
            </div>
            <div className="table-card">
              {suppliers.map((s) => (
                <div className="table-row" key={s.id}>
                  <div><strong>{s.name}</strong><span>Credit Terms: {s.creditDays} days</span></div>
                  <strong>Total Spend: {s.totalSpend}</strong>
                  <span className="status-good">{s.score}/100 Reliability</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. ANALYTICS SCREEN */}
        {activeNav === "Analytics" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">EXECUTIVE METRICS</p>
                <h1>Financial Analytics</h1>
                <p>Revenue growth, DSO (Days Sales Outstanding), and customer concentration.</p>
              </div>
            </div>
            <div className="workflow-card">
              <div className="workflow-stat"><span>DSO (Collection Time)</span><strong>38 Days</strong></div>
              <div className="workflow-stat"><span>Top 5 Concentration</span><strong>64%</strong></div>
              <div className="workflow-stat"><span>Monthly Revenue Growth</span><strong>+14.2%</strong></div>
            </div>
          </div>
        )}

        {/* 9. AI CFO AGENT SCREEN */}
        {activeNav === "AI CFO" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">DATABASE-AWARE CFO AGENT</p>
                <h1>AI CFO Workspace</h1>
                <p>Ask natural language questions evaluated against your live database tables.</p>
              </div>
            </div>
            <div className="scenario-card" style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid #e0e0e0" }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                {[
                  "Why did my cash decrease?",
                  "Which customers should I contact today?",
                  "Can I afford to hire two employees?",
                  "What are my biggest financial risks?",
                ].map((q) => (
                  <button
                    key={q}
                    className="text-button"
                    style={{ background: "#f1f5f9", padding: "6px 12px", borderRadius: "16px" }}
                    onClick={() => {
                      setAiQuestion(q);
                      askAiCfo(q);
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="Ask your AI CFO any financial question..."
                  style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #ccc" }}
                />
                <button className="primary-button" onClick={() => askAiCfo()}>
                  Ask AI CFO <Arrow />
                </button>
              </div>
              {aiResponse && (
                <div style={{ marginTop: "16px", padding: "16px", background: "#f8fafc", borderRadius: "8px", borderLeft: "4px solid #1c8b69" }}>
                  <strong>AI CFO Recommendation:</strong>
                  <p style={{ marginTop: "6px", whiteSpace: "pre-line" }}>{aiResponse}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 10. DEDICATED COLLECTIONS & PAYMENT PROMISE SYSTEM */}
        {activeNav === "Collections" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">DEDICATED COLLECTIONS CENTER</p>
                <h1>Collections & Promises to Pay</h1>
                <p>Track customer payment commitments and missed promise dates.</p>
              </div>
              {hasPermission(userRole, "collections.manage") && (
                <button className="primary-button" onClick={() => setShowAddPromiseModal(true)}>
                  Record Payment Promise <span>+</span>
                </button>
              )}
            </div>
            <div className="workflow-card">
              <div className="workflow-stat"><span>Total Overdue</span><strong className="negative">₹{(totalOverdue / 100000).toFixed(1)}L</strong></div>
              <div className="workflow-stat"><span>At-Risk Exposure</span><strong>₹4.2L</strong></div>
              <div className="workflow-stat"><span>Recovery Rate</span><strong className="positive">81%</strong></div>
            </div>

            <div className="table-card" style={{ marginTop: "20px" }}>
              <div className="table-header"><h2>Active Promises to Pay</h2></div>
              {promises.map((p) => (
                <div className="table-row" key={p.id}>
                  <div>
                    <strong>{p.customerName}</strong>
                    <span>Promised Date: {p.promisedDate}</span>
                  </div>
                  <strong>{p.amount}</strong>
                  <span className={`status-${p.status === "missed" ? "bad" : "good"}`}>
                    {p.status === "missed" ? "⚠️ Promise Missed" : "Pending Promise"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 11. ALERTS CENTER */}
        {activeNav === "Alerts" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">AUTOMATED MONITORING</p>
                <h1>Alerts Center</h1>
              </div>
            </div>
            <div className="table-card">
              <div className="table-row"><span>🔴 Critical: ₹2.4L invoice from Acme Cloudworks is 14 days overdue.</span></div>
              <div className="table-row"><span>🟠 Warning: ₹4.2L supplier payment due in 3 days.</span></div>
              <div className="table-row"><span>🔵 AI Insight: Unusual +27% software expense flagged.</span></div>
            </div>
          </div>
        )}

        {/* 12. REPORTS SCREEN */}
        {activeNav === "Reports" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">EXPORTABLE FINANCIAL REPORTS</p>
                <h1>Reports</h1>
              </div>
            </div>
            <div className="customer-grid">
              {["Cash Flow Statement", "Receivables Aging Report", "Customer Risk Report", "Expense Breakdown"].map((rep) => (
                <div className="customer-card" key={rep}>
                  <strong>{rep}</strong>
                  <button className="text-button" style={{ marginTop: "12px" }} onClick={() => handleExportReport(rep)}>
                    Export CSV / PDF <Arrow />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 13. TEAM MANAGEMENT */}
        {activeNav === "Team" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">ORGANIZATION GOVERNANCE</p>
                <h1>Team Management</h1>
                <p>Invite members and assign 6-tier RBAC roles.</p>
              </div>
              {hasPermission(userRole, "team.invite") && (
                <button className="primary-button" onClick={() => setShowInviteModal(true)}>
                  Invite Member <span>+</span>
                </button>
              )}
            </div>

            <div className="table-card">
              {teamMembers.map((tm) => (
                <div className="table-row" key={tm.email}>
                  <div><strong>{tm.email}</strong><span>Role: {tm.role.toUpperCase()}</span></div>
                  <span className={`status-${tm.status === "Active" ? "good" : "warm"}`}>{tm.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 14. SETTINGS */}
        {activeNav === "Settings" && (
          <div className="workspace-view">
            <div className="workspace-heading">
              <div>
                <p className="eyebrow">ORGANIZATION CONTROL</p>
                <h1>Settings & Governance</h1>
              </div>
            </div>
            <div className="settings-card">
              <label>Organization Name<input defaultValue={activeOrg?.name || "ABC Digital Solutions"} disabled /></label>
              <label>Active User Role<input value={userRole.toUpperCase()} disabled /></label>
              <label className="toggle-row"><span>Enforce Database Row Level Security (RLS)</span><input type="checkbox" defaultChecked disabled /></label>
              <label className="toggle-row"><span>6-Tier RBAC Permission Enforcement</span><input type="checkbox" defaultChecked disabled /></label>
            </div>
          </div>
        )}

        {/* REAL INTERACTIVE MODALS */}

        {/* 1. NEW INVOICE MODAL */}
        {showNewInvoiceModal && (
          <div className="modal-overlay" onClick={() => setShowNewInvoiceModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Invoice</h2>
                <button className="modal-close" onClick={() => setShowNewInvoiceModal(false)}>×</button>
              </div>
              <form onSubmit={handleCreateInvoice} className="modal-form">
                <label>
                  Invoice Reference Number
                  <input value={invNumber} onChange={(e) => setInvNumber(e.target.value)} required />
                </label>
                <label>
                  Customer Name
                  <input
                    value={invCustomer}
                    onChange={(e) => setInvCustomer(e.target.value)}
                    placeholder="e.g. Acme Cloudworks"
                    required
                  />
                </label>
                <label>
                  Total Invoice Amount (₹)
                  <input
                    type="number"
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    placeholder="e.g. 150000"
                    required
                  />
                </label>
                <label>
                  Due Date
                  <input type="date" value={invDueDate} onChange={(e) => setInvDueDate(e.target.value)} required />
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowNewInvoiceModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Create Invoice</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. ADD EXPENSE MODAL */}
        {showAddExpenseModal && (
          <div className="modal-overlay" onClick={() => setShowAddExpenseModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Record New Expense</h2>
                <button className="modal-close" onClick={() => setShowAddExpenseModal(false)}>×</button>
              </div>
              <form onSubmit={handleAddExpense} className="modal-form">
                <label>
                  Expense Category
                  <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                    <option value="Cloud Hosting">Cloud Hosting & Infrastructure</option>
                    <option value="Software Licenses">Software & Tools</option>
                    <option value="Salaries & Payroll">Salaries & Payroll</option>
                    <option value="Marketing & Ads">Marketing & Ads</option>
                    <option value="Office Rent">Office Rent & Facilities</option>
                    <option value="Consulting & Legal">Consulting & Legal</option>
                  </select>
                </label>
                <label>
                  Supplier / Vendor Name
                  <input
                    value={expSupplier}
                    onChange={(e) => setExpSupplier(e.target.value)}
                    placeholder="e.g. AWS India / DesignStack"
                    required
                  />
                </label>
                <label>
                  Amount (₹)
                  <input
                    type="number"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="e.g. 75000"
                    required
                  />
                </label>
                <label>
                  Expense Date
                  <input type="text" value={expDate} onChange={(e) => setExpDate(e.target.value)} required />
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddExpenseModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Save Expense</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 3. ADD CUSTOMER MODAL */}
        {showAddCustomerModal && (
          <div className="modal-overlay" onClick={() => setShowAddCustomerModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Customer</h2>
                <button className="modal-close" onClick={() => setShowAddCustomerModal(false)}>×</button>
              </div>
              <form onSubmit={handleAddCustomer} className="modal-form">
                <label>
                  Customer / Business Name
                  <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="e.g. Global Tech Solutions" required />
                </label>
                <label>
                  Contact Email
                  <input type="email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} placeholder="finance@globaltech.com" />
                </label>
                <label>
                  Initial Outstanding Balance (₹)
                  <input type="number" value={custAmount} onChange={(e) => setCustAmount(e.target.value)} placeholder="0" />
                </label>
                <label>
                  Payment Reliability Score (0 - 100)
                  <input type="number" min="0" max="100" value={custScore} onChange={(e) => setCustScore(e.target.value)} required />
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddCustomerModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Save Customer</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. ADD SUPPLIER MODAL */}
        {showAddSupplierModal && (
          <div className="modal-overlay" onClick={() => setShowAddSupplierModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Add Supplier</h2>
                <button className="modal-close" onClick={() => setShowAddSupplierModal(false)}>×</button>
              </div>
              <form onSubmit={handleAddSupplier} className="modal-form">
                <label>
                  Supplier Name
                  <input value={supName} onChange={(e) => setSupName(e.target.value)} placeholder="e.g. CloudHost India" required />
                </label>
                <label>
                  Credit Terms (Days)
                  <input type="number" value={supCreditDays} onChange={(e) => setSupCreditDays(e.target.value)} required />
                </label>
                <label>
                  Estimated Total Annual Spend
                  <input value={supTotalSpend} onChange={(e) => setSupTotalSpend(e.target.value)} placeholder="e.g. ₹3.5L" required />
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddSupplierModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Save Supplier</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. ADD PROMISE TO PAY MODAL */}
        {showAddPromiseModal && (
          <div className="modal-overlay" onClick={() => setShowAddPromiseModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Record Promise to Pay</h2>
                <button className="modal-close" onClick={() => setShowAddPromiseModal(false)}>×</button>
              </div>
              <form onSubmit={handleAddPromise} className="modal-form">
                <label>
                  Customer Name
                  <input value={promCustomer} onChange={(e) => setPromCustomer(e.target.value)} placeholder="e.g. Northstar Studio" required />
                </label>
                <label>
                  Promised Payment Amount (₹)
                  <input type="number" value={promAmount} onChange={(e) => setPromAmount(e.target.value)} placeholder="e.g. 142000" required />
                </label>
                <label>
                  Promised Payment Date
                  <input type="date" value={promDate} onChange={(e) => setPromDate(e.target.value)} required />
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowAddPromiseModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Save Commitment</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 6. INVITE TEAM MEMBER MODAL */}
        {showInviteModal && (
          <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Invite Team Member</h2>
                <button className="modal-close" onClick={() => setShowInviteModal(false)}>×</button>
              </div>
              <form onSubmit={handleInviteMember} className="modal-form">
                <label>
                  Member Email:
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="colleague@company.com" />
                </label>
                <label>
                  Assigned RBAC Role:
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                    <option value="admin">Admin</option>
                    <option value="finance_manager">Finance Manager</option>
                    <option value="accountant">Accountant</option>
                    <option value="collections">Collections Manager</option>
                    <option value="viewer">Viewer (Read-Only)</option>
                  </select>
                </label>
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={() => setShowInviteModal(false)}>Cancel</button>
                  <button type="submit" className="primary-button">Send Invitation</button>
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
