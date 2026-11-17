import { useCallback,useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { Link,useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowRight, BarChart3, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardList, Factory, FilePlus2, FileText, Landmark, LayoutGrid, RefreshCw, ShieldCheck, ShoppingCart, Wallet } from 'lucide-react';
import { Bar,CartesianGrid,Cell,ComposedChart,Legend,Line,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import { api,actionRecord,formatDate,formatVnd,messageOf,today } from './api';
import { Button,Card,StatusBadge,useToast } from './components';
import { roleName } from './RoleHome';
import { useAuth } from './auth';
import { formatAxisMoney,formatNumber,moneyTicks } from './presentation';

type DashboardTab = 'overview' | 'charts' | 'operations';

const dayShift = (day: string, count: number) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0,10); };
const pathFor = (row: any) => `${({ invoices: '/invoices', transactions: '/transactions', quotations: '/quotations', 'stock-movements': '/inventory' } as Record<string,string>)[row.entity] || '/invoices'}?view=${encodeURIComponent(row.viewKey || row.code || row.id)}${row.entity === 'invoices' ? `&type=${row.direction}` : ''}`;

function QuickActionsBar() {
  const { user } = useAuth();
  const items = user?.role === 'ACCOUNTANT' ? [
    { to: '/invoices?new=1&type=OUTPUT', label: 'Hóa đơn bán', icon: FilePlus2, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/80' },
    { to: '/invoices?new=1&type=INPUT', label: 'Hóa đơn mua', icon: ShoppingCart, tone: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100/80' },
    { to: '/transactions?new=1', label: 'Ghi thu chi', icon: Wallet, tone: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100/80' },
    { to: '/reconciliation', label: 'Khớp ngân hàng', icon: Landmark, tone: 'text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100/80' },
  ] : [
    { to: '/invoices?new=1&type=OUTPUT', label: 'Bán hàng', icon: FilePlus2, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/80' },
    { to: '/invoices?new=1&type=INPUT', label: 'Mua hàng', icon: ShoppingCart, tone: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100/80' },
    { to: '/payments?new=1', label: 'Thu / Trả nợ', icon: ArrowLeftRight, tone: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100/80' },
    { to: '/quotations?new=1', label: 'Lập báo giá', icon: FileText, tone: 'text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100/80' },
  ];

  return (
    <div aria-label="Thao tác nhanh" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <span className="hidden text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 lg:inline">Tạo nhanh:</span>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${item.tone}`}
        >
          <item.icon size={14} className="shrink-0" />
          <span>{item.label}</span>
        </Link>
      ))}
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

  const urgentCount =
    Number(actions.quotationCount || 0) +
    (user?.role !== 'OWNER' ? Number(actions.approvedQuoteCount || 0) + Number(actions.rejectedQuoteCount || 0) + Number(actions.acceptedQuoteCount || 0) : 0) +
    Number(actions.unclassifiedCount || 0) +
    Number(actions.reviewInvoiceCount || 0) +
    Number(actions.reconciliationCount || 0) +
    Number(actions.pendingOdoo || 0) +
    Number(data?.lowStock?.length || 0);

  const tabs: Array<{ id: DashboardTab; label: string; icon: any; badge?: number; badgeTone?: string }> = [
    {
      id: 'overview',
      label: 'Tổng quan & Tiền',
      icon: LayoutGrid,
      badge: urgentCount > 0 ? urgentCount : undefined,
      badgeTone: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'charts',
      label: 'Biểu đồ & Phân tích',
      icon: BarChart3,
    },
    {
      id: 'operations',
      label: 'Chứng từ & Tiến độ Xưởng',
      icon: ClipboardList,
      badge: data?.production?.length || undefined,
      badgeTone: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  ];

  return <>
    {/* Compact Executive Header Bar */}
    <Card className="mb-4 p-3.5 sm:px-5 sm:py-3.5 bg-white">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Xin chào, {user?.name || ''}</h1>
              {roleName[user?.role || ''] && (
                <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                  {roleName[user?.role || '']}
                </span>
              )}
              <StatusBadge status={data?.period?.id ? data.period.status : 'DRAFT'} label={data?.period?.id ? data.period.status === 'LOCKED' ? 'Đã chốt sổ kỳ' : 'Kỳ đang mở' : 'Chưa thiết lập kỳ'}/>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Số liệu từ {formatDate(period.from)} đến {formatDate(period.to)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1">
            <CalendarDays size={14} className="text-brand-600 shrink-0"/>
            <select aria-label="Kỳ kế toán" value={preset} onChange={(event) => choosePeriod(event.target.value)} className="bg-transparent text-xs font-semibold text-slate-700 outline-none">
              <option value="month">Tháng này</option>
              <option value="quarter">Quý này</option>
              <option value="custom">Tùy chọn ngày</option>
            </select>
          </div>
          {preset === 'custom' && (
            <form onSubmit={(event) => { event.preventDefault(); if (draft.from && draft.to && draft.from <= draft.to) setPeriod(draft); }} className="flex flex-wrap items-center gap-1.5">
              <input aria-label="Từ ngày" type="date" required value={draft.from} onChange={(event) => setDraft({ ...draft,from:event.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs"/>
              <input aria-label="Đến ngày" type="date" required min={draft.from} value={draft.to} onChange={(event) => setDraft({ ...draft,to:event.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-xs"/>
              <Button type="submit" compact>Áp dụng</Button>
            </form>
          )}
          <Button variant="secondary" compact onClick={() => void load()} disabled={busy}>
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''}/>Làm mới
          </Button>
        </div>
      </div>

      {/* Quick Actions + 3-Tab Switcher */}
      <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Chế độ xem Dashboard" className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/80 p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <tab.icon size={14} className={isActive ? 'text-brand-600' : 'text-slate-400'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`ml-0.5 rounded-full border px-1.5 py-0.2 text-[10px] font-bold leading-4 ${tab.badgeTone}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <QuickActionsBar />
      </div>
    </Card>

    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">{error}</p>}

    {!data && !error ? (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"/>)}
      </div>
    ) : (
      <>
        {/* TAB 1: TỔNG QUAN & TIỀN (6 Compact KPIs + Việc cần xử lý & Cảnh báo xưởng) */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi title="Tiền đang có (Quỹ & NH)" amount={metrics.balance} icon={<Wallet size={16}/>} to="/settings?tab=accounts" change={comparison.balance} tone="blue">
                <Sub label="Quỹ tiền mặt" value={metrics.cashBalance}/>
                <Sub label="Tài khoản ngân hàng" value={metrics.bankBalance}/>
              </Kpi>
              <Kpi title="Doanh thu bán hàng" amount={metrics.netRevenue} icon={<ArrowDownLeft size={16}/>} to="/invoices?type=OUTPUT" change={comparison.netRevenue} tone="green">
                <Sub label="Thực thu trong kỳ" value={metrics.actualReceipts}/>
              </Kpi>
              <Kpi title="Chi phí & Giá vốn đã chi" amount={metrics.operatingCost} icon={<Factory size={16}/>} to="/reports?book=SME-GT" change={comparison.operatingCost} tone="amber">
                <Sub label="Hóa đơn mua vào" value={metrics.inputInvoices}/>
              </Kpi>
              <Kpi title="Phải thu khách hàng" amount={metrics.receivable} icon={<CircleDollarSign size={16}/>} to="/invoices?type=OUTPUT" change={comparison.receivable} tone={metrics.overdueCount ? 'red' : 'blue'}>
                <Sub label={`${metrics.overdueCount || 0} hóa đơn quá hạn`} value={metrics.overdueAmount} danger={metrics.overdueCount > 0}/>
              </Kpi>
              <Kpi title="Phải trả nhà cung cấp" amount={metrics.payable} icon={<Landmark size={16}/>} to="/invoices?type=INPUT" change={comparison.payable} tone="red">
                <Sub label={`Đến hạn 7 ngày (${metrics.upcomingCount || 0} HĐ)`} value={metrics.upcomingAmount}/>
              </Kpi>
              <Kpi title="Thuế tạm tính trong kỳ" amount={metrics.taxLiability} icon={<ShieldCheck size={16}/>} to="/reports?book=SME-VAT" change={comparison.taxLiability} tone="indigo">
                <Sub label="VAT đầu ra" value={tax.outputVat}/>
                <Sub label={tax.personalIncome ? 'TNCN khoán' : 'VAT đầu vào được trừ'} value={tax.personalIncome || tax.inputVat}/>
              </Kpi>
            </div>

            <div className="grid items-start gap-4 lg:grid-cols-2">
              <Card className="overflow-hidden">
                <WidgetHeader icon={<AlertTriangle size={15}/>} title="Cần xử lý ngay"/>
                <div className="divide-y divide-slate-100">
                  {user?.role === 'OWNER' ? (
                    <>
                      <Task count={actions.quotationCount} label="Báo giá chờ duyệt" to="/quotations?status=PENDING_APPROVAL" action="Xem báo giá"/>
                      {actions.pendingQuotes?.map((quote: any) => (
                        <div key={quote.id} className="flex items-center justify-between gap-2 bg-amber-50/70 px-4 py-2 border-b border-amber-100">
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-bold text-amber-900">{quote.code} · {quote.customerName}</span>
                            <span className="block truncate text-[11px] text-amber-700">{quote.title} ({formatVnd(quote.total)})</span>
                          </div>
                          <Button className="shrink-0" compact onClick={() => void approve(quote.id)}>Duyệt ngay</Button>
                        </div>
                      ))}
                      {Number(actions.approvedQuoteCount) > 0 && (
                        <Task count={actions.approvedQuoteCount} label="Báo giá đã duyệt · Chờ gửi khách" to="/quotations?status=APPROVED" action="Xem"/>
                      )}
                    </>
                  ) : (
                    <>
                      <Task count={actions.approvedQuoteCount} label="Báo giá đã được Chủ xưởng duyệt · Cần gửi khách" to="/quotations?status=APPROVED" action="Gửi khách"/>
                      {actions.approvedQuotes?.map((quote: any) => (
                        <div key={quote.id} className="flex items-center justify-between gap-2 bg-emerald-50/80 px-4 py-2 border-b border-emerald-100">
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-bold text-emerald-900">✓ Đã duyệt: {quote.code} · {quote.customerName}</span>
                            <span className="block truncate text-[11px] text-emerald-700">{quote.title} · {formatVnd(quote.total)}</span>
                          </div>
                          <Button variant="secondary" className="shrink-0" compact onClick={() => void markSent(quote.id)}>Đã gửi khách</Button>
                        </div>
                      ))}
                      {Number(actions.rejectedQuoteCount) > 0 && (
                        <>
                          <Task count={actions.rejectedQuoteCount} label="Báo giá bị từ chối · Cần chỉnh sửa lại" to="/quotations?status=REJECTED" action="Sửa lại"/>
                          {actions.rejectedQuotes?.map((quote: any) => (
                            <Link key={quote.id} to={`/quotations?status=REJECTED&view=${encodeURIComponent(quote.code)}`} className="block bg-rose-50/80 px-4 py-2 border-b border-rose-100 hover:bg-rose-100/70 transition-colors">
                              <span className="block truncate text-xs font-bold text-rose-900">✕ Bị từ chối: {quote.code} · {quote.customerName}</span>
                              {quote.rejectionNote && <span className="block truncate text-[11px] text-rose-700">Lý do: {quote.rejectionNote}</span>}
                            </Link>
                          ))}
                        </>
                      )}
                      {Number(actions.acceptedQuoteCount) > 0 && (
                        <Task count={actions.acceptedQuoteCount} label="Báo giá khách đã chốt · Cần tạo việc làm" to="/quotations?status=ACCEPTED" action="Tạo việc làm"/>
                      )}
                      <Task count={actions.quotationCount} label="Báo giá đang chờ Chủ xưởng duyệt" to="/quotations?status=PENDING_APPROVAL" action="Theo dõi"/>
                    </>
                  )}
                  <Task count={actions.unclassifiedCount} label="Khoản thu chi chưa phân loại" to="/transactions?q=UNCLASSIFIED" action="Phân loại"/>
                  <Task count={Number(actions.reviewInvoiceCount || 0)+Number(actions.reconciliationCount || 0)} label="Hóa đơn / Khớp ngân hàng cần rà soát" to="/invoices" action="Rà soát"/>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${actions.pendingOdoo ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{actions.pendingOdoo || 0}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800">Hồ sơ chờ đồng bộ Odoo</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{data?.integrations?.odoo?.connected ? 'Odoo ERP Online · Đồng bộ ổn định' : 'Mất kết nối · Đang chờ thử lại'}</p>
                    </div>
                    {user?.role === 'OWNER' ? (
                      <Button variant="secondary" compact disabled={syncing || !data?.integrations?.odoo?.connected || !actions.pendingOdoo} onClick={() => void retry()}>
                        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''}/>Thử lại
                      </Button>
                    ) : (
                      <Link to="/settings?tab=integrations" className="text-xs font-semibold text-brand-700">Chi tiết</Link>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <WidgetHeader
                  icon={<Factory size={15}/>}
                  title="Cảnh báo tồn kho & Lệnh sản xuất"
                  right={<button onClick={() => setTab('operations')} className="text-[11px] font-semibold text-brand-700 hover:underline">Xem tất cả →</button>}
                />
                <div className="space-y-2.5 p-4">
                  {data?.lowStock?.length ? (
                    <div className="space-y-2">
                      {data.lowStock.map((row: any) => (
                        <Link key={row.id} to={`/catalog?tab=materials&view=${encodeURIComponent(row.viewKey || row.code || row.id)}`} className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-rose-800 hover:bg-rose-100/70 transition-colors">
                          <AlertTriangle size={14} className="shrink-0 text-rose-600"/>
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">{row.name}</span>
                          <span className="whitespace-nowrap text-xs font-bold tabular-nums">{formatNumber(row.stock)} / {formatNumber(row.minStock)} {row.unit}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-800">
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-600"/>
                      <span>Tồn kho vật tư đang ở mức an toàn.</span>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100 pt-1">
                    {data?.production?.length ? data.production.slice(0, 3).map((job: any) => (
                      <Link key={job.id} to={`/workshop?view=${encodeURIComponent(job.code)}`} className="block py-2 first:pt-0 last:pb-0 group">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-slate-800 group-hover:text-brand-700">{job.productName} <span className="text-slate-400 font-normal">({job.code})</span></span>
                          <span className="text-xs font-bold text-brand-700 tabular-nums">{formatNumber(job.progress)}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width:`${job.progress || 0}%` }}/>
                        </div>
                      </Link>
                    )) : <p className="py-2 text-xs text-slate-400">Không có lệnh đang sản xuất.</p>}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: BIỂU ĐỒ & PHÂN TÍCH TÀI CHÍNH */}
        {activeTab === 'charts' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(290px,1fr)]">
            <Card className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 sm:text-base">Dòng tiền thu – chi & Số dư lũy kế</h2>
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
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Cơ cấu chi phí & Thuế</h2>
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

        {/* TAB 3: CHỨNG TỪ & TIẾN ĐỘ XƯỞNG */}
        {activeTab === 'operations' && (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <WidgetHeader
                icon={<Factory size={15}/>}
                title="Tiến độ xưởng & Cảnh báo tồn kho"
                right={<Link to="/workshop" className="text-[11px] font-semibold text-brand-700 hover:underline">Quản lý xưởng →</Link>}
              />
              <div className="space-y-3.5 p-4">
                {data?.production?.length ? data.production.map((job: any) => (
                  <Link key={job.id} to={`/workshop?view=${encodeURIComponent(job.code)}`} className="block group rounded-lg border border-slate-100 p-2.5 hover:border-slate-200 hover:bg-slate-50/50 transition-colors">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800 group-hover:text-brand-700 transition-colors">{job.productName}</p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{job.code} · {job.stage}</p>
                      </div>
                      <span className="text-xs font-bold text-brand-700">{formatNumber(job.progress)}%</span>
                    </div>
                    <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width:`${job.progress || 0}%` }}/>
                    </div>
                    <p className="flex justify-between text-[10px] text-slate-400">
                      <span>{formatNumber(job.laborHours)} giờ công</span>
                      <span>Hạn {formatDate(job.dueDate)}</span>
                    </p>
                  </Link>
                )) : <p className="text-xs text-slate-400">Không có lệnh đang sản xuất.</p>}

                {data?.lowStock?.map((row: any) => (
                  <Link key={row.id} to={`/catalog?tab=materials&view=${encodeURIComponent(row.viewKey || row.code || row.id)}`} className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-rose-800">
                    <AlertTriangle size={14} className="shrink-0 text-rose-600"/>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{row.name}</span>
                    <span className="whitespace-nowrap text-xs font-bold tabular-nums">{formatNumber(row.stock)} / {formatNumber(row.minStock)} {row.unit}</span>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <WidgetHeader
                icon={<FileText size={15}/>}
                title="Chứng từ phát sinh gần nhất"
                right={<Link to="/invoices" className="text-[11px] font-semibold text-brand-700 hover:underline">Tất cả chứng từ →</Link>}
              />
              <div className="divide-y divide-slate-100">
                {data?.recentDocuments?.map((row: any) => (
                  <Link key={`${row.entity}-${row.id}`} to={pathFor(row)} className="block px-4 py-3 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{row.code}</span>
                      <span className={`whitespace-nowrap text-xs font-bold tabular-nums ${['INPUT','EXPENSE','WASTE'].includes(row.direction) ? 'text-rose-700' : 'text-emerald-700'}`}>{formatVnd(row.total)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{row.counterparty || 'Chứng từ nội bộ'}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400">{formatDate(row.date)}</span>
                      <StatusBadge status={row.status}/>
                    </div>
                  </Link>
                ))}
                {!data?.recentDocuments?.length && <p className="px-4 py-8 text-center text-xs text-slate-400">Chưa có chứng từ.</p>}
              </div>
            </Card>
          </div>
        )}
      </>
    )}
  </>;
}

function Kpi({ title, amount, icon, to, change, tone, children }: { title: string; amount: unknown; icon: ReactNode; to: string; change?: any; tone: 'blue'|'green'|'amber'|'red'|'indigo'; children: ReactNode }) {
  const colors = {
    blue:'bg-blue-50 text-blue-700 border border-blue-100',
    green:'bg-emerald-50 text-emerald-700 border border-emerald-100',
    amber:'bg-amber-50 text-amber-700 border border-amber-100',
    red:'bg-rose-50 text-rose-700 border border-rose-100',
    indigo:'bg-indigo-50 text-indigo-700 border border-indigo-100'
  };
  return <Link to={to} className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-soft transition-all duration-150 hover:border-slate-300 hover:shadow-lift">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{title}</p>
      <span className={`rounded-lg p-1.5 shrink-0 ${colors[tone]}`}>{icon}</span>
    </div>
    <div className="mt-1.5 flex items-baseline justify-between gap-2">
      <p className={`text-xl font-bold tracking-tight tabular-nums ${tone === 'red' ? 'text-rose-700' : 'text-slate-900'}`}>{formatVnd(amount)}</p>
      <span className={`text-[11px] shrink-0 flex items-center gap-1 ${change?.change == null ? 'text-slate-400' : change.change >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}`}>
        {change?.change == null ? 'Mới' : `${change.change > 0 ? '+' : ''}${formatNumber(change.change)}%`}
        <ArrowRight size={12} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"/>
      </span>
    </div>
    <div className="mt-2 border-t border-slate-100 pt-2 space-y-1">{children}</div>
  </Link>;
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
  return <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-2.5">
    <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
      <span className="text-brand-600">{icon}</span>{title}
    </h2>
    {right}
  </div>;
}

function Task({ count = 0, label, to, action }: { count?: number; label: string; to: string; action: string }) {
  return <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${count ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
      {count || <CheckCircle2 size={14}/>}
    </span>
    <p className="min-w-0 flex-1 text-xs font-medium text-slate-700">{label}</p>
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
