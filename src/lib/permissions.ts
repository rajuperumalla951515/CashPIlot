// CashPilot Role-Based Access Control (RBAC) & Permission System

export type Role =
  | "owner"
  | "admin"
  | "finance_manager"
  | "accountant"
  | "collections"
  | "viewer";

export type Permission =
  // Dashboard & Analytics
  | "dashboard.view"
  | "analytics.view"
  | "cashflow.view"
  | "reports.view"
  | "reports.export"

  // Invoices & Receivables
  | "invoice.view"
  | "invoice.create"
  | "invoice.edit"
  | "invoice.delete"

  // Payments & Payables
  | "payment.view"
  | "payment.create"
  | "payment.edit"
  | "payment.delete"

  // Expenses & Suppliers
  | "expense.view"
  | "expense.create"
  | "supplier.view"
  | "supplier.manage"

  // Customers & Collections
  | "customer.view"
  | "customer.edit"
  | "collections.view"
  | "collections.manage"
  | "promise.manage"

  // AI CFO Agent
  | "ai.insights"

  // Administration & Governance
  | "team.view"
  | "team.invite"
  | "team.remove"
  | "settings.manage"
  | "billing.manage"
  | "org.delete";

// Role-to-Permissions Matrix
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "dashboard.view",
    "analytics.view",
    "cashflow.view",
    "reports.view",
    "reports.export",
    "invoice.view",
    "invoice.create",
    "invoice.edit",
    "invoice.delete",
    "payment.view",
    "payment.create",
    "payment.edit",
    "payment.delete",
    "expense.view",
    "expense.create",
    "supplier.view",
    "supplier.manage",
    "customer.view",
    "customer.edit",
    "collections.view",
    "collections.manage",
    "promise.manage",
    "ai.insights",
    "team.view",
    "team.invite",
    "team.remove",
    "settings.manage",
    "billing.manage",
    "org.delete",
  ],

  admin: [
    "dashboard.view",
    "analytics.view",
    "cashflow.view",
    "reports.view",
    "reports.export",
    "invoice.view",
    "invoice.create",
    "invoice.edit",
    "payment.view",
    "payment.create",
    "payment.edit",
    "expense.view",
    "expense.create",
    "supplier.view",
    "supplier.manage",
    "customer.view",
    "customer.edit",
    "collections.view",
    "collections.manage",
    "promise.manage",
    "ai.insights",
    "team.view",
    "team.invite",
    "team.remove",
    "settings.manage",
  ],

  finance_manager: [
    "dashboard.view",
    "analytics.view",
    "cashflow.view",
    "reports.view",
    "reports.export",
    "invoice.view",
    "invoice.create",
    "invoice.edit",
    "payment.view",
    "payment.create",
    "payment.edit",
    "expense.view",
    "expense.create",
    "supplier.view",
    "customer.view",
    "customer.edit",
    "collections.view",
    "collections.manage",
    "promise.manage",
    "ai.insights",
    "team.view",
  ],

  accountant: [
    "dashboard.view",
    "reports.view",
    "reports.export",
    "invoice.view",
    "invoice.create",
    "invoice.edit",
    "payment.view",
    "payment.create",
    "expense.view",
    "expense.create",
    "supplier.view",
    "customer.view",
    "customer.edit",
  ],

  collections: [
    "dashboard.view",
    "invoice.view",
    "customer.view",
    "collections.view",
    "collections.manage",
    "promise.manage",
    "reports.view",
  ],

  viewer: [
    "dashboard.view",
    "analytics.view",
    "reports.view",
    "cashflow.view",
  ],
};

/**
 * Checks if a specific role possesses the requested permission.
 */
export function hasPermission(role: Role | string | undefined, permission: Permission): boolean {
  if (!role) return false;
  const validRole = (ROLE_PERMISSIONS[role as Role] ? role : "viewer") as Role;
  return ROLE_PERMISSIONS[validRole].includes(permission);
}
