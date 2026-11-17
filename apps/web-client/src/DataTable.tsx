import { useEffect,useMemo,useRef,useState,type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button,EmptyState,SearchBox,StatusBadge } from './components';
import { exportExcel,type ExportColumn } from './exports';
import { AlertTriangle,ArrowDownToLine,ArrowUpDown,Check,Columns3,Filter,RotateCcw } from 'lucide-react';
import { actionLabel,displayLabel,entityLabels,formatNumber,formatTaxRate,isMoneyField,plainValue,referenceText,vietnamDate } from './presentation';
import { formatDate,formatVnd,statusLabel,today } from './api';
import { useLanguage } from './language';

// Các cột phụ mặc định ẩn khi bảng có từ 7 cột trở lên để vừa khít 1 màn hình không cần kéo ngang
const SECONDARY_COLUMN_KEYS = new Set([
  'direction',
  'subtotal',
  'taxAmount',
  'costEstimate',
  'accountName',
  'category',
  'discountAmount',
  'roundingAdjustment',
  'bankFeeAmount',
  'invoiceId',
  'paymentId',
  'LegalReference',
  'legalReference',
  'effectiveFrom',
  'effectiveTo',
]);

export function Pagination({ page, pageSize, total, onPage, onPageSize }: { page: number; pageSize: number; total: number; onPage: (value: number) => void; onPageSize: (value: number) => void }) {
  const { t, isEn } = useLanguage();
  const count = Math.max(1, Math.ceil(total / pageSize));
  const pagesLabels = [
    { label: t('Đầu'), value: 1 },
    { label: t('Trước'), value: page - 1 },
    ...Array.from({ length: Math.min(5, count) }, (_, index) => {
      const value = Math.min(Math.max(1, page - 2), Math.max(1, count - 4)) + index;
      return { label: String(value), value };
    }),
    { label: t('Tiếp'), value: page + 1 },
    { label: t('Cuối'), value: count }
  ];

  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 px-4 py-3 text-xs text-slate-500">
    <span>
      {t('Hiển thị')}{' '}
      <b className="text-slate-800">{total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)}</b>{' '}
      {t('trên')}{' '}
      <b className="text-slate-800">{total}</b>{' '}
      {t('bản ghi')}
    </span>
    <div className="flex flex-wrap items-center gap-1.5">
      <select aria-label={isEn ? 'Rows per page' : 'Số dòng mỗi trang'} value={pageSize} onChange={(event) => { onPageSize(Number(event.target.value)); onPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
        {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} {t('dòng')}</option>)}
      </select>
      {pagesLabels.map(({ label, value }) => <button key={label} disabled={value < 1 || value > count || value === page} onClick={() => onPage(value)} className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-30 ${String(page) === label ? 'border-brand-600 bg-brand-50 text-brand-700 font-bold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}
    </div>
  </div>;
}

export function DataTable({ title, rows, columns, controls, emptyTitle, emptyHint }: { emptyTitle?: string; emptyHint?: string; title: string; rows: Record<string, any>[]; columns: ExportColumn[]; controls?: (row: any) => ReactNode }) {
  const { t, isEn } = useLanguage();
  const location = useLocation();
  const initialParams = new URLSearchParams(location.search);
  const initialQ = initialParams.get('q') || '';
  const initialStatus = initialParams.get('status') || '';
  const [search, setSearch] = useState(initialQ), [query, setQuery] = useState(initialQ), [status, setStatus] = useState(initialStatus), [type, setType] = useState(''), [page, setPage] = useState(1), [pageSize, setPageSize] = useState(10), [sort, setSort] = useState({ key: '', descending: false });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(() => `fintax_cols_v1_${location.pathname}_${title}`, [location.pathname, title]);

  const computeDefaultVisibleKeys = useMemo(() => {
    const isWideTable = columns.length >= 7;
    const defaults = columns
      .filter((col) => {
        if (col.defaultHidden !== undefined) return !col.defaultHidden;
        if (isWideTable && SECONDARY_COLUMN_KEYS.has(col.key)) return false;
        return true;
      })
      .map((col) => col.key);
    return defaults.length >= 2 ? defaults : columns.map((col) => col.key);
  }, [columns]);

  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((k) => columns.some((c) => c.key === k));
          if (valid.length >= 2) return valid;
        }
      }
    } catch {
      // ignore storage errors
    }
    return computeDefaultVisibleKeys;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((k) => columns.some((c) => c.key === k));
          if (valid.length >= 2) {
            setVisibleKeys(valid);
            return;
          }
        }
      }
    } catch {
      // ignore
    }
    setVisibleKeys(computeDefaultVisibleKeys);
  }, [storageKey, computeDefaultVisibleKeys, columns]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target as Node)) {
        setColMenuOpen(false);
      }
    }
    if (colMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [colMenuOpen]);

  const saveVisibleKeys = (next: string[]) => {
    setVisibleKeys(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const toggleColumn = (key: string) => {
    if (visibleKeys.includes(key)) {
      if (visibleKeys.length <= 2) return; // Giữ tối thiểu 2 cột
      saveVisibleKeys(visibleKeys.filter((k) => k !== key));
    } else {
      const ordered = columns.map((c) => c.key).filter((k) => k === key || visibleKeys.includes(k));
      saveVisibleKeys(ordered);
    }
  };

  const visibleColumns = useMemo(
    () => columns.filter((col) => visibleKeys.includes(col.key)),
    [columns, visibleKeys]
  );

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search);
    const nextQ = nextParams.get('q') || '';
    const nextStatus = nextParams.get('status') || '';
    setSearch(nextQ);
    setQuery(nextQ);
    setStatus(nextStatus);
    setPage(1);
  }, [location.pathname, location.search]);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search), 250); return () => window.clearTimeout(timer); }, [search]);
  const typeOf = (row: any) => String(row.direction || row.type || row.category || row.role || '');
  const statuses = [...new Set(rows.flatMap((row) => [row.status, row.paymentStatus, row.approvalStatus]).filter(Boolean).map(String))];
  const types = [...new Set(rows.map(typeOf).filter(Boolean))];
  const filtered = useMemo(() => rows.filter((row) => (!query || [JSON.stringify(row),...Object.values(row).filter((value) => typeof value === 'string').map(displayLabel)].join(' ').toLocaleLowerCase(isEn ? 'en-US' : 'vi').includes(query.toLocaleLowerCase(isEn ? 'en-US' : 'vi'))) && (!status || [row.status, row.paymentStatus, row.approvalStatus].includes(status)) && (!type || typeOf(row) === type)), [rows, query, status, type, isEn]);
  const sorted = useMemo(() => sort.key ? [...filtered].sort((a,b) => { const x = a[sort.key], y = b[sort.key]; const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), isEn ? 'en-US' : 'vi', { numeric: true }); return sort.descending ? -order : order; }) : filtered, [filtered, sort, isEn]);
  useEffect(() => setPage(1), [query, status, type]);
  const current = Math.min(page, Math.max(1, Math.ceil(sorted.length / pageSize)));
  const warning = (row: any) => ['CANCELLED','VOID'].includes(row.status) ? '' : row.dueDate && row.dueDate < today() && Number(row.openBalance ?? 0) > 0 || row.trackInventory !== false && row.stock !== undefined && row.minStock !== undefined && Number(row.stock) <= Number(row.minStock) || Number(row.balance) < 0 ? 'red' : ['REVIEW_REQUIRED','NEEDS_REVIEW','PENDING_APPROVAL'].includes(row.status) ? 'amber' : '';
  const display = (row: any, column: ExportColumn, exportValue = false): any => {
    const { key } = column, value = row[key];
    if (value === undefined || value === null || value === '') return '—';
    if (column.format === 'money' || isMoneyField(key)) return exportValue ? Number(value) : formatVnd(value);
    if (column.format === 'date') return formatDate(value);
    if (/^(createdAt|updatedAt|simulatedAt|created_at|updated_at)$/.test(key)) return vietnamDate(value,true);
    if (key === 'matchField') return isEn ? ({description:'Description',counterparty:'Client / Partner',accountName:'Cash / Bank Account'} as Record<string,string>)[String(value)] || 'Description' : ({description:'Nội dung',counterparty:'Khách / người bán',accountName:'Tài khoản tiền'} as Record<string,string>)[String(value)] || 'Nội dung';
    if (key === 'confidence') return `${formatNumber(value)}%`;
    if (key === 'entity') return entityLabels[String(value)] || (isEn ? 'Record' : 'Hồ sơ');
    if (key === 'action' || key === 'operation') return key === 'action' ? actionLabel(value) : displayLabel(value);
    if (['recordId','record_id'].includes(key)) return row.recordCode || row.code || row.afterData?.code || row.beforeData?.code || row.afterData?.name || entityLabels[row.entity] || (isEn ? 'Record' : 'Hồ sơ');
    if (key.endsWith('Id')) return referenceText(row,key);
    if (/Rate$/.test(key)) return formatTaxRate(['wasteRate','marginRate'].includes(key) && Number(value) < 1 ? Number(value)*100 : value, row.taxTreatment);
    if (key === 'last_error') return !value ? '—' : isEn ? 'Configuration / connection error' : /ngày giấy tờ|quá 7 ngày|đúng kỳ/i.test(value) ? 'Cần tỷ giá đúng kỳ' : /tax|thuế/i.test(value) ? 'Cần khớp mức thuế' : /VND|tiền tệ|tỷ giá/i.test(value) ? 'Cần kiểm tra VND và tỷ giá' : /connect|timeout|ECONN/i.test(value) ? 'Lỗi kết nối · Chờ thử lại' : 'Kiểm tra cấu hình Odoo';
    if (key === 'progress') return exportValue ? `${value}%` : <div className="min-w-24"><div className="mb-1 text-right text-xs font-bold text-slate-700">{formatNumber(value)}%</div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100,Number(value))}%` }}/></div></div>;
    if (column.format === 'status' || column.format === 'classification' || ['status','direction','type','approvalStatus','odooSyncStatus','syncStatus','role','source','taxMode','ownerScope'].includes(key)) {
      const isPayment = key === 'direction' && ['PAID','RECEIVED','PAYMENT','RECEIPT'].includes(value);
      const stockReceipt=key==='type'&&value==='RECEIPT'&&(row.materialId||row.productId);
      const label = stockReceipt?(isEn ? 'Purchase Receipt' : 'Nhập mua'):isPayment ? ['PAID','PAYMENT'].includes(value) ? (isEn ? 'Payment Voucher' : 'Phiếu chi') : (isEn ? 'Receipt Voucher' : 'Phiếu thu') : displayLabel(value);
      const tone = isPayment ? ['PAID','PAYMENT'].includes(value) ? 'INPUT' : 'OUTPUT' : value;
      return exportValue ? label : <StatusBadge status={tone} label={label}/>;
    }
    return typeof value === 'number' ? exportValue ? value : formatNumber(value) : plainValue(value);
  };
  const download = () => exportExcel(t(title), sorted.map((row) => Object.fromEntries(columns.map((column) => [column.key, display(row,column,true)]))), columns);
  const hiddenCount = columns.length - visibleColumns.length;

  return <div className="rounded-xl border border-slate-200/80 bg-white shadow-soft overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 bg-white">
      <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
        <div className="w-full sm:w-60"><SearchBox value={search} onChange={setSearch}/></div>
        <Filter size={14} className="hidden text-slate-400 sm:block"/>
        <select aria-label={isEn ? 'Filter status' : 'Lọc trạng thái'} value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
          <option value="">{t('Tất cả trạng thái')}</option>
          {statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select>
        {types.length > 0 && <select aria-label={isEn ? 'Filter type' : 'Lọc loại'} value={type} onChange={(event) => setType(event.target.value)} className="max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700">
          <option value="">{t('Tất cả loại')}</option>
          {types.map((value) => <option key={value} value={value}>{value === 'PAID' ? (isEn ? 'Payment Voucher' : 'Phiếu chi') : statusLabel(value)}</option>)}
        </select>}
      </div>

      <div className="flex items-center gap-2">
        {/* Column Visibility Toggle (Chuẩn Odoo 16 & shadcn/ui) */}
        {columns.length > 3 && (
          <div ref={colMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setColMenuOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                hiddenCount > 0
                  ? 'border-brand-200 bg-brand-50/70 text-brand-700 hover:bg-brand-100/70'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title={isEn ? 'Customize visible columns' : 'Tùy chỉnh ẩn/hiện các cột dữ liệu'}
            >
              <Columns3 size={13} className={hiddenCount > 0 ? 'text-brand-600' : 'text-slate-500'} />
              <span>{isEn ? 'Columns' : 'Cột hiển thị'}</span>
              <span className="rounded-full bg-white/90 px-1.5 py-0.2 text-[10px] font-bold tabular-nums border border-slate-200/80">
                {visibleColumns.length}/{columns.length}
              </span>
            </button>

            {colMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between border-b border-slate-100 px-2 pb-2 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {isEn ? 'Toggle Columns' : 'Ẩn / Hiện cột'}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => saveVisibleKeys(computeDefaultVisibleKeys)}
                      className="inline-flex items-center gap-0.5 text-slate-500 hover:text-brand-700"
                      title="Khôi phục bộ cột gọn mặc định"
                    >
                      <RotateCcw size={11} />
                      <span>{isEn ? 'Compact' : 'Mặc định'}</span>
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => saveVisibleKeys(columns.map((c) => c.key))}
                      className="text-brand-600 hover:underline"
                    >
                      {isEn ? 'Show all' : 'Hiện tất cả'}
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
                  {columns.map((col) => {
                    const checked = visibleKeys.includes(col.key);
                    const disabled = checked && visibleKeys.length <= 2;
                    return (
                      <button
                        key={col.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleColumn(col.key)}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                          checked ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        } disabled:opacity-40`}
                      >
                        <span className="truncate">{t(col.label)}</span>
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <Button variant="secondary" compact onClick={download}><ArrowDownToLine size={13}/>{t('Xuất Excel (.xlsx)')}</Button>
      </div>
    </div>
    {sorted.length ? <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200/90 bg-slate-50/90">
          <tr>
            <th className="w-12 whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('STT')}</th>
            {visibleColumns.map((column) => <th key={column.key} className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${column.format === 'money' || isMoneyField(column.key) ? 'text-right' : ''}`}>
              <button onClick={() => setSort({ key: column.key, descending: sort.key === column.key ? !sort.descending : false })} className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors">
                {t(column.label)}
                <ArrowUpDown size={11} className={sort.key === column.key ? 'text-brand-600' : 'text-slate-300'}/>
              </button>
            </th>)}
            {controls && <th className="sticky right-0 z-10 bg-slate-50/95 backdrop-blur-[1px] whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.06)]">{isEn ? 'Actions' : 'Thao tác'}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.slice((current - 1) * pageSize, current * pageSize).map((row,index) => {
            const rowWarn = warning(row);
            const stickyBg = rowWarn === 'red' ? 'bg-red-50/95 group-hover:bg-red-50' : rowWarn === 'amber' ? 'bg-amber-50/95 group-hover:bg-amber-50' : 'bg-white/95 group-hover:bg-slate-50';
            return <tr key={row.id || index} className={`group transition-colors ${rowWarn === 'red' ? 'bg-red-50/60 hover:bg-red-50' : rowWarn === 'amber' ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50/80'}`}>
              <td className="px-3 py-2.5 text-xs tabular-nums text-slate-400">
                <span className="flex items-center gap-1.5">
                  {rowWarn && <AlertTriangle size={13} className={rowWarn === 'red' ? 'text-red-600' : 'text-amber-600'} aria-label={rowWarn === 'red' ? (isEn ? 'Urgent action required' : 'Cần xử lý ngay') : (isEn ? 'Review needed' : 'Cần rà soát')}/>}
                  <span>{(current - 1) * pageSize + index + 1}</span>
                </span>
              </td>
              {visibleColumns.map((column) => <td key={column.key} className={`max-w-[220px] truncate px-3 py-2.5 text-xs sm:text-[13px] ${column.format === 'money' || isMoneyField(column.key) ? 'whitespace-nowrap text-right font-semibold tabular-nums text-slate-900' : ['code','name','counterparty'].includes(column.key) ? 'font-semibold text-slate-900' : 'text-slate-600'}`} title={typeof row[column.key] === 'string' ? row[column.key] : undefined}>
                {display(row,column)}
              </td>)}
              {controls && <td className={`sticky right-0 z-10 px-3 py-2 text-right transition-colors shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.06)] ${stickyBg}`}>
                <div className="flex min-w-max flex-wrap justify-end gap-1">{controls(row)}</div>
              </td>}
            </tr>;
          })}
        </tbody>
      </table>
    </div> : <EmptyState title={query || status || type ? (isEn ? 'No results found' : 'Không tìm thấy kết quả') : emptyTitle ? t(emptyTitle) : t('Chưa có gì ở đây')} description={query || status || type ? (isEn ? 'Try different keywords or clear filters.' : 'Thử tìm từ khóa khác hoặc xóa bộ lọc.') : emptyHint ? t(emptyHint) : t('Bấm nút thêm ở góc trên để bắt đầu.')}/>}
    <Pagination page={current} pageSize={pageSize} total={sorted.length} onPage={setPage} onPageSize={setPageSize}/>
  </div>;
}
