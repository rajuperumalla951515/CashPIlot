-- CashPilot Supabase schema
-- Paste this entire file into Supabase SQL Editor and click Run.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.cashpilot_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cashpilot_workspace_members (
  workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.cashpilot_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  payment_score integer not null default 50 check (payment_score between 0 and 100),
  outstanding_amount numeric(14, 2) not null default 0 check (outstanding_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cashpilot_invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade,
  customer_id uuid not null references public.cashpilot_customers(id) on delete restrict,
  invoice_number text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  issued_date date not null default current_date,
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'open' check (status in ('open', 'overdue', 'paid', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, invoice_number)
);

create table if not exists public.cashpilot_payables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade,
  supplier_name text not null,
  supplier_email text,
  amount numeric(14, 2) not null check (amount >= 0),
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'open' check (status in ('open', 'scheduled', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cashpilot_cash_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade,
  label text not null,
  amount numeric(14, 2) not null,
  movement_type text not null check (movement_type in ('inflow', 'outflow')),
  expected_date date not null,
  confidence integer not null default 50 check (confidence between 0 and 100),
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.cashpilot_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade,
  file_name text not null,
  storage_path text,
  document_type text not null default 'other' check (document_type in ('invoice', 'receipt', 'bank_statement', 'contract', 'other')),
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'processing', 'complete', 'failed')),
  extracted_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cashpilot_scenarios (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade,
  name text not null,
  delayed_amount numeric(14, 2) not null default 0,
  delayed_days integer not null default 0,
  projected_balance numeric(14, 2),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cashpilot_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cashpilot_workspaces(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'in_app')),
  recipient text not null,
  subject text,
  body text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cashpilot_customers_workspace_idx on public.cashpilot_customers(workspace_id);
create index if not exists cashpilot_invoices_workspace_status_idx on public.cashpilot_invoices(workspace_id, status);
create index if not exists cashpilot_invoices_due_date_idx on public.cashpilot_invoices(workspace_id, due_date);
create index if not exists cashpilot_payables_workspace_status_idx on public.cashpilot_payables(workspace_id, status);
create index if not exists cashpilot_movements_date_idx on public.cashpilot_cash_movements(workspace_id, expected_date);

create or replace function public.cashpilot_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cashpilot_workspaces_updated_at on public.cashpilot_workspaces;
create trigger cashpilot_workspaces_updated_at before update on public.cashpilot_workspaces for each row execute function public.cashpilot_touch_updated_at();
drop trigger if exists cashpilot_customers_updated_at on public.cashpilot_customers;
create trigger cashpilot_customers_updated_at before update on public.cashpilot_customers for each row execute function public.cashpilot_touch_updated_at();
drop trigger if exists cashpilot_invoices_updated_at on public.cashpilot_invoices;
create trigger cashpilot_invoices_updated_at before update on public.cashpilot_invoices for each row execute function public.cashpilot_touch_updated_at();
drop trigger if exists cashpilot_payables_updated_at on public.cashpilot_payables;
create trigger cashpilot_payables_updated_at before update on public.cashpilot_payables for each row execute function public.cashpilot_touch_updated_at();

create or replace function public.cashpilot_is_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cashpilot_workspace_members
    where workspace_id = target_workspace and user_id = auth.uid()
  );
$$;

create or replace function public.create_workspace_for_current_user(workspace_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be authenticated'; end if;
  insert into public.cashpilot_workspaces (name) values (workspace_name) returning id into new_workspace_id;
  insert into public.cashpilot_workspace_members (workspace_id, user_id, role) values (new_workspace_id, auth.uid(), 'owner');
  return new_workspace_id;
end;
$$;

alter table public.cashpilot_workspaces enable row level security;
alter table public.cashpilot_workspace_members enable row level security;
alter table public.cashpilot_customers enable row level security;
alter table public.cashpilot_invoices enable row level security;
alter table public.cashpilot_payables enable row level security;
alter table public.cashpilot_cash_movements enable row level security;
alter table public.cashpilot_documents enable row level security;
alter table public.cashpilot_scenarios enable row level security;
alter table public.cashpilot_notifications enable row level security;

drop policy if exists workspace_members_can_read_workspace on public.cashpilot_workspaces;
create policy workspace_members_can_read_workspace on public.cashpilot_workspaces for select to authenticated using (public.cashpilot_is_member(id));
drop policy if exists users_can_read_own_memberships on public.cashpilot_workspace_members;
create policy users_can_read_own_memberships on public.cashpilot_workspace_members for select to authenticated using (user_id = auth.uid());

drop policy if exists workspace_members_manage_customers on public.cashpilot_customers;
create policy workspace_members_manage_customers on public.cashpilot_customers for all to authenticated using (public.cashpilot_is_member(workspace_id)) with check (public.cashpilot_is_member(workspace_id));
drop policy if exists workspace_members_manage_invoices on public.cashpilot_invoices;
create policy workspace_members_manage_invoices on public.cashpilot_invoices for all to authenticated using (public.cashpilot_is_member(workspace_id)) with check (public.cashpilot_is_member(workspace_id));
drop policy if exists workspace_members_manage_payables on public.cashpilot_payables;
create policy workspace_members_manage_payables on public.cashpilot_payables for all to authenticated using (public.cashpilot_is_member(workspace_id)) with check (public.cashpilot_is_member(workspace_id));
drop policy if exists workspace_members_manage_movements on public.cashpilot_cash_movements;
create policy workspace_members_manage_movements on public.cashpilot_cash_movements for all to authenticated using (public.cashpilot_is_member(workspace_id)) with check (public.cashpilot_is_member(workspace_id));
drop policy if exists workspace_members_manage_documents on public.cashpilot_documents;
create policy workspace_members_manage_documents on public.cashpilot_documents for all to authenticated using (public.cashpilot_is_member(workspace_id)) with check (public.cashpilot_is_member(workspace_id));
drop policy if exists workspace_members_manage_scenarios on public.cashpilot_scenarios;
create policy workspace_members_manage_scenarios on public.cashpilot_scenarios for all to authenticated using (public.cashpilot_is_member(workspace_id)) with check (public.cashpilot_is_member(workspace_id));
drop policy if exists workspace_members_manage_notifications on public.cashpilot_notifications;
create policy workspace_members_manage_notifications on public.cashpilot_notifications for all to authenticated using (public.cashpilot_is_member(workspace_id)) with check (public.cashpilot_is_member(workspace_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.create_workspace_for_current_user(text) to authenticated;

-- Optional demo workspace. It is not connected to a user until you add a membership.
insert into public.cashpilot_workspaces (id, name, currency)
values ('00000000-0000-0000-0000-000000000001', 'Acme Studio Demo', 'INR')
on conflict (id) do nothing;

insert into public.cashpilot_customers (workspace_id, name, email, payment_score, outstanding_amount)
values
  ('00000000-0000-0000-0000-000000000001', 'Acme Cloudworks', 'accounts@acmecloudworks.example', 92, 85000),
  ('00000000-0000-0000-0000-000000000001', 'Northstar Studio', 'finance@northstar.example', 61, 142000),
  ('00000000-0000-0000-0000-000000000001', 'Pixel & Beam', 'hello@pixelbeam.example', 38, 64500)
on conflict do nothing;
