"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

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

const customers = [
  { initials: "AC", name: "Acme Cloudworks", invoice: "INV-2841", days: "14 days overdue", score: 92, color: "#1c8b69" },
  { initials: "NS", name: "Northstar Studio", invoice: "INV-2835", days: "9 days overdue", score: 61, color: "#db7438" },
  { initials: "PB", name: "Pixel & Beam", invoice: "INV-2818", days: "Due in 2 days", score: 38, color: "#cc5d5d" },
];

function Arrow() { return <span aria-hidden="true">↗</span>; }

function AuthPanel({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Acme Studio");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setMessage("Supabase environment variables are missing."); return; }
    setBusy(true);
    setMessage("");

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      });
      if (error) setMessage(error.message);
      else setMessage("Password reset email sent! Check your inbox.");
      setBusy(false);
      return;
    }

    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || splitEmail(email),
              workspace_name: workspaceName || "My CashPilot Workspace",
            },
          },
        });

    if (result.error) {
      setMessage(result.error.message);
    } else if (result.data.user) {
      // Sync profile table in database if user signed in
      await supabase.from("cashpilot_profiles").upsert({
        id: result.data.user.id,
        email: result.data.user.email ?? email,
        full_name: fullName || result.data.user.user_metadata?.full_name || splitEmail(email),
        updated_at: new Date().toISOString(),
      });
      onAuthenticated(result.data.user);
    } else {
      setMessage("Account created! Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  function splitEmail(val: string) {
    return val.split("@")[0] || "User";
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
            : mode === "signup"
            ? "Start your cash command center."
            : "Reset your password."}
        </h1>
        <p className="auth-subtitle">
          {mode === "forgot"
            ? "Enter your email address and we'll send you a password reset link."
            : "Sign in to securely access your workspace data."}
        </p>
        <form onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
                placeholder="Rahul Sharma"
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
                placeholder="At least 6 characters"
              />
            </label>
          )}
          {mode === "signup" && (
            <label>
              Workspace name
              <input
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
                placeholder="Acme Studio"
              />
            </label>
          )}
          <button className="primary-button auth-submit" disabled={busy}>
            {busy
              ? "Connecting..."
              : mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Create account & workspace"
              : "Send reset email"}
            <Arrow />
          </button>
        </form>

        {message && <p className="auth-message">{message}</p>}

        <div className="auth-footer-links">
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
                New to CashPilot? Create an account
              </button>
              <button
                type="button"
                className="auth-switch text-subtle"
                onClick={() => {
                  setMode("forgot");
                  setMessage("");
                }}
              >
                Forgot your password?
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

