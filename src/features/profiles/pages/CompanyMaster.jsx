import LoadState from '@/features/profiles/components/LoadState';
import { downloadCsv } from '@/features/profiles/utils/profileExport';
import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '@/shared/stores/DashboardContext';
import { marketingOwners } from '@/shared/mocks/profiles';
import { normalizeCompany } from '@/features/profiles/utils/normalizeProfiles';
import { getCompanies, createCompany, updateCompany, mergeCompanies } from '@/shared/api/httpClient';
import {
  Card, SectionTitle, Badge, KpiCard, Toolbar, SearchInput, Select, Button, TabBar,
  Modal, Field, Input, Toast, Th, Td, EmptyState,
} from '@/features/profiles/components/ui';

const fmt = (n) => Number(n || 0).toLocaleString('vi-VN');
const fmtCurrency = (n) => `${Math.round((n || 0) / 1000000).toLocaleString('vi-VN')} tr`;

const industryOptions = [
  { value: 'all', label: 'Ngành nghề: Tất cả' },
  { value: 'Logistics & Transportation', label: 'Logistics & Transportation' },
  { value: 'Freight & Forwarding', label: 'Freight & Forwarding' },
  { value: 'Shipping & Maritime', label: 'Shipping & Maritime' },
  { value: 'Port Operation', label: 'Port Operation' },
  { value: 'Fulfillment', label: 'Fulfillment' },
];

const cityOptions = [
  { value: 'all', label: 'Khu vực: Tất cả' },
  { value: 'Hồ Chí Minh', label: 'Hồ Chí Minh' },
  { value: 'Hà Nội', label: 'Hà Nội' },
  { value: 'Đà Nẵng', label: 'Đà Nẵng' },
];

