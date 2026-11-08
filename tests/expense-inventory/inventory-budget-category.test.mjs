import assert from 'node:assert/strict';
import {
  getInventoryBudgetGroup,
  resolveInventoryBudgetCategory,
  getBatchExpenseCategory,
  VAT_PHAM_BUDGET_GROUP,
  QUA_TANG_IN_AN_BUDGET_GROUP,
} from '../../src/features/inventory/utils/inventoryBudgetCategory.js';

// Danh mục kho -> nhóm ngân sách.
assert.equal(getInventoryBudgetGroup('gift'), QUA_TANG_IN_AN_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup('print'), QUA_TANG_IN_AN_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup('  GIFT  '), QUA_TANG_IN_AN_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup('Quà tặng'), QUA_TANG_IN_AN_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup('Ấn phẩm in'), QUA_TANG_IN_AN_BUDGET_GROUP);

assert.equal(getInventoryBudgetGroup('posm'), VAT_PHAM_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup('uniform'), VAT_PHAM_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup(null), VAT_PHAM_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup(undefined), VAT_PHAM_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup(''), VAT_PHAM_BUDGET_GROUP);
assert.equal(getInventoryBudgetGroup('khác'), VAT_PHAM_BUDGET_GROUP);

// Cây ngân sách thật: ưu tiên đúng tên nhóm và trả categoryId thật.
const categories = [
  { id: 'cat-gift', name: 'QUÀ TẶNG/ IN ẤN' },
  { id: 'cat-vp', name: 'Vật phẩm' },
  { id: 'cat-event', name: 'EVENT' },
];

assert.deepEqual(
  resolveInventoryBudgetCategory('gift', categories),
  { name: 'QUÀ TẶNG/ IN ẤN', id: 'cat-gift', group: QUA_TANG_IN_AN_BUDGET_GROUP }
);
assert.deepEqual(
  resolveInventoryBudgetCategory('print', categories),
  { name: 'QUÀ TẶNG/ IN ẤN', id: 'cat-gift', group: QUA_TANG_IN_AN_BUDGET_GROUP }
);
assert.deepEqual(
  resolveInventoryBudgetCategory('posm', categories),
  { name: 'Vật phẩm', id: 'cat-vp', group: VAT_PHAM_BUDGET_GROUP }
);
assert.deepEqual(
  resolveInventoryBudgetCategory('uniform', categories),
  { name: 'Vật phẩm', id: 'cat-vp', group: VAT_PHAM_BUDGET_GROUP }
);

// Chưa có nhóm đích trong cây: KHÔNG tự tạo nhóm mới, lùi về Vật phẩm.
assert.deepEqual(
  resolveInventoryBudgetCategory('gift', [{ id: 'cat-vp', name: 'Vật phẩm' }]),
  { name: 'Vật phẩm', id: 'cat-vp', group: VAT_PHAM_BUDGET_GROUP }
);
// Chưa có cả Vật phẩm: giữ tên Vật phẩm với id null (unassigned), không bịa id.
assert.deepEqual(
  resolveInventoryBudgetCategory('print', []),
  { name: 'Vật phẩm', id: null, group: VAT_PHAM_BUDGET_GROUP }
);
assert.deepEqual(
  resolveInventoryBudgetCategory('posm', null),
  { name: 'Vật phẩm', id: null, group: VAT_PHAM_BUDGET_GROUP }
);

// Batch chỉ có chi phí chung khi đã chọn hạng mục; giữ nguyên hành vi cũ.
assert.equal(getBatchExpenseCategory(null), null);
assert.equal(getBatchExpenseCategory({}), null);
assert.deepEqual(
  getBatchExpenseCategory({ expenseCategoryId: 'cat-gift', expenseCategoryName: 'QUÀ TẶNG/ IN ẤN' }),
  { id: 'cat-gift', name: 'QUÀ TẶNG/ IN ẤN' }
);
assert.deepEqual(
  getBatchExpenseCategory({ expenseCategoryId: 'cat-vp', expenseCategory: { name: 'Vật phẩm' } }),
  { id: 'cat-vp', name: 'Vật phẩm' }
);

console.log('inventory budget category tests passed');
