import { useMemo } from 'react';
import { TASK_STATUS_KEYS, TASK_STATUS_FALLBACK_LABELS, normalizeTaskStatus } from '../services/api';
import { useDropdownOptionsState } from './useDropdownOptions';

// Danh sách trạng thái Task = đúng những gì tab Cấu hình Dropdown đang có, đúng thứ tự đó.
// KHÔNG bù thêm cho đủ 7 — số lượng hiển thị ở module Task phải khớp tuyệt đối với cấu hình.
// `key` dùng cho logic (lọc, style, gửi BE): quy về khóa chuẩn nếu nhận diện được,
// còn nhãn lạ thì lấy chính nhãn làm key. `label` luôn là chuỗi người dùng đã gõ.
export function useTaskStatusOptions() {
  const { options: configured, loaded } = useDropdownOptionsState('task_status');

  return useMemo(() => {
    // Chưa tải xong: dùng tạm 7 mặc định để select không rỗng, tải xong sẽ thay bằng cấu hình thật.
    if (!loaded) {
      return TASK_STATUS_KEYS.map((key) => ({ key, id: `ts_${key}`, label: TASK_STATUS_FALLBACK_LABELS[key] }));
    }

    // Mỗi giá trị trong cấu hình = đúng một mục ở đây, để số lượng luôn khớp 1:1.
    // Chỉ gộp khi trùng đúng nhãn; hai nhãn khác nhau cùng quy về một khóa chuẩn
    // thì cái sau giữ nguyên nhãn làm key (vẫn hiện, không bị nuốt mất).
    const usedKeys = new Set();
    const seenLabels = new Set();
    const result = [];
    configured.forEach((opt) => {
      const label = String(opt.label ?? '').trim();
      if (!label) return;
      const dedupe = label.toLowerCase();
      if (seenLabels.has(dedupe)) return;
      seenLabels.add(dedupe);
      const canonical = normalizeTaskStatus(label);
      const key = canonical && !usedKeys.has(canonical) ? canonical : label;
      usedKeys.add(key);
      result.push({ key, id: opt.id, label });
    });
    return result;
  }, [configured, loaded]);
}

// Tra nhanh nhãn hiển thị theo khóa chuẩn.
export function statusLabelOf(options, key) {
  return options.find((o) => o.key === key)?.label || TASK_STATUS_FALLBACK_LABELS[key] || key;
}
