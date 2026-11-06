// Chi phí nhập kho chung (không chia được cho dự án) có thể ghi thẳng vào 1 nhóm hạng mục ngân sách.
// BE lưu ở batch: expenseCategoryId / expenseCategoryName, và tự cộng vào thực tế của nhóm trong cây ngân sách.
export function getBatchExpenseCategory(batch) {
  if (!batch?.expenseCategoryId) return null;
  return { id: batch.expenseCategoryId, name: batch.expenseCategoryName || batch.expenseCategory?.name || '' };
}
