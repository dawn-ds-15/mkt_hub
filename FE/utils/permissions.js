// Ma trận quyền theo tài khoản (feedback 26/09 T06): quản lý (quyền cao nhất) đặt mức truy cập từng module cho từng tài khoản.
// Mức: none (ẩn module) | view (chỉ xem) | edit (toàn quyền). Ô không đặt riêng → theo mặc định của vai trò.
// Lưu ở BE: GET/PUT /v1/permissions/matrix; BE áp quyền (view → 403 khi ghi, none → 403 cả GET riêng của module).
import { useEffect, useState } from 'react';
import { getPermissionMatrix } from '../services/api';

export const PERMISSION_MODULES = [
  { key: 'dashboard', href: '/', vi: 'Tổng quan', en: 'Dashboard' },
  { key: 'projects', href: '/projects', vi: 'Dự án', en: 'Projects' },
  { key: 'tasks', href: '/tasks', vi: 'Task', en: 'Tasks' },
  { key: 'leads', href: '/leads', vi: 'Leads & KPIs', en: 'Leads & KPIs' },
  { key: 'expense', href: '/expense', vi: 'Quản lý chi phí', en: 'Expenses' },
  { key: 'inventory', href: '/inventory', vi: 'Kho vật phẩm', en: 'Inventory' },
];

// Quản lý dữ liệu (thành viên, phân quyền, cấu hình, sao lưu) giữ theo vai trò: chỉ quản lý — không nằm trong ma trận
const DATA_MODULE = { key: 'data', href: '/data' };

export const PERMISSION_LEVELS = ['none', 'view', 'edit'];

// Mặc định theo vai trò = hành vi hiện tại của app
export const ROLE_DEFAULTS = {
  manager: { dashboard: 'edit', projects: 'edit', tasks: 'edit', leads: 'edit', expense: 'edit', inventory: 'edit' },
  specialist: { dashboard: 'edit', projects: 'edit', tasks: 'edit', leads: 'edit', expense: 'edit', inventory: 'edit' },
};

export function normalizeRole(role) {
  return String(role || '').toLowerCase() === 'manager' ? 'manager' : 'specialist';
}

export function currentUser() {
  try { return JSON.parse(localStorage.getItem('mkt_hub_user')) || {}; } catch { return {}; }
}

export function effectiveLevel(matrix, user, moduleKey) {
  const role = normalizeRole(user?.role);
  if (moduleKey === DATA_MODULE.key) return role === 'manager' ? 'edit' : 'none';
  const override = user?.id ? matrix?.[user.id]?.[moduleKey] : undefined;
  return PERMISSION_LEVELS.includes(override) ? override : ROLE_DEFAULTS[role][moduleKey];
}

export function moduleKeyOfPath(pathname) {
  const hit = [...PERMISSION_MODULES, DATA_MODULE].filter((m) => m.href !== '/').find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`));
  return hit ? hit.key : (pathname === '/' ? 'dashboard' : null);
}

// Cache dùng chung trong phiên: Sidebar, route guard và Layout đọc cùng 1 bản ma trận
let cache = null;
let inflight = null;
const listeners = new Set();

export function loadPermissionMatrix({ force = false } = {}) {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  inflight = getPermissionMatrix()
    .then((res) => { cache = res; return res; })
    .catch(() => { cache = { matrix: {}, source: 'error' }; return cache; })
    .finally(() => { inflight = null; listeners.forEach((fn) => fn(cache)); });
  return inflight;
}

export function setPermissionCache(next) {
  cache = next;
  listeners.forEach((fn) => fn(cache));
}

export function usePermissionMatrix() {
  const [state, setState] = useState(cache);
  useEffect(() => {
    listeners.add(setState);
    if (!cache) loadPermissionMatrix();
    else setState(cache);
    return () => listeners.delete(setState);
  }, []);
  return state;
}

// Mức quyền của người đang đăng nhập với 1 module; ma trận chưa tải xong → theo mặc định của vai trò
export function useModuleLevel(moduleKey) {
  const state = usePermissionMatrix();
  return effectiveLevel(state?.matrix || {}, currentUser(), moduleKey);
}
