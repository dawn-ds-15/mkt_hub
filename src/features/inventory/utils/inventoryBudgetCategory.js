// Chi phí nhập kho chung (không chia được cho dự án) có thể ghi thẳng vào 1 nhóm hạng mục ngân sách.
// BE lưu ở batch: expenseCategoryId / expenseCategoryName, và tự cộng vào thực tế của nhóm trong cây ngân sách.
export function getBatchExpenseCategory(batch) {
  if (!batch?.expenseCategoryId) return null;
  return { id: batch.expenseCategoryId, name: batch.expenseCategoryName || batch.expenseCategory?.name || '' };
}

// Nhóm ngân sách đích cho từng danh mục kho:
// - Quà tặng / Ấn phẩm in  -> QUÀ TẶNG/ IN ẤN
// - POSM / Đồng phục / khác -> Vật phẩm
export const VAT_PHAM_BUDGET_GROUP = 'Vật phẩm';
export const QUA_TANG_IN_AN_BUDGET_GROUP = 'QUÀ TẶNG/ IN ẤN';

const normalizeGroup = (value) => String(value ?? '').trim().toLowerCase();

export function getInventoryBudgetGroup(category) {
  const key = normalizeGroup(category);
  if (
    key === 'gift'
    || key === 'print'
    || key === 'quà tặng'
    || key === 'ấn phẩm in'
    || key === 'in ấn'
  ) return QUA_TANG_IN_AN_BUDGET_GROUP;
  return VAT_PHAM_BUDGET_GROUP;
}

// Trả về tên + categoryId thật từ cây ngân sách đang tải.
// Nếu nhóm đích chưa tồn tại trong cây, KHÔNG tự tạo nhóm mới: giữ Vật phẩm (id null).
export function resolveInventoryBudgetCategory(category, categories = []) {
  const group = getInventoryBudgetGroup(category);
  const list = Array.isArray(categories) ? categories : [];
  const target = list.find((c) => c && c.id && normalizeGroup(c.name) === normalizeGroup(group));
  if (target) return { name: target.name, id: target.id, group };

  const vatPham = list.find((c) => c && c.id && normalizeGroup(c.name) === normalizeGroup(VAT_PHAM_BUDGET_GROUP));
  return { name: vatPham?.name || VAT_PHAM_BUDGET_GROUP, id: vatPham?.id || null, group: VAT_PHAM_BUDGET_GROUP };
}
