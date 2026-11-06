import assert from 'node:assert/strict';
import { matchInventoryItem, normalizeItemName, stripDiacritics } from '../../src/features/expense/utils/inventoryMatching.js';

// Danh sách vật phẩm thực tế của kho (rút gọn từ dữ liệu VILOG 2026).
const items = [
  { id: 'moc-khoa', name: 'MÓC KHÓA LỬNG MẬT' },
  { id: 'voucher-giay-50', name: 'VOUCHER GIẤY 50.000' },
  { id: 'voucher-giay-100', name: 'VOUCHER GIẤY 100.000' },
  { id: 'tui-tote', name: 'TÚI TOTE' },
  { id: 'voucher-50', name: 'VOUCHER 50.000' },
  { id: 'voucher-100', name: 'VOUCHER 100.000' },
];

const idOf = (name) => matchInventoryItem(items, name)?.id ?? null;

// Các dòng chi phí "QUÀ TẶNG/ IN ẤN" của VILOG 2026 phải liên kết được với vật phẩm kho.
assert.equal(idOf('MÓC KHÓA LỬNG MẬT'), 'moc-khoa');
assert.equal(idOf('VOUCHER GIẤY 50.000'), 'voucher-giay-50');
assert.equal(idOf('VOUCHER GIẤY 100.000'), 'voucher-giay-100');
assert.equal(idOf('TÚI TOTE'), 'tui-tote');
assert.equal(idOf('VOUCHER 50.000'), 'voucher-50');
assert.equal(idOf('VOUCHER 100.000'), 'voucher-100');

// Chấp nhận khác biệt hoa/thường, khoảng trắng thừa và dấu tiếng Việt (trường hợp gõ "LUNG" thay vì "LỬNG").
assert.equal(idOf('  móc   khóa lửng mật  '), 'moc-khoa');
assert.equal(idOf('MÓC KHÓA LUNG MẬT'), 'moc-khoa');
assert.equal(idOf('Tui Tote'), 'tui-tote');

// Không khớp / khớp mơ hồ thì không tự liên kết để tránh trừ kho sai.
assert.equal(idOf('VILOG leaflet'), null);
assert.equal(idOf(''), null);
assert.equal(idOf(null), null);
const ambiguous = [
  { id: 'a', name: 'MÓC KHÓA' },
  { id: 'b', name: 'MOC KHOA' },
];
assert.equal(matchInventoryItem(ambiguous, 'MÓC KHOA'), null);

assert.equal(normalizeItemName('  A   B  '), 'a b');
assert.equal(stripDiacritics('Đinh Kèm'), 'dinh kem');

console.log('inventory matching tests passed');
