import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Landmark,
  Lock,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { actionRecord, api, formatDate, formatVnd, messageOf } from './api';
import { Button, StatusBadge, useDialogFocusTrap, useToast } from './components';

type Row = Record<string, any>;

export function TaxPortalBridgeModal({
  initialInvoice,
  onClose,
  onChanged,
}: {
  initialInvoice?: Row | null;
  onClose: () => void;
  onChanged?: () => Promise<void> | void;
}) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(initialInvoice?.mockTaxCode ? 4 : 0);
  const [overview, setOverview] = useState<{
    portalOnline: boolean;
    portalUrl: string;
    workshopName: string;
    workshopTaxCode: string;
    taxHistory: Row[];
    invoices: Row[];
  }>({
    portalOnline: false,
    portalUrl: 'http://localhost:4000',
    workshopName: 'Xưởng Sản Xuất FinWorkshop',
    workshopTaxCode: '0316890123',
    taxHistory: [],
    invoices: [],
  });
  const [selectedInvoice, setSelectedInvoice] = useState<Row | null>(initialInvoice || null);
  const [verifyCodeInput, setVerifyCodeInput] = useState<string>(initialInvoice?.mockTaxCode || '');
  const [verifyResult, setVerifyResult] = useState<Row | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [lastExchange, setLastExchange] = useState<{
    sentPayload: Row;
    responsePayload: Row;
    endpoint: string;
    exchangedAt: string;
  } | null>(initialInvoice?.taxPortalTrace || null);

  useDialogFocusTrap(dialogRef, onClose, Boolean(issuingId));

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/tax-portal/overview');
      setOverview(data);
      setSelectedInvoice((prev) => {
        if (prev) {
          const updated = (data.invoices || []).find((inv: Row) => inv.id === prev.id);
          if (updated) return updated;
        }
        return (data.invoices || [])[0] || null;
      });
    } catch (error) {
      toast(messageOf(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const verifyTaxCodeOnPortal = async (codeToVerify?: string) => {
    const code = (codeToVerify ?? verifyCodeInput).trim();
    if (!code) return;
    setVerifyCodeInput(code);
    setVerifying(true);
    try {
      const { data } = await api.get(`/tax-portal/verify/${encodeURIComponent(code)}`);
      setVerifyResult(data);
    } catch (error: any) {
      setVerifyResult(
        error?.response?.data || {
          success: false,
          message: 'Mã CQT này chưa có trong phiên chạy hiện tại của Cổng Thuế (:4000) hoặc đã khởi động lại.',
        }
      );
    } finally {
      setVerifying(false);
    }
  };

  const runLiveIssueFlow = async (invoice: Row) => {
    if (issuingId || invoice.mockTaxCode) return;
    setSelectedInvoice(invoice);
    setIssuingId(invoice.id);
    setVerifyResult(null);

    const previewPayload = {
      invoiceId: invoice.id,
      invoiceCode: invoice.code,
      invoiceDate: invoice.date,
      sellerName: overview.workshopName,
      sellerTaxCode: overview.workshopTaxCode,
      buyerName: invoice.counterparty || 'Khách hàng',
      buyerTaxCode: invoice.taxCode || '',
      subtotal: invoice.subtotal || 0,
      taxAmount: invoice.taxAmount || 0,
      total: invoice.total || 0,
    };

    try {
      // Bước 1: Đóng gói dữ liệu tại FinWorkshop
      setActiveStep(1);
      await new Promise((r) => setTimeout(r, 450));

      // Bước 2: Truyền gói tin HTTP POST sang Cổng Thuế (:4000)
      setActiveStep(2);
      await new Promise((r) => setTimeout(r, 450));

      // Bước 3: Cổng Thuế kiểm duyệt & Cấp Mã CQT
      setActiveStep(3);
      const updated = await actionRecord<Row>('invoices', invoice.id, 'simulate-code');
      await new Promise((r) => setTimeout(r, 400));

      // Bước 4: Phản hồi về FinWorkshop & Khóa cứng hóa đơn
      setActiveStep(4);
      const trace = updated.taxPortalTrace || {
        endpoint: `${overview.portalUrl}/api/v1/invoices/issue`,
        sentPayload: previewPayload,
        responsePayload: {
          success: true,
          taxAuthorityCode: updated.mockTaxCode,
          mockTaxCode: updated.mockTaxCode,
          invoiceId: updated.id,
          invoiceCode: updated.code,
          issuedAt: updated.simulatedAt,
          status: 'APPROVED',
        },
        exchangedAt: new Date().toISOString(),
      };
      setLastExchange(trace);
      setSelectedInvoice(updated);
      if (updated.mockTaxCode) {
        setVerifyCodeInput(updated.mockTaxCode);
        void verifyTaxCodeOnPortal(updated.mockTaxCode);
      }
      await loadOverview();
      await onChanged?.();
      window.dispatchEvent(new Event('fintax:records-changed'));
      toast(`Đã cấp Mã Cơ Quan Thuế: ${updated.mockTaxCode}`);
    } catch (error) {
      setActiveStep(0);
      toast(messageOf(error), 'error');
    } finally {
      setIssuingId(null);
    }
  };

  const selectInvoiceRow = (inv: Row) => {
    setSelectedInvoice(inv);
    if (inv.mockTaxCode) {
      setActiveStep(4);
      setVerifyCodeInput(inv.mockTaxCode);
      setLastExchange(
        inv.taxPortalTrace || {
          endpoint: `${overview.portalUrl}/api/v1/invoices/issue`,
          sentPayload: {
            invoiceId: inv.id,
            invoiceCode: inv.code,
            invoiceDate: inv.date,
            buyerName: inv.counterparty,
            total: inv.total,
          },
          responsePayload: {
            success: true,
            taxAuthorityCode: inv.mockTaxCode,
            issuedAt: inv.simulatedAt || inv.date,
            status: 'APPROVED',
          },
          exchangedAt: inv.simulatedAt || inv.date,
        }
      );
      void verifyTaxCodeOnPortal(inv.mockTaxCode);
    } else {
      setActiveStep(0);
      setLastExchange(null);
      setVerifyResult(null);
    }
  };

  const steps = [
    {
      step: 1,
      title: '1. Đóng gói tại Xưởng',
      subtitle: 'FinWorkshop (:3001)',
      desc: 'Kiểm tra Số HĐ, MST khách, Tiền hàng, Thuế GTGT & ký điện tử.',
      icon: Building2,
    },
    {
      step: 2,
      title: '2. Truyền gói tin XML/JSON',
      subtitle: 'POST /api/v1/invoices/issue',
      desc: 'Gửi dữ liệu hóa đơn bán ra sang Cổng Tiếp Nhận của Cơ Quan Thuế.',
      icon: Send,
    },
    {
      step: 3,
      title: '3. Cổng Thuế duyệt & Cấp mã',
      subtitle: 'Cổng Thuế (:4000)',
      desc: 'Kiểm tra hợp lệ MST, ngày lập, số tiền và sinh Mã CQT (C26-...).',
      icon: Landmark,
    },
    {
      step: 4,
      title: '4. Nhận mã & Khóa bảo vệ HĐ',
      subtitle: 'Đã cấp mã hóa đơn',
      desc: 'Gắn Mã CQT vào hóa đơn và KHÓA CỨNG tiền/thuế chống sửa đổi.',
      icon: Lock,
    },
  ];

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-2 sm:p-4"
      onMouseDown={(e) => {
        if (!issuingId && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Mô phỏng Tương tác 2 Cổng: Xưởng FinWorkshop và Cổng Hóa Đơn Điện Tử Cơ Quan Thuế"
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <Landmark size={18} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                  Luồng Tương Tác 2 Cổng: Phần mềm Xưởng (FinWorkshop) ⇄ Cổng Hóa Đơn Điện Tử Cơ Quan Thuế
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    overview.portalOnline
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${overview.portalOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {overview.portalOnline ? 'Cổng Thuế :4000 Đang Trực Tuyến' : 'Cổng Thuế :4000 Mất Kết Nối'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Chọn một hóa đơn bán ra bên trái và bấm <b>“Gửi Cổng Thuế & Cấp mã”</b> để quan sát gói tin đi qua 2 cổng theo thời gian thực.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={overview.portalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <ExternalLink size={13} />
              <span>Mở Web Cổng Thuế (:4000)</span>
            </a>
            <Button variant="secondary" compact onClick={() => void loadOverview()} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Làm mới
            </Button>
            <button
              type="button"
              onClick={onClose}
              disabled={Boolean(issuingId)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* 4-Step Visual Pipeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Sparkles size={14} className="text-brand-600" />
                Quy trình 4 bước Cấp Mã Hóa Đơn Điện Tử (Chuẩn Nghị định 123/2020/NĐ-CP)
              </span>
              {selectedInvoice && (
                <span className="text-xs text-slate-600">
                  Đang chọn HĐ: <b className="text-slate-900">{selectedInvoice.code}</b> ({formatVnd(selectedInvoice.total)})
                  {selectedInvoice.mockTaxCode && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 size={12} /> Mã CQT: {selectedInvoice.mockTaxCode}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {steps.map((item, idx) => {
                const Icon = item.icon;
                const isDone = activeStep >= item.step;
                const isCurrent = activeStep === item.step && Boolean(issuingId);
                return (
                  <div
                    key={item.step}
                    className={`relative rounded-xl border p-3 transition-all ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
                        : isDone
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                          isCurrent
                            ? 'bg-blue-600 text-white animate-bounce'
                            : isDone
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isDone && !isCurrent ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                      </span>
                      <span className="font-mono text-[10px] font-semibold text-slate-500">{item.subtitle}</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.desc}</p>
                    {idx < 3 && (
                      <ArrowRight
                        size={14}
                        className={`hidden sm:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 rounded-full bg-white ${
                          activeStep > item.step ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side-by-Side 2 Portals */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* CỔNG 1: PHẦN MỀM NỘI BỘ XƯỞNG (FINWORKSHOP ERP :3001) */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-brand-400" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">Cổng 1 · Phần Mềm Nội Bộ Xưởng (FinWorkshop)</h3>
                    <p className="text-[11px] text-slate-300">
                      {overview.workshopName} · MST: {overview.workshopTaxCode}
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] text-slate-200">Port :5173 / :3001</span>
              </div>

              <div className="p-3 border-b border-slate-100 bg-slate-50/70 text-xs text-slate-600 flex items-center justify-between">
                <span>Danh sách <b>Hóa đơn bán ra (Thu)</b> của xưởng:</span>
                <span className="text-[11px] text-slate-500">
                  Chưa cấp mã: <b>{overview.invoices.filter((i) => !i.mockTaxCode).length}</b> · Đã cấp mã:{' '}
                  <b className="text-emerald-700">{overview.invoices.filter((i) => i.mockTaxCode).length}</b>
                </span>
              </div>

              <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
                {overview.invoices.map((inv) => {
                  const isSelected = selectedInvoice?.id === inv.id;
                  const isIssued = Boolean(inv.mockTaxCode);
                  const isBusy = issuingId === inv.id;

                  return (
                    <div
                      key={inv.id}
                      onClick={() => selectInvoiceRow(inv)}
                      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{inv.code}</span>
                          <StatusBadge status={inv.status} />
                          {isIssued && (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600" title="Đã khóa chống sửa tiền/thuế">
                              <Lock size={10} /> Đã khóa sổ
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-600">
                          {inv.counterparty} · Ngày {formatDate(inv.date)} · <b className="text-slate-900">{formatVnd(inv.total)}</b>
                        </p>
                        {inv.mockTaxCode && (
                          <p className="mt-1 font-mono text-[11px] font-bold text-emerald-700">
                            Mã CQT: {inv.mockTaxCode}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        {!isIssued ? (
                          <Button
                            compact
                            disabled={Boolean(issuingId)}
                            onClick={() => void runLiveIssueFlow(inv)}
                          >
                            <Play size={12} />
                            {isBusy ? 'Đang gửi Cổng Thuế…' : 'Gửi Cổng Thuế & Cấp mã'}
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            compact
                            onClick={() => {
                              selectInvoiceRow(inv);
                              void verifyTaxCodeOnPortal(inv.mockTaxCode);
                            }}
                          >
                            <Search size={12} />
                            Đối chiếu Cổng Thuế
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!overview.invoices.length && (
                  <p className="p-6 text-center text-xs text-slate-400">Chưa có hóa đơn bán ra nào.</p>
                )}
              </div>
            </div>

            {/* CỔNG 2: CỔNG HÓA ĐƠN ĐIỆN TỬ CƠ QUAN THUẾ (MOCK TAX API :4000) */}
            <div className="flex flex-col rounded-xl border border-blue-200 bg-white overflow-hidden shadow-xs">
              <div className="flex items-center justify-between border-b border-blue-200 bg-blue-900 px-4 py-3 text-white">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-amber-300" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">Cổng 2 · Cổng HĐĐT Tổng Cục Thuế (Sandbox)</h3>
                    <p className="text-[11px] text-blue-200">Tiếp nhận tờ khai, kiểm duyệt MST & cấp Mã Cơ Quan Thuế</p>
                  </div>
                </div>
                <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[10px] text-blue-100">Port :4000</span>
              </div>

              {/* Tra cứu mã CQT trên Cổng Thuế */}
              <div className="border-b border-slate-100 bg-blue-50/40 p-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-900 mb-1.5">
                  Tra cứu & Xác thực Mã Cơ Quan Thuế (GET /api/tax/invoice/verify/:code)
                </label>
                <div className="flex gap-2">
                  <input
                    value={verifyCodeInput}
                    onChange={(e) => setVerifyCodeInput(e.target.value)}
                    placeholder="Nhập Mã CQT (VD: C26-XXXX-XXXXXXXX)"
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 outline-none focus:border-blue-600"
                  />
                  <Button variant="secondary" compact onClick={() => void verifyTaxCodeOnPortal()} disabled={verifying}>
                    <ShieldCheck size={13} />
                    {verifying ? 'Đang tra…' : 'Xác thực trên Cổng Thuế'}
                  </Button>
                </div>

                {verifyResult && (
                  <div
                    className={`mt-2.5 rounded-lg border p-2.5 text-xs ${
                      verifyResult.success
                        ? 'border-emerald-200 bg-emerald-50/90 text-emerald-900'
                        : 'border-amber-200 bg-amber-50/90 text-amber-900'
                    }`}
                  >
                    {verifyResult.success && verifyResult.data ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1 text-emerald-800">
                            <CheckCircle2 size={14} /> HÓA ĐƠN HỢP LỆ TRÊN CỔNG THUẾ
                          </span>
                          <span className="font-mono text-emerald-700">{verifyResult.data.taxAuthorityCode}</span>
                        </div>
                        <p className="text-[11px]">
                          Số HĐ: <b>{verifyResult.data.invoiceNumber}</b> · Ngày lập: <b>{verifyResult.data.invoiceDate}</b> · Tổng tiền:{' '}
                          <b>{formatVnd(verifyResult.data.totalAmount)}</b>
                        </p>
                        <p className="text-[11px] text-emerald-700">
                          Thời điểm Tổng Cục Thuế cấp mã: {new Date(verifyResult.data.issuedAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] font-medium">
                        {verifyResult.message || 'Mã này được tạo từ dữ liệu mẫu trước đó. Hãy bấm "Gửi Cổng Thuế & Cấp mã" ở Cổng 1 để tạo bản ghi mới trên Cổng Thuế :4000!'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Danh sách hóa đơn Cổng Thuế (:4000) vừa tiếp nhận */}
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Sổ Đăng Ký Hóa Đơn Đã Tiếp Nhận tại Cổng Thuế (:4000)</span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                  {overview.taxHistory.length} bản ghi phiên này
                </span>
              </div>

              <div className="max-h-[225px] overflow-y-auto divide-y divide-slate-100">
                {overview.taxHistory.map((item) => (
                  <div
                    key={item.taxAuthorityCode}
                    onClick={() => void verifyTaxCodeOnPortal(item.taxAuthorityCode)}
                    className="px-4 py-2.5 hover:bg-blue-50/40 cursor-pointer transition-colors flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 text-[11px]">
                          {item.taxAuthorityCode}
                        </span>
                        <span className="font-bold text-slate-900">HĐ: {item.invoiceNumber}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        Người mua: {item.buyerName || 'Khách hàng'} · Cấp lúc: {new Date(item.issuedAt).toLocaleTimeString('vi-VN')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <b className="block text-slate-900 tabular-nums">{formatVnd(item.totalAmount)}</b>
                      <span className="text-[10px] font-semibold text-emerald-700">✓ Đã cấp mã</span>
                    </div>
                  </div>
                ))}
                {!overview.taxHistory.length && (
                  <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                    <FileCheck2 size={22} className="mx-auto text-slate-300" />
                    <p className="font-medium text-slate-600">Chưa có gói tin nào gửi sang Cổng Thuế (:4000) trong phiên chạy này.</p>
                    <p className="text-[11px] text-slate-400">
                      Hãy bấm nút <b>“Gửi Cổng Thuế & Cấp mã”</b> ở một hóa đơn bên Cổng 1 (cột trái) để xem Cổng Thuế nhận dữ liệu ngay lập tức!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Gói tin JSON Thực Tế Trao Đổi Giữa 2 Cổng */}
          {lastExchange && (
            <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-slate-100 shadow-xs">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles size={14} />
                  Bản ghi Gói tin Giao thức HTTP giữa 2 Cổng ({lastExchange.endpoint})
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Thời điểm trao đổi: {new Date(lastExchange.exchangedAt).toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                    📤 1. Gói tin Xưởng gửi lên Cổng Thuế (Request Body)
                  </p>
                  <pre className="max-h-44 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-200 border border-slate-800">
                    {JSON.stringify(lastExchange.sentPayload, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                    📥 2. Gói tin Cổng Thuế phản hồi về Xưởng (Response 201 Created)
                  </p>
                  <pre className="max-h-44 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-emerald-300 border border-slate-800">
                    {JSON.stringify(lastExchange.responsePayload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-brand-600 shrink-0" />
            <span>
              <b>Quy tắc bảo mật Kế toán & Thuế:</b> Hóa đơn sau khi nhận <b>Mã CQT</b> từ Cổng 2 sẽ bị khóa cứng số tiền, thuế và tên khách hàng ở Cổng 1.
            </span>
          </div>
          <Button variant="secondary" compact onClick={onClose} disabled={Boolean(issuingId)}>
            Đóng cửa sổ
          </Button>
        </footer>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
