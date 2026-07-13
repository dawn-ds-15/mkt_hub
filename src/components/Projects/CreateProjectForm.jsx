export default function CreateProjectForm() {
  return (
    <div className="sticky top-24 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Tạo Dự án Mới</h3>
        <button className="text-on-surface-variant hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Tên Dự án</label>
          <input
            className="w-full px-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
            placeholder="VD: Báo cáo thường niên 2024"
            type="text"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">Loại</label>
            <select className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none appearance-none">
               <option>Social Media</option>
              <option>Chiến dịch</option>
              <option>Ra mắt Sản phẩm</option>
              <option>SEO/SEM</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-label-sm font-bold text-on-surface-variant uppercase">Trạng thái</label>
            <select className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none">
              <option>Đã lên kế hoạch</option>
              <option>Đang thực hiện</option>
              <option>Đang tạm dừng</option>
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Chủ sở hữu</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">person</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              placeholder="Gán chủ sở hữu..."
              type="text"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-label-sm font-bold text-on-surface-variant uppercase">Hạn chót</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">event</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              type="date"
            />
          </div>
        </div>
        <div className="border-t border-outline-variant pt-4 space-y-4">
          <div className="flex items-center justify-between">
              <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">Tài chính</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Ngân sách Direct</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="text" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Overhead</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md text-right focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="text" />
            </div>
          </div>
        </div>
        <div className="border-t border-outline-variant pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-label-sm font-bold text-on-surface-variant uppercase tracking-widest">KPI Hiệu suất</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Kế hoạch (Mục tiêu)</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="100,000" type="text" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase">Thực tế (Đạt được)</label>
              <input className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-body-md focus:ring-1 focus:ring-primary outline-none" placeholder="0" type="text" />
            </div>
          </div>
        </div>
        <button className="w-full py-3 bg-primary text-on-primary rounded font-bold text-label-md mt-6 hover:shadow-lg transition-all active:scale-[0.98]" type="submit">
          Lưu Thay đổi
        </button>
        <button className="w-full py-3 bg-transparent text-on-surface-variant border border-outline-variant rounded font-bold text-label-md hover:bg-surface-container transition-all" type="button">
          Đặt lại
        </button>
      </form>
    </div>
  );
}
