// Lưu tạm link Drive của dự án ở FE cho tới khi BE trả về trường driveLink.
// BE vẫn nhận driveLink trong payload; khi BE lưu được thì giá trị từ API
// sẽ được ưu tiên và overlay này chỉ còn là bản dự phòng.
const STORE_KEY = 'mkt_hub_project_drive_links';

function getAll() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getDriveLink(projectId) {
  if (!projectId) return '';
  return getAll()[String(projectId)] || '';
}

export function setDriveLink(projectId, link) {
  if (!projectId) return;
  const all = getAll();
  const value = String(link || '').trim();
  if (value) all[String(projectId)] = value;
  else delete all[String(projectId)];
  saveAll(all);
}

export function clearDriveLink(projectId) {
  setDriveLink(projectId, '');
}
