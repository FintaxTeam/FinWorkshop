import { useCallback,useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeftRight, ArrowRight, BarChart3, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Factory, FilePlus2, FileText, Landmark, LayoutGrid, Plus, RefreshCw, ShieldCheck, ShoppingCart, Wallet } from 'lucide-react';
import { Bar,CartesianGrid,Cell,ComposedChart,Legend,Line,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import { api,actionRecord,formatDate,formatVnd,messageOf,today } from './api';
import { Button,Card,StatusBadge,useToast } from './components';
import { roleName } from './RoleHome';
import { useAuth } from './auth';
import { formatAxisMoney,formatNumber,moneyTicks } from './presentation';

type DashboardTab = 'overview' | 'charts' | 'operations';

const dayShift = (day: string, count: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0,10); };
const pathFor = (row: any) => `${({ invoices: '/invoices', transactions: '/transactions', quotations: '/quotations', 'stock-movements': '/inventory' } as Record<string,string>)[row.entity] || '/invoices'}?view=${encodeURIComponent(row.viewKey || row.code || row.id)}${row.entity === 'invoices' ? `&type=${row.direction}` : ''}`;

function QuickCreateMenu() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const items = user?.role === 'ACCOUNTANT' ? [
    { to: '/invoices?new=1&type=OUTPUT', label: 'Hóa đơn bán hàng', desc: 'Lập chứng từ bán ra & cấp mã CQT', icon: FilePlus2 },
    { to: '/invoices?new=1&type=INPUT', label: 'Hóa đơn mua vào', desc: 'Ghi nhận chi phí & vật tư đầu vào', icon: ShoppingCart },
    { to: '/transactions?new=1', label: 'Ghi sổ thu chi', desc: 'Thu tiền mặt hoặc chuyển khoản', icon: Wallet },
    { to: '/reconciliation', label: 'Khớp sao kê ngân hàng', desc: 'Nhập CSV/XLSX và đối soát', icon: Landmark },
  ] : [
    { to: '/quotations?new=1', label: 'Lập báo giá mới', desc: 'Tính giá theo định mức sản xuất', icon: FileText },
    { to: '/invoices?new=1&type=OUTPUT', label: 'Hóa đơn bán hàng', desc: 'Phát hành hóa đơn & ghi doanh thu', icon: FilePlus2 },
    { to: '/invoices?new=1&type=INPUT', label: 'Hóa đơn mua vào', desc: 'Ghi nhận mua vật tư, dịch vụ', icon: ShoppingCart },
    { to: '/payments?new=1', label: 'Phiếu thu / Trả nợ', desc: 'Gán thanh toán vào hóa đơn', icon: ArrowLeftRight },
  ];

  return (
    <div ref={menuRef} className="relative">
      <Button compact onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <Plus size={14} />
        <span>Tạo mới</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                <item.icon size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-900">{item.label}</span>
                <span className="block text-[11px] text-slate-500">{item.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: DashboardTab = (['overview', 'charts', 'operations'].includes(searchParams.get('tab') || '')
    ? searchParams.get('tab')
    : 'overview') as DashboardTab;

  const setTab = (tab: DashboardTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [syncing, setSyncing] = useState(false);
  const [showCalmChecks, setShowCalmChecks] = useState(false);
  const [preset, setPreset] = useState('month'), [period, setPeriod] = useState({ from: `${today().slice(0,7)}-01`, to: today() }), [draft, setDraft] = useState(period), [chartRange, setChartRange] = useState('14');
  const { user } = useAuth(), toast = useToast();
  const requestVersion = useRef(0);
  const chartParams = useMemo(() => {
    if (chartRange === 'month') { const date = new Date(`${period.to}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth()-5,1); return { chartFrom: date.toISOString().slice(0,10), chartTo: period.to, chartMode: 'month' }; }
    return { chartFrom: dayShift(period.to, 1-Number(chartRange)), chartTo: period.to, chartMode: 'day' };
  }, [period.to,chartRange]);
  const load = useCallback(async () => { const version = ++requestVersion.current; setBusy(true); try { const { data } = await api.get('/dashboard',{ params:{ ...period,...chartParams } }); if (version === requestVersion.current) { setData(data); setError(''); } } catch (error) { if (version === requestVersion.current) setError(messageOf(error)); } finally { if (version === requestVersion.current) setBusy(false); } },[period,chartParams]);
  useEffect(() => { void load(); const refresh = () => void load(); window.addEventListener('fintax:records-changed',refresh); return () => window.removeEventListener('fintax:records-changed',refresh); }, [load]);
  const choosePeriod = (value: string) => {
    setPreset(value);
    if (value === 'custom') return;
    const current = today(), year = current.slice(0,4), month = Number(current.slice(5,7));
    setPeriod({ from: value === 'quarter' ? `${year}-${String(Math.floor((month-1)/3)*3+1).padStart(2,'0')}-01` : `${current.slice(0,7)}-01`, to: current });
  };
  const retry = async () => { setSyncing(true); try { const { data } = await api.post('/integrations/odoo/sync-pending'); const count = data.results.filter((row: any) => row.status === 'SYNCED').length; toast(`Đã đồng bộ ${count}/${data.attempted} hồ sơ.`); await load(); } catch (error) { toast(messageOf(error),'error'); } finally { setSyncing(false); } };
  const approve = async (id: string) => { try { await actionRecord('quotations',id,'approve'); await load(); toast('Đã duyệt báo giá.'); } catch (error) { toast(messageOf(error),'error'); } };
  const markSent = async (id: string) => { try { await actionRecord('quotations',id,'mark-sent'); await load(); toast('Đã đánh dấu gửi báo giá cho khách.'); } catch (error) { toast(messageOf(error),'error'); } };

  const metrics = data?.metrics || {}, actions = data?.actions || {}, tax = data?.tax || {}, comparison = data?.comparison || {};
  const ticks = moneyTicks(Math.max(1,...(data?.trend || []).flatMap((row: any) => [row.thu,row.chi])));
  const costs = data?.expenseBreakdown || [], costTotal = costs.reduce((sum: number,row: any) => sum+row.amount,0);
  const agingTotal = Number(data?.aging?.current || 0)+Number(data?.aging?.overdue || 0);

  const reviewTotal = Number(actions.reviewInvoiceCount || 0) + Number(actions.reconciliationCount || 0);
  const urgentCount =
    Number(actions.quotationCount || 0) +
    (user?.role !== 'OWNER' ? Number(actions.approvedQuoteCount || 0) + Number(actions.rejectedQuoteCount || 0) + Number(actions.acceptedQuoteCount || 0) : 0) +
    Number(actions.unclassifiedCount || 0) +
    reviewTotal +
    Number(actions.pendingOdoo || 0) +
    Number(data?.lowStock?.length || 0);

  // Split checklist items into "Needs attention (> 0)" and "All clear (=== 0)" for Option 1 focus
  const checkItems = useMemo(() => {
    const list: Array<{ key: string; count: number; label: string; to: string; action: string }> = [];
    if (user?.role === 'OWNER') {
      list.push({ key: 'q-pending', count: Number(actions.quotationCount || 0), label: 'Báo giá chờ duyệt', to: '/quotations?status=PENDING_APPROVAL', action: 'Xem báo giá' });
      if (Number(actions.approvedQuoteCount || 0) > 0) {
        list.push({ key: 'q-approved', count: Number(actions.approvedQuoteCount || 0), label: 'Báo giá đã duyệt · Chờ gửi khách', to: '/quotations?status=APPROVED', action: 'Xem' });
      }
    } else {
      list.push({ key: 'q-approved', count: Number(actions.approvedQuoteCount || 0), label: 'Báo giá đã được Chủ xưởng duyệt · Cần gửi khách', to: '/quotations?status=APPROVED', action: 'Gửi khách' });
      if (Number(actions.rejectedQuoteCount || 0) > 0) {
        list.push({ key: 'q-rejected', count: Number(actions.rejectedQuoteCount || 0), label: 'Báo giá bị từ chối · Cần chỉnh sửa lại', to: '/quotations?status=REJECTED', action: 'Sửa lại' });
      }
      if (Number(actions.acceptedQuoteCount || 0) > 0) {
        list.push({ key: 'q-accepted', count: Number(actions.acceptedQuoteCount || 0), label: 'Báo giá khách đã chốt · Cần tạo việc làm', to: '/quotations?status=ACCEPTED', action: 'Tạo việc làm' });
      }
      list.push({ key: 'q-pending', count: Number(actions.quotationCount || 0), label: 'Báo giá đang chờ Chủ xưởng duyệt', to: '/quotations?status=PENDING_APPROVAL', action: 'Theo dõi' });
    }
    list.push({ key: 'unclassified', count: Number(actions.unclassifiedCount || 0), label: 'Khoản thu chi chưa phân loại', to: '/transactions?q=UNCLASSIFIED', action: 'Phân loại' });
    list.push({ key: 'review', count: reviewTotal, label: 'Hóa đơn / Khớp ngân hàng cần rà soát', to: '/invoices', action: 'Rà soát' });
    return list;
  }, [actions, reviewTotal, user?.role]);

  const activeChecks = checkItems.filter((item) => item.count > 0);
  const calmChecks = checkItems.filter((item) => item.count === 0);

  const tabs: Array<{ id: DashboardTab; label: string; icon: any; badge?: number }> = [
    { id: 'overview', label: 'Tổng quan & Tiền', icon: LayoutGrid, badge: urgentCount > 0 ? urgentCount : undefined },
    { id: 'charts', label: 'Biểu đồ & Phân tích', icon: BarChart3 },
    { id: 'operations', label: 'Chứng từ & Tiến độ Xưởng', icon: ClipboardList, badge: data?.production?.length || undefined },
  ];

  return <>
    {/* Restrained Executive Header Bar */}
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/90 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
              Xin chào, {user?.name || ''}
            </h1>
            {roleName[user?.role || ''] && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {roleName[user?.role || '']}
              </span>
            )}
            <StatusBadge status={data?.period?.id ? data.period.status : 'DRAFT'} label={data?.period?.id ? data.period.status === 'LOCKED' ? 'Đã chốt sổ kỳ' : 'Kỳ đang mở' : 'Chưa thiết lập kỳ'}/>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Kỳ đối chiếu từ {formatDate(period.from)} đến {formatDate(period.to)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <CalendarDays size={14} className="text-slate-400 shrink-0"/>
            <select aria-label="Kỳ kế toán" value={preset} onChange={(event) => choosePeriod(event.target.value)} className="bg-transparent text-xs font-semibold text-slate-700 outline-none">
              <option value="month">Tháng này</option>
              <option value="quarter">Quý này</option>
              <option value="custom">Tùy chọn ngày</option>
            </select>
          </div>
          {preset === 'custom' && (
            <form onSubmit={(event) => { event.preventDefault(); if (draft.from && draft.to && draft.from <= draft.to) setPeriod(draft); }} className="flex flex-wrap items-center gap-1.5">
              <input aria-label="Từ ngày" type="date" required value={draft.from} onChange={(event) => setDraft({ ...draft,from:event.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"/>
              <input aria-label="Đến ngày" type="date" required min={draft.from} value={draft.to} onChange={(event) => setDraft({ ...draft,to:event.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"/>
              <Button type="submit" compact>Áp dụng</Button>
            </form>
          )}
          <Button variant="secondary" compact onClick={() => void load()} disabled={busy}>
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''}/>Làm mới
          </Button>
          <QuickCreateMenu />
        </div>
      </div>

      {/* Clean Tab Navigation */}
      <div role="tablist" aria-label="Chế độ xem Dashboard" className="flex flex-wrap items-center gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <tab.icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`ml-0.5 rounded-full px-1.5 text-[10px] font-bold leading-4 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>

    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">{error}</p>}

    {!data && !error ? (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white"/>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(290px,1fr)]">
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white"/>
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white"/>
        </div>
      </div>
    ) : (
      <>
        {/* TAB 1: TỔNG QUAN & TIỀN (OPTION 1: Executive Financial Strip + 65/35 Focus Layout) */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* 1. Unified Executive Financial Strip */}
            <Card className="overflow-hidden bg-white">
              <div className="grid divide-y divide-slate-100 lg:grid-cols-[1.35fr_1fr_1fr_1fr_1fr] lg:divide-x lg:divide-y-0">
                {/* Primary Hero Metric: Tiền đang có */}
                <Link to="/settings?tab=accounts" className="group block p-5 transition-colors hover:bg-slate-50/70">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tiền đang có (Quỹ &amp; NH)</span>
                    <ChangePill change={comparison.balance} />
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums sm:text-[26px]">
                    {formatVnd(metrics.balance)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <span>Quỹ mặt: <strong className="font-semibold text-slate-800 tabular-nums">{formatVnd(metrics.cashBalance)}</strong></span>
                    <span>Ngân hàng: <strong className="font-semibold text-slate-800 tabular-nums">{formatVnd(metrics.bankBalance)}</strong></span>
                  </div>
                </Link>

                {/* Secondary Strip Metric 1: Doanh thu */}
                <StripMetric
                  title="Doanh thu bán hàng"
                  amount={metrics.netRevenue}
                  change={comparison.netRevenue}
                  to="/invoices?type=OUTPUT"
                  subLabel="Thực thu trong kỳ"
                  subValue={metrics.actualReceipts}
                />

                {/* Secondary Strip Metric 2: Chi phí */}
                <StripMetric
                  title="Chi phí & Giá vốn"
                  amount={metrics.operatingCost}
                  change={comparison.operatingCost}
                  to="/reports?book=SME-GT"
                  subLabel="Hóa đơn mua vào"
                  subValue={metrics.inputInvoices}
                />

                {/* Secondary Strip Metric 3: Phải thu */}
                <StripMetric
                  title="Phải thu khách hàng"
                  amount={metrics.receivable}
                  change={comparison.receivable}
                  to="/invoices?type=OUTPUT"
                  subLabel={`${metrics.overdueCount || 0} hóa đơn quá hạn`}
                  subValue={metrics.overdueAmount}
                  danger={Number(metrics.overdueCount || 0) > 0}
                />

                {/* Secondary Strip Metric 4: Phải trả */}
                <StripMetric
                  title="Phải trả NCC"
                  amount={metrics.payable}
                  change={comparison.payable}
                  to="/invoices?type=INPUT"
                  subLabel={`Đến hạn 7 ngày (${metrics.upcomingCount || 0} HĐ)`}
                  subValue={metrics.upcomingAmount}
                />
              </div>
            </Card>

            {/* 2. Asymmetric 65% / 35% Operational Grid */}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(300px,1fr)]">
              {/* LEFT (65%): Focused Action Inbox */}
              <Card className="overflow-hidden bg-white">
                <WidgetHeader
                  icon={<AlertTriangle size={15}/>}
                  title="Cần xử lý ngay"
                  right={
                    <span className="text-[11px] font-semibold text-slate-500">
                      {activeChecks.length > 0 ? `${activeChecks.length} nhóm có việc cần làm` : 'Không có đầu việc tồn đọng'}
                    </span>
                  }
                />

                <div className="divide-y divide-slate-100">
                  {/* Inline High-Priority Quote Actions */}
                  {user?.role === 'OWNER' && actions.pendingQuotes?.map((quote: any) => (
                    <div key={quote.id} className="flex items-center justify-between gap-3 bg-amber-50/50 px-5 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                          <span className="truncate text-xs font-bold text-slate-900">{quote.code} · {quote.customerName}</span>
                        </div>
                        <p className="mt-0.5 truncate pl-4 text-xs text-slate-600">
                          {quote.title} · <strong className="tabular-nums text-slate-900">{formatVnd(quote.total)}</strong>
                        </p>
                      </div>
                      <Button className="shrink-0" compact onClick={() => void approve(quote.id)}>Duyệt ngay</Button>
                    </div>
                  ))}

                  {user?.role !== 'OWNER' && actions.approvedQuotes?.map((quote: any) => (
                    <div key={quote.id} className="flex items-center justify-between gap-3 bg-emerald-50/50 px-5 py-3">
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-900">Đã duyệt · {quote.code} ({quote.customerName})</span>
                        <span className="block truncate text-xs text-slate-600">{quote.title} · {formatVnd(quote.total)}</span>
                      </div>
                      <Button variant="secondary" className="shrink-0" compact onClick={() => void markSent(quote.id)}>Đã gửi khách</Button>
                    </div>
                  ))}

                  {user?.role !== 'OWNER' && actions.rejectedQuotes?.map((quote: any) => (
                    <Link key={quote.id} to={`/quotations?status=REJECTED&view=${encodeURIComponent(quote.code)}`} className="block bg-rose-50/50 px-5 py-3 hover:bg-rose-50 transition-colors">
                      <span className="block truncate text-xs font-bold text-rose-900">Bị từ chối · {quote.code} ({quote.customerName})</span>
                      {quote.rejectionNote && <span className="mt-0.5 block truncate text-xs text-rose-700">Lý do: {quote.rejectionNote}</span>}
                    </Link>
                  ))}

                  {/* Active Tasks (count > 0) */}
                  {activeChecks.map((item) => (
                    <Task key={item.key} count={item.count} label={item.label} to={item.to} action={item.action} />
                  ))}

                  {activeChecks.length === 0 && (
                    <div className="flex items-center gap-3 px-5 py-6 text-slate-600">
                      <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Mọi đầu việc kế toán &amp; báo giá đều đang sạch sẽ</p>
                        <p className="mt-0.5 text-xs text-slate-500">Không có báo giá chờ duyệt, khoản chưa phân loại hay hóa đơn tồn đọng.</p>
                      </div>
                    </div>
                  )}

                  {/* Calm / Zero-count checks neatly tucked into a collapsible footer */}
                  {calmChecks.length > 0 && (
                    <div className="bg-slate-50/70 px-5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setShowCalmChecks((v) => !v)}
                        className="flex w-full items-center justify-between text-left text-xs font-medium text-slate-500 hover:text-slate-800"
                      >
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          {calmChecks.length} mục kiểm tra khác đang ổn định (0 tồn đọng)
                        </span>
                        <ChevronDown size={14} className={`transition-transform ${showCalmChecks ? 'rotate-180' : ''}`} />
                      </button>
                      {showCalmChecks && (
                        <div className="mt-2 divide-y divide-slate-200/70 border-t border-slate-200/70 pt-1">
                          {calmChecks.map((item) => (
                            <div key={item.key} className="flex items-center justify-between py-2 text-xs text-slate-500">
                              <span>{item.label}</span>
                              <Link to={item.to} className="font-semibold text-slate-700 hover:text-brand-700">{item.action} →</Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* RIGHT (35%): Compact Rail — Tax, Workshop & Inventory, Odoo Sync */}
              <div className="space-y-4">
                {/* Tax Liability Card (Preserves 6th KPI cleanly) */}
                <Card className="bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <ShieldCheck size={14} className="text-slate-400" />Thuế tạm tính trong kỳ
                    </span>
                    <Link to="/reports?book=SME-VAT" className="text-xs font-semibold text-brand-700 hover:underline">Sổ thuế →</Link>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <p className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{formatVnd(metrics.taxLiability)}</p>
                    <ChangePill change={comparison.taxLiability} />
                  </div>
                  <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2.5">
                    <Sub label="VAT đầu ra" value={tax.outputVat}/>
                    <Sub label={tax.personalIncome ? 'TNCN khoán' : 'VAT đầu vào được trừ'} value={tax.personalIncome || tax.inputVat}/>
                  </div>
                </Card>

                {/* Workshop & Inventory Summary */}
                <Card className="overflow-hidden bg-white">
                  <WidgetHeader
                    icon={<Factory size={15}/>}
                    title="Xưởng & Tồn kho"
                    right={<button onClick={() => setTab('operations')} className="text-[11px] font-semibold text-brand-700 hover:underline">Xem tất cả →</button>}
                  />
                  <div className="space-y-3 p-4">
                    {data?.lowStock?.length ? (
                      <div className="space-y-1.5">
                        {data.lowStock.map((row: any) => (
                          <Link key={row.id} to={`/catalog?tab=materials&view=${encodeURIComponent(row.viewKey || row.code || row.id)}`} className="flex items-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/70 px-3 py-2 text-rose-900 hover:bg-rose-100/60 transition-colors">
                            <AlertTriangle size={13} className="shrink-0 text-rose-600"/>
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{row.name}</span>
                            <span className="whitespace-nowrap text-xs font-bold tabular-nums">{formatNumber(row.stock)} / {formatNumber(row.minStock)} {row.unit}</span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-600"/>
                        <span>Tồn kho vật tư đang ở mức an toàn.</span>
                      </div>
                    )}

                    <div className="divide-y divide-slate-100">
                      {data?.production?.length ? data.production.slice(0, 3).map((job: any) => (
                        <Link key={job.id} to={`/workshop?view=${encodeURIComponent(job.code)}`} className="block py-2.5 first:pt-0 last:pb-0 group">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-slate-800 group-hover:text-brand-700">{job.productName} <span className="text-slate-400 font-normal">({job.code})</span></span>
                            <span className="text-xs font-bold text-slate-700 tabular-nums">{formatNumber(job.progress)}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-slate-800 transition-all group-hover:bg-brand-600" style={{ width:`${job.progress || 0}%` }}/>
                          </div>
                        </Link>
                      )) : <p className="py-1 text-xs text-slate-400">Không có lệnh đang sản xuất.</p>}
                    </div>
                  </div>
                </Card>

                {/* Odoo ERP Sync Health */}
                <Card className="bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${data?.integrations?.odoo?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <p className="text-xs font-semibold text-slate-900">Đồng bộ Odoo ERP</p>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {actions.pendingOdoo ? `${actions.pendingOdoo} hồ sơ đang chờ đồng bộ` : data?.integrations?.odoo?.connected ? 'Trực tuyến · Không có hồ sơ tồn' : 'Mất kết nối · Đang chờ thử lại'}
                      </p>
                    </div>
                    {user?.role === 'OWNER' ? (
                      <Button variant="secondary" compact disabled={syncing || !data?.integrations?.odoo?.connected || !actions.pendingOdoo} onClick={() => void retry()}>
                        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''}/>Thử lại
                      </Button>
                    ) : (
                      <Link to="/settings?tab=integrations" className="text-xs font-semibold text-brand-700 hover:underline">Chi tiết</Link>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: BIỂU ĐỒ & PHÂN TÍCH TÀI CHÍNH (Kept intact) */}
        {activeTab === 'charts' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(290px,1fr)]">
            <Card className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 sm:text-base">Dòng tiền thu – chi &amp; Số dư lũy kế</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{formatDate(data?.chartFrom)} – {formatDate(data?.chartTo)}</p>
                </div>
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  {[['7','7 ngày'],['14','14 ngày'],['30','30 ngày'],['month','Theo tháng']].map(([value,label]) => (
                    <button key={value} onClick={() => setChartRange(value)} className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${chartRange === value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="my-3 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                <ChartTotal label="Tổng thu vào" value={data?.chartTotals?.income} tone="text-emerald-700"/>
                <ChartTotal label="Tổng chi ra" value={data?.chartTotals?.expense} tone="text-rose-700"/>
                <ChartTotal label="Chênh lệch ròng" value={data?.chartTotals?.net} tone="text-brand-700"/>
              </div>

              <div className="h-[290px] w-full" aria-label="Biểu đồ dòng tiền" data-chart="cashflow">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data?.trend || []} barGap={4} barCategoryGap="24%" margin={{ top:12,right:8,left:0,bottom:5 }}>
                    <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 4"/>
                    <XAxis dataKey="date" tickFormatter={(value) => chartRange === 'month' ? `${String(value).slice(5,7)}/${String(value).slice(0,4)}` : `${String(value).slice(8,10)}/${String(value).slice(5,7)}`} minTickGap={14} tick={{ fontSize:10,fill:'#64748B' }} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="cash" ticks={ticks} domain={[0,ticks[4]]} width={64} tickFormatter={(value) => formatAxisMoney(value,ticks[4])} tick={{ fontSize:10,fill:'#64748B' }} axisLine={false} tickLine={false}/>
                    <YAxis yAxisId="balance" orientation="right" width={64} tickFormatter={(value) => formatAxisMoney(value)} tick={{ fontSize:10,fill:'#4F46E5' }} axisLine={false} tickLine={false} domain={([min,max]: [number,number]) => { const padding = Math.max(1000000,(max-min)*0.15); return [Math.floor((min-padding)/1000000)*1000000,Math.ceil((max+padding)/1000000)*1000000]; }}/>
                    <Tooltip content={<CashTooltip monthly={chartRange === 'month'}/>} cursor={{ fill:'#F1F5F9',opacity:0.6 }}/>
                    <Legend wrapperStyle={{ fontSize:11,paddingTop:8 }}/>
                    <Bar yAxisId="cash" name="Thu vào" dataKey="thu" fill="#10B981" maxBarSize={32} radius={[4,4,0,0]}/>
                    <Bar yAxisId="cash" name="Chi ra" dataKey="chi" fill="#EF4444" maxBarSize={32} radius={[4,4,0,0]}/>
                    <Line yAxisId="balance" name="Số dư lũy kế" dataKey="balance" type="monotone" stroke="#4F46E5" strokeWidth={2.2} dot={false} activeDot={{ r:4,stroke:'#fff',strokeWidth:2 }}/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <div className="grid gap-4 content-start">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cơ cấu chi phí &amp; Thuế</h2>
                  <span className="text-[10px] text-slate-400">Trong kỳ</span>
                </div>
                {costs.length ? <>
                  <div className="h-36 my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={costs} dataKey="amount" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="white" strokeWidth={2}>
                          {costs.map((row: any) => <Cell key={row.name} fill={row.color}/>)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatVnd(value)} contentStyle={{ borderRadius:8,fontSize:11,border:'1px solid #E2E8F0' }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {costs.map((row: any) => (
                      <div key={row.name} className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background:row.color }}/>
                        <span className="min-w-0 flex-1 truncate text-slate-600">{row.name}</span>
                        <span className="w-9 text-right tabular-nums text-slate-400">{costTotal ? Math.round(row.amount/costTotal*100) : 0}%</span>
                        <span className="min-w-20 text-right font-semibold tabular-nums text-slate-900">{formatVnd(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                </> : <p className="py-8 text-center text-xs text-slate-400">Chưa phát sinh chi phí trong kỳ.</p>}
              </Card>

              <Card className="p-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tuổi nợ phải thu</h2>
                  <Link to="/invoices?type=OUTPUT" className="text-xs font-semibold text-brand-700 hover:underline">Chi tiết</Link>
                </div>
                <div className="my-2.5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <span className="bg-emerald-500 transition-all" style={{ width:`${agingTotal ? data.aging.current/agingTotal*100 : 0}%` }}/>
                  <span className="bg-rose-500 transition-all" style={{ width:`${agingTotal ? data.aging.overdue/agingTotal*100 : 0}%` }}/>
                </div>
                <Sub label="Trong hạn thanh toán" value={data?.aging?.current}/>
                <div className="mt-1.5"><Sub label="Quá hạn thanh toán" value={data?.aging?.overdue} danger/></div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 3: CHỨNG TỪ & TIẾN ĐỘ XƯỞNG (60% Compact Document Table / 40% Workshop Progress) */}
        {activeTab === 'operations' && (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(290px,1fr)]">
            <Card className="overflow-hidden bg-white">
              <WidgetHeader
                icon={<FileText size={15}/>}
                title="Chứng từ phát sinh gần nhất"
                right={<Link to="/invoices" className="text-[11px] font-semibold text-brand-700 hover:underline">Tất cả chứng từ →</Link>}
              />
              <div className="divide-y divide-slate-100">
                {data?.recentDocuments?.map((row: any) => (
                  <Link
                    key={`${row.entity}-${row.id}`}
                    to={pathFor(row)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 hover:bg-slate-50/80 transition-colors sm:grid-cols-[minmax(0,1.4fr)_auto_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{row.code}</span>
                        <span className="text-[11px] text-slate-400">· {formatDate(row.date)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{row.counterparty || 'Chứng từ nội bộ'}</p>
                    </div>
                    <div className="hidden sm:block">
                      <StatusBadge status={row.status}/>
                    </div>
                    <div className="text-right">
                      <span className={`block whitespace-nowrap text-xs font-bold tabular-nums ${['INPUT','EXPENSE','WASTE'].includes(row.direction) ? 'text-rose-700' : 'text-slate-900'}`}>
                        {['INPUT','EXPENSE','WASTE'].includes(row.direction) ? '−' : '+'}{formatVnd(row.total)}
                      </span>
                      <span className="mt-1 inline-block sm:hidden"><StatusBadge status={row.status}/></span>
                    </div>
                  </Link>
                ))}
                {!data?.recentDocuments?.length && <p className="px-5 py-10 text-center text-xs text-slate-400">Chưa có chứng từ phát sinh trong kỳ.</p>}
              </div>
            </Card>

            <Card className="overflow-hidden bg-white">
              <WidgetHeader
                icon={<Factory size={15}/>}
                title="Tiến độ xưởng & Cảnh báo tồn kho"
                right={<Link to="/workshop" className="text-[11px] font-semibold text-brand-700 hover:underline">Quản lý xưởng →</Link>}
              />
              <div className="space-y-3 p-4">
                {data?.lowStock?.length > 0 && (
                  <div className="space-y-1.5 border-b border-slate-100 pb-3">
                    {data.lowStock.map((row: any) => (
                      <Link key={row.id} to={`/catalog?tab=materials&view=${encodeURIComponent(row.viewKey || row.code || row.id)}`} className="flex items-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/70 px-3 py-2 text-rose-900">
                        <AlertTriangle size={13} className="shrink-0 text-rose-600"/>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{row.name}</span>
                        <span className="whitespace-nowrap text-xs font-bold tabular-nums">{formatNumber(row.stock)} / {formatNumber(row.minStock)} {row.unit}</span>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {data?.production?.length ? data.production.map((job: any) => (
                    <Link key={job.id} to={`/workshop?view=${encodeURIComponent(job.code)}`} className="block py-3 first:pt-0 last:pb-0 group">
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800 group-hover:text-brand-700 transition-colors">{job.productName}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{job.code} · {job.stage}</p>
                        </div>
                        <span className="text-xs font-bold text-slate-900 tabular-nums">{formatNumber(job.progress)}%</span>
                      </div>
                      <div className="my-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-800 transition-all group-hover:bg-brand-600" style={{ width:`${job.progress || 0}%` }}/>
                      </div>
                      <p className="flex justify-between text-[11px] text-slate-400">
                        <span>{formatNumber(job.laborHours)} giờ công</span>
                        <span>Hạn {formatDate(job.dueDate)}</span>
                      </p>
                    </Link>
                  )) : <p className="text-xs text-slate-400">Không có lệnh đang sản xuất.</p>}
                </div>
              </div>
            </Card>
          </div>
        )}
      </>
    )}
  </>;
}

function ChangePill({ change }: { change?: any }) {
  if (change?.change == null) return <span className="text-[11px] font-medium text-slate-400">Mới</span>;
  const positive = change.change >= 0;
  return (
    <span className={`text-[11px] font-semibold tabular-nums ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>
      {change.change > 0 ? '+' : ''}{formatNumber(change.change)}%
    </span>
  );
}

function StripMetric({
  title,
  amount,
  change,
  to,
  subLabel,
  subValue,
  danger = false,
}: {
  title: string;
  amount: unknown;
  change?: any;
  to: string;
  subLabel: string;
  subValue: unknown;
  danger?: boolean;
}) {
  return (
    <Link to={to} className="group flex flex-col justify-between p-4 sm:p-5 transition-colors hover:bg-slate-50/70">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</span>
          <ArrowRight size={13} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <p className={`text-lg font-bold tracking-tight tabular-nums ${danger ? 'text-rose-700' : 'text-slate-900'}`}>
            {formatVnd(amount)}
          </p>
          <ChangePill change={change} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px]">
        <span className={`truncate ${danger ? 'font-medium text-rose-700' : 'text-slate-500'}`}>{subLabel}</span>
        <span className={`whitespace-nowrap font-semibold tabular-nums ${danger ? 'text-rose-700' : 'text-slate-700'}`}>{formatVnd(subValue)}</span>
      </div>
    </Link>
  );
}

function Sub({ label, value, danger = false }: { label: string; value: unknown; danger?: boolean }) {
  return <div className="flex items-center justify-between gap-3 text-xs">
    <span className={danger ? 'font-medium text-rose-700' : 'text-slate-500'}>{label}</span>
    <span className={`whitespace-nowrap font-bold tabular-nums ${danger ? 'text-rose-700' : 'text-slate-800'}`}>{formatVnd(value)}</span>
  </div>;
}

function ChartTotal({ label, value, tone }: { label: string; value: unknown; tone: string }) {
  return <div className="px-3">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    <p className={`mt-0.5 text-sm font-bold tabular-nums sm:text-base ${tone}`}>{formatVnd(value)}</p>
  </div>;
}

function WidgetHeader({ icon, title, right }: { icon: ReactNode; title: string; right?: ReactNode }) {
  return <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
    <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
      <span className="text-slate-400">{icon}</span>{title}
    </h2>
    {right}
  </div>;
}

function Task({ count = 0, label, to, action }: { count?: number; label: string; to: string; action: string }) {
  return <div className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors">
    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-1.5 text-xs font-bold text-amber-800 tabular-nums">
      {count}
    </span>
    <p className="min-w-0 flex-1 text-xs font-semibold text-slate-800">{label}</p>
    <Link to={to} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">{action}<span aria-hidden="true"> →</span></Link>
  </div>;
}

function CashTooltip({ active, payload, monthly }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="min-w-56 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl">
    <p className="mb-2 text-xs font-bold text-slate-900">{monthly ? `Tháng ${row.date.slice(5,7)}/${row.date.slice(0,4)}` : formatDate(row.date)}</p>
    <div className="space-y-1.5">
      <Sub label="Tổng thu" value={row.thu}/>
      <Sub label="Tổng chi" value={row.chi}/>
      <Sub label="Chênh lệch ròng" value={row.net}/>
      <div className="border-t border-slate-100 pt-1.5">
        <Sub label="Số dư lũy kế" value={row.balance}/>
      </div>
    </div>
  </div>;
}
