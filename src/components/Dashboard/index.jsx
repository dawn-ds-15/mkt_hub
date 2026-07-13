import { useEffect, useState } from 'react';
import { getDashboardData } from '../../services/api';
import KPICard from './KPICard';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardData().then((res) => {
      setData(res);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-on-surface-variant">Đang tải dữ liệu...</p>
      </div>
    );
  }

  const chartMax = Math.max(
    ...data.marketingActivities.map((a) => Math.max(a.plan, a.actual))
  );

  const donutData = [
    { color: '#10B981', offset: 25 },
    { color: '#2170E4', offset: 65 },
    { color: '#F59E0B', offset: 85 },
    { color: '#EF4444', offset: 96 },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-gutter">
        {data.kpis.map((kpi) => (
          <KPICard key={kpi.id} {...kpi} />
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-gutter">
        <div className="w-full lg:w-2/3 space-y-gutter">
          <div className="bg-white rounded-lg card-shadow border border-border-light p-widget-padding">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Phễu Chuyển Đổi Lead (Conversion Funnel)
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-secondary-container" /> Số lượng
                </span>
                <span className="text-[11px] text-on-surface-variant flex items-center gap-1 ml-4">
                  <span className="material-symbols-outlined text-[14px]">percent</span> Tỉ lệ CV
                </span>
              </div>
            </div>
            <div className="space-y-4">
              {data.funnel.map((item, idx) => (
                <div key={item.stage}>
                  <div className="flex items-center mb-1">
                    <span className="w-24 text-[11px] font-bold text-on-surface-variant">{item.stage}</span>
                    <div className="flex-1 bg-surface-container-low rounded-lg overflow-hidden h-10 flex items-center px-4 relative">
                      <div className={`${item.color} h-full absolute left-0 rounded-lg`}
                        style={{
                          width: idx === 0 ? '100%' : `${(item.value / data.funnel[0].value) * 100}%`,
                        }}
                      />
                      <span className="relative z-10 text-white font-bold text-sm">
                        {item.value.toLocaleString()} ({item.percent})
                      </span>
                    </div>
                  </div>
                  {item.cv && (
                    <div className={`ml-24 -mt-2 text-[10px] ${item.cvColor} font-bold`}>
                      ↑ CV: {item.cv}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg card-shadow border border-border-light p-widget-padding">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                Hoạt Động Marketing (Kế hoạch vs Thực tế)
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-primary rounded-sm" />
                  <span className="text-body-sm text-on-surface-variant">Kế hoạch</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 bg-secondary-container rounded-sm" />
                  <span className="text-body-sm text-on-surface-variant">Thực tế</span>
                </div>
              </div>
            </div>
            <div className="h-64 flex items-end justify-between gap-6 px-4">
              {data.marketingActivities.map((act) => (
                <div key={act.label} className="flex-1 flex items-end justify-center gap-1.5 h-full relative group">
                  <div
                    className="bg-primary w-full rounded-t-sm transition-all group-hover:opacity-80"
                    style={{ height: `${(act.plan / chartMax) * 100}%` }}
                  />
                  <div
                    className="bg-secondary-container w-full rounded-t-sm transition-all group-hover:opacity-80"
                    style={{ height: `${(act.actual / chartMax) * 100}%` }}
                  />
                  <p className="absolute -bottom-6 text-[10px] text-on-surface-variant font-bold">{act.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/3 space-y-gutter">
          <div className="bg-white rounded-lg card-shadow border border-border-light p-widget-padding">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Tiến Độ Dự Án</h3>
              <span className="text-primary font-bold text-headline-sm">68%</span>
            </div>
            <div className="space-y-5">
              {data.projectProgress.map((project) => (
                <div key={project.name} className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-on-surface-variant uppercase">
                    <span>{project.name}</span>
                    <span>{project.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full ${project.color} rounded-full`} style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg card-shadow border border-border-light p-widget-padding">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6">Trạng Thái Công Việc</h3>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="none" r="16" stroke="#E2E8F0" strokeWidth="4" />
                  <circle cx="18" cy="18" fill="none" r="16" stroke="#10B981" strokeDasharray="100" strokeDashoffset={donutData[0].offset} strokeWidth="4" />
                  <circle cx="18" cy="18" fill="none" r="16" stroke="#2170E4" strokeDasharray="100" strokeDashoffset={donutData[1].offset} strokeWidth="4" />
                  <circle cx="18" cy="18" fill="none" r="16" stroke="#F59E0B" strokeDasharray="100" strokeDashoffset={donutData[2].offset} strokeWidth="4" />
                  <circle cx="18" cy="18" fill="none" r="16" stroke="#EF4444" strokeDasharray="100" strokeDashoffset={donutData[3].offset} strokeWidth="4" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-headline-md font-bold text-primary">{data.taskStatus.total}</span>
                  <span className="text-[9px] uppercase font-bold text-outline">Tổng Task</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-body-sm text-on-surface-variant">Hoàn thành</span>
                  </div>
                  <span className="text-body-sm font-bold">{data.taskStatus.completed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary-container" />
                    <span className="text-body-sm text-on-surface-variant">Đang xử lý</span>
                  </div>
                  <span className="text-body-sm font-bold">{data.taskStatus.inProgress}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-warning" />
                    <span className="text-body-sm text-on-surface-variant">Chờ duyệt</span>
                  </div>
                  <span className="text-body-sm font-bold">{data.taskStatus.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-danger" />
                    <span className="text-body-sm text-on-surface-variant">Quá hạn</span>
                  </div>
                  <span className="text-body-sm font-bold">{data.taskStatus.overdue}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg card-shadow border border-border-light p-widget-padding">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Cảnh Báo Công Việc</h3>
            <div className="space-y-3">
              {data.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3 flex gap-3 ${
                    alert.type === 'error'
                      ? 'bg-red-50 border-l-4 border-danger'
                      : 'bg-amber-50 border-l-4 border-warning'
                  }`}
                >
                  <span className={`material-symbols-outlined text-lg ${
                    alert.type === 'error' ? 'text-danger' : 'text-warning'
                  }`}>
                    {alert.icon}
                  </span>
                  <div className="flex-1">
                    <p className={`text-body-sm font-bold ${
                      alert.type === 'error' ? 'text-red-800' : 'text-amber-800'
                    }`}>
                      {alert.title}
                    </p>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`text-[10px] font-medium ${
                        alert.type === 'error' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        Assignee: {alert.assignee}
                      </span>
                      <span className={`text-[10px] font-bold italic ${
                        alert.type === 'error' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        Due: {alert.due}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
