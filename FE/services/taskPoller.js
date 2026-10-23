import { getTaskList } from './api';

// Một nguồn poll /v1/tasks dùng chung cho Topbar (đếm quá hạn / sắp hạn) và NotificationBell (task của tôi).
// - 1 request mỗi chu kỳ dù có bao nhiêu component đăng ký (trước đây mỗi component tự poll → 2 request / 30s)
// - Layout mount lại khi chuyển trang: dùng lại dữ liệu nếu còn mới (< POLL_MS), không gọi lại
// - Tab ẩn thì ngừng poll; quay lại tab thì tải lại nếu dữ liệu đã cũ
const POLL_MS = 30000;

const listeners = new Set();
let cache = null; // { tasks, at }
let inflight = null;
let timer = null;

function emit() {
  if (!cache) return;
  listeners.forEach((fn) => {
    try { fn(cache.tasks); } catch { /* listener lỗi không ảnh hưởng listener khác */ }
  });
}

function fetchNow() {
  if (inflight) return inflight;
  inflight = getTaskList({})
    .then((res) => {
      cache = { tasks: res.data || [], at: Date.now() };
      emit();
    })
    .catch(() => { /* bỏ qua lỗi poll, thử lại ở chu kỳ sau */ })
    .finally(() => { inflight = null; });
  return inflight;
}

// Chừa 5s để tick của setInterval (lệch pha với lần tải đầu) không bỏ lỡ chu kỳ và kéo giãn thành 60s
const isStale = () => !cache || Date.now() - cache.at >= POLL_MS - 5000;

function tick() {
  if (document.visibilityState === 'hidden') return;
  if (isStale()) fetchNow();
}

function onVisibility() {
  if (document.visibilityState === 'visible') tick();
}

function start() {
  if (timer) return;
  timer = setInterval(tick, POLL_MS);
  document.addEventListener('visibilitychange', onVisibility);
}

function stop() {
  clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVisibility);
}

// Chuyển trang = Layout unmount rồi mount lại ngay → hoãn dừng một chút để interval giữ nhịp 30s, không bị đặt lại
let stopTimer = null;

export function subscribeTasks(fn) {
  clearTimeout(stopTimer);
  listeners.add(fn);
  start();
  if (cache) fn(cache.tasks);
  if (isStale()) fetchNow();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => { if (listeners.size === 0) stop(); }, 3000);
    }
  };
}

// Gọi sau khi tạo/sửa/xoá task để badge cập nhật ngay thay vì chờ chu kỳ sau
export function refreshTasks() {
  if (listeners.size > 0) fetchNow();
  else cache = null;
}
