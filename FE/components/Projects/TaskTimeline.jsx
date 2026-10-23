import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTaskList, getProjects, getMembers, taskDateKey } from '../../services/api';
import { useDashboard } from '../../contexts/DashboardContext';
import { useTaskStatusOptions, statusLabelOf } from '../../hooks/useTaskStatusOptions';
import { currentUser } from '../../utils/permissions';

// Timeline task của team / cá nhân (feedback 26/09 T08): nhóm theo thành viên, mỗi hàng 1 task.
// Thanh chính = task (start → hạn chót) tô màu theo trạng thái task; ô nhỏ trên thanh = task nhỏ tại ngày cần hoàn thành,
// tô theo trạng thái: đã xong → Hoàn thành, qua ngày mà chưa xong → Quá hạn, còn lại → trạng thái của task cha.
// Màu trạng thái trùng với cột Kanban.
const STATUS_STYLE = {
  Overdue: { bar: 'bg-red-500/15 border-red-500', solid: 'bg-red-500', text: 'text-red-700' },
  Planning: { bar: 'bg-slate-400/15 border-slate-400', solid: 'bg-slate-400', text: 'text-slate-700' },
  Processing: { bar: 'bg-blue-500/15 border-blue-500', solid: 'bg-blue-500', text: 'text-blue-700' },
  Done: { bar: 'bg-emerald-500/15 border-emerald-500', solid: 'bg-emerald-500', text: 'text-emerald-700' },
  Pending: { bar: 'bg-purple-500/15 border-purple-500', solid: 'bg-purple-500', text: 'text-purple-700' },
  Cancel: { bar: 'bg-gray-400/15 border-gray-400', solid: 'bg-gray-400', text: 'text-gray-600' },
  Backlog: { bar: 'bg-amber-500/15 border-amber-500', solid: 'bg-amber-500', text: 'text-amber-700' },
};
const styleOf = (key) => STATUS_STYLE[key] || STATUS_STYLE.Planning;

const DAY_MS = 86400000;
const ROW_H = 36;
const LEFT_W = 280;
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utcOf = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const todayKey = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};
const fmt = (key) => (key ? key.split('-').reverse().join('/') : '—');

function presetRange(preset) {
  const n = new Date();
  const y = n.getFullYear();
  const m = n.getMonth();
  if (preset === 'quarter') {
    const q = Math.floor(m / 3);
    return { from: toKey(new Date(Date.UTC(y, q * 3, 1))), to: toKey(new Date(Date.UTC(y, q * 3 + 3, 0))) };
  }
  if (preset === 'next90') {
    const start = Date.UTC(y, m, n.getDate()) - 14 * DAY_MS;
    return { from: toKey(new Date(start)), to: toKey(new Date(start + 104 * DAY_MS)) };
  }
  return { from: toKey(new Date(Date.UTC(y, m, 1))), to: toKey(new Date(Date.UTC(y, m + 1, 0))) };
}