function WorkspaceView({ view, notify, customers: databaseCustomers, workspaceId }: { view: string; notify: (message: string) => void; customers: typeof customers; workspaceId: string | null }) {
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

  useEffect(() => {
    if (!supabase || !workspaceId || view !== "Receivables") return;
    supabase.from("cashpilot_invoices").select("invoice_number, amount, due_date, status").eq("workspace_id", workspaceId).order("due_date")
      .then(({ data, error }) => {
        if (error) { console.error(error); return; }
        if (data?.length) setInvoices(data.map((invoice) => ({ id: invoice.invoice_number, customer: "Customer account", amount: `₹${Number(invoice.amount).toLocaleString("en-IN")}`, due: invoice.due_date, status: invoice.status === "paid" ? "Paid" : invoice.status === "overdue" ? "Overdue" : "Due soon" })));
      });
  }, [view, workspaceId]);

  async function updateInvoice(invoiceNumber: string, status: string) {
    if (supabase && workspaceId) {
      const { error } = await supabase.from("cashpilot_invoices").update({ status, paid_at: status === "paid" ? new Date().toISOString() : null }).eq("workspace_id", workspaceId).eq("invoice_number", invoiceNumber);
      if (error) { notify(error.message); return; }
    }
    setInvoices((items) => items.map((item) => item.id === invoiceNumber ? { ...item, status: status === "paid" ? "Paid" : "Reminder queued" } : item));
    notify(status === "paid" ? `${invoiceNumber} marked as paid.` : "Reminders queued for overdue invoices.");
  }

  if (view === "Cash forecast") return <div className="workspace-view"><div className="workspace-heading"><div><p className="eyebrow">PLANNING TOOL</p><h1>Cash forecast</h1><p>Model inflows, outflows, and runway before they happen.</p></div><button className="primary-button" onClick={() => notify("Forecast exported as a report.")}>Export report <Arrow /></button></div><div className="workflow-card"><div className="workflow-stat"><span>Projected balance in 30 days</span><strong>₹11.2L</strong><small>82% confidence</small></div><div className="workflow-stat"><span>Lowest projected balance</span><strong>₹8.1L</strong><small>18 September 2026</small></div><div className="workflow-stat"><span>Runway</span><strong>42 days</strong><small>Healthy position</small></div></div><div className="table-card"><div className="table-header"><h2>Upcoming cash movements</h2><button className="text-button" onClick={() => notify("Cash movement import opened.")}>Import CSV <Arrow /></button></div>{["Customer payments · ₹6.8L", "Payroll · -₹4.2L", "Supplier payments · -₹1.6L", "Rent and tax · -₹85K"].map((item) => <div className="table-row" key={item}><span>{item}</span><span className={item.includes("-") ? "negative" : "positive"}>{item.includes("-") ? "Outflow" : "Inflow"}</span></div>)}</div></div>;

  if (view === "Receivables") return <div className="workspace-view"><div className="workspace-heading"><div><p className="eyebrow">MONEY OWED TO YOU</p><h1>Receivables</h1><p>Track invoices and take the next collection action.</p></div><button className="primary-button" onClick={() => notify("Create invoices in Supabase, then refresh this workspace.")}>New invoice <span>+</span></button></div><div className="workflow-card"><div className="workflow-stat"><span>Total outstanding</span><strong>₹31.7L</strong><small>18 open invoices</small></div><div className="workflow-stat"><span>Overdue</span><strong className="negative">₹7.9L</strong><small>5 invoices need action</small></div><div className="workflow-stat"><span>Collected this month</span><strong className="positive">₹18.4L</strong><small>+12.8% vs last month</small></div></div><div className="table-card"><div className="table-header"><h2>Invoice queue</h2><button className="text-button" onClick={() => { invoices.filter((item) => item.status === "Overdue").forEach((item) => updateInvoice(item.id, "overdue")); }}>Queue reminders <Arrow /></button></div>{invoices.map((invoice) => <div className="table-row invoice-row" key={invoice.id}><div><strong>{invoice.id}</strong><span>{invoice.customer} · {invoice.due}</span></div><strong>{invoice.amount}</strong><span className={invoice.status === "Overdue" ? "status-bad" : "status-good"}>{invoice.status}</span><button className="row-action" disabled={invoice.status === "Paid"} onClick={() => updateInvoice(invoice.id, "paid")}>{invoice.status === "Paid" ? "Paid" : "Mark paid"} <Arrow /></button></div>)}</div></div>;

  if (view === "Payables") return <div className="workspace-view"><div className="workspace-heading"><div><p className="eyebrow">MONEY YOU OWE</p><h1>Payables</h1><p>Protect cash without missing critical supplier obligations.</p></div><button className="primary-button" onClick={() => notify("New bill form opened.")}>Add bill <span>+</span></button></div><div className="workflow-card"><div className="workflow-stat"><span>Due this week</span><strong>₹4.1L</strong><small>7 supplier bills</small></div><div className="workflow-stat"><span>Due this month</span><strong>₹12.3L</strong><small>23 open bills</small></div><div className="workflow-stat"><span>Potentially deferrable</span><strong className="positive">₹75K</strong><small>Low supplier risk</small></div></div><div className="table-card"><div className="table-header"><h2>Supplier payment queue</h2><button className="text-button" onClick={() => notify("Payment batch prepared for review.")}>Prepare batch <Arrow /></button></div>{["CloudHost India · ₹42,000 · Due today", "DesignStack · ₹75,000 · Due in 6 days", "Office lease · ₹1,18,000 · Due in 10 days"].map((bill) => <div className="table-row" key={bill}><span>{bill}</span><button className="row-action" onClick={() => { setScheduled((items) => [...items, bill]); notify("Payment scheduled for approval."); }}>{scheduled.includes(bill) ? "Scheduled" : "Schedule"} <Arrow /></button></div>)}</div></div>;

  if (view === "Customers") return <div className="workspace-view"><div className="workspace-heading"><div><p className="eyebrow">RELATIONSHIP INTELLIGENCE</p><h1>Customers</h1><p>See who pays reliably and where your cash is exposed.</p></div><button className="primary-button" onClick={() => notify("Customer import opened.")}>Import customers <span>+</span></button></div><div className="customer-grid">{databaseCustomers.map((customer) => <button className={`customer-card ${selectedCustomer === customer.name ? "selected" : ""}`} onClick={() => setSelectedCustomer(customer.name)} key={customer.name}><span className="customer-avatar" style={{ backgroundColor: customer.color }}>{customer.initials}</span><strong>{customer.name}</strong><span>{customer.invoice} · {customer.days}</span><b>{customer.score}<small>/100 reliability</small></b>{selectedCustomer === customer.name && <em>Selected for review</em>}</button>)}</div>{selectedCustomer && <div className="detail-card"><p className="eyebrow">CUSTOMER PROFILE</p><h2>{selectedCustomer}</h2><p>Payment reliability is based on invoice history, delay patterns, and outstanding exposure.</p><button className="text-button" onClick={() => notify(`Reminder draft created for ${selectedCustomer}.`)}>Draft reminder <Arrow /></button></div>}</div>;

  if (view === "Scenarios") return <div className="workspace-view"><div className="workspace-heading"><div><p className="eyebrow">DECISION LAB</p><h1>Scenario simulator</h1><p>Ask what happens before you commit the cash.</p></div></div><div className="scenario-card"><label>What amount could be delayed? <input type="number" value={delayAmount} onChange={(event) => setDelayAmount(event.target.value)} /></label><label>How many days late? <input type="number" value={delayDays} onChange={(event) => setDelayDays(event.target.value)} /></label><button className="primary-button" onClick={() => { const projected = Math.max(0, 1120000 - Number(delayAmount)); setScenarioResult(`With ₹${Number(delayAmount).toLocaleString("en-IN")} delayed by ${delayDays} days, projected cash falls to ₹${projected.toLocaleString("en-IN")}.`); }}>Run simulation <Arrow /></button></div>{scenarioResult && <div className="simulation-result"><span>SIMULATION RESULT</span><strong>{scenarioResult}</strong><button className="text-button" onClick={() => notify("Scenario saved to your workspace.")}>Save scenario <Arrow /></button></div>}</div>;

  if (view === "Documents") return <div className="workspace-view"><div className="workspace-heading"><div><p className="eyebrow">DOCUMENT INTELLIGENCE</p><h1>Documents</h1><p>Upload invoices, statements, and receipts for extraction.</p></div><label className="primary-button upload-button">Upload files<input type="file" multiple onChange={(event) => setDocuments(Array.from(event.target.files ?? []).map((file) => file.name))} /></label></div><div className="document-drop"><strong>{documents.length ? `${documents.length} document${documents.length > 1 ? "s" : ""} selected` : "No documents uploaded yet"}</strong><span>PDF, CSV, XLSX, PNG up to 25 MB</span>{documents.map((document) => <div className="document-item" key={document}>▤ {document}<span>Ready for extraction</span></div>)}</div></div>;

  return <div className="workspace-view"><div className="workspace-heading"><div><p className="eyebrow">WORKSPACE PREFERENCES</p><h1>Settings</h1><p>Control how CashPilot communicates and evaluates cash risk.</p></div></div><div className="settings-card"><label>Business name<input defaultValue="Acme Studio" /></label><label>Owner email<input defaultValue="rahul@acmestudio.in" type="email" /></label><label className="toggle-row"><span>Send collection reminders for approval</span><input type="checkbox" defaultChecked /></label><label className="toggle-row"><span>Include AI explanations in daily digest</span><input type="checkbox" defaultChecked /></label><button className="primary-button" onClick={() => { setSaved(true); notify("Settings saved locally."); }}>{saved ? "Saved" : "Save settings"}</button></div></div>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [range, setRange] = useState("30 days");
  const [activeNav, setActiveNav] = useState("Overview");
  const [dashboardMetrics, setDashboardMetrics] = useState(metrics);
  const [forecastBalance, setForecastBalance] = useState("₹11.2L");
  const [forecastChange, setForecastChange] = useState("₹2.8L");
  const [aiMessage, setAiMessage] = useState("");
  const [toast, setToast] = useState("");
  const [databaseCustomers, setDatabaseCustomers] = useState(customers);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthReady(true); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    async function loadWorkspace() {
      let { data: membership } = await supabase!.from("cashpilot_workspace_members").select("workspace_id").eq("user_id", user!.id).limit(1).maybeSingle();
      if (!membership) {
        const created = await supabase!.rpc("create_workspace_for_current_user", { workspace_name: user!.user_metadata?.workspace_name ?? "My CashPilot Workspace" });
        if (created.error) { notify(created.error.message); return; }
        membership = { workspace_id: created.data };
      }
      setWorkspaceId(membership.workspace_id);
      const { data } = await supabase!.from("cashpilot_customers").select("name,email,payment_score,outstanding_amount").eq("workspace_id", membership.workspace_id).order("created_at");
      if (data?.length) setDatabaseCustomers(data.map((customer) => ({ initials: customer.name.slice(0, 2).toUpperCase(), name: customer.name, invoice: "Customer account", days: `₹${Number(customer.outstanding_amount).toLocaleString("en-IN")} outstanding`, score: customer.payment_score, color: customer.payment_score > 75 ? "#1c8b69" : customer.payment_score > 50 ? "#db7438" : "#cc5d5d" })));
    }
    loadWorkspace();
  }, [user]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function selectNav(item: string) {
    setActiveNav(item);
    notify(`${item} view selected. This workspace is ready for the next workflow.`);
  }

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/overview`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Overview unavailable")))
      .then((data) => setDashboardMetrics(data.metrics.map((metric: (typeof metrics)[number]) => ({ ...metric, tone: metrics.find((item) => item.label === metric.label)?.tone ?? "mint" }))))
      .catch(() => undefined);
  }, [apiUrl]);

  useEffect(() => {
    fetch(`${apiUrl}/api/v1/forecast?range=${encodeURIComponent(range)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Forecast unavailable")))
      .then((data) => { setForecastBalance(data.projected_balance); setForecastChange(data.change_from_today); })
      .catch(() => undefined);
  }, [apiUrl, range]);

  async function askCashPilot() {
    try {
      const response = await fetch(`${apiUrl}/api/v1/ai/insight`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "What should I prioritize today?", context: "Cash available ₹8.4L, receivables ₹31.7L, overdue ₹7.9L." }) });
      const data = await response.json();
      setAiMessage(data.insight ?? "The AI service did not return a recommendation.");
    } catch {
      setAiMessage("Connect the API to ask your AI CFO for a live recommendation.");
    }
  }

  if (!authReady) return <main className="auth-shell"><div className="auth-card"><h1>Connecting to CashPilot...</h1></div></main>;
  if (!user) return <AuthPanel onAuthenticated={setUser} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">+</span><span>cashpilot</span></div>
        <div className="workspace-switcher"><span className="workspace-dot" /> Acme Studio <span className="chevron">⌄</span></div>
        <nav className="nav-list" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {["Overview", "Cash forecast", "Receivables", "Payables", "Customers"].map((item, index) => (
            <button className={`nav-item ${activeNav === item ? "active" : ""}`} onClick={() => selectNav(item)} key={item}><span className="nav-icon">{["◒", "⌁", "↗", "↘", "◎"][index]}</span>{item}{item === "Receivables" && <span className="nav-count">5</span>}</button>
          ))}
          <p className="nav-label second">Operations</p>
          {["Scenarios", "Documents", "Settings"].map((item, index) => <button className={`nav-item ${activeNav === item ? "active" : ""}`} onClick={() => selectNav(item)} key={item}><span className="nav-icon">{["◇", "▤", "⚙"][index]}</span>{item}</button>)}
        </nav>
        <button className="sidebar-bottom" onClick={askCashPilot}><div className="help-mark">?</div><div><strong>Need a hand?</strong><span>Ask your AI CFO</span></div><Arrow /></button>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>Monday, 08 September 2026</span><span className="slash">/</span><strong>{activeNav}</strong></div><div className="top-actions"><span className="signed-in">{user.email}</span><button className="icon-button" aria-label="Search" onClick={() => notify("Search is ready for invoices, customers, and payments.")}>⌕</button><button className="icon-button notification" aria-label="Notifications" onClick={() => notify("You have 5 overdue invoices to review.")}>♢<i /></button><button className="avatar" aria-label="Sign out" onClick={() => supabase?.auth.signOut()}>RK</button></div></header>
        {activeNav === "Overview" ? <div className="content-wrap">
          <section className="hero-row"><div><p className="eyebrow">GOOD MORNING, RAHUL <span className="sun">✦</span></p><h1>Your cash, at a glance.</h1><p className="subheading">Here&apos;s what&apos;s happening with your business today.</p>{aiMessage && <p className="ai-message">{aiMessage}</p>}</div><button className="primary-button" onClick={askCashPilot}>Ask CashPilot<span>✦</span></button></section>

          <section className="status-banner"><div className="status-symbol">✓</div><div><strong>Cash position is healthy</strong><span>You have enough runway for the next 42 days, but ₹7.9L in overdue invoices needs your attention.</span></div><button className="text-button" onClick={() => setAiMessage("Your runway is healthy because projected inflows exceed committed outflows. The main risk is ₹7.9L in overdue receivables.")}>See why <Arrow /></button></section>

          <section className="metric-grid">{dashboardMetrics.map((metric) => <article className={`metric-card ${metric.tone}`} key={metric.label}><div className="metric-top"><span>{metric.label}</span><span className="metric-arrow"><Arrow /></span></div><strong>{metric.value}</strong><p>{metric.note}</p></article>)}<article className="runway-card"><div className="runway-copy"><div className="metric-top"><span>Cash runway</span><span className="runway-badge">Healthy</span></div><strong>42 <small>days</small></strong><p>+8 days since last month</p></div><div className="ring"><span>42</span></div></article></section>

          <section className="section-heading"><div><p className="eyebrow">THE BIG PICTURE</p><h2>Cash forecast</h2></div><div className="range-toggle">{["7 days", "30 days", "90 days"].map((item) => <button className={range === item ? "selected" : ""} onClick={() => setRange(item)} key={item}>{item}</button>)}</div></section>
          <section className="forecast-panel"><div className="forecast-header"><div><span className="forecast-label">PROJECTED BALANCE IN {range.toUpperCase()}</span><strong>{forecastBalance}</strong><p><span className="positive">↑ {forecastChange}</span> from today&apos;s balance</p></div><div className="legend"><span><i className="dot inflow" />Expected inflow</span><span><i className="dot outflow" />Expected outflow</span></div></div><div className="chart"><div className="grid-line line-1"><span>₹15L</span></div><div className="grid-line line-2"><span>₹10L</span></div><div className="grid-line line-3"><span>₹5L</span></div><div className="grid-line line-4"><span>₹0</span></div><div className="chart-fill" /><div className="chart-line" /><div className="chart-point point-1" /><div className="chart-point point-2" /><div className="chart-point point-3" /><div className="chart-point point-4" /><div className="chart-point point-5" /><div className="chart-point point-6" /><div className="today-line"><span>Today</span></div><div className="chart-labels"><span>08 Sep</span><span>13 Sep</span><span>18 Sep</span><span>23 Sep</span><span>28 Sep</span><span>08 Oct</span></div></div></section>

          <section className="lower-grid"><div className="priorities"><div className="section-heading compact"><div><p className="eyebrow">NOISE DOWN, ACTION UP</p><h2>Today&apos;s priorities</h2></div><button className="text-button" onClick={() => notify("Showing all 12 recommended actions.")}>View all <Arrow /></button></div><div className="action-list">{actions.map((item) => <div className={`action-row ${item.tone}`} key={item.title}><span className="action-icon">{item.icon}</span><div className="action-copy"><strong>{item.title}</strong><span>{item.detail}</span></div><button className="row-action" onClick={() => notify(`${item.action} opened for ${item.title}.`)}>{item.action} <Arrow /></button></div>)}</div></div><div className="risk-panel"><div className="section-heading compact"><div><p className="eyebrow">WATCH CLOSELY</p><h2>Customer risk</h2></div><button className="icon-button" aria-label="Risk options" onClick={() => notify("Risk options opened.")}>⋯</button></div><div className="concentration"><div className="donut"><span>46%<small>top 3</small></span></div><div><strong>Concentration risk</strong><p>Three customers make up 46% of receivables.</p><button className="text-button" onClick={() => notify("Customer concentration analysis opened.")}>Explore risk <Arrow /></button></div></div><div className="customer-list">{customers.map((customer) => <div className="customer-row" key={customer.name}><span className="customer-avatar" style={{ backgroundColor: customer.color }}>{customer.initials}</span><div className="customer-name"><strong>{customer.name}</strong><span>{customer.invoice} · {customer.days}</span></div><div className="customer-score"><strong>{customer.score}</strong><span>/100</span></div></div>)}</div></div></section>
        </div> : <WorkspaceView view={activeNav} notify={notify} customers={databaseCustomers} workspaceId={workspaceId} />}
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    </div>
  );
}
