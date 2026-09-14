import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, CalendarDays, ListChecks, CheckCheck } from 'lucide-react';
import { useDashboard } from '../../contexts/DashboardContext';
import { getTaskList } from '../../services/api';

const SEEN_KEY = 'mkt_hub_notif_seen';

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('mkt_hub_user');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function loadSeen() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function NotificationBell() {
  const { locale } = useDashboard();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const seenRef = useRef(loadSeen());

  const isMine = (task, user) => {
    if (!user) return false;
    if (task.assigneeId && user.id) return task.assigneeId === user.id;
    if (user.name) return (task.assignee?.name || '') === user.name;
    return false;
  };

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const check = async () => {
      try {
        const user = getCurrentUser();
        if (!user) return;
        const res = await getTaskList({});
        const tasks = res.data || [];
        const mine = tasks.filter((t) => isMine(t, user));
        setNotifications(mine.map((t) => ({
          id: t.id,
          title: t.taskName || '-',
          project: t.project || '',
          due: t.due || '',
          status: t.status || '',
        })));
        const fresh = mine.filter((t) => !seenRef.current[t.id]);
        setNewCount(fresh.length);
      } catch {
        // ignore polling errors
      }
    };

    check();
    timer = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const markRead = () => {
    const seen = { ...seenRef.current };
    notifications.forEach((n) => { seen[n.id] = true; });
    seenRef.current = seen;
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    setNewCount(0);
  };

  const handleBellClick = () => {
    setOpen((prev) => {
      if (!prev) markRead();
      return !prev;
    });
  };

  const handleItemClick = (n) => {
    setOpen(false);
    markRead();
    navigate('/tasks');
  };

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
          newCount > 0 ? 'bg-brand-600 text-white bell-shake' : 'text-slate-500 hover:bg-slate-100'
        }`}
        title={locale === 'vi' ? 'Thông báo' : 'Notifications'}
      >
        <Bell className="w-[22px] h-[22px]" />
        {newCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {newCount > 99 ? '99+' : newCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">{locale === 'vi' ? 'Thông báo' : 'Notifications'}</p>
              <span className="text-[11px] text-slate-500">
                {locale === 'vi' ? 'Giao task mới' : 'New task assignments'}
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <BellOff className="w-8 h-8 text-slate-300 mb-2 mx-auto" />
                  <p className="text-xs text-slate-500">{locale === 'vi' ? 'Chưa có thông báo nào' : 'No notifications yet'}</p>
                </div>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className="w-full px-4 py-2.5 text-left hover:bg-brand-50 transition-colors flex gap-3 cursor-pointer"
                >
                  <ListChecks className="w-[18px] h-[18px] text-brand-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{n.title}</p>
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 inline-block" />
                      {n.project}{n.due && n.due !== '-' ? ` · ${n.due}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={() => { setOpen(false); markRead(); }}
                className="w-full px-4 py-2 text-center text-xs font-semibold text-brand-600 hover:bg-brand-50 border-t border-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {locale === 'vi' ? 'Đánh dấu đã đọc' : 'Mark all as read'}
              </button>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes bellShake {
          0%, 100% { transform: rotate(0); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-15deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-10deg); }
          50% { transform: rotate(5deg); }
          60% { transform: rotate(-5deg); }
        }
        .bell-shake {
          animation: bellShake 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
