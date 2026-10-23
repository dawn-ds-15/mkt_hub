import { useEffect, useRef, useState, useCallback } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  getBatchAttachments,
  uploadBatchAttachments,
  deleteInventoryAttachment,
  downloadInventoryAttachment,
} from '../../services/api';

// Hồ sơ liên quan (hóa đơn, hợp đồng, biên bản...) gắn với 1 batch nhập kho.
// - Có batchId: đọc/ghi trực tiếp qua API /v1/inventory/batches/{id}/attachments.
// - Chưa có batchId (form tạo mới): giữ file ở local (pendingFiles), form upload sau khi tạo batch.

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.zip,.rar,image/*';

const UNSUPPORTED_STATUSES = [404, 405, 501];

export const isAttachmentApiUnsupported = (err) => UNSUPPORTED_STATUSES.includes(err?.response?.status);

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-GB');
}

function fileIcon(name, type) {
  const n = String(name || '').toLowerCase();
  if (String(type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n)) return 'image';
  if (/\.pdf$/.test(n) || type === 'application/pdf') return 'picture_as_pdf';
  if (/\.(xlsx?|csv)$/.test(n)) return 'table_view';
  return 'description';
}

export default function BatchAttachments({ batchId, pendingFiles, onPendingChange, disabled }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const inputRef = useRef(null);

  const isPendingMode = !batchId;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [unsupported, setUnsupported] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getBatchAttachments(batchId);
      setList(res.data || []);
      setUnsupported(false);
    } catch (e) {
      console.error('[Inventory] getBatchAttachments:', e);
      if (isAttachmentApiUnsupported(e)) setUnsupported(true);
      else setError(t('Không tải được hồ sơ liên quan.', 'Failed to load attachments.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  const handlePick = async (fileList) => {
    const files = Array.from(fileList || []);
    if (inputRef.current) inputRef.current.value = '';
    if (!files.length) return;
    if (isPendingMode) {
      onPendingChange?.([...(pendingFiles || []), ...files]);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const res = await uploadBatchAttachments(batchId, files);
      if (res.data?.length) setList((prev) => [...prev, ...res.data]);
      else await load();
    } catch (e) {
      console.error('[Inventory] uploadBatchAttachments:', e);
      if (isAttachmentApiUnsupported(e)) setUnsupported(true);
      else {
        const raw = e?.response?.data?.message;
        const detail = Array.isArray(raw) ? raw.join(', ') : (typeof raw === 'string' ? raw : '');
        setError(t(`Tải lên không thành công. ${detail}`, `Upload failed. ${detail}`).trim());
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (att) => {
    if (!window.confirm(t(`Xóa hồ sơ "${att.name}"?`, `Delete attachment "${att.name}"?`))) return;
    setBusyId(att.id);
    setError(null);
    try {
      await deleteInventoryAttachment(att.id);
      setList((prev) => prev.filter((a) => a.id !== att.id));
    } catch (e) {
      console.error('[Inventory] deleteInventoryAttachment:', e);
      setError(t('Xóa hồ sơ không thành công.', 'Failed to delete attachment.'));
    } finally {
      setBusyId(null);
    }
  };

  const fetchBlobUrl = async (att) => {
    const blob = await downloadInventoryAttachment(att);
    return URL.createObjectURL(att.type && blob.type !== att.type ? new Blob([blob], { type: att.type }) : blob);
  };

  const handleOpen = async (att) => {
    // Mở tab trước (đồng bộ với click) để không bị chặn popup, rồi gán URL sau khi tải xong.
    const win = window.open('', '_blank');
    setBusyId(att.id);
    try {
      const url = await fetchBlobUrl(att);
      if (win) win.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error('[Inventory] open attachment:', e);
      if (win) win.close();
      setError(t('Không mở được hồ sơ.', 'Could not open attachment.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (att) => {
    setBusyId(att.id);
    try {
      const url = await fetchBlobUrl(att);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.name || 'attachment';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('[Inventory] download attachment:', e);
      setError(t('Không tải được hồ sơ.', 'Could not download attachment.'));
    } finally {
      setBusyId(null);
    }
  };

  const removePending = (idx) => {
    onPendingChange?.((pendingFiles || []).filter((_, i) => i !== idx));
  };

  const rows = isPendingMode
    ? (pendingFiles || []).map((f, idx) => ({ key: `p-${idx}`, idx, name: f.name, size: f.size, type: f.type, pending: true }))
    : list.map((a) => ({ ...a, key: a.id }));

  const canUpload = !disabled && !unsupported && !uploading;

  return (
    <div className="space-y-2">
      {unsupported ? (
        <div className="p-3 rounded bg-warning/10 text-warning text-body-sm flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] mt-0.5">info</span>
          <span>{t(
            'Backend chưa hỗ trợ lưu hồ sơ liên quan cho batch kho (API /v1/inventory/batches/{id}/attachments chưa có). Vui lòng thử lại sau khi BE cập nhật.',
            'Backend does not support batch attachments yet (/v1/inventory/batches/{id}/attachments missing). Please retry after the BE update.'
          )}</span>
        </div>
      ) : (
        <div
          onClick={() => canUpload && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (canUpload) handlePick(e.dataTransfer.files); }}
          className={`border-2 border-dashed border-border-light rounded-lg px-3 py-3 text-center text-body-sm text-on-surface-variant transition-colors ${canUpload ? 'cursor-pointer hover:border-secondary hover:text-secondary' : 'opacity-60 cursor-not-allowed'}`}
        >
          <span className="material-symbols-outlined text-[18px] align-middle mr-1">{uploading ? 'hourglass_top' : 'upload_file'}</span>
          {uploading
            ? t('Đang tải lên...', 'Uploading...')
            : t('Kéo thả hoặc bấm để thêm hồ sơ (hóa đơn, hợp đồng, biên bản...)', 'Drop or click to add documents (invoice, contract...)')}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handlePick(e.target.files)}
          />
        </div>
      )}

      {isPendingMode && rows.length > 0 && (
        <p className="text-xs text-on-surface-variant">{t('Hồ sơ sẽ được tải lên sau khi lưu.', 'Files will be uploaded after saving.')}</p>
      )}

      {error && (
        <div className="p-2 rounded bg-danger/10 text-danger text-body-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </div>
      )}

      {loading && (
        <div className="text-body-sm text-on-surface-variant flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          {t('Đang tải...', 'Loading...')}
        </div>
      )}

      {!loading && !unsupported && !isPendingMode && rows.length === 0 && (
        <p className="text-body-sm text-on-surface-variant">{t('Chưa có hồ sơ liên quan.', 'No attachments yet.')}</p>
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-border-light border border-border-light rounded-lg">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2 px-3 py-2 text-body-sm">
              <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">{fileIcon(r.name, r.type)}</span>
              <div className="flex-1 min-w-0">
                {r.pending ? (
                  <div className="truncate text-on-surface" title={r.name}>{r.name}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpen(r)}
                    className="truncate text-secondary hover:underline cursor-pointer text-left max-w-full block"
                    title={r.name}
                  >
                    {r.name}
                  </button>
                )}
                <div className="text-xs text-on-surface-variant">
                  {formatSize(r.size)}{r.uploadedAt ? ` · ${formatDate(r.uploadedAt)}` : ''}
                </div>
              </div>
              {r.pending ? (
                <button type="button" onClick={() => removePending(r.idx)} className="p-1 text-on-surface-variant hover:text-danger rounded cursor-pointer" title={t('Bỏ', 'Remove')}>
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              ) : (
                <>
                  <button type="button" disabled={busyId === r.id} onClick={() => handleDownload(r)} className="p-1 text-on-surface-variant hover:text-secondary rounded cursor-pointer disabled:opacity-40" title={t('Tải xuống', 'Download')}>
                    <span className="material-symbols-outlined text-[16px]">{busyId === r.id ? 'hourglass_top' : 'download'}</span>
                  </button>
                  {!disabled && (
                    <button type="button" disabled={busyId === r.id} onClick={() => handleDelete(r)} className="p-1 text-on-surface-variant hover:text-danger rounded cursor-pointer disabled:opacity-40" title={t('Xóa', 'Delete')}>
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BatchAttachmentsModal({ item, batch, onClose }) {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg pointer-events-auto mx-4 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">{t('Hồ sơ liên quan', 'Related documents')}</h3>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                {item?.name}{batch?.batchCode ? ` — ${batch.batchCode}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface text-xl leading-none cursor-pointer">&times;</button>
          </div>
          <BatchAttachments batchId={batch?.id} />
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-surface-container-low text-on-surface rounded text-body-sm font-semibold hover:bg-surface-container transition-colors cursor-pointer">
              {t('Đóng', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
