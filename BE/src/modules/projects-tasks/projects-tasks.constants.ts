export const PROJECT_TYPES = [
  'Internal',
  'Client',
  'Research',
] as const;

export const PROJECT_STATUSES = [
  'Planning',
  'Active',
  'On Hold',
  'Completed',
  'Cancelled',
] as const;

export const TASK_STATUSES = [
  'To Do',
  'In Progress',
  'Review',
  'Done',
] as const;

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const STAKEHOLDERS = [
  'BOD',
  'Sales Team',
  'Dev Team',
  'CS Team',
] as const;

export const EVENT_PROJECT_TYPES = [
  'Workshop',
  'Event',
  'Exhibition',
  'Webinar',
];

export const EVENT_CHECKLIST = [
  'Xác định mục tiêu và concept',
  'Lập ngân sách sự kiện',
  'Chốt địa điểm / nền tảng',
  'Xác nhận diễn giả và agenda',
  'Thiết kế nội dung truyền thông',
  'Mở đăng ký và gửi thư mời',
  'Chuẩn bị hậu cần và thiết bị',
  'Tổng duyệt chương trình',
  'Tổ chức sự kiện',
  'Gửi follow-up và tổng kết',
];

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
