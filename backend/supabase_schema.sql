-- CashPilot Enterprise Multi-Tenant Supabase Schema (Production Edition)
-- Paste this entire file into Supabase SQL Editor and click Run.

create extension if not exists pgcrypto;

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Organizations Table
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text default 'IT Services',
  country text default 'India',
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  company_size text default '25 Employees',
  financial_tool text default 'Excel',
  onboarding_preference text default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Organization Memberships (6 Roles: owner, admin, finance_manager, accountant, collections, viewer)
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'finance_manager', 'accountant', 'collections', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- 4. Organization Team Invitations Table
create table if not exists public.org_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'accountant' check (role in ('admin', 'finance_manager', 'accountant', 'collections', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now()
);

-- 5. Business Data Tables
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  payment_score integer not null default 50 check (payment_score between 0 and 100),
  outstanding_amount numeric(14, 2) not null default 0 check (outstanding_amount >= 0),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete restrict,
  invoice_number text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  issued_date date not null default current_date,
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'open' check (status in ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'open', 'overdue', 'escalated', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete cascade,
  amount numeric(14, 2) not null,
  promised_date date not null,
  status text not null default 'pending' check (status in ('pending', 'kept', 'missed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  supplier_name text,
  amount numeric(14, 2) not null check (amount >= 0),
  expense_date date not null default current_date,
  payment_status text not null default 'paid' check (payment_status in ('paid', 'pending', 'scheduled')),
  is_recurring boolean default false,
  is_unusual boolean default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  credit_days integer default 30,
  payment_reliability_score integer default 85,
  total_spend numeric(14, 2) default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- Security Helper Function for Multi-Tenant RLS
create or replace function public.is_org_member(target_org uuid, required_roles text[] default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org
      and user_id = auth.uid()
      and (required_roles is null or role = any(required_roles))
  );
$$;

-- Create Organization Function
create or replace function public.create_organization_for_user(
  org_name text,
  org_industry text default 'IT Services',
  org_currency text default 'INR',
  org_timezone text default 'Asia/Kolkata'
)
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

  return new_org_id;
end;
$$;

-- Automatic Onboarding Trigger Function
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  user_full_name text;
  org_name text;
begin
  user_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  org_name := coalesce(new.raw_user_meta_data->>'org_name', new.raw_user_meta_data->>'workspace_name', 'ABC Digital Solutions');

  insert into public.profiles (id, full_name)
  values (new.id, user_full_name)
  on conflict (id) do update set updated_at = now();

  insert into public.organizations (name, industry, currency, timezone)
  values (
    org_name,
    coalesce(new.raw_user_meta_data->>'industry', 'IT Services'),
    coalesce(new.raw_user_meta_data->>'currency', 'INR'),
    coalesce(new.raw_user_meta_data->>'timezone', 'Asia/Kolkata')
  )
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS across all tables
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.org_invitations enable row level security;
alter table public.customers enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_promises enable row level security;
alter table public.expenses enable row level security;
alter table public.suppliers enable row level security;
alter table public.audit_logs enable row level security;

-- Policies
drop policy if exists profiles_user_policy on public.profiles;
create policy profiles_user_policy on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists org_select_policy on public.organizations;
create policy org_select_policy on public.organizations for select to authenticated using (public.is_org_member(id));

drop policy if exists org_members_select_policy on public.organization_members;
create policy org_members_select_policy on public.organization_members for select to authenticated using (user_id = auth.uid() or public.is_org_member(organization_id, array['owner', 'admin']));

drop policy if exists customers_org_policy on public.customers;
create policy customers_org_policy on public.customers for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'accountant', 'collections']));

drop policy if exists invoices_org_policy on public.invoices;
create policy invoices_org_policy on public.invoices for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'accountant', 'collections']));

drop policy if exists promises_org_policy on public.payment_promises;
create policy promises_org_policy on public.payment_promises for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'collections']));

drop policy if exists expenses_org_policy on public.expenses;
create policy expenses_org_policy on public.expenses for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'accountant']));

drop policy if exists suppliers_org_policy on public.suppliers;
create policy suppliers_org_policy on public.suppliers for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager', 'accountant']));

drop policy if exists audit_logs_org_policy on public.audit_logs;
create policy audit_logs_org_policy on public.audit_logs for select to authenticated using (public.is_org_member(organization_id, array['owner', 'admin', 'finance_manager']));

-- Grants
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.create_organization_for_user(text, text, text, text) to authenticated;