export default function CompanyMaster() {
  const { locale } = useDashboard();
  const t = (vi, en) => (locale === 'vi' ? vi : en);

  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [companyList, setCompanyList] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await getCompanies();
        if (cancelled) return;
        if (res?.data && Array.isArray(res.data)) {
          setCompanyList(res.data.map(normalizeCompany));
          setSelectedCode(res.data[0]?.code || '');
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.response?.data?.message || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('all');
  const [city, setCity] = useState('all');
  const [toast, setToast] = useState('');
  const [editingCode, setEditingCode] = useState('');
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', industry: 'Logistics & Transportation', domain: '', taxCode: '', city: 'Hồ Chí Minh', country: 'Việt Nam' });

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2600);
  };

  const filtered = useMemo(() => {
    return companyList.filter((c) => {
      if (industry !== 'all' && c.industry !== industry) return false;
      if (city !== 'all' && c.city !== city) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [c.code, c.name, c.domain, c.taxCode, ...(c.aliases || [])].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [companyList, industry, city, search]);

  const selected = companyList.find((c) => c.code === selectedCode) || filtered[0] || companyList[0];

  const totalLeads = companyList.reduce((s, c) => s + (Number(c.leads) || 0), 0);
  const totalPipeline = companyList.reduce((s, c) => s + (Number(c.pipeline) || 0), 0);
  const totalWon = companyList.reduce((s, c) => s + (Number(c.won) || 0), 0);
  const mappedRate = null;

  const companyLeads = selected?.recentLeads || [];

  const resetFilters = () => {
    setSearch('');
    setIndustry('all');
    setCity('all');
  };

  const submitAdd = async () => {
    if (!form.name.trim()) {
      notify(t('Vui lòng nhập tên công ty.', 'Company name is required.'));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), domain: form.domain.trim(), taxCode: form.taxCode.trim() };
      const res = editingCode ? await updateCompany(editingCode, payload) : await createCompany(payload);
      const company = normalizeCompany({ ...payload, ...res.data, code: res.data?.code || editingCode });
      if (!company.code) throw new Error(t('Phản hồi công ty không hợp lệ.', 'Invalid company response.'));
      setCompanyList((prev) => editingCode ? prev.map((c) => c.code === editingCode ? { ...c, ...company } : c) : [company, ...prev]);
      setSelectedCode(company.code);
      setShowAdd(false);
      setEditingCode('');
      notify(t('Đã lưu công ty.', 'Company saved.'));
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const submitMerge = async () => {
    if (!mergeTarget || mergeTarget === selected?.code || saving) return;
    setSaving(true);
    try {
      await mergeCompanies({ fromCode: selected.code, toCode: mergeTarget });
      setMergeOpen(false);
      setSelectedCode(mergeTarget);
      setReload((n) => n + 1);
      notify(t('Đã gộp công ty.', 'Companies merged.'));
    } catch (err) {
      notify({ error: true, message: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  };

  const tabItems = [
    { key: 'overview', label: t('Tổng quan', 'Overview') },
    { key: 'list', label: t('Danh sách công ty', 'Company list'), count: companyList.length },
  ];

  if (loading || loadError) return <LoadState loading={loading} error={loadError} onRetry={() => setReload((n) => n + 1)} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-[22px]">domain</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline-md text-[20px] font-bold text-on-surface tracking-tight">
                {t('Company Master', 'Company Master')}
              </h1>
              <Badge tone="brand">BDD-03</Badge>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t('Hồ sơ công ty chuẩn', 'Standard company profiles')}
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
              {t(
                'Hồ sơ công ty chuẩn · Nhóm Lead theo công ty · Chống trùng lặp Company Master.',
                'Standard company profiles · Group leads by company · Deduplicate Company Master.'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => downloadCsv('companies.csv', filtered)}>
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            {t('Xuất', 'Export')}
          </Button>
          <Button variant="outline" onClick={() => setTab('list')}>
            <span className="material-symbols-outlined text-[16px]">filter_list</span>
            {t('Bộ lọc', 'Filters')}
          </Button>
          <Button variant="primary" onClick={() => { setEditingCode(''); setForm({ name: '', industry: 'Logistics & Transportation', domain: '', taxCode: '', city: 'Hồ Chí Minh', country: 'Việt Nam' }); setShowAdd(true); }}>
            <span className="material-symbols-outlined text-[16px]">add_business</span>
            {t('Thêm công ty', 'Add company')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <KpiCard label={t('Tổng công ty', 'Companies')} value={fmt(companyList.length)} sub={t('Đã chuẩn hoá', 'Normalized')} icon={() => <span className="material-symbols-outlined text-[18px]">domain</span>} />
        <KpiCard label={t('Lead liên kết', 'Linked leads')} value={fmt(totalLeads)}  icon={() => <span className="material-symbols-outlined text-[18px]">group</span>} />
        <KpiCard label={t('Pipeline', 'Pipeline')} value={fmtCurrency(totalPipeline)} sub={t('Toàn bộ công ty', 'All companies')} icon={() => <span className="material-symbols-outlined text-[18px]">trending_up</span>} />
        <KpiCard label={t('Tỷ lệ mapping', 'Mapping rate')} value="—" progress={mappedRate} sub={t('Lead khớp Company Master', 'Leads matched to Company Master')} icon={() => <span className="material-symbols-outlined text-[18px]">verified</span>} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className="xl:col-span-8 overflow-hidden">
          <TabBar tabs={tabItems} active={tab} onChange={setTab} />

          {tab === 'overview' && (
            <div className="p-4 space-y-3">
              <p className="font-body-sm text-[12px] text-on-surface-variant">
                {t(
                  'Company Master là nguồn chuẩn để gán Lead vào công ty. Lead mới được khớp tự động theo domain, MST hoặc tên tương đương; trường hợp không chắc chắn sẽ đưa vào Hàng chờ xử lý.',
                  'Company Master is the source of truth for assigning leads to companies. New leads are auto-matched by domain, tax code or alias; uncertain cases are queued for review.'
                )}
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <KpiCard label={t('Lead khớp tự động', 'Auto-matched')} value="—" sub={t('Trong 30 ngày', 'Last 30 days')} />
                <KpiCard label={t('Cần xác nhận', 'Needs confirmation')} value="—" tone="danger" sub={t('Chờ MKT xử lý', 'Awaiting MKT')} />
                <KpiCard label={t('Công ty mới', 'New companies')} value="—" sub={t('30 ngày qua', 'Last 30 days')} />
                <KpiCard label={t('Won', 'Won')} value={fmtCurrency(totalWon)} sub={t('Doanh thu ghi nhận', 'Recognized revenue')} />
              </div>
              <div className="rounded-lg border border-outline-variant/60 bg-surface-container-low/60 p-3">
                <div className="font-label-md text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1">
                  {t('Quy tắc khớp', 'Matching rules')}
                </div>
                <ul className="space-y-1 font-body-sm text-[11px] text-on-surface-variant list-disc pl-4">
                  <li>{t('Domain email doanh nghiệp khớp 100% → tự động gán.', 'Corporate email domain exact match → auto-assign.')}</li>
                  <li>{t('Mã số thuế khớp → tự động gán và gộp tên tương đương.', 'Tax code match → auto-assign and merge aliases.')}</li>
                  <li>{t('Tên gần đúng (fuzzy) → đưa vào hàng chờ xác nhận.', 'Fuzzy name match → queue for confirmation.')}</li>
                </ul>
              </div>
            </div>
          )}

          {tab === 'list' && (
            <div>
              <Toolbar>
                <div className="flex-1 min-w-[220px]">
                  <SearchInput value={search} onChange={setSearch} placeholder={t('Tìm mã, tên, domain, MST…', 'Search code, name, domain, tax…')} />
                </div>
                <Select value={industry} onChange={setIndustry} options={industryOptions} />
                <Select value={city} onChange={setCity} options={cityOptions} />
                <button onClick={resetFilters} className="font-label-sm text-[11px] text-secondary hover:underline px-1">
                  {t('Xóa bộ lọc', 'Clear filters')}
                </button>
                <span className="ml-auto font-body-sm text-[11px] text-on-surface-variant">
                  {t('Hiển thị', 'Showing')} <strong>{filtered.length}</strong> / {companyList.length}
                </span>
              </Toolbar>

              {filtered.length === 0 ? (
                <EmptyState message={t('Không có công ty phù hợp bộ lọc.', 'No companies match the filters.')} />
              ) : (
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
                      {filtered.map((c) => (
                        <tr
                          key={c.code}
                          onClick={() => setSelectedCode(c.code)}
                          className={`cursor-pointer transition-colors ${selected?.code === c.code ? 'bg-primary-fixed/40' : 'hover:bg-surface-container-low'}`}
                        >
                          <Td><span className="font-mono text-[10px] text-secondary">{c.code}</span></Td>
                          <Td><div className="font-medium">{c.name}</div><div className="text-[9px] text-on-surface-variant">{c.industry}</div></Td>
                          <Td>
                            <div className="flex flex-wrap gap-1">
                              {(c.aliases || []).length ? (c.aliases || []).map((a) => <Badge key={a} tone="neutral">{a}</Badge>) : <span className="text-on-surface-variant">—</span>}
                            </div>
                          </Td>
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
              )}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-4 overflow-hidden">
          <SectionTitle
            title={selected?.name || t('Chi tiết công ty', 'Company detail')}
            subtitle={selected ? `${selected.code} · ${selected.industry}` : ''}
            right={<Badge tone="active">{t('Đã chuẩn hoá', 'Normalized')}</Badge>}
          />
          {selected && (
            <div className="p-4 space-y-3">
              <dl className="grid grid-cols-2 gap-2.5">
                <div>
                  <dt className="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">{t('Domain', 'Domain')}</dt>
                  <dd className="font-body-sm text-[12px] text-on-surface break-all">{selected.domain}</dd>
                </div>
                <div>
                  <dt className="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">{t('Mã số thuế', 'Tax code')}</dt>
                  <dd className="font-mono text-[12px] text-on-surface">{selected.taxCode}</dd>
                </div>
                <div>
                  <dt className="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">{t('Khu vực', 'Location')}</dt>
                  <dd className="font-body-sm text-[12px] text-on-surface">{selected.city}, {selected.country}</dd>
                </div>
                <div>
                  <dt className="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">{t('Ngày tạo', 'Created')}</dt>
                  <dd className="font-body-sm text-[12px] text-on-surface">{selected.createdAt}</dd>
                </div>
              </dl>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-surface-container-low p-2.5 text-center">
                  <div className="num font-bold text-on-surface">{selected.leads}</div>
                  <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">Lead</div>
                </div>
                <div className="rounded-lg bg-surface-container-low p-2.5 text-center">
                  <div className="num font-bold text-on-surface">{fmtCurrency(selected.pipeline)}</div>
                  <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">Pipeline</div>
                </div>
                <div className="rounded-lg bg-surface-container-low p-2.5 text-center">
                  <div className="num font-bold text-emerald-600">{fmtCurrency(selected.won)}</div>
                  <div className="font-label-sm text-[9px] uppercase text-on-surface-variant">Won</div>
                </div>
              </div>

              <div>
                <div className="font-label-md text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1.5">
                  {t('Lead gần đây', 'Recent leads')}
                </div>
                {companyLeads.length === 0 ? (
                  <p className="font-body-sm text-[11px] text-on-surface-variant italic">{t('Chưa có Lead liên kết.', 'No linked leads yet.')}</p>
                ) : (
                  <ul className="divide-y divide-outline-variant/40">
                    {companyLeads.map((l) => (
                      <li key={l.id} className="py-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-body-sm text-[11px] text-on-surface truncate">{l.name}</div>
                          <div className="font-mono text-[9px] text-on-surface-variant">{l.id}</div>
                        </div>
                        <Badge tone={l.tier === 'hot' ? 'danger' : l.tier === 'warm' ? 'warm' : 'neutral'}>{l.score}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => { setEditingCode(selected.code); setForm({ name: selected.name || '', industry: selected.industry || '', domain: selected.domain || '', taxCode: selected.taxCode || '', city: selected.city || '', country: selected.country || '' }); setShowAdd(true); }}>
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  {t('Chỉnh sửa', 'Edit')}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={companyList.length < 2} onClick={() => { setMergeTarget(companyList.find((c) => c.code !== selected.code)?.code || ''); setMergeOpen(true); }}>
                  <span className="material-symbols-outlined text-[15px]">merge</span>
                  {t('Gộp', 'Merge')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {showAdd && (
        <Modal
          title={editingCode ? t('Chỉnh sửa công ty', 'Edit company') : t('Thêm công ty mới', 'Add new company')}
          subtitle={t('Tạo hồ sơ Company Master trước khi gán Lead.', 'Create a Company Master record before assigning leads.')}
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>{t('Hủy', 'Cancel')}</Button>
              <Button variant="primary" disabled={saving} onClick={submitAdd}>{editingCode ? t('Lưu', 'Save') : t('Tạo công ty', 'Create company')}</Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label={t('Tên công ty', 'Company name')}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Logistics Viet Corp" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('Ngành nghề', 'Industry')}>
                <Select
                  value={form.industry}
                  onChange={(v) => setForm({ ...form, industry: v })}
                  options={industryOptions.filter((o) => o.value !== 'all')}
                  className="w-full"
                />
              </Field>
              <Field label={t('Khu vực', 'City')}>
                <Select
                  value={form.city}
                  onChange={(v) => setForm({ ...form, city: v })}
                  options={cityOptions.filter((o) => o.value !== 'all')}
                  className="w-full"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Domain">
                <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="company.com" />
              </Field>
              <Field label={t('Mã số thuế', 'Tax code')}>
                <Input value={form.taxCode} onChange={(e) => setForm({ ...form, taxCode: e.target.value })} placeholder="0101234567" />
              </Field>
            </div>
            <Field label={t('Quốc gia', 'Country')}>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </Field>
            <p className="font-body-sm text-[11px] text-on-surface-variant">
              {t(
                `Marketing Owner mặc định sẽ được gợi ý từ quy tắc phân công (${marketingOwners[0]}).`,
                `Default marketing owner will be suggested by routing rules (${marketingOwners[0]}).`
              )}
            </p>
          </div>
        </Modal>
      )}

      {mergeOpen && <Modal title={t('Gộp công ty', 'Merge companies')} onClose={() => setMergeOpen(false)} footer={<Button disabled={saving || !mergeTarget} onClick={submitMerge}>{t('Xác nhận gộp', 'Confirm merge')}</Button>}>
        <Field label={t('Gộp vào công ty', 'Merge into company')}><Select value={mergeTarget} onChange={setMergeTarget} options={companyList.filter((c) => c.code !== selected?.code).map((c) => ({ value: c.code, label: c.name }))} /></Field>
      </Modal>}
      <Toast toast={toast} />
    </div>
  );
}
