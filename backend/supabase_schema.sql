-- CashPilot Enterprise Multi-Tenant Supabase Schema
-- Paste this entire file into Supabase SQL Editor and click Run.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

-- 1. Profiles Table (Application-level user profiles)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Organizations Table (Company / Tenant level)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text default 'IT Services',
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Organization Memberships & Roles
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'finance_manager', 'accountant', 'collections', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- 4. Business Data Tables (Multi-tenant with organization_id)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  payment_score integer not null default 50 check (payment_score between 0 and 100),
  outstanding_amount numeric(14, 2) not null default 0 check (outstanding_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_number text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  issued_date date not null default current_date,
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'open' check (status in ('open', 'overdue', 'paid', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists public.payables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_name text not null,
  supplier_email text,
  amount numeric(14, 2) not null check (amount >= 0),
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'open' check (status in ('open', 'scheduled', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  amount numeric(14, 2) not null,
  movement_type text not null check (movement_type in ('inflow', 'outflow')),
  expected_date date not null,
  confidence integer not null default 50 check (confidence between 0 and 100),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  file_name text not null,
  storage_path text,
  document_type text not null default 'other' check (document_type in ('invoice', 'receipt', 'bank_statement', 'contract', 'other')),
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'processing', 'complete', 'failed')),
  extracted_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  delayed_amount numeric(14, 2) not null default 0,
  delayed_days integer not null default 0,
  projected_balance numeric(14, 2),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'in_app')),
  recipient text not null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. Audit Logs Table (For tracking mutations & compliance)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- Backward compatibility aliases for legacy tables if existing:
create table if not exists public.cashpilot_workspaces (id uuid primary key default gen_random_uuid(), name text not null, currency text not null default 'INR', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.cashpilot_workspace_members (workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null default 'member', created_at timestamptz not null default now(), primary key (workspace_id, user_id));
create table if not exists public.cashpilot_customers (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade, name text not null, email text, phone text, payment_score integer not null default 50, outstanding_amount numeric(14,2) not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.cashpilot_invoices (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade, customer_id uuid references public.cashpilot_customers(id), invoice_number text not null, amount numeric(14,2) not null, issued_date date not null default current_date, due_date date not null, paid_at timestamptz, status text not null default 'open', notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

-- Indexes for maximum query performance across organizations
create index if not exists org_members_user_idx on public.organization_members(user_id);
create index if not exists org_members_org_idx on public.organization_members(organization_id);
create index if not exists customers_org_idx on public.customers(organization_id);
create index if not exists invoices_org_status_idx on public.invoices(organization_id, status);
create index if not exists payables_org_status_idx on public.payables(organization_id, status);
create index if not exists audit_logs_org_idx on public.audit_logs(organization_id, created_at desc);

-- Helper Function for RLS Authorization
create or replace function public.is_org_member(target_org uuid, required_roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and (required_roles is null or role = any(required_roles))
  );
$$;

-- Function to create organization & member
create or replace function public.create_organization_for_user(org_name text, org_industry text default 'IT Services', org_currency text default 'INR', org_timezone text default 'Asia/Kolkata')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name, industry, currency, timezone)
  values (org_name, org_industry, org_currency, org_timezone)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');

  -- Also populate legacy workspace for backward compatibility:
  insert into public.cashpilot_workspaces (id, name, currency) values (new_org_id, org_name, org_currency) on conflict (id) do nothing;
  insert into public.cashpilot_workspace_members (workspace_id, user_id, role) values (new_org_id, auth.uid(), 'owner') on conflict do nothing;

  return new_org_id;
end;
$$;

-- Trigger Function for Automatic User Onboarding
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  user_full_name text;
  org_name text;
begin
  user_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  org_name := coalesce(new.raw_user_meta_data->>'workspace_name', new.raw_user_meta_data->>'org_name', 'My CashPilot Business');

  insert into public.profiles (id, full_name)
  values (new.id, user_full_name)
  on conflict (id) do update set updated_at = now();

  insert into public.organizations (name, industry, currency)
  values (org_name, coalesce(new.raw_user_meta_data->>'industry', 'IT Services'), coalesce(new.raw_user_meta_data->>'currency', 'INR'))
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner')
  on conflict do nothing;

  -- Also populate legacy workspace
  insert into public.cashpilot_workspaces (id, name, currency) values (new_org_id, org_name, 'INR') on conflict (id) do nothing;
  insert into public.cashpilot_workspace_members (workspace_id, user_id, role) values (new_org_id, new.id, 'owner') on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable Row Level Security (RLS) across all tables
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.payables enable row level security;
alter table public.cash_movements enable row level security;
alter table public.documents enable row level security;
alter table public.scenarios enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.cashpilot_workspaces enable row level security;
alter table public.cashpilot_workspace_members enable row level security;
alter table public.cashpilot_customers enable row level security;
alter table public.cashpilot_invoices enable row level security;

-- Define RLS Policies for Organizations & Security Walls
drop policy if exists profiles_user_policy on public.profiles;
create policy profiles_user_policy on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists org_select_policy on public.organizations;
create policy org_select_policy on public.organizations for select to authenticated using (public.is_org_member(id));
drop policy if exists org_update_policy on public.organizations;
create policy org_update_policy on public.organizations for update to authenticated using (public.is_org_member(id, array['owner', 'admin'])) with check (public.is_org_member(id, array['owner', 'admin']));

drop policy if exists org_members_select_policy on public.organization_members;
create policy org_members_select_policy on public.organization_members for select to authenticated using (user_id = auth.uid() or public.is_org_member(organization_id, array['owner', 'admin']));
drop policy if exists org_members_insert_policy on public.organization_members;
create policy org_members_insert_policy on public.organization_members for insert to authenticated with check (public.is_org_member(organization_id, array['owner', 'admin']));
drop policy if exists org_members_delete_policy on public.organization_members;
create policy org_members_delete_policy on public.organization_members for delete to authenticated using (public.is_org_member(organization_id, array['owner']));

-- Multi-Tenant Data Policies
drop policy if exists customers_org_policy on public.customers;
create policy customers_org_policy on public.customers for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'accountant', 'collections']));

