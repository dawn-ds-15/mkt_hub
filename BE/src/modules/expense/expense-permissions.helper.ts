export interface ExpensePermissions {
  view: boolean;
  createDraft: boolean;
  confirm: boolean;
  cancel: boolean;
  managePlans: boolean;
}

export function getExpensePermissions(user?: { role?: string }): ExpensePermissions {
  const isManagerOrAdmin =
    !user || !user.role || user.role === 'admin' || user.role === 'manager';
  return {
    view: true,
    createDraft: true,
    confirm: isManagerOrAdmin,
    cancel: isManagerOrAdmin,
    managePlans: isManagerOrAdmin,
  };
}

export const EXPENSE_ERROR_CODES = {
  ERR_ANNUAL_PLAN_NOT_ACTIVE: 'ERR_ANNUAL_PLAN_NOT_ACTIVE',
  ERR_ANNUAL_PLAN_ALREADY_ACTIVE: 'ERR_ANNUAL_PLAN_ALREADY_ACTIVE',
  ERR_NOT_DRAFT: 'ERR_NOT_DRAFT',
  ERR_PLAN_NOT_DRAFT: 'ERR_PLAN_NOT_DRAFT',
  ERR_NODE_LEVEL_INVALID: 'ERR_NODE_LEVEL_INVALID',
  ERR_ITEM_NOT_FOUND: 'ERR_ITEM_NOT_FOUND',
  ERR_LINE_ALREADY_CONFIRMED: 'ERR_LINE_ALREADY_CONFIRMED',
  ERR_LINE_ALREADY_CANCELLED: 'ERR_LINE_ALREADY_CANCELLED',
  ERR_LINE_NOT_CONFIRMED: 'ERR_LINE_NOT_CONFIRMED',
  ERR_UNPLANNED_REQUIRES_NAME: 'ERR_UNPLANNED_REQUIRES_NAME',
  ERR_PROJECT_EXPENSE_ITEM_NOT_FOUND: 'ERR_PROJECT_EXPENSE_ITEM_NOT_FOUND',
  ERR_ANNUAL_EXPENSE_ITEM_NOT_FOUND: 'ERR_ANNUAL_EXPENSE_ITEM_NOT_FOUND',
  ERR_RECOGNIZED_AFTER_CANCELLED: 'ERR_RECOGNIZED_AFTER_CANCELLED',
  ERR_PROJECT_CANCELLED: 'ERR_PROJECT_CANCELLED',
  ERR_INVALID_DETAIL_LEVEL: 'ERR_INVALID_DETAIL_LEVEL',
  ERR_UNPLANNED_HAS_PROJECT_ITEM: 'ERR_UNPLANNED_HAS_PROJECT_ITEM',
  ERR_BUDGET_AMOUNT_NEGATIVE: 'ERR_BUDGET_AMOUNT_NEGATIVE',
  ERR_PLAN_STATUS_CHANGE_DENIED: 'ERR_PLAN_STATUS_CHANGE_DENIED',
} as const;

export interface ExpenseErrorPayload {
  code: string;
  message: string;
  params?: Record<string, any>;
  errors?: Record<string, any>;
}