export default function TaskTimeline() {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);
  const navigate = useNavigate();
  const statusOptions = useTaskStatusOptions();

  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [scope, setScope] = useState('team');
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => presetRange('month'));
  const [hideDone, setHideDone] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const scrollRef = useRef(null);

  useEffect(() => {
    getProjects().then((res) => setProjects(Array.isArray(res.data) ? res.data : [])).catch(() => {});
    getMembers().then((res) => setMembers((res.data || []).filter((m) => m.active !== false))).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getTaskList({ project: projectId || undefined })
      .then((res) => { if (!cancelled) setTasks(res.data || []); })
      .catch(() => { if (!cancelled) setError(t('Không tải được danh sách task.', 'Could not load tasks.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  // "Cá nhân" = task của tài khoản đang đăng nhập
  const me = currentUser();
  const myMemberId = useMemo(() => {
    const hit = members.find((m) => (me.id && m.id === me.id) || (me.email && m.email === me.email));
    return hit?.id || me.id || '';
  }, [members, me.id, me.email]);
  const effectiveMemberId = scope === 'me' ? myMemberId : memberId;

  const fromUtc = utcOf(range.from);
  const toUtc = utcOf(range.to);
  const dayCount = Math.max(1, Math.round((toUtc - fromUtc) / DAY_MS) + 1);
  const dayW = dayCount <= 45 ? 32 : dayCount <= 120 ? 14 : 6;
  const gridW = dayCount * dayW;
  const today = todayKey();
  const dayIndex = (key) => Math.round((utcOf(key) - fromUtc) / DAY_MS);

  // Nhóm theo thành viên; chỉ giữ task có khoảng [bắt đầu, hạn chót] giao với khoảng đang xem
  const groups = useMemo(() => {
    const byMember = new Map();
    for (const task of tasks) {
      if (effectiveMemberId && task.assigneeId !== effectiveMemberId) continue;
      const statusKey = task.status === 'overdue' ? 'Overdue' : task.statusKey;
      if (hideDone && (statusKey === 'Done' || statusKey === 'Cancel')) continue;
      const due = taskDateKey(task.dueDate);
      const start = taskDateKey(task.startDate) || due;
      if (!start || !due) continue;
      const [s, e] = start <= due ? [start, due] : [due, start];
      if (e < range.from || s > range.to) continue;
      const key = task.assigneeId || '_none';
      if (!byMember.has(key)) byMember.set(key, { id: key, name: task.assignee?.name && task.assignee.name !== 'Unknown' ? task.assignee.name : t('Chưa giao', 'Unassigned'), tasks: [] });
      byMember.get(key).tasks.push({ ...task, statusKey, start: s, end: e });
    }
    const list = [...byMember.values()];
    list.forEach((g) => g.tasks.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)));
    return list.sort((a, b) => (a.id === '_none') - (b.id === '_none') || a.name.localeCompare(b.name));
  }, [tasks, effectiveMemberId, hideDone, range.from, range.to, locale]);

  const taskCount = groups.reduce((s, g) => s + g.tasks.length, 0);

  // Cuộn tới hôm nay khi mở / đổi khoảng thời gian
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || today < range.from || today > range.to) return;
    el.scrollLeft = Math.max(0, dayIndex(today) * dayW - el.clientWidth / 3);
  }, [range.from, range.to, dayW, loading]);

  // Tiêu đề: dải tháng + ngày (hoặc thứ Hai đầu tuần khi thu nhỏ)
  const months = [];
  const days = [];
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date(fromUtc + i * DAY_MS);
    const key = toKey(d);
    const label = `${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
    if (!months.length || months[months.length - 1].label !== label) months.push({ label, start: i, len: 1 });
    else months[months.length - 1].len += 1;
    days.push({ i, key, date: d.getUTCDate(), weekday: d.getUTCDay() });
  }

  const openTask = (task) => navigate(`/tasks?tab=tasks&taskId=${encodeURIComponent(task.id)}`);

  const applyPreset = (p) => {
    setPreset(p);
    if (p !== 'custom') setRange(presetRange(p));
  };

  const selectCls = 'border border-border-light rounded-lg px-2 py-1.5 text-[12px] text-on-surface bg-surface-container-lowest focus:ring-1 focus:ring-primary outline-none';

  const legendKeys = ['Planning', 'Processing', 'Pending', 'Done', 'Overdue', 'Backlog', 'Cancel'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-surface-container-lowest border border-border-light rounded-lg p-3">
        <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1">
          {[{ k: 'team', vi: 'Team', en: 'Team' }, { k: 'me', vi: 'Cá nhân', en: 'Mine' }].map((o) => (
            <button
              key={o.k}
              onClick={() => setScope(o.k)}
              className={`px-3 py-1 text-[12px] font-bold rounded-md transition-colors ${scope === o.k ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              {t(o.vi, o.en)}
            </button>
          ))}
        </div>
        {scope === 'team' && (
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className={selectCls} aria-label={t('Thành viên', 'Member')}>
            <option value="">{t('Tất cả thành viên', 'All members')}</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectCls} aria-label={t('Dự án', 'Project')}>
          <option value="">{t('Tất cả dự án', 'All projects')}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-surface-container-low rounded-lg p-1">
          {[{ k: 'month', vi: 'Tháng này', en: 'This month' }, { k: 'quarter', vi: 'Quý này', en: 'This quarter' }, { k: 'next90', vi: '3 tháng tới', en: 'Next 3 months' }, { k: 'custom', vi: 'Tùy chọn', en: 'Custom' }].map((o) => (
            <button
              key={o.k}
              onClick={() => applyPreset(o.k)}
              className={`px-3 py-1 text-[12px] font-bold rounded-md transition-colors ${preset === o.k ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-primary'}`}
            >
              {t(o.vi, o.en)}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
            <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className={selectCls} />
            <span>–</span>
            <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className={selectCls} />
          </div>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[12px] text-on-surface-variant cursor-pointer">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="accent-primary" />
          {t('Ẩn task đã xong / hủy', 'Hide done / cancelled')}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
        {legendKeys.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm ${styleOf(k).solid}`} />
            {statusLabelOf(statusOptions, k)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rotate-45 border border-on-surface-variant" />
          {t('Task nhỏ (ngày cần hoàn thành)', 'Sub-task (required date)')}
        </span>
        <span className="ml-auto">{t(`${taskCount} task · ${fmt(range.from)} – ${fmt(range.to)}`, `${taskCount} tasks · ${fmt(range.from)} – ${fmt(range.to)}`)}</span>
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="bg-surface-container-lowest border border-border-light rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] text-outline-variant animate-spin">sync</span>
          </div>
        ) : groups.length === 0 ? (
          <p className="py-16 text-center text-body-sm text-on-surface-variant">{t('Không có task nào trong khoảng thời gian này.', 'No tasks in this period.')}</p>
        ) : (
          <div ref={scrollRef} className="overflow-auto max-h-[70vh]">
            <div style={{ width: LEFT_W + gridW }} className="relative">
              {/* Header */}
              <div className="flex sticky top-0 z-20 bg-surface-container-lowest border-b border-border-light">
                <div style={{ width: LEFT_W }} className="shrink-0 sticky left-0 z-30 bg-surface-container-lowest border-r border-border-light px-3 flex items-end pb-1.5 text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  {t('Thành viên / Task', 'Member / Task')}
                </div>
                <div style={{ width: gridW }} className="shrink-0">
                  <div className="flex h-6 border-b border-border-light">
                    {months.map((mo) => (
                      <div key={mo.label} style={{ width: mo.len * dayW }} className="shrink-0 px-1.5 text-[11px] font-semibold text-on-surface border-r border-border-light truncate leading-6">
                        {t(`Tháng ${mo.label}`, mo.label)}
                      </div>
                    ))}
                  </div>
                  <div className="flex h-6">
                    {days.map((d) => {
                      const show = dayW >= 14 || d.weekday === 1;
                      return (
                        <div
                          key={d.key}
                          style={{ width: dayW }}
                          className={`shrink-0 text-center text-[10px] leading-6 tabular-nums ${d.key === today ? 'text-primary font-bold' : (d.weekday === 0 || d.weekday === 6) ? 'text-outline' : 'text-on-surface-variant'}`}
                        >
                          {show ? d.date : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Nền: cuối tuần + đường hôm nay */}
              <div className="absolute pointer-events-none" style={{ left: LEFT_W, top: 48, bottom: 0, width: gridW }}>
                {dayW >= 6 && days.filter((d) => d.weekday === 0 || d.weekday === 6).map((d) => (
                  <div key={d.key} className="absolute top-0 bottom-0 bg-surface-container/60" style={{ left: d.i * dayW, width: dayW }} />
                ))}
                {today >= range.from && today <= range.to && (
                  <div className="absolute top-0 bottom-0 w-px bg-primary z-[2]" style={{ left: dayIndex(today) * dayW + dayW / 2 }} title={t('Hôm nay', 'Today')} />
                )}
              </div>

              {groups.map((g) => {
                const isCollapsed = collapsed.has(g.id);
                return (
                  <div key={g.id}>
                    <button
                      type="button"
                      onClick={() => setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(g.id)) next.delete(g.id); else next.add(g.id);
                        return next;
                      })}
                      className="flex w-full text-left bg-surface-muted/70 border-b border-border-light hover:bg-surface-muted relative z-[5]"
                      style={{ height: 30 }}
                    >
                      <span style={{ width: LEFT_W }} className="shrink-0 sticky left-0 bg-surface-muted px-3 flex items-center gap-1.5 text-[12px] font-bold text-on-surface border-r border-border-light">
                        <span className={`material-symbols-outlined text-[16px] transition-transform ${isCollapsed ? '-rotate-90' : ''}`}>expand_more</span>
                        <span className="truncate">{g.name}</span>
                        <span className="text-[11px] font-medium text-on-surface-variant">({g.tasks.length})</span>
                      </span>
                    </button>
                    {!isCollapsed && g.tasks.map((task) => {
                      const s = Math.max(0, dayIndex(task.start));
                      const e = Math.min(dayCount - 1, dayIndex(task.end));
                      const st = styleOf(task.statusKey);
                      const clippedLeft = task.start < range.from;
                      const clippedRight = task.end > range.to;
                      const doneSubs = task.subtasks.filter((x) => x.done).length;
                      const barW = (e - s + 1) * dayW;
                      return (
                        <div key={task.id} className="flex border-b border-border-light/60 hover:bg-primary/5 relative" style={{ height: ROW_H }}>
                          <button
                            type="button"
                            onClick={() => openTask(task)}
                            style={{ width: LEFT_W }}
                            className="shrink-0 sticky left-0 z-[5] bg-surface-container-lowest border-r border-border-light px-3 pl-8 text-left flex flex-col justify-center min-w-0 hover:text-primary"
                            title={task.taskName}
                          >
                            <span className="text-[12px] font-medium text-on-surface truncate">{task.taskName}</span>
                            <span className="text-[10px] text-on-surface-variant truncate">{task.project}</span>
                          </button>
                          <div className="relative shrink-0" style={{ width: gridW }}>
                            <button
                              type="button"
                              onClick={() => openTask(task)}
                              className={`absolute top-1.5 bottom-1.5 border ${st.bar} ${clippedLeft ? 'rounded-l-none border-l-0' : 'rounded-l-md border-l-4'} ${clippedRight ? 'rounded-r-none border-r-0' : 'rounded-r-md'} flex items-center overflow-hidden text-left hover:brightness-95`}
                              style={{ left: s * dayW + 1, width: Math.max(barW - 2, 6) }}
                              title={[
                                task.taskName,
                                task.project,
                                `${fmt(task.start)} → ${fmt(task.end)}`,
                                statusLabelOf(statusOptions, task.statusKey),
                                task.subtasks.length ? t(`Task nhỏ: ${doneSubs}/${task.subtasks.length} xong`, `Sub-tasks: ${doneSubs}/${task.subtasks.length} done`) : '',
                              ].filter(Boolean).join('\n')}
                            >
                              {barW > 70 && (
                                <span className={`px-1.5 text-[11px] font-semibold truncate ${st.text}`}>{task.taskName}</span>
                              )}
                            </button>
                            {/* Task nhỏ tại ngày cần hoàn thành */}
                            {task.subtasks.map((sub, idx) => {
                              const key = taskDateKey(sub.doneDate);
                              if (!key || key < range.from || key > range.to) return null;
                              const subKey = sub.done ? 'Done' : key < today ? 'Overdue' : (task.statusKey === 'Overdue' ? 'Processing' : task.statusKey);
                              return (
                                <span
                                  key={sub.id || idx}
                                  className={`absolute w-3 h-3 rotate-45 rounded-[2px] ring-2 ring-surface-container-lowest ${styleOf(subKey).solid} z-[3]`}
                                  style={{ left: dayIndex(key) * dayW + dayW / 2 - 6, top: ROW_H / 2 - 6 }}
                                  title={`${sub.text}\n${fmt(key)} · ${sub.done ? t('Đã xong', 'Done') : statusLabelOf(statusOptions, subKey)}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-on-surface-variant">
        {t(
          'Bấm vào task để mở và cập nhật. Ô nhỏ hình thoi là task nhỏ, đặt tại "ngày cần hoàn thành" nhập trong checklist của task.',
          'Click a task to open it. Diamonds are sub-tasks placed at their required date from the task checklist.'
        )}
      </p>
    </div>
  );
}