drop policy if exists invoices_org_policy on public.invoices;
create policy invoices_org_policy on public.invoices for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'accountant', 'collections']));

drop policy if exists payables_org_policy on public.payables;
create policy payables_org_policy on public.payables for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'accountant']));

drop policy if exists movements_org_policy on public.cash_movements;
create policy movements_org_policy on public.cash_movements for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'accountant']));

drop policy if exists documents_org_policy on public.documents;
create policy documents_org_policy on public.documents for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists scenarios_org_policy on public.scenarios;
create policy scenarios_org_policy on public.scenarios for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists notifications_org_policy on public.notifications;
create policy notifications_org_policy on public.notifications for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy if exists audit_logs_org_policy on public.audit_logs;
create policy audit_logs_org_policy on public.audit_logs for select to authenticated using (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager']));

-- Legacy table RLS fallback policies
drop policy if exists legacy_ws_select on public.cashpilot_workspaces;
create policy legacy_ws_select on public.cashpilot_workspaces for select to authenticated using (exists (select 1 from public.cashpilot_workspace_members where workspace_id = id and user_id = auth.uid()));
drop policy if exists legacy_ws_members_select on public.cashpilot_workspace_members;
create policy legacy_ws_members_select on public.cashpilot_workspace_members for select to authenticated using (user_id = auth.uid());
drop policy if exists legacy_customers_all on public.cashpilot_customers;
create policy legacy_customers_all on public.cashpilot_customers for all to authenticated using (exists (select 1 from public.cashpilot_workspace_members where workspace_id = cashpilot_customers.workspace_id and user_id = auth.uid()));
drop policy if exists legacy_invoices_all on public.cashpilot_invoices;
create policy legacy_invoices_all on public.cashpilot_invoices for all to authenticated using (exists (select 1 from public.cashpilot_workspace_members where workspace_id = cashpilot_invoices.workspace_id and user_id = auth.uid()));

-- Grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.create_organization_for_user(text, text, text, text) to authenticated;
