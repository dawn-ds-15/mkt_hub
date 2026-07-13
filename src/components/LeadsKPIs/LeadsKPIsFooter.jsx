export default function LeadsKPIsFooter() {
  const handleExportExcel = () => {
    alert('Tính năng Xuất File Excel đang được phát triển!');
  };

  const handleImportCSV = () => {
    alert('Tính năng Nhập từ CSV đang được phát triển!');
  };

  return (
    <footer className="bg-white border border-border-light rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-surface-container rounded-full">
          <span className="material-symbols-outlined text-on-surface-variant">help_center</span>
        </div>
        <div>
          <h5 className="text-label-md font-semibold text-on-surface">Hướng dẫn nhập liệu</h5>
          <p className="text-body-sm text-on-surface-variant">
            Mọi thắc mắc về phân bổ Plan hoặc chuyển đổi trạng thái Opportunities, vui lòng xem{' '}
            <a className="text-primary hover:underline" href="#">
              Tài liệu HDSD
            </a>.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 border border-border-light rounded text-body-sm font-medium text-on-surface-variant hover:bg-surface-container transition-all"
        >
          Xuất File Excel
        </button>
        <button
          onClick={handleImportCSV}
          className="px-4 py-2 border border-border-light rounded text-body-sm font-medium text-on-surface-variant hover:bg-surface-container transition-all"
        >
          Nhập từ CSV
        </button>
      </div>
    </footer>
  );
}
