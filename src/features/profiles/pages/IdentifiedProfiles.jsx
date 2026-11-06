import LoadState from '@/features/profiles/components/LoadState';
import { downloadCsv } from '@/features/profiles/utils/profileExport';
import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '@/shared/stores/DashboardContext';
import {
  salesList, marketingOwners,
  projectOptions, funnelStages,
} from '@/shared/mocks/profiles';
import {
  getLeads, getLeadsFunnelOverview, getLeadsReturns, handoverLead, updateLead,
  getCompanies, getSlaQueue, mergeCompanies, claimSlaQueueItem, resolveSlaQueueItem, skipSlaQueueItem,
} from '@/shared/api/httpClient';
import { normalizeLead, normalizeSlaItem, normalizeCompany } from '@/features/profiles/utils/normalizeProfiles';
import {
  Card, SectionTitle, Badge, KpiCard, Toolbar, SearchInput, Select, Button, TabBar,
  Modal, Field, Input, Textarea, Checkbox, Toast, Th, Td, EmptyState,
} from '@/features/profiles/components/ui';

const funnelOptions = [{ value: 'all', label: 'Funnel: Tất cả' }, ...funnelStages.map((s) => ({ value: s, label: s }))];
const tierOptions = [
  { value: 'all', label: 'Điểm: Tất cả' },
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];
const ownerOptions = [{ value: 'all', label: 'Owner: Tất cả' }, ...marketingOwners.map((o) => ({ value: o, label: o }))];
const salesOptions = [
  { value: 'all', label: 'Sales: Tất cả' },
  { value: 'unassigned', label: 'Chưa bàn giao' },
  ...salesList.map((s) => ({ value: s.name, label: s.name })),
];
const projectFilterOptions = [{ value: 'all', label: 'Dự án: Tất cả' }, ...projectOptions.filter((p) => p !== '—').map((p) => ({ value: p, label: p }))];

