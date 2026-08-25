import { useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';

const ACCEPT = {
  excel: '.xlsx,.xls,.csv',
  image: 'image/*',
};

// BUG-C07: nén ảnh trước khi lưu/upload — giảm nặng base64 trong localStorage
// và dung lượng upload lên server. Max cạnh 1600px, JPEG 80%.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

const compressImage = (fileObj) =>
  new Promise((resolve) => {
    const imgUrl = URL.createObjectURL(fileObj);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(imgUrl);
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(imgUrl);
      resolve(null);
    };
    img.src = imgUrl;
  });

const TYPE_LABEL = (locale) => ({
  excel: locale === 'vi' ? 'File số liệu (Excel)' : 'Data File (Excel)',
  image: locale === 'vi' ? 'Hợp đồng (Ảnh)' : 'Contract (Image)',
});

const TYPE_HINT = (locale) => ({
  excel: locale === 'vi' ? 'Chỉ nhận file Excel (.xlsx, .xls, .csv)' : 'Only Excel files (.xlsx, .xls, .csv) accepted',
  image: locale === 'vi' ? 'Chỉ nhận file ảnh (PNG, JPG...)' : 'Only image files (PNG, JPG...) accepted',
});

export default function FileUploadModal({ type, onClose, onConfirm }) {
  const { locale } = useDashboard();
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const setFromList = (list) => {
    if (!list || !list.length) return;
    const f = list[0];
    setFile({ name: f.name, size: f.size, fileObj: f, dataUrl: type === 'image' ? URL.createObjectURL(f) : null });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    setFromList(e.dataTransfer.files);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto pointer-events-auto mx-4">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-base font-bold">{TYPE_LABEL(locale)[type]}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current && inputRef.current.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border-light hover:border-primary/50'
              }`}
            >
              <div className="flex justify-center mb-3">
                <span className="material-symbols-outlined text-[40px] text-primary">cloud_upload</span>
              </div>
              <p className="text-sm font-semibold text-on-surface mb-1">
                {locale === 'vi' ? 'Kéo thả file vào đây hoặc' : 'Drag & drop a file here or'}
                <span className="text-primary ml-1">{locale === 'vi' ? 'chọn file' : 'browse'}</span>
              </p>
              <p className="text-xs text-on-surface-variant">{TYPE_HINT(locale)[type]}</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT[type]}
                className="hidden"
                onChange={(e) => setFromList(e.target.files)}
              />
            </div>

            {file && (
              <div className="bg-background-subtle border border-border-light rounded-lg p-4 flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">{type === 'image' ? 'image' : 'description'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{file.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {type === 'image' && file?.dataUrl && (
              <img src={file.dataUrl} alt={file.name} className="w-full max-h-56 object-contain rounded-lg border border-border-light" />
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button onClick={onClose} className="px-6 py-2.5 border border-border-light rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer">
              {locale === 'vi' ? 'Hủy bỏ' : 'Cancel'}
            </button>
            <button
              disabled={!file}
              onClick={async () => {
                if (!file) return;
                if (type === 'image' && file.fileObj) {
                  const dataUrl = await compressImage(file.fileObj);
                  onConfirm(file.name, { size: file.size, dataUrl, file: file.fileObj });
                } else {
                  onConfirm(file.name, { size: file.size, dataUrl: null, file: null });
                }
              }}
              className="px-8 py-2.5 bg-primary text-white rounded-lg text-sm font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              {locale === 'vi' ? 'Xác nhận' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
