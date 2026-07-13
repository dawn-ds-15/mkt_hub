export default function PortfolioSummary() {
  return (
    <div className="bg-primary text-on-primary rounded-xl p-6">
        <h4 className="font-headline-sm text-headline-sm mb-4">Tổng quan Danh mục</h4>
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-on-primary-fixed-variant pb-2">
          <span className="text-label-md opacity-80">Tổng Ngân sách</span>
          <span className="text-headline-sm font-bold">$1.2M</span>
        </div>
        <div className="flex justify-between items-center border-b border-on-primary-fixed-variant pb-2">
          <span className="text-label-md opacity-80">Tiến độ TB</span>
          <span className="text-headline-sm font-bold">42%</span>
        </div>
        <div className="flex justify-between items-center border-b border-on-primary-fixed-variant pb-2">
          <span className="text-label-md opacity-80">Vấn đề Tồn đọng</span>
          <span className="text-headline-sm font-bold text-tertiary-fixed">14</span>
        </div>
      </div>
    </div>
  );
}