const fmtCurrency = (n) => {
  if (!n) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} tr`;
  return Number(n).toLocaleString('vi-VN');
};

const tierTone = (tier) => (tier === 'hot' ? 'danger' : tier === 'warm' ? 'warm' : 'neutral');
const funnelTone = (f) => (f === 'MQL' ? 'info' : f === 'SQL' ? 'purple' : f === 'OPP' ? 'warm' : f === 'Won' ? 'active' : 'neutral');

export default function IdentifiedProfiles() {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState('overview');
  const [leads, setLeads] = useState([]);
  const [queue, setQueue] = useState([]);
  const [companyList, setCompanyList] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [funnel, setFunnel] = useState('all');
  const [tier, setTier] = useState('all');
  const [owner, setOwner] = useState('all');
  const [sales, setSales] = useState('all');
  const [project, setProject] = useState('all');
  const [toast, setToast] = useState('');
  const [handoverLead, setHandoverLead] = useState(null);
  const [handoverSales, setHandoverSales] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeFrom, setMergeFrom] = useState('');
  const [mergeTo, setMergeTo] = useState('');
  const [detailTab, setDetailTab] = useState('overview');
  const [returnFilter, setReturnFilter] = useState(false);
  const [queueFilter, setQueueFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [leadsRes, compRes, qRes] = await Promise.all([
          getLeads(),
          getCompanies(),
          getSlaQueue(),
        ]);
        if (cancelled) return;
        if (Array.isArray(leadsRes?.data)) {
          const nextLeads = leadsRes.data.map(normalizeLead);
          setLeads(nextLeads);
          setSelectedId((current) => (nextLeads.some((l) => l.id === current) ? current : nextLeads[0]?.id || ''));
        }
        if (Array.isArray(compRes?.data)) {
          const nextCompanies = compRes.data.map(normalizeCompany);
          setCompanyList(nextCompanies);
          setMergeFrom((current) => (nextCompanies.some((c) => c.code === current) ? current : nextCompanies[1]?.code || nextCompanies[0]?.code || ''));
          setMergeTo((current) => (nextCompanies.some((c) => c.code === current) ? current : nextCompanies[0]?.code || ''));
        }
        const qItems = qRes?.data?.items || qRes?.data;
        if (Array.isArray(qItems)) setQueue(qItems.map(normalizeSlaItem));
      } catch (err) {
        if (!cancelled) setLoadError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (funnel !== 'all' && l.funnel !== funnel) return false;
      if (tier !== 'all' && l.tier !== tier) return false;
      if (owner !== 'all' && l.owner !== owner) return false;
      if (sales === 'unassigned' && l.sales) return false;
      if (sales !== 'all' && sales !== 'unassigned' && l.sales !== sales) return false;
      if (project !== 'all' && l.project !== project) return false;
      if (returnFilter && !l.isReturn) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [l.id, l.name, l.company || '', l.phone, l.email || '', l.sales || '', l.owner || ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, funnel, tier, owner, sales, project, search, returnFilter]);

  const selected = leads.find((l) => l.id === selectedId) || filteredLeads[0] || leads[0];

  if (loading || loadError) return <LoadState loading={loading} error={loadError} onRetry={() => setReload((n) => n + 1)} />;

  const totalLeads = leads.length;
  const mql = leads.filter((l) => ['MQL', 'SQL', 'OPP', 'Won'].includes(l.funnel)).length;
  const sql = leads.filter((l) => ['SQL', 'OPP', 'Won'].includes(l.funnel)).length;
  const opp = leads.filter((l) => ['OPP', 'Won'].includes(l.funnel)).length;
  const won = leads.filter((l) => l.funnel === 'Won').length;
  const pipeline = leads.reduce((s, l) => s + (l.oppValue || 0), 0);
  const wonValue = leads.reduce((s, l) => s + (l.wonValue || 0), 0);
  const unassigned = leads.filter((l) => !l.sales).length;
  const handedOver = leads.filter((l) => l.handoverAt).length;
  const funnelKpis = [{ stage: t('Lead bàn giao', 'Leads handed over'), actual: handedOver }, ...['MQL', 'SQL', 'OPP', 'Won'].map((stage) => ({ stage, actual: leads.filter((l) => l.funnel === stage).length }))];
  const missingData = leads.filter((l) => !l.company || !l.need).length;
  const returning = leads.filter((l) => l.isReturn).length;

  const openHandover = (lead) => {
    setHandoverLead(lead);
    setHandoverSales(lead.sales || '');
    setHandoverNote('');
  };

  const confirmHandover = async () => {
    if (!handoverSales) {
      notify(t('Vui lòng chọn Sales phụ trách.', 'Please select a sales owner.'));
      return;
    }
    try {
      await handoverLead(handoverLead.id, { salesId: handoverSales, salesName: handoverSales, note: handoverNote });
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setLeads((prev) =>
      prev.map((l) =>
        l.id === handoverLead.id
          ? {
              ...l,
              sales: handoverSales,
              handoverAt: new Date().toLocaleDateString('vi-VN'),
              handoverScore: l.score,
              handoverTier: l.tier,
              funnel: l.funnel === 'Raw Lead' ? 'MQL' : l.funnel,
            }
          : l
      )
    );
    setHandoverLead(null);
    notify(t('Đã ghi nhận bàn giao và lưu snapshot điểm.', 'Handover recorded with score snapshot.'));
  };

  const openEdit = (lead) => {
    setEditLead(lead);
    setEditForm({
      name: lead.name,
      phone: lead.phone,
      email: lead.email || '',
      company: lead.company || '',
      title: lead.title || '',
      owner: lead.owner || '',
      sales: lead.sales || '',
      products: (lead.products || []).join(', '),
      need: lead.need || '',
      project: lead.project || '—',
    });
  };

  const saveEdit = async () => {
    try {
      await updateLead(editLead.id, {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        company: editForm.company,
        title: editForm.title,
        owner: editForm.owner,
        sales: editForm.sales,
        products: editForm.products ? editForm.products.split(',').map((x) => x.trim()).filter(Boolean) : [],
        need: editForm.need,
        project: editForm.project === '—' ? null : editForm.project,
      });
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setLeads((prev) =>
      prev.map((l) =>
        l.id === editLead.id
          ? {
              ...l,
              name: editForm.name || l.name,
              phone: editForm.phone || l.phone,
              email: editForm.email || null,
              company: editForm.company || null,
              title: editForm.title || null,
              owner: editForm.owner || null,
              sales: editForm.sales || null,
              products: editForm.products ? editForm.products.split(',').map((x) => x.trim()).filter(Boolean) : [],
              need: editForm.need || null,
              project: editForm.project === '—' ? null : editForm.project,
            }
          : l
      )
    );
    setEditLead(null);
    setEditForm(null);
    notify(t('Đã lưu thay đổi và ghi audit giá trị trước/sau.', 'Changes saved with before/after audit.'));
  };

  const setQueueStatus = async (item, nextStatus, label) => {
    try {
      if (nextStatus === 'processing') await claimSlaQueueItem(item.id);
      else if (nextStatus === 'done') await resolveSlaQueueItem(item.id, { resolution: 'done' });
      else if (nextStatus === 'skipped') await skipSlaQueueItem(item.id, { reason: label });
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, status: nextStatus, owner: q.owner || t('Bạn', 'You') } : q)));
    notify(label);
  };

  const handleMergeCompanies = async () => {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) {
      notify(t('Hai Company Master phải khác nhau.', 'The two companies must differ.'));
      return;
    }
    try {
      await mergeCompanies({ fromCode: mergeFrom, toCode: mergeTo, note: 'FE merge' });    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
      return;
    }
    const from = companyList.find((c) => c.code === mergeFrom);
    const to = companyList.find((c) => c.code === mergeTo);
    if (from && to) {
      setCompanyList((prev) =>
        prev
          .filter((c) => c.code !== mergeFrom)
          .map((c) =>
            c.code === mergeTo
              ? { ...c, leads: c.leads + (from.leads || 0), pipeline: c.pipeline + (from.pipeline || 0), won: c.won + (from.won || 0), aliases: [...(c.aliases || []), ...(from.aliases || [])] }
              : c
          )
      );
      setLeads((prev) => prev.map((l) => (l.company === from.name ? { ...l, company: to.name } : l)));
    }
    setMergeOpen(false);
    notify(t(`Đã hợp nhất ${mergeFrom} vào ${mergeTo}. `, `Merged ${mergeFrom} into ${mergeTo}. `));
  };

  const tabItems = [
    { key: 'overview', label: t('Tổng quan Funnel', 'Funnel Overview') },
    { key: 'leads', label: t('Danh sách Lead', 'Lead List'), count: leads.length },
    { key: 'companies', label: t('Công ty', 'Companies'), count: companyList.length },
    { key: 'queue', label: t('Dữ liệu cần xử lý', 'Data Review'), count: queue.filter((q) => ['new', 'processing'].includes(q.status)).length },
    { key: 'alerts', label: t('Cảnh báo quay lại', 'Return Alerts'), count: leads.filter((l) => l.isReturn).length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[22px]">how_to_reg</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline-md text-[20px] font-bold text-on-surface tracking-tight">
                {t('Hồ sơ định danh 360', 'Identified Profile 360')}
              </h1>
              <Badge tone="active">BDD-03</Badge>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t('Dữ liệu đã tải', 'Loaded data')}
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
              {t('Customer 360 · Lead Scoring · Funnel & Bàn giao · Dự án nguồn', 'Customer 360 · Lead Scoring · Funnel & Handover · Source project')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-on-surface-variant">{t('Thống kê trên dữ liệu đã tải', 'Statistics for loaded records')}</span>
          <Button variant="secondary" onClick={() => downloadCsv('identified-profiles.csv', filteredLeads.map(({ id, name, phone, email, company, funnel, score, owner, sales }) => ({ id, name, phone, email, company, funnel, score, owner, sales })))}>
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            {t('Xuất', 'Export')}
          </Button>
          <Button variant="primary" onClick={() => setTab('leads')}>
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            {t('Danh sách Lead', 'Lead list')}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <TabBar tabs={tabItems} active={tab} onChange={setTab} />

        {tab === 'overview' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
              <KpiCard label={t('Lead bàn giao', 'Leads handed over')} value={handedOver} icon={() => <span className="material-symbols-outlined text-[18px]">handshake</span>} />
              <KpiCard label="MQL" value={mql} icon={() => <span className="material-symbols-outlined text-[18px]">filter_alt</span>} />
              <KpiCard label="SQL" value={sql} icon={() => <span className="material-symbols-outlined text-[18px]">verified</span>} />
              <KpiCard label="OPP" value={opp} sub={`${fmtCurrency(pipeline)} pipeline`} icon={() => <span className="material-symbols-outlined text-[18px]">target</span>} />
              <KpiCard label={t('Chốt deal (Won)', 'Won deals')} value={won} sub={`${fmtCurrency(wonValue)} won`} icon={() => <span className="material-symbols-outlined text-[18px]">workspace_premium</span>} />
              <KpiCard label={t('Hiệu quả chi phí', 'Unit economics')} value="—" icon={() => <span className="material-symbols-outlined text-[18px]">query_stats</span>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <button onClick={() => { setReturnFilter(true); setTab('leads'); }} className="text-left flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/60 hover:bg-red-50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">notifications_active</span>
                  </div>
                  <div>
                    <div className="font-headline-sm text-[13px] font-bold text-red-700">{returning} {t('Lead quay lại online', 'leads returned online')}</div>
                    <div className="font-body-sm text-[11px] text-red-700/80">{t('Tương tác lại sau >90 ngày im lặng', 'Re-engaged after >90 days of silence')}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-red-600">arrow_forward</span>
              </button>
              <button onClick={() => setTab('queue')} className="text-left flex items-center justify-between p-3 rounded-xl border border-outline-variant/60 bg-surface-container-high hover:bg-surface-container-highest transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-highest text-on-surface flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">rule_folder</span>
                  </div>
                  <div>
                    <div className="font-headline-sm text-[13px] font-bold text-on-surface">{missingData} {t('hồ sơ thiếu dữ liệu', 'records missing data')}</div>
                    <div className="font-body-sm text-[11px] text-on-surface-variant">{t('Cần chuẩn hóa trước khi giao Sales', 'Clean up before handing over to Sales')}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
              </button>
              <button onClick={() => { setSales('unassigned'); setTab('leads'); }} className="text-left flex items-center justify-between p-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">person_off</span>
                  </div>
                  <div>
                    <div className="font-headline-sm text-[13px] font-bold text-on-surface">{unassigned} {t('Lead chưa gán Sales', 'leads without Sales')}</div>
                    <div className="font-body-sm text-[11px] text-on-surface-variant">{t('SLA vượt 2 giờ làm việc', 'SLA exceeded 2 working hours')}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
              <div className="xl:col-span-7 rounded-xl border border-outline-variant/60 overflow-hidden">
                <SectionTitle title={t('Funnel throughput · Actual / Plan', 'Funnel throughput · Actual / Plan')} subtitle={t('Thống kê trên dữ liệu đã tải', 'Statistics for loaded records')} />
                <table className="w-full">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <Th>{t('Giai đoạn', 'Stage')}</Th>
                      <Th className="text-right">Actual</Th>
                      <Th className="text-right">Plan</Th>
                      <Th className="text-right">% Plan</Th>
                      <Th>{t('Chuyển đổi', 'Conversion')}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {funnelKpis.map((f) => {
                      const pct = f.plan ? Math.round((f.actual / f.plan) * 100) : null;
                      return (
                        <tr key={f.stage} className="hover:bg-surface-container-low">
                          <Td><span className="font-semibold">{f.stage}</span></Td>
                          <Td className="text-right num font-semibold">{f.actual}</Td>
                          <Td className="text-right num text-on-surface-variant">{f.plan ?? '—'}</Td>
                          <Td className="text-right">
                            <span className={`num font-semibold ${pct >= 100 ? 'text-emerald-600' : pct >= 80 ? 'text-amber-600' : 'text-red-600'}`}>{pct == null ? '—' : `${pct}%`}</span>
                          </Td>
                          <Td>
                            {f.conv ? <span className="font-label-sm text-[10px] text-on-surface-variant">{f.conv}</span> : <span className="text-outline">—</span>}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-2 border-t border-outline-variant/40 font-body-sm text-[10px] text-on-surface-variant">
                  {t('Số lượng Funnel tính theo ngày MKT nhấn chuyển; mỗi Lead chỉ tính một lần tại mỗi giai đoạn.', 'Funnel counts use the manual stage-change date; each Lead counts once per stage.')}
                </div>
              </div>

              <div className="xl:col-span-5 rounded-xl border border-outline-variant/60 overflow-hidden">
                <SectionTitle title={t('Điểm & Phân loại theo Owner', 'Score & Tier by Owner')} subtitle={t('Cold/Warm/Hot độc lập với Funnel', 'Cold/Warm/Hot is independent from Funnel')} />
                <div className="p-3 space-y-2">
                  {marketingOwners.map((o) => {
                    const own = leads.filter((l) => l.owner === o);
                    const hot = own.filter((l) => l.tier === 'hot').length;
                    const warm = own.filter((l) => l.tier === 'warm').length;
                    const cold = own.filter((l) => l.tier === 'cold').length;
                    const total = own.length || 1;
                    return (
                      <div key={o} className="p-2 rounded-lg bg-surface-container-low">
                        <div className="flex items-center justify-between">
                          <span className="font-body-sm text-[12px] font-medium text-on-surface">{o}</span>
                          <span className="font-mono text-[10px] text-on-surface-variant">{own.length} Lead</span>
                        </div>
                        <div className="flex h-1.5 rounded-full overflow-hidden mt-1.5 bg-surface-container-high">
                          <div className="bg-red-500" style={{ width: `${(hot / total) * 100}%` }} />
                          <div className="bg-amber-400" style={{ width: `${(warm / total) * 100}%` }} />
                          <div className="bg-slate-400" style={{ width: `${(cold / total) * 100}%` }} />
                        </div>
                        <div className="flex gap-3 mt-1 font-label-sm text-[9px] text-on-surface-variant">
                          <span>Hot {hot}</span><span>Warm {warm}</span><span>Cold {cold}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="p-2 rounded-lg border border-dashed border-outline-variant/70 font-body-sm text-[10px] text-on-surface-variant">
                    {t('Điểm tại bàn giao được giữ cố định; Điểm hiện tại tiếp tục cập nhật sau bàn giao và có thể tạo tín hiệu tăng ưu tiên.', 'Handover score is frozen; current score keeps updating after handover and can raise priority.')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'leads' && (
          <>
            <Toolbar>
              <div className="flex-1 min-w-[220px]">
                <SearchInput value={search} onChange={setSearch} placeholder={t('Tìm tên, SĐT, email, Lead ID, công ty…', 'Search name, phone, email, Lead ID, company…')} />
              </div>
              <Select value={funnel} onChange={setFunnel} options={funnelOptions} />
              <Select value={tier} onChange={setTier} options={tierOptions} />
              <Select value={owner} onChange={setOwner} options={ownerOptions} />
              <Select value={sales} onChange={setSales} options={salesOptions} />
              <Select value={project} onChange={setProject} options={projectFilterOptions} />
              {(returnFilter || search || funnel !== 'all' || tier !== 'all' || owner !== 'all' || sales !== 'all' || project !== 'all') && (
                <button
                  onClick={() => { setReturnFilter(false); setSearch(''); setFunnel('all'); setTier('all'); setOwner('all'); setSales('all'); setProject('all'); }}
                  className="font-label-sm text-[11px] text-secondary hover:underline px-1"
                >
                  {t('Xóa bộ lọc', 'Clear filters')}
                </button>
              )}
              <span className="ml-auto font-body-sm text-[11px] text-on-surface-variant">{filteredLeads.length} / {leads.length}</span>
            </Toolbar>

            <div className="grid grid-cols-1 xl:grid-cols-12">
              <div className="xl:col-span-8 xl:border-r border-outline-variant/60 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <Th>Lead</Th>
                      <Th>{t('Công ty', 'Company')}</Th>
                      <Th className="text-center">{t('Điểm', 'Score')}</Th>
                      <Th>Funnel</Th>
                      <Th>{t('Bàn giao', 'Handover')}</Th>
                      <Th>{t('Cảnh báo', 'Alerts')}</Th>
                      <Th>Owner</Th>
                      <Th>Sales</Th>
                      <Th>{t('Nguồn / Dự án', 'Source / Project')}</Th>
                      <Th>{t('Tương tác cuối', 'Last interaction')}</Th>
                      <Th className="text-right">{t('Hành động', 'Actions')}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/40">
                    {filteredLeads.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => { setSelectedId(l.id); setDetailTab('overview'); }}
                        className={`cursor-pointer transition-colors ${selected?.id === l.id ? 'bg-emerald-50/60' : 'hover:bg-surface-container-low'}`}
                      >
                        <Td>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-semibold text-[10px] shrink-0">
                              {l.initials}
                            </div>
                            <div>
                              <div className={`font-semibold text-[12px] ${String(l.name || '').startsWith('Chưa') ? 'italic font-normal text-on-surface-variant' : 'text-on-surface'}`}>{l.name}</div>
                              <div className="font-mono text-[9px] text-on-surface-variant">{l.id}</div>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="text-[11px]">{l.company || <span className="italic text-on-surface-variant">{t('Chưa cập nhật', 'Not set')}</span>}</div>
                          <div className="text-[9px] text-outline">{l.title || '—'}</div>
                        </Td>
                        <Td className="text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className={`text-[13px] font-bold num ${l.tier === 'hot' ? 'text-red-600' : l.tier === 'warm' ? 'text-amber-600' : 'text-slate-500'}`}>{l.score}</span>
                            <Badge tone={tierTone(l.tier)}>{l.tier}</Badge>
                          </div>
                        </Td>
                        <Td><Badge tone={funnelTone(l.funnel)}>{l.funnel}</Badge></Td>
                        <Td>
                          {l.handoverAt ? (
                            <div>
                              <div className="text-[10px] text-on-surface">{l.handoverAt}</div>
                              <div className="font-label-sm text-[9px] text-on-surface-variant">
                                {t('Điểm', 'Score')} {l.handoverScore} · {l.handoverTier}
                              </div>
                            </div>
                          ) : (
                            <span className="font-label-sm text-[9px] text-amber-600">{t('Chưa bàn giao', 'Not handed over')}</span>
                          )}
                        </Td>
                        <Td>
                          {l.isReturn ? (
                            <Badge tone="danger" dot>{t('Quay lại', 'Returned')}</Badge>
                          ) : !l.company || !l.need ? (
                            <Badge tone="warm">{t('Thiếu dữ liệu', 'Missing')}</Badge>
                          ) : (
                            <span className="text-outline">—</span>
                          )}
                        </Td>
                        <Td className="text-[11px]">{l.owner || <span className="italic text-red-500">{t('Chưa có', 'None')}</span>}</Td>
                        <Td className="text-[11px]">{l.sales || <span className="text-outline">—</span>}</Td>
                        <Td>
                          <div className="text-[10px] text-on-surface">{l.source}</div>
                          <div className="text-[9px] text-on-surface-variant">{l.project || '—'}</div>
                        </Td>
                        <Td className="text-[10px] text-on-surface-variant whitespace-nowrap">{l.lastActivity}</Td>
                        <Td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); openHandover(l); }}
                              title={t('Bàn giao', 'Hand over')}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              <span className="material-symbols-outlined text-[15px]">handshake</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openEdit(l); }}
                              title={t('Chỉnh sửa', 'Edit')}
                              className="p-1.5 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredLeads.length && <EmptyState message={t('Không có Lead khớp bộ lọc.', 'No leads match the filters.')} />}
              </div>

              <div className="xl:col-span-4">
                {selected ? (
                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-[12px]">
                        {selected.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-headline-sm text-[14px] font-bold text-on-surface">{selected.name}</span>
                          <Badge tone={funnelTone(selected.funnel)}>{selected.funnel}</Badge>
                          <Badge tone={tierTone(selected.tier)}>{selected.tier} · {selected.score}</Badge>
                        </div>
                        <div className="font-mono text-[10px] text-on-surface-variant">{selected.id} · {selected.company || '—'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 border-b border-outline-variant/40 pb-1 overflow-x-auto">
                      {[
                        { k: 'overview', l: t('Hồ sơ', 'Profile') },
                        { k: 'journey', l: t('Hành trình', 'Journey') },
                        { k: 'score', l: t('Điểm', 'Score') },
                        { k: 'handover', l: t('Bàn giao', 'Handover') },
                      ].map((x) => (
                        <button
                          key={x.k}
                          onClick={() => setDetailTab(x.k)}
                          className={`px-2 py-1 rounded-md font-label-md text-[10px] whitespace-nowrap ${detailTab === x.k ? 'bg-primary-fixed text-on-primary-fixed font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                        >
                          {x.l}
                        </button>
                      ))}
                    </div>

                    {detailTab === 'overview' && (
                      <div className="space-y-2">
                        <div className="space-y-1.5">
                          {[
                            { l: t('Số điện thoại chính', 'Primary phone'), v: selected.phone },
                            { l: t('Số phụ', 'Secondary phones'), v: (selected.phones || []).slice(1).join(', ') || '—' },
                            { l: t('Email chính', 'Primary email'), v: selected.email || '—' },
                            { l: t('Email phụ', 'Secondary emails'), v: (selected.emails || []).slice(1).join(', ') || '—' },
                            { l: t('Quốc gia', 'Country'), v: selected.country || '—' },
                            { l: t('Chức danh', 'Job title'), v: selected.title || '—' },
                          ].map((x) => (
                            <div key={x.l} className="flex justify-between gap-3">
                              <span className="font-body-sm text-[10px] text-on-surface-variant">{x.l}</span>
                              <span className="font-body-sm text-[11px] text-on-surface text-right">{x.v}</span>
                            </div>
                          ))}
                        </div>
                        <div className="p-2 rounded-lg bg-surface-container-low">
                          <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant">{t('Sản phẩm quan tâm', 'Interested products')}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(selected.products || []).length ? (selected.products || []).map((p) => <Badge key={p} tone="info">{p}</Badge>) : <span className="text-[11px] text-outline">—</span>}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-surface-container-low">
                          <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant">{t('Nhu cầu hiện tại', 'Current need')}</div>
                          <div className="font-body-sm text-[11px] text-on-surface mt-0.5">{selected.need || <span className="italic text-on-surface-variant">{t('Chưa tổng hợp', 'Not summarized')}</span>}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-lg bg-surface-container-low">
                            <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant">Marketing Owner</div>
                            <div className="text-[11px] text-on-surface font-medium">{selected.owner || '—'}</div>
                          </div>
                          <div className="p-2 rounded-lg bg-surface-container-low">
                            <div className="font-label-sm text-[9px] uppercase tracking-wider text-on-surface-variant">Sales</div>
                            <div className={`text-[11px] font-medium ${selected.sales ? 'text-on-surface' : 'italic text-amber-600'}`}>{selected.sales || t('Chưa bàn giao', 'Not assigned')}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detailTab === 'journey' && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-label-md text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant">{t('Hành trình xuyên suốt', 'End-to-end journey')}</span>
                          <span className="font-label-sm text-[9px] text-outline">{t('Ẩn danh → Định danh', 'Anonymous → Identified')}</span>
                        </div>
                        {[
                          { event: 'identified', detail: t('Định danh bằng SĐT', 'Identified by phone') + ' · ' + selected.identifiedAt, time: selected.identifiedAt, chip: t('Định danh', 'Identified'), tone: 'active' },
                          { event: 'form_submit', detail: t('Form website · ', 'Website form · ') + selected.source, time: selected.createdAt, chip: t('Form', 'Form'), tone: 'info' },
                          { event: 'page_view', detail: selected.lastTouch, time: selected.lastActivity, chip: t('Website', 'Website'), tone: 'neutral' },
                          { event: 'document_download', detail: t('Tải tài liệu · Whitepaper', 'Document download · Whitepaper'), time: t('2 ngày trước', '2 days ago'), chip: t('Tài liệu', 'Document'), tone: 'neutral' },
                          { event: 'chat_interaction', detail: t('Chat tư vấn · 4 tin nhắn', 'Chat · 4 messages'), time: t('5 ngày trước', '5 days ago'), chip: t('Chat', 'Chat'), tone: 'neutral' },
                        ].map((ev, i) => (
                          <div key={i} className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-surface-container-low">
                            <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? 'bg-emerald-500' : 'bg-outline-variant'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-body-sm text-[11px] font-medium text-on-surface capitalize">{String(ev.event || '').replace(/_/g, ' ')}</span>
                                <Badge tone={ev.tone}>{ev.chip}</Badge>
                              </div>
                              <div className="font-body-sm text-[10px] text-on-surface-variant">{ev.detail}</div>
                            </div>
                            <span className="font-label-sm text-[9px] text-outline whitespace-nowrap">{ev.time}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {detailTab === 'score' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-lg bg-surface-container-low">
                            <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">{t('Điểm hiện tại', 'Current score')}</div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold num text-on-surface">{selected.score}</span>
                              <Badge tone={tierTone(selected.tier)}>{selected.tier}</Badge>
                            </div>
                          </div>
                          <div className="p-2.5 rounded-lg bg-surface-container-low">
                            <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">{t('Điểm tại bàn giao', 'Handover score')}</div>
                            <div className="text-xl font-bold num text-on-surface">{selected.handoverScore ?? '—'}</div>
                            {selected.handoverScore != null && (
                              <div className={`font-label-sm text-[9px] font-semibold ${selected.score >= selected.handoverScore ? 'text-emerald-600' : 'text-red-600'}`}>
                                {selected.score >= selected.handoverScore ? '+' : ''}{selected.score - selected.handoverScore} điểm
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {[
                            { l: t('Tải whitepaper WMS', 'Whitepaper download'), pts: '+18', time: t('2 ngày trước', '2 days ago') },
                            { l: t('Xem bảng giá', 'Pricing view'), pts: '+12', time: t('3 ngày trước', '3 days ago') },
                            { l: t('Mở chat tư vấn', 'Chat interaction'), pts: '+10', time: t('5 ngày trước', '5 days ago') },
                            { l: t('Đăng ký demo', 'Demo request'), pts: '+25', time: t('6 ngày trước', '6 days ago') },
                          ].map((x, i) => (
                            <div key={i} className="flex items-center justify-between p-1.5 rounded-lg bg-surface-container-low">
                              <div>
                                <div className="font-body-sm text-[11px] text-on-surface">{x.l}</div>
                                <div className="font-label-sm text-[9px] text-outline">{x.time}</div>
                              </div>
                              <span className="font-mono text-[11px] font-semibold text-emerald-600">{x.pts}</span>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-lg border border-dashed border-outline-variant/70 p-2 font-body-sm text-[10px] text-on-surface-variant">
                          {t('Cold/Warm/Hot không phải Funnel. Điểm tiếp tục cập nhật sau bàn giao và có thể tạo cảnh báo tăng ưu tiên.', 'Cold/Warm/Hot is not Funnel. Scores keep updating after handover and can raise a priority alert.')}
                        </div>
                      </div>
                    )}

                    {detailTab === 'handover' && (
                      <div className="space-y-2">
                        {selected.handoverAt ? (
                          <>
                            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                              <div className="font-headline-sm text-[12px] font-semibold text-emerald-700">{t('Đã bàn giao', 'Handed over')} · {selected.handoverAt}</div>
                              <div className="font-body-sm text-[11px] text-emerald-700/90 mt-0.5">
                                {t('Sales phụ trách', 'Sales owner')}: {selected.sales || '—'}
                              </div>
                              <div className="font-body-sm text-[11px] text-emerald-700/90">
                                Snapshot: {selected.handoverScore} điểm · {selected.handoverTier}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {[
                                { l: t('Funnel hiện tại', 'Current funnel'), v: selected.funnel },
                                { l: t('Giá trị OPP', 'OPP value'), v: fmtCurrency(selected.oppValue) },
                                { l: t('Giá trị chốt', 'Won value'), v: fmtCurrency(selected.wonValue) },
                                { l: t('Ngày ký hợp đồng', 'Contract date'), v: selected.contractDate || '—' },
                              ].map((x) => (
                                <div key={x.l} className="flex justify-between">
                                  <span className="font-body-sm text-[10px] text-on-surface-variant">{x.l}</span>
                                  <span className="font-body-sm text-[11px] text-on-surface">{x.v}</span>
                                </div>
                              ))}
                            </div>
                            <Button variant="secondary" className="w-full" onClick={() => openHandover(selected)}>
                              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                              {t('Cập nhật / bàn giao lại', 'Update / hand over again')}
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="p-2.5 rounded-lg bg-surface-container-low font-body-sm text-[11px] text-on-surface-variant">
                              {t('Ghi nhận bàn giao không yêu cầu CRM ID hoặc link CRM. Hệ thống lưu Sales nội bộ, ngày giờ và snapshot điểm.', 'Handover does not require a CRM ID or CRM link. It stores internal Sales, timestamp and score snapshot.')}
                            </div>
                            <Button className="w-full" onClick={() => openHandover(selected)}>
                              <span className="material-symbols-outlined text-[16px]">handshake</span>
                              {t('Ghi nhận bàn giao', 'Record handover')}
                            </Button>
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button variant="secondary" className="flex-1" onClick={() => openEdit(selected)}>
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        {t('Chỉnh sửa', 'Edit')}
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => setTab('queue')}>
                        <span className="material-symbols-outlined text-[16px]">rule</span>
                        {t('Kiểm tra dữ liệu', 'Review data')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <EmptyState message={t('Chọn một Lead để xem hồ sơ.', 'Select a lead to view details.')} />
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'companies' && (
          <div>
            <Toolbar>
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                {t('Không tự hợp nhất hai Lead chỉ vì trùng tên và công ty. Công ty chỉ gộp khi MKT xác nhận.', 'Never merge two leads just for matching name and company. Companies merge only when MKT confirms.')}
              </p>
              <Button className="ml-auto" size="sm" variant="secondary" onClick={() => setMergeOpen(true)}>
                <span className="material-symbols-outlined text-[16px]">merge</span>
                {t('Hợp nhất Công ty', 'Merge companies')}
              </Button>
            </Toolbar>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-container-low">
                  <tr>
                    <Th>{t('Mã', 'Code')}</Th>
                    <Th>{t('Tên công ty', 'Company')}</Th>
                    <Th>{t('Tên tương đương', 'Aliases')}</Th>
                    <Th>{t('Domain / MST', 'Domain / Tax')}</Th>
                    <Th>{t('Khu vực', 'Location')}</Th>
                    <Th className="text-center">Lead</Th>
                    <Th className="text-right">Pipeline</Th>
                    <Th className="text-right">Won</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {companyList.map((c) => (
                    <tr key={c.code} className="hover:bg-surface-container-low cursor-pointer" onClick={() => { window.location.href = '/company-master'; }}>
                      <Td><span className="font-mono text-[10px] text-secondary">{c.code}</span></Td>
                      <Td><div className="font-medium">{c.name}</div><div className="text-[9px] text-on-surface-variant">{c.industry}</div></Td>
                      <Td><div className="flex flex-wrap gap-1">{(c.aliases || []).map((a) => <Badge key={a} tone="neutral">{a}</Badge>)}</div></Td>
                      <Td><div className="text-[11px]">{c.domain}</div><div className="font-mono text-[9px] text-on-surface-variant">{c.taxCode}</div></Td>
                      <Td className="text-[11px]">{c.city}<div className="text-[9px] text-on-surface-variant">{c.country}</div></Td>
                      <Td className="text-center num font-semibold">{c.leads}</Td>
                      <Td className="text-right num text-[11px]">{fmtCurrency(c.pipeline)}</Td>
                      <Td className="text-right num text-[11px] text-emerald-600 font-semibold">{fmtCurrency(c.won)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'queue' && (
          <div>
            <Toolbar>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { k: 'all', l: t('Tất cả', 'All') },
                  { k: 'new', l: t('Mới', 'New') },
                  { k: 'processing', l: t('Đang xử lý', 'Processing') },
                  { k: 'done', l: t('Đã xử lý', 'Done') },
                ].map((f) => (
                  <button key={f.k} onClick={() => setQueueFilter(f.k)} className={`px-2 py-1 rounded-md font-label-md text-[10px] ${queueFilter === f.k ? 'bg-primary-fixed text-on-primary-fixed font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>{f.l}</button>
                ))}
              </div>
              <span className="ml-auto font-body-sm text-[11px] text-on-surface-variant">
                SLA: 24h {t('xung đột / nghi ngờ trùng', 'conflicts / duplicates')} · 48h {t('thiếu dữ liệu', 'missing data')}
              </span>
            </Toolbar>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-container-low">
                  <tr>
                    <Th>ID</Th>
                    <Th>{t('Nhóm / Nội dung', 'Group / Item')}</Th>
                    <Th>{t('Đối tượng', 'Record')}</Th>
                    <Th>{t('Người phụ trách', 'Owner')}</Th>
                    <Th>SLA</Th>
                    <Th>{t('Trạng thái', 'Status')}</Th>
                    <Th className="text-right">{t('Thao tác', 'Actions')}</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {queue.filter((q) => queueFilter === 'all' || q.status === queueFilter).map((q) => (
                    <tr key={q.id} className="hover:bg-surface-container-low">
                      <Td><span className="font-mono text-[10px] text-on-surface-variant">{q.id}</span></Td>
                      <Td>
                        <div className="font-medium text-[11px]">{q.title}</div>
                        <div className="text-[10px] text-on-surface-variant max-w-[340px] truncate" title={q.description}>{q.description}</div>
                      </Td>
                      <Td><span className="font-mono text-[10px]">{q.lead}</span></Td>
                      <Td className="text-[11px]">{q.owner || <span className="italic text-amber-600">{t('Chưa nhận', 'Unassigned')}</span>}</Td>
                      <Td>
                        <span className={`font-label-sm text-[10px] font-semibold ${q.overdue ? 'text-red-600' : 'text-on-surface-variant'}`}>{q.sla}</span>
                      </Td>
                      <Td>
                        <Badge tone={q.status === 'done' ? 'active' : q.status === 'processing' ? 'purple' : 'danger'}>
                          {q.status === 'done' ? t('Đã xử lý', 'Done') : q.status === 'processing' ? t('Đang xử lý', 'Processing') : q.status === 'skipped' ? t('Đã bỏ qua', 'Skipped') : t('Mới', 'New')}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {q.status === 'new' && (
                            <Button size="sm" variant="secondary" onClick={() => setQueueStatus(q, 'processing', t('Đã nhận xử lý và gán người phụ trách.', 'Item claimed and assigned.'))}>
                              {t('Nhận', 'Claim')}
                            </Button>
                          )}
                          <Button size="sm" variant="success" disabled={['done', 'skipped'].includes(q.status)} onClick={() => setQueueStatus(q, 'done', t('Đã đánh dấu xử lý xong.', 'Marked as resolved.'))}>
                            {t('Xong', 'Resolve')}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={['done', 'skipped'].includes(q.status)} onClick={() => setQueueStatus(q, 'skipped', t('Đã bỏ qua với lý do.', 'Skipped with reason.'))}>
                            {t('Bỏ qua', 'Skip')}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'alerts' && (
          <div>
            <Toolbar>
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                {t('Lead không có trạng thái Đang/Không hoạt động. Cảnh báo quay lại không đổi trạng thái hồ sơ; email tổng hợp chỉ gửi khi 24h trước có ít nhất một cảnh báo.', 'Leads have no Active/Inactive status. Return alerts do not change record status; digest email is only sent when at least one alert exists in the last 24h.')}
              </p>
            </Toolbar>
            <div className="divide-y divide-outline-variant/40">
              {leads.filter((l) => l.isReturn).map((l) => (
                <div key={l.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px]">notifications_active</span>
                    </div>
                    <div>
                      <div className="font-headline-sm text-[12px] font-semibold text-on-surface">{l.name} · {l.id}</div>
                      <div className="font-body-sm text-[11px] text-on-surface-variant">
                        {t('Không có hành vi online trong ít nhất 90 ngày, vừa quay lại website.', 'No online activity for at least 90 days, now back on the website.')}
                      </div>
                      <div className="font-label-sm text-[9px] text-outline mt-0.5">{l.lastActivity} · {l.lastTouch} · {t('Điểm hiện tại', 'Current score')} {l.score} ({l.tier})</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => { setSelectedId(l.id); setTab('leads'); }}>{t('Mở Lead', 'Open lead')}</Button>
                    <Button size="sm" onClick={() => openHandover(l)}>{t('Bàn giao ngay', 'Hand over now')}</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {handoverLead && (
        <Modal
          title={t('Ghi nhận bàn giao Lead', 'Record lead handover')}
          subtitle={`${handoverLead.id} · ${handoverLead.name}`}
          onClose={() => setHandoverLead(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setHandoverLead(null)}>{t('Hủy', 'Cancel')}</Button>
              <Button onClick={confirmHandover}>{t('Xác nhận bàn giao', 'Confirm handover')}</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-surface-container-low">
                <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">{t('Điểm hiện tại', 'Current score')}</div>
                <div className="text-lg font-bold num">{handoverLead.score} <span className="text-[10px] font-normal">{handoverLead.tier}</span></div>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low">
                <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">Funnel</div>
                <div className="text-lg font-bold">{handoverLead.funnel}</div>
              </div>
            </div>
            <Field label={t('Sales phụ trách *', 'Sales owner *')} hint={t('Chỉ hiển thị Sales đang hoạt động.', 'Only active sales reps are listed.')}>
              <Select
                value={handoverSales}
                onChange={setHandoverSales}
                className="w-full"
                options={[
                  { value: '', label: t('— Chọn Sales —', '— Select Sales —') },
                  ...salesList.filter((s) => s.active).map((s) => ({ value: s.name, label: s.name })),
                ]}
              />
            </Field>
            <Field label={t('Ghi chú bàn giao', 'Handover note')}>
              <Textarea rows={3} value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} placeholder={t('Thông tin cần Sales nắm trước khi liên hệ…', 'Context Sales should know before reaching out…')} />
            </Field>
            <div className="rounded-lg bg-surface-container-low p-2.5 font-body-sm text-[10px] text-on-surface-variant">
              {t('Hệ thống lưu snapshot điểm và phân loại tại thời điểm bàn giao; Điểm hiện tại vẫn tiếp tục cập nhật sau bàn giao. Không yêu cầu CRM ID hoặc link CRM.', 'The system freezes score and tier at handover; the current score keeps updating afterwards. No CRM ID or CRM link is required.')}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked label={t('Tôi đã kiểm tra điều kiện bàn giao', 'I have verified handover conditions')} />
            </div>
          </div>
        </Modal>
      )}

      {editLead && editForm && (
        <Modal
          title={t('Chỉnh sửa hồ sơ Lead', 'Edit lead profile')}
          subtitle={editLead.id}
          width="max-w-2xl"
          onClose={() => { setEditLead(null); setEditForm(null); }}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setEditLead(null); setEditForm(null); }}>{t('Hủy', 'Cancel')}</Button>
              <Button onClick={saveEdit}>{t('Lưu thay đổi', 'Save changes')}</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('Họ tên', 'Full name')}><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></Field>
            <Field label={t('Số điện thoại chính', 'Primary phone')}><Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Email"><Input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label={t('Chức danh', 'Job title')}><Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            <Field label={t('Công ty', 'Company')}><Input value={editForm.company} onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} /></Field>
            <Field label={t('Dự án nguồn', 'Source project')}>
              <Select
                value={editForm.project}
                onChange={(v) => setEditForm((f) => ({ ...f, project: v }))}
                className="w-full"
                options={projectOptions.map((p) => ({ value: p, label: p }))}
              />
            </Field>
            <Field label="Marketing Owner">
              <Select value={editForm.owner} onChange={(v) => setEditForm((f) => ({ ...f, owner: v }))} className="w-full" options={[{ value: '', label: '—' }, ...marketingOwners.map((o) => ({ value: o, label: o }))]} />
            </Field>
            <Field label="Sales phụ trách">
              <Select value={editForm.sales} onChange={(v) => setEditForm((f) => ({ ...f, sales: v }))} className="w-full" options={[{ value: '', label: '—' }, ...salesList.map((s) => ({ value: s.name, label: s.name + (s.active ? '' : ' (ngừng hoạt động)') }))]} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('Sản phẩm quan tâm', 'Interested products')} hint={t('Ngăn cách bằng dấu phẩy.', 'Separate by commas.')}>
                <Input value={editForm.products} onChange={(e) => setEditForm((f) => ({ ...f, products: e.target.value }))} placeholder="WMS, TMS" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t('Nhu cầu hiện tại', 'Current need')}>
                <Textarea rows={3} value={editForm.need} onChange={(e) => setEditForm((f) => ({ ...f, need: e.target.value }))} />
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {mergeOpen && (
        <Modal
          title={t('Hợp nhất Company Master', 'Merge Company Master')}
          subtitle={t('Chuyển Lead, tên tương đương, domain và lịch sử sang công ty chính.', 'Move leads, aliases, domain and history into the primary company.')}
          onClose={() => setMergeOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setMergeOpen(false)}>{t('Hủy', 'Cancel')}</Button>
              <Button onClick={handleMergeCompanies}>{t('Xác nhận hợp nhất', 'Confirm merge')}</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label={t('Công ty chính', 'Primary company')}>
              <Select value={mergeTo} onChange={setMergeTo} className="w-full" options={companyList.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))} />
            </Field>
            <Field label={t('Công ty sẽ hợp nhất', 'Company to merge')}>
              <Select value={mergeFrom} onChange={setMergeFrom} className="w-full" options={companyList.filter((c) => c.code !== mergeTo).map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))} />
            </Field>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 font-body-sm text-[10px] text-amber-700">
              {t('Không cho xóa Công ty còn Lead. Hợp nhất có thể hoàn tác nếu đủ dữ liệu khôi phục; audit ghi người thực hiện và kết quả.', 'Companies with leads cannot be deleted. Merge is reversible when enough data exists; audit records actor and result.')}
            </div>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  );
}
