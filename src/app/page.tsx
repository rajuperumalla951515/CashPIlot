"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Organization {
  id: string;
  name: string;
  industry?: string;
  currency?: string;
  role?: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  created_at: string;
  user_email?: string;
}

const metrics = [
  { label: "Cash available", value: "₹8.4L", note: "+12.8% vs last month", tone: "mint" },
  { label: "Receivables", value: "₹31.7L", note: "₹7.9L overdue", tone: "orange" },
  { label: "Payables", value: "₹12.3L", note: "₹4.1L due this week", tone: "cream" },
  { label: "30-day inflow", value: "₹24.8L", note: "82% high confidence", tone: "blue" },
];

const actions = [
  { icon: "!", title: "Recover ₹2.4L", detail: "5 overdue customers need attention", action: "Review list", tone: "urgent" },
  { icon: "↗", title: "Follow up with 8 customers", detail: "₹4.1L due within 3 days", action: "Open queue", tone: "warm" },
  { icon: "↓", title: "Delay ₹75K supplier payment", detail: "Protect short-term cash runway", action: "Simulate", tone: "cool" },
  { icon: "✓", title: "Expected inflow ₹3.8L", detail: "Arriving this week", action: "View details", tone: "good" },
];

const sampleCustomers = [
  { initials: "AC", name: "Acme Cloudworks", invoice: "INV-2841", days: "14 days overdue", score: 92, color: "#1c8b69" },
  { initials: "NS", name: "Northstar Studio", invoice: "INV-2835", days: "9 days overdue", score: 61, color: "#db7438" },
  { initials: "PB", name: "Pixel & Beam", invoice: "INV-2818", days: "Due in 2 days", score: 38, color: "#cc5d5d" },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

// Demo user object for instant access preview
const DEMO_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  app_metadata: { provider: "email" },
  user_metadata: { full_name: "Rahul Sharma (Demo CFO)", org_name: "Acme Studio Demo" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
  email: "demo@cashpilot.app",
};

function MultiStepAuthPanel({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  // Step 1: User Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Step 2: Organization / Business details
  const [orgName, setOrgName] = useState("ABC Digital Solutions");
  const [industry, setIndustry] = useState("IT Services");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  function launchDemoMode() {
    onAuthenticated(DEMO_USER);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase environment is initializing...");
      setIsError(true);
      return;
    }
    setMessage("");
    setIsError(false);

    if (mode === "signup" && signupStep === 1) {
      setSignupStep(2);
      return;
    }

    setBusy(true);

    // Forgot password flow
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (error) {
        setIsError(true);
        setMessage(error.message);
      } else {
        setIsError(false);
        setMessage("Password reset link sent! Check your email inbox.");
      }
      setBusy(false);
      return;
    }

    // Sign in flow
    if (mode === "signin") {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        setIsError(true);
        setMessage(result.error.message);
      } else if (result.data.user) {
        onAuthenticated(result.data.user);
      }
      setBusy(false);
      return;
    }

    // Sign up flow
    const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    const result = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName || email.split("@")[0],
          org_name: orgName,
          workspace_name: orgName,
          industry,
          currency,
          timezone,
        },
      },
    });

    if (result.error) {
      setIsError(true);
      setMessage(result.error.message);
    } else if (result.data.session && result.data.user) {
      // Immediate session created (auto-confirm enabled)
      await supabase.from("profiles").upsert({
        id: result.data.user.id,
        full_name: fullName || email.split("@")[0],
        updated_at: new Date().toISOString(),
      });
      onAuthenticated(result.data.user);
    } else if (result.data.user) {
      // Email confirmation required by Supabase
      setIsError(false);
      setMessage(`Account created for ${email}! Please check your email to confirm your account.`);
    }
    setBusy(false);
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-mark">+</span>
          <span>cashpilot</span>
        </div>
        <p className="eyebrow">YOUR AI CFO FOR CASH FLOW</p>
        <h1>
          {mode === "signin"
            ? "Welcome back."
            : mode === "forgot"
            ? "Reset your password."
            : signupStep === 1
            ? "Step 1: Account Details"
            : "Step 2: Business Setup"}
        </h1>
        <p className="auth-subtitle">
          {mode === "forgot"
            ? "Enter your email to receive a password reset link."
            : mode === "signup" && signupStep === 2
            ? "Set up your multi-tenant business environment."
            : "Sign in to securely access your cash flow dashboard."}
        </p>

        {/* Demo Mode Quick Access Banner */}
        <div className="demo-banner" style={{ background: "rgba(28, 139, 105, 0.08)", border: "1px solid rgba(28, 139, 105, 0.2)", borderRadius: "8px", padding: "12px", marginBottom: "16px", textAlign: "center" }}>
          <span style={{ fontSize: "13px", color: "#1c8b69", fontWeight: 600 }}>Want to preview CashPilot instantly?</span>
          <button
            type="button"
            className="primary-button"
            style={{ marginTop: "8px", width: "100%", padding: "8px 16px", background: "#1c8b69", fontSize: "14px" }}
            onClick={launchDemoMode}
          >
            ⚡ Launch Demo Mode (Instant Access)
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && signupStep === 1 && (
            <label>
              Full Name
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Raju Perumalla"
              />
            </label>
          )}

          {mode !== "signup" || signupStep === 1 ? (
            <label>
              Email Address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
              />
            </label>
          ) : null}

          {mode !== "forgot" && (mode !== "signup" || signupStep === 1) ? (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                placeholder="At least 6 characters"
              />
            </label>
          ) : null}

          {mode === "signup" && signupStep === 2 && (
            <>
              <label>
                Company / Organization Name
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  placeholder="ABC Digital Solutions"
                />
              </label>
              <label>
                Industry
                <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  <option value="IT Services">IT Services / Tech Agency</option>
                  <option value="SaaS">SaaS / Software</option>
                  <option value="Manufacturing">Manufacturing & Goods</option>
                  <option value="Retail">Retail & E-commerce</option>
                  <option value="Consulting">Consulting & Services</option>
                </select>
              </label>
              <label>
                Operating Currency
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </label>
            </>
          )}

          <button className="primary-button auth-submit" disabled={busy} style={{ marginTop: "12px" }}>
            {busy
              ? "Connecting..."
              : mode === "signin"
              ? "Sign in with Email"
              : mode === "forgot"
              ? "Send Reset Link"
              : signupStep === 1
              ? "Next: Business Details ↗"
              : "Complete Setup & Sign In"}
            {mode !== "signup" || signupStep === 2 ? <Arrow /> : null}
          </button>
        </form>

        {message && (
          <p className="auth-message" style={{ color: isError ? "#cc5d5d" : "#1c8b69", marginTop: "12px", fontSize: "13px", lineHeight: "1.4" }}>
            {message}
          </p>
        )}

        <div className="auth-footer-links" style={{ marginTop: "16px" }}>
          {mode === "signup" && signupStep === 2 ? (
            <button
              type="button"
              className="auth-switch"
              onClick={() => setSignupStep(1)}
            >
              ← Back to Account Details
            </button>
          ) : mode === "signin" ? (
            <>
              <button
                type="button"
                className="auth-switch"
                onClick={() => {
                  setMode("signup");
                  setSignupStep(1);
                  setMessage("");
                }}
              >
                New to CashPilot? Create an Account
              </button>
              <button
                type="button"
                className="auth-switch text-subtle"
                onClick={() => {
                  setMode("forgot");
                  setMessage("");
                }}
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setMode("signin");
                setMessage("");
              }}
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function WorkspaceView({
  view,
  notify,
  customers: databaseCustomers,
  organizationId,
  userRole,
}: {
  view: string;
  notify: (msg: string) => void;
  customers: typeof sampleCustomers;
  organizationId: string | null;
  userRole: string;
}) {
  const [invoices, setInvoices] = useState([
    { id: "INV-2841", customer: "Acme Cloudworks", amount: "₹85,000", due: "14 days overdue", status: "Overdue" },
    { id: "INV-2835", customer: "Northstar Studio", amount: "₹1,42,000", due: "9 days overdue", status: "Overdue" },
    { id: "INV-2818", customer: "Pixel & Beam", amount: "₹64,500", due: "Due in 2 days", status: "Due soon" },
  ]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (!supabase || !organizationId) return;
    if (view === "Receivables") {
      supabase
        .from("invoices")
        .select("invoice_number, amount, due_date, status")
        .eq("organization_id", organizationId)
        .order("due_date")
        .then(({ data }) => {
          if (data?.length) {
            setInvoices(
              data.map((inv) => ({
                id: inv.invoice_number,
                customer: "Account",
                amount: `₹${Number(inv.amount).toLocaleString("en-IN")}`,
                due: inv.due_date,
                status: inv.status === "paid" ? "Paid" : inv.status === "overdue" ? "Overdue" : "Due soon",
              }))
            );
          }
        });
    } else if (view === "Audit logs") {
      supabase
        .from("audit_logs")
        .select("id, action, entity_type, entity_id, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => {
          if (data) setAuditLogs(data as AuditLog[]);
        });
    }
  }, [view, organizationId]);

  if (view === "Audit logs") {
    return (
      <div className="workspace-view">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">COMPLIANCE & RISK MANAGEMENT</p>
            <h1>Audit logs</h1>
            <p>Every financial mutation is tracked at the database level.</p>
          </div>
        </div>
        <div className="table-card">
          <div className="table-header">
            <h2>Organization Activity Trail</h2>
            <span className="badge">Secured by RLS</span>
          </div>
          {auditLogs.length ? (
            auditLogs.map((log) => (
              <div className="table-row" key={log.id}>
                <div>
                  <strong>{log.action}</strong>
                  <span>{log.entity_type} {log.entity_id ? `· ${log.entity_id}` : ""}</span>
                </div>
                <small>{new Date(log.created_at).toLocaleString()}</small>
              </div>
            ))
          ) : (
            <div className="table-row">
              <span>No audit events logged yet. Mutations will automatically record user and timestamp.</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "Receivables") {
    return (
      <div className="workspace-view">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">MONEY OWED TO YOU</p>
            <h1>Receivables</h1>
            <p>Track invoices and take collection action.</p>
          </div>
          {userRole !== "viewer" && (
            <button className="primary-button" onClick={() => notify("New invoice form opened.")}>
              New invoice <span>+</span>
            </button>
          )}
        </div>
        <div className="workflow-card">
          <div className="workflow-stat">
            <span>Total outstanding</span>
            <strong>₹31.7L</strong>
            <small>18 open invoices</small>
          </div>
          <div className="workflow-stat">
            <span>Overdue</span>
            <strong className="negative">₹7.9L</strong>
            <small>5 invoices need action</small>
          </div>
          <div className="workflow-stat">
            <span>Role Permissions</span>
            <strong className="positive">{userRole.toUpperCase()}</strong>
            <small>RLS Enforced</small>
          </div>
        </div>
        <div className="table-card">
          <div className="table-header">
            <h2>Invoice queue</h2>
          </div>
          {invoices.map((inv) => (
            <div className="table-row invoice-row" key={inv.id}>
              <div>
                <strong>{inv.id}</strong>
                <span>{inv.customer} · {inv.due}</span>
              </div>
              <strong>{inv.amount}</strong>
              <span className={inv.status === "Overdue" ? "status-bad" : "status-good"}>{inv.status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-view">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">ORGANIZATION SETTINGS</p>
          <h1>Settings & Team</h1>
          <p>Control organization members and role-based permissions.</p>
        </div>
      </div>
      <div className="settings-card">
        <label>
          Active Role
          <input value={userRole.toUpperCase()} disabled />
        </label>
        <label className="toggle-row">
          <span>Enforce Database Row Level Security (RLS)</span>
          <input type="checkbox" defaultChecked disabled />
        </label>
        <label className="toggle-row">
          <span>Automatic Financial Audit Trails</span>
          <input type="checkbox" defaultChecked disabled />
        </label>
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);

  // Multi-Tenant State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState("owner");
  const [activeNav, setActiveNav] = useState("Overview");

  const [range, setRange] = useState("30 days");
  const [dashboardMetrics, setDashboardMetrics] = useState(metrics);
  const [toast, setToast] = useState("");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session?.user) {
        notify(`Welcome back, ${session.user.user_metadata?.full_name || session.user.email}!`);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    async function loadOrganizations() {
      if (!supabase) return;

      try {
        const { data: memberships } = await supabase
          .from("organization_members")
          .select("organization_id, role, organizations(id, name, industry, currency)")
          .eq("user_id", user!.id);

        if (memberships && memberships.length > 0) {
          const orgList: Organization[] = memberships.map((m: any) => ({
            id: m.organizations?.id || m.organization_id,
            name: m.organizations?.name || "Business Organization",
            industry: m.organizations?.industry,
            currency: m.organizations?.currency,
            role: m.role,
          }));
          setOrganizations(orgList);
          setActiveOrg(orgList[0]);
          setUserRole(orgList[0].role || "owner");
        } else {
          // Fallback demo/initial organization
          const fallbackOrg = {
            id: "00000000-0000-0000-0000-000000000001",
            name: user?.user_metadata?.org_name || user?.user_metadata?.workspace_name || "Acme Studio Demo",
            role: "owner",
          };
          setOrganizations([fallbackOrg]);
          setActiveOrg(fallbackOrg);
        }
      } catch {
        const fallbackOrg = {
          id: "00000000-0000-0000-0000-000000000001",
          name: "Acme Studio Demo",
          role: "owner",
        };
        setOrganizations([fallbackOrg]);
        setActiveOrg(fallbackOrg);
      }
    }

    loadOrganizations();
  }, [user]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }

  function handleSignOut() {
    if (supabase) {
      supabase.auth.signOut().catch(() => undefined);
    }
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">+</span>
          <span>cashpilot</span>
        </div>

        {/* Multi-Tenant Organization Switcher */}
        <div className="workspace-switcher">
          <select
            value={activeOrg?.id ?? ""}
            onChange={(e) => {
              const selected = organizations.find((o) => o.id === e.target.value);
              if (selected) {
                setActiveOrg(selected);
                setUserRole(selected.role || "member");
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

        <nav className="nav-list" aria-label="Main navigation">
          <p className="nav-label">Organization</p>
          {["Overview", "Cash forecast", "Receivables", "Payables", "Audit logs"].map((item, index) => (
            <button
              className={`nav-item ${activeNav === item ? "active" : ""}`}
              onClick={() => setActiveNav(item)}
              key={item}
            >
              <span className="nav-icon">{["◒", "⌁", "↗", "↘", "📋"][index]}</span>
              {item}
            </button>
          ))}
          <p className="nav-label second">Security & Controls</p>
          {["Settings"].map((item) => (
            <button
              className={`nav-item ${activeNav === item ? "active" : ""}`}
              onClick={() => setActiveNav(item)}
              key={item}
            >
              <span className="nav-icon">⚙</span>
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{activeOrg?.name || "Organization"}</span>
            <span className="slash">/</span>
            <strong>{activeNav}</strong>
          </div>
          <div className="top-actions">
            <span className="signed-in">{user.email}</span>
            <span className="role-pill">{userRole.toUpperCase()}</span>
            <button className="avatar" title="Sign out" onClick={handleSignOut}>
              {user.email?.slice(0, 2).toUpperCase() || "US"}
            </button>
          </div>
        </header>

        {activeNav === "Overview" ? (
          <div className="content-wrap">
            <section className="hero-row">
              <div>
                <p className="eyebrow">AUTHENTICATED AS {user?.user_metadata?.full_name?.toUpperCase() || user?.email?.toUpperCase()}</p>
                <h1>{activeOrg?.name || "Cash Command Center"}</h1>
                <p className="subheading">Your organization cash flow metrics secured by Supabase RLS.</p>
              </div>
            </section>

            <section className="metric-grid">
              {dashboardMetrics.map((m) => (
                <article className={`metric-card ${m.tone}`} key={m.label}>
                  <div className="metric-top">
                    <span>{m.label}</span>
                    <span className="metric-arrow"><Arrow /></span>
                  </div>
                  <strong>{m.value}</strong>
                  <p>{m.note}</p>
                </article>
              ))}
            </section>
          </div>
        ) : (
          <WorkspaceView
            view={activeNav}
            notify={notify}
            customers={sampleCustomers}
            organizationId={activeOrg?.id ?? null}
            userRole={userRole}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
      </main>
    </div>
  );
}
