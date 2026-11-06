export const normalizeItemName = (s) => String(s || '')
  .normalize('NFC')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

export const stripDiacritics = (s) => s
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase();

// Liên kết dòng chi phí với vật phẩm kho theo tên, áp dụng cho mọi hạng mục (không chỉ "Vật phẩm").
// Khớp chính xác trước; nếu không có thì khớp bỏ dấu, nhưng chỉ nhận khi kết quả duy nhất để tránh gán nhầm.
export const matchInventoryItem = (items, name) => {
  const key = normalizeItemName(name);
  if (!key) return null;
  const exact = (items || []).find((i) => normalizeItemName(i.name) === key);
  if (exact) return exact;
  const loose = stripDiacritics(key);
  const candidates = (items || []).filter((i) => stripDiacritics(normalizeItemName(i.name)) === loose);
  return candidates.length === 1 ? candidates[0] : null;
};
