// Hồ sơ liên quan của dòng chi phí — nhiều file / dòng (feedback 25/09 T02 lần 2).
// BE: GET/POST /v1/expenses/lines/{lineId}/attachments, GET /v1/expenses/attachments/{id}/file;
// ExpenseLineDto.attachments gồm cả file cũ 1-file-một-dòng.
export const ATTACHMENT_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'xls', 'docx', 'doc'];
export const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc';
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export function lineAttachments(ln) {
  return (Array.isArray(ln?.attachments) ? ln.attachments : [])
    .filter((a) => a?.id)
    .map((a) => ({ id: a.id, name: a.name || 'Hồ sơ' }));
}

export function validateAttachmentFile(file) {
  const ext = String(file?.name || '').split('.').pop().toLowerCase();
  if (!ATTACHMENT_EXTS.includes(ext)) return 'type';
  if (file.size > ATTACHMENT_MAX_BYTES) return 'size';
  return '';
}
