const taskFieldLabels = {
  name: 'Tên task',
  title: 'Tên task',
  description: 'Mô tả',
  status: 'Trạng thái',
  priority: 'Độ ưu tiên',
  projectId: 'Dự án',
  assigneeId: 'Người phụ trách',
  startDate: 'Ngày bắt đầu',
  dueDate: 'Hạn chót',
  completedDate: 'Ngày hoàn thành',
  execWeek: 'Tuần thực hiện',
  execYear: 'Năm thực hiện',
  stakeholders: 'Liên quan',
  link: 'Liên kết',
  remark: 'Ghi chú',
};

const constraintTranslations = [
  [/should not be empty|must not be empty/g, 'không được để trống'],
  [/must be a valid ISO 8601 date/g, 'không hợp lệ'],
  [/must be a valid date/g, 'không hợp lệ'],
  [/must be a string/g, 'phải là chuỗi ký tự'],
  [/must be a number/g, 'phải là số'],
  [/must be an integer number/g, 'phải là số nguyên'],
  [/must not be greater than (\d+)/g, 'không được lớn hơn $1'],
  [/must not be less than (\d+)/g, 'không được nhỏ hơn $1'],
  [/must be one of the following values/g, 'phải là một trong các giá trị sau'],
  [/must match .+ regular expression/g, 'không hợp lệ'],
  [/property .+ should not exist/g, 'không hợp lệ'],
  [/each value in nested property .+ must be either a string or a number/g, 'phải là chuỗi hoặc số'],
];

function translateConstraint(raw) {
  let text = raw;
  constraintTranslations.forEach(([regex, vi]) => {
    text = text.replace(regex, vi);
  });
  return text;
}

function translateSingle(msg) {
  if (typeof msg !== 'string') return msg;
  const match = msg.match(/^([a-zA-Z_]+)\s+(.*)$/);
  if (!match) return msg;
  const field = taskFieldLabels[match[1]] || match[1];
  const text = translateConstraint(match[2]);
  return `${field} ${text}`;
}

export function translateTaskErrors(msg, locale) {
  if (locale !== 'vi') return msg;
  if (Array.isArray(msg)) return msg.map(translateSingle).join('; ');
  return translateSingle(msg);
}
