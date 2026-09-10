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

function SmartAuthPanel({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("ABC Digital Solutions");

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Initializing database connection...");
      setIsError(true);
      return;
    }
    setMessage("");
    setIsError(false);
    setBusy(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (error) {
        setIsError(true);
        setMessage(error.message);
      } else {
        setIsError(false);
        setMessage("Password reset link sent! Check your inbox.");
      }
      setBusy(false);
      return;
    }

    if (mode === "signin") {
      const signInResult = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInResult.data.user) {
        onAuthenticated(signInResult.data.user);
        setBusy(false);
        return;
      }

      const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const signUpResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName || email.split("@")[0],
            org_name: orgName,
            workspace_name: orgName,
          },
        },
      });

      if (signUpResult.data.user) {
        await supabase.from("profiles").upsert({
          id: signUpResult.data.user.id,
          full_name: fullName || email.split("@")[0],
          updated_at: new Date().toISOString(),
        });

        if (signUpResult.data.session) {
          onAuthenticated(signUpResult.data.user);
          setBusy(false);
          return;
        }

        const autoLogin = await supabase.auth.signInWithPassword({ email, password });
        if (autoLogin.data.user) {
          onAuthenticated(autoLogin.data.user);
          setBusy(false);
          return;
        }
      }

      setIsError(true);
      setMessage(signInResult.error?.message || "Invalid login credentials. Click 'Create an Account' below to register.");
      setBusy(false);
      return;
    }

    const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    const signUpResult = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName || email.split("@")[0],
          org_name: orgName,
          workspace_name: orgName,
        },
      },
    });

    if (signUpResult.error) {
      setIsError(true);
      setMessage(signUpResult.error.message);
    } else if (signUpResult.data.user) {
      await supabase.from("profiles").upsert({
        id: signUpResult.data.user.id,
        full_name: fullName || email.split("@")[0],
        updated_at: new Date().toISOString(),
      });

      if (signUpResult.data.session) {
        onAuthenticated(signUpResult.data.user);
      } else {
        const autoLogin = await supabase.auth.signInWithPassword({ email, password });
        if (autoLogin.data.user) {
          onAuthenticated(autoLogin.data.user);
        } else {
          setIsError(false);
          setMessage(`Account created for ${email}! You can now sign in.`);
        }
      }
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
            ? "Sign in to CashPilot."
            : mode === "forgot"
            ? "Reset your password."
            : "Create your account & workspace."}
        </h1>
        <p className="auth-subtitle">
          {mode === "forgot"
            ? "Enter your email address to receive a password reset link."
            : "Access your company's cash command center."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
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

          {mode !== "forgot" && (
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
          )}

          {mode === "signup" && (
            <label>
              Company / Business Name
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="ABC Digital Solutions"
              />
            </label>
          )}

          <button className="primary-button auth-submit" disabled={busy} style={{ marginTop: "12px" }}>
            {busy
              ? "Authenticating..."
              : mode === "signin"
              ? "Continue to Dashboard"
              : mode === "forgot"
              ? "Send Reset Link"
              : "Create Account & Workspace"}
            <Arrow />
          </button>
        </form>

        {message && (
          <p className="auth-message" style={{ color: isError ? "#cc5d5d" : "#1c8b69", marginTop: "12px", fontSize: "13px", lineHeight: "1.4" }}>
            {message}
          </p>
        )}

        <div className="auth-footer-links" style={{ marginTop: "16px" }}>
          {mode === "signin" ? (
            <>
              <button
                type="button"
                className="auth-switch"
                onClick={() => {
                  setMode("signup");
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
  const [scheduled, setScheduled] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [delayDays, setDelayDays] = useState("30");
  const [delayAmount, setDelayAmount] = useState("320000");
  const [scenarioResult, setScenarioResult] = useState("");
  const [documents, setDocuments] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
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

  async function updateInvoice(invoiceNumber: string, status: string) {
    if (supabase && organizationId) {
      await supabase
        .from("invoices")
        .update({ status, paid_at: status === "paid" ? new Date().toISOString() : null })
        .eq("organization_id", organizationId)
        .eq("invoice_number", invoiceNumber);
    }
    setInvoices((items) =>
      items.map((item) => (item.id === invoiceNumber ? { ...item, status: status === "paid" ? "Paid" : "Reminder queued" } : item))
    );
    notify(status === "paid" ? `${invoiceNumber} marked as paid.` : "Reminders queued for overdue invoices.");
  }

  if (view === "Cash forecast") {
    return (
      <div className="workspace-view">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">PLANNING TOOL</p>
            <h1>Cash forecast</h1>
            <p>Model inflows, outflows, and runway before they happen.</p>
          </div>
          <button className="primary-button" onClick={() => notify("Forecast exported as a report.")}>
            Export report <Arrow />
          </button>
        </div>
        <div className="workflow-card">
          <div className="workflow-stat">
            <span>Projected balance in 30 days</span>
            <strong>₹11.2L</strong>
            <small>82% confidence</small>
          </div>
          <div className="workflow-stat">
            <span>Lowest projected balance</span>
            <strong>₹8.1L</strong>
            <small>18 September 2026</small>
          </div>
          <div className="workflow-stat">
            <span>Runway</span>
            <strong>42 days</strong>
            <small>Healthy position</small>
          </div>
        </div>
        <div className="table-card">
          <div className="table-header">
            <h2>Upcoming cash movements</h2>
            <button className="text-button" onClick={() => notify("Cash movement import opened.")}>
              Import CSV <Arrow />
            </button>
          </div>
          {["Customer payments · ₹6.8L", "Payroll · -₹4.2L", "Supplier payments · -₹1.6L", "Rent and tax · -₹85K"].map((item) => (
            <div className="table-row" key={item}>
              <span>{item}</span>
              <span className={item.includes("-") ? "negative" : "positive"}>{item.includes("-") ? "Outflow" : "Inflow"}</span>
            </div>
          ))}
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
            <button className="primary-button" onClick={() => notify("New invoice created in Supabase.")}>
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
            <button
              className="text-button"
              onClick={() => {
                invoices.filter((item) => item.status === "Overdue").forEach((item) => updateInvoice(item.id, "overdue"));
              }}
            >
              Queue reminders <Arrow />
            </button>
          </div>
          {invoices.map((invoice) => (
            <div className="table-row invoice-row" key={invoice.id}>
              <div>
                <strong>{invoice.id}</strong>
                <span>{invoice.customer} · {invoice.due}</span>
              </div>
              <strong>{invoice.amount}</strong>
              <span className={invoice.status === "Overdue" ? "status-bad" : "status-good"}>{invoice.status}</span>
              <button
                className="row-action"
                disabled={invoice.status === "Paid"}
                onClick={() => updateInvoice(invoice.id, "paid")}
              >
                {invoice.status === "Paid" ? "Paid" : "Mark paid"} <Arrow />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "Payables") {
    return (
      <div className="workspace-view">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">MONEY YOU OWE</p>
            <h1>Payables</h1>
            <p>Protect cash without missing critical supplier obligations.</p>
          </div>
          <button className="primary-button" onClick={() => notify("New bill form opened.")}>
            Add bill <span>+</span>
          </button>
        </div>
        <div className="workflow-card">
          <div className="workflow-stat">
            <span>Due this week</span>
            <strong>₹4.1L</strong>
            <small>7 supplier bills</small>
          </div>
          <div className="workflow-stat">
            <span>Due this month</span>
            <strong>₹12.3L</strong>
            <small>23 open bills</small>
          </div>
          <div className="workflow-stat">
            <span>Potentially deferrable</span>
            <strong className="positive">₹75K</strong>
            <small>Low supplier risk</small>
          </div>
        </div>
        <div className="table-card">
          <div className="table-header">
            <h2>Supplier payment queue</h2>
            <button className="text-button" onClick={() => notify("Payment batch prepared for review.")}>
              Prepare batch <Arrow />
            </button>
          </div>
          {["CloudHost India · ₹42,000 · Due today", "DesignStack · ₹75,000 · Due in 6 days", "Office lease · ₹1,18,000 · Due in 10 days"].map((bill) => (
            <div className="table-row" key={bill}>
              <span>{bill}</span>
              <button
                className="row-action"
                onClick={() => {
                  setScheduled((items) => [...items, bill]);
                  notify("Payment scheduled for approval.");
                }}
              >
                {scheduled.includes(bill) ? "Scheduled" : "Schedule"} <Arrow />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "Customers") {
    return (
      <div className="workspace-view">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">RELATIONSHIP INTELLIGENCE</p>
            <h1>Customers</h1>
            <p>See who pays reliably and where your cash is exposed.</p>
          </div>
          <button className="primary-button" onClick={() => notify("Customer import opened.")}>
            Import customers <span>+</span>
          </button>
        </div>
        <div className="customer-grid">
          {databaseCustomers.map((customer) => (
            <button
              className={`customer-card ${selectedCustomer === customer.name ? "selected" : ""}`}
              onClick={() => setSelectedCustomer(customer.name)}
              key={customer.name}
            >
              <span className="customer-avatar" style={{ backgroundColor: customer.color }}>
                {customer.initials}
              </span>
              <strong>{customer.name}</strong>
              <span>{customer.invoice} · {customer.days}</span>
              <b>
                {customer.score}
                <small>/100 reliability</small>
              </b>
              {selectedCustomer === customer.name && <em>Selected for review</em>}
            </button>
          ))}
        </div>
        {selectedCustomer && (
          <div className="detail-card">
            <p className="eyebrow">CUSTOMER PROFILE</p>
            <h2>{selectedCustomer}</h2>
            <p>Payment reliability is based on invoice history, delay patterns, and outstanding exposure.</p>
            <button className="text-button" onClick={() => notify(`Reminder draft created for ${selectedCustomer}.`)}>
              Draft reminder <Arrow />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === "Scenarios") {
    return (
      <div className="workspace-view">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">DECISION LAB</p>
            <h1>Scenario simulator</h1>
            <p>Ask what happens before you commit the cash.</p>
          </div>
        </div>
        <div className="scenario-card">
          <label>
            What amount could be delayed?{" "}
            <input type="number" value={delayAmount} onChange={(e) => setDelayAmount(e.target.value)} />
          </label>
          <label>
            How many days late?{" "}
            <input type="number" value={delayDays} onChange={(e) => setDelayDays(e.target.value)} />
          </label>
          <button
            className="primary-button"
            onClick={() => {
              const projected = Math.max(0, 1120000 - Number(delayAmount));
              setScenarioResult(
                `With ₹${Number(delayAmount).toLocaleString("en-IN")} delayed by ${delayDays} days, projected cash falls to ₹${projected.toLocaleString("en-IN")}.`
              );
            }}
          >
            Run simulation <Arrow />
          </button>
        </div>
        {scenarioResult && (
          <div className="simulation-result">
            <span>SIMULATION RESULT</span>
            <strong>{scenarioResult}</strong>
            <button className="text-button" onClick={() => notify("Scenario saved to your organization.")}>
              Save scenario <Arrow />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === "Documents") {
    return (
      <div className="workspace-view">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">DOCUMENT INTELLIGENCE</p>
            <h1>Documents</h1>
            <p>Upload invoices, statements, and receipts for extraction.</p>
          </div>
          <label className="primary-button upload-button">
            Upload files
            <input type="file" multiple onChange={(e) => setDocuments(Array.from(e.target.files ?? []).map((file) => file.name))} />
          </label>
        </div>
        <div className="document-drop">
          <strong>{documents.length ? `${documents.length} document${documents.length > 1 ? "s" : ""} selected` : "No documents uploaded yet"}</strong>
          <span>PDF, CSV, XLSX, PNG up to 25 MB</span>
          {documents.map((document) => (
            <div className="document-item" key={document}>
              ▤ {document}
              <span>Ready for extraction</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
        <button className="primary-button" onClick={() => { setSaved(true); notify("Settings saved."); }}>
          {saved ? "Saved" : "Save settings"}
        </button>
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
  const [forecastBalance, setForecastBalance] = useState("₹11.2L");
  const [forecastChange, setForecastChange] = useState("₹2.8L");
  const [aiMessage, setAiMessage] = useState("");
  const [toast, setToast] = useState("");
  const [databaseCustomers, setDatabaseCustomers] = useState(sampleCustomers);
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
          const { data: newOrgId } = await supabase.rpc("create_organization_for_user", {
            org_name: user?.user_metadata?.org_name || user?.user_metadata?.workspace_name || "ABC Digital Solutions",
          });
          const fallbackOrg = {
            id: newOrgId || "00000000-0000-0000-0000-000000000001",
            name: user?.user_metadata?.org_name || user?.user_metadata?.workspace_name || "ABC Digital Solutions",
            role: "owner",
          };
          setOrganizations([fallbackOrg]);
          setActiveOrg(fallbackOrg);
        }
      } catch {
        const fallbackOrg = {
          id: "00000000-0000-0000-0000-000000000001",
          name: "ABC Digital Solutions",
          role: "owner",
        };
        setOrganizations([fallbackOrg]);
        setActiveOrg(fallbackOrg);
      }
    }

    loadOrganizations();
  }, [user]);

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/overview`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Overview unavailable"))))
      .then((data) =>
        setDashboardMetrics(
          data.metrics.map((metric: (typeof metrics)[number]) => ({
            ...metric,
            tone: metrics.find((item) => item.label === metric.label)?.tone ?? "mint",
          }))
        )
      )
      .catch(() => undefined);
  }, [apiUrl]);

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/forecast?range=${encodeURIComponent(range)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Forecast unavailable"))))
      .then((data) => {
        setForecastBalance(data.projected_balance);
        setForecastChange(data.change_from_today);
      })
      .catch(() => undefined);
  }, [apiUrl, range]);

  async function askCashPilot() {
    try {
      const response = await fetch(`${apiUrl}/api/v1/ai/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "What should I prioritize today?",
          context: "Cash available ₹8.4L, receivables ₹31.7L, overdue ₹7.9L.",
        }),
      });
      const data = await response.json();
      setAiMessage(data.insight ?? "The AI CFO service recommendation is ready.");
    } catch {
      setAiMessage("Your AI CFO recommends prioritizing ₹7.9L overdue receivables today.");
    }
  }

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
    return <SmartAuthPanel onAuthenticated={setUser} />;
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
          <p className="nav-label">Workspace</p>
          {["Overview", "Cash forecast", "Receivables", "Payables", "Customers"].map((item, index) => (
            <button
              className={`nav-item ${activeNav === item ? "active" : ""}`}
              onClick={() => setActiveNav(item)}
              key={item}
            >
              <span className="nav-icon">{["◒", "⌁", "↗", "↘", "◎"][index]}</span>
              {item}
              {item === "Receivables" && <span className="nav-count">5</span>}
            </button>
          ))}
          <p className="nav-label second">Operations & Security</p>
          {["Scenarios", "Documents", "Audit logs", "Settings"].map((item, index) => (
            <button
              className={`nav-item ${activeNav === item ? "active" : ""}`}
              onClick={() => setActiveNav(item)}
              key={item}
            >
              <span className="nav-icon">{["◇", "▤", "📋", "⚙"][index]}</span>
              {item}
            </button>
          ))}
        </nav>

        <button className="sidebar-bottom" onClick={askCashPilot}>
          <div className="help-mark">?</div>
          <div>
            <strong>Need a hand?</strong>
            <span>Ask your AI CFO</span>
          </div>
          <Arrow />
        </button>
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
            <button className="icon-button" aria-label="Search" onClick={() => notify("Search ready for invoices & customers.")}>
              ⌕
            </button>
            <button className="icon-button notification" aria-label="Notifications" onClick={() => notify("5 overdue invoices need review.")}>
              ♢<i />
            </button>
            <button className="avatar" title="Sign out" onClick={handleSignOut}>
              {user.email?.slice(0, 2).toUpperCase() || "US"}
            </button>
          </div>
        </header>

        {activeNav === "Overview" ? (
          <div className="content-wrap">
            <section className="hero-row">
              <div>
                <p className="eyebrow">
                  WELCOME BACK, {user?.user_metadata?.full_name?.toUpperCase() || user?.email?.split("@")[0].toUpperCase()} <span className="sun">✦</span>
                </p>
                <h1>Your cash, at a glance.</h1>
                <p className="subheading">Here&apos;s what&apos;s happening with your business today.</p>
                {aiMessage && <p className="ai-message">{aiMessage}</p>}
              </div>
              <button className="primary-button" onClick={askCashPilot}>
                Ask CashPilot<span>✦</span>
              </button>
            </section>

            <section className="status-banner">
              <div className="status-symbol">✓</div>
              <div>
                <strong>Cash position is healthy</strong>
                <span>You have enough runway for the next 42 days, but ₹7.9L in overdue invoices needs your attention.</span>
              </div>
              <button className="text-button" onClick={() => setAiMessage("Your runway is healthy because projected inflows exceed committed outflows.")}>
                See why <Arrow />
              </button>
            </section>

            <section className="metric-grid">
              {dashboardMetrics.map((metric) => (
                <article className={`metric-card ${metric.tone}`} key={metric.label}>
                  <div className="metric-top">
                    <span>{metric.label}</span>
                    <span className="metric-arrow">
                      <Arrow />
                    </span>
                  </div>
                  <strong>{metric.value}</strong>
                  <p>{metric.note}</p>
                </article>
              ))}
              <article className="runway-card">
                <div className="runway-copy">
                  <div className="metric-top">
                    <span>Cash runway</span>
                    <span className="runway-badge">Healthy</span>
                  </div>
                  <strong>
                    42 <small>days</small>
                  </strong>
                  <p>+8 days since last month</p>
                </div>
                <div className="ring">
                  <span>42</span>
                </div>
              </article>
            </section>

            <section className="section-heading">
              <div>
                <p className="eyebrow">THE BIG PICTURE</p>
                <h2>Cash forecast</h2>
              </div>
              <div className="range-toggle">
                {["7 days", "30 days", "90 days"].map((item) => (
                  <button className={range === item ? "selected" : ""} onClick={() => setRange(item)} key={item}>
                    {item}
                  </button>
                ))}
              </div>
            </section>

            {/* Interactive Cash Forecast Line Graph */}
            <section className="forecast-panel">
              <div className="forecast-header">
                <div>
                  <span className="forecast-label">PROJECTED BALANCE IN {range.toUpperCase()}</span>
                  <strong>{forecastBalance}</strong>
                  <p>
                    <span className="positive">↑ {forecastChange}</span> from today&apos;s balance
                  </p>
                </div>
                <div className="legend">
                  <span>
                    <i className="dot inflow" />
                    Expected inflow
                  </span>
                  <span>
                    <i className="dot outflow" />
                    Expected outflow
                  </span>
                </div>
              </div>
              <div className="chart">
                <div className="grid-line line-1">
                  <span>₹15L</span>
                </div>
                <div className="grid-line line-2">
                  <span>₹10L</span>
                </div>
                <div className="grid-line line-3">
                  <span>₹5L</span>
                </div>
                <div className="grid-line line-4">
                  <span>₹0</span>
                </div>
                <div className="chart-fill" />
                <div className="chart-line" />
                <div className="chart-point point-1" />
                <div className="chart-point point-2" />
                <div className="chart-point point-3" />
                <div className="chart-point point-4" />
                <div className="chart-point point-5" />
                <div className="chart-point point-6" />
                <div className="today-line">
                  <span>Today</span>
                </div>
                <div className="chart-labels">
                  <span>08 Sep</span>
                  <span>13 Sep</span>
                  <span>18 Sep</span>
                  <span>23 Sep</span>
                  <span>28 Sep</span>
                  <span>08 Oct</span>
                </div>
              </div>
            </section>

            <section className="lower-grid">
              <div className="priorities">
                <div className="section-heading compact">
                  <div>
                    <p className="eyebrow">NOISE DOWN, ACTION UP</p>
                    <h2>Today&apos;s priorities</h2>
                  </div>
                  <button className="text-button" onClick={() => notify("Showing all 12 recommended actions.")}>
                    View all <Arrow />
                  </button>
                </div>
                <div className="action-list">
                  {actions.map((item) => (
                    <div className={`action-row ${item.tone}`} key={item.title}>
                      <span className="action-icon">{item.icon}</span>
                      <div className="action-copy">
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </div>
                      <button className="row-action" onClick={() => notify(`${item.action} opened for ${item.title}.`)}>
                        {item.action} <Arrow />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Risk Donut Chart & Risk Analysis */}
              <div className="risk-panel">
                <div className="section-heading compact">
                  <div>
                    <p className="eyebrow">WATCH CLOSELY</p>
                    <h2>Customer risk</h2>
                  </div>
                  <button className="icon-button" aria-label="Risk options" onClick={() => notify("Risk options opened.")}>
                    ⋯
                  </button>
                </div>
                <div className="concentration">
                  <div className="donut">
                    <span>
                      46%<small>top 3</small>
                    </span>
                  </div>
                  <div>
                    <strong>Concentration risk</strong>
                    <p>Three customers make up 46% of receivables.</p>
                    <button className="text-button" onClick={() => notify("Customer concentration analysis opened.")}>
                      Explore risk <Arrow />
                    </button>
                  </div>
                </div>
                <div className="customer-list">
                  {databaseCustomers.map((customer) => (
                    <div className="customer-row" key={customer.name}>
                      <span className="customer-avatar" style={{ backgroundColor: customer.color }}>
                        {customer.initials}
                      </span>
                      <div className="customer-name">
                        <strong>{customer.name}</strong>
                        <span>{customer.invoice} · {customer.days}</span>
                      </div>
                      <div className="customer-score">
                        <strong>{customer.score}</strong>
                        <span>/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        ) : (
          <WorkspaceView
            view={activeNav}
            notify={notify}
            customers={databaseCustomers}
            organizationId={activeOrg?.id ?? null}
            userRole={userRole}
          />
        )}
        {toast && <div className="toast">{toast}</div>}
      </main>
    </div>
  );
}
