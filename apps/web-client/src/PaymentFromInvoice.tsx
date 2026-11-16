import { useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { api,createRecord,getRecords,messageOf,today } from './api';
import { RecordModal,type FieldDef,useDialogFocusTrap } from './components';

export function PaymentFromInvoice({ invoice, onClose, onSaved }: { invoice: any; onClose: () => void; onSaved: () => Promise<void> }) {
  const [accounts, setAccounts] = useState<any[]>([]), [busy, setBusy] = useState(false), [payment, setPayment] = useState<any>(null);
  useEffect(() => { void getRecords<any>('cash-accounts').then((rows) => setAccounts(rows.filter((row) => !['INACTIVE', 'CANCELLED'].includes(row.status)))).catch(() => setAccounts([])); }, []);
  const fields: FieldDef[] = [
    { name: 'code', label: 'Số phiếu', required: true }, { name: 'date', label: 'Ngày thanh toán', type: 'date', required: true },
    { name: 'counterparty', label: invoice.direction === 'INPUT' ? 'Người bán' : 'Khách hàng', readOnly: true, wide: true },
    { name: 'accountId', label: 'Tài khoản tiền', type: 'select', required: true, options: accounts.map((row) => ({ value: row.id, label: row.name })) },
    { name: 'amount', label: 'Thực thu / Thực chi (₫)', type: 'number', required: true, min: 1 },
    { name: 'discountAmount', label: 'Chiết khấu thanh toán (₫)', type: 'number', min: 0 },
    { name: 'bankFeeAmount', label: 'Phí ngân hàng chi riêng (₫)', type: 'number', min: 0 },
    { name: 'roundingAdjustment', label: 'Làm tròn (±5 ₫)', type: 'number', min: -5, max: 5 },
    { name: 'writeOffReason', label: 'Lý do điều chỉnh / Phí ngân hàng', type: 'textarea', wide: true },
  ];
  return <RecordModal title={`${invoice.direction === 'INPUT' ? 'Chi tiền' : 'Thu tiền'} · ${invoice.code}`} fields={fields.map((field) => payment && ['code','date','accountId','amount'].includes(field.name) ? { ...field,readOnly:true } : field)} initial={{ code: `${invoice.direction === 'INPUT' ? 'PC' : 'PT'}-${today().replace(/-/g, '')}-${Date.now().toString().slice(-5)}`, date: today(), counterparty: invoice.counterparty, amount: Number(invoice.openBalance ?? invoice.total) }} busy={busy} submitLabel={payment ? 'Gán vào hóa đơn phiếu đã lưu' : 'Ghi lại & Gán vào hóa đơn'} onClose={onClose} onSubmit={async (value) => {
    setBusy(true);
    let savedPayment = payment;
    try {
      const amount = Number(value.amount), discount = Number(value.discountAmount || 0), rounding = Number(value.roundingAdjustment || 0);
      if (amount + discount + rounding > Number(invoice.openBalance ?? invoice.total)) throw new Error('Tổng tất toán vượt tiền còn nợ còn lại.');
      if ((discount || rounding || Number(value.bankFeeAmount)) && !String(value.writeOffReason || '').trim()) throw new Error('Nhập lý do điều chỉnh hoặc phí ngân hàng.');
      const saved = payment || await createRecord<any>('payments', { code: value.code, date: value.date, counterparty: invoice.counterparty, counterpartyId: invoice.counterpartyId, amount, accountId: value.accountId, direction: invoice.direction === 'INPUT' ? 'PAID' : 'RECEIVED' });
      savedPayment = saved; setPayment(saved);
      await createRecord('payment-allocations', { paymentId: saved.id, invoiceId: invoice.id, allocatedAmount: saved.amount, discountAmount: discount, bankFeeAmount: Number(value.bankFeeAmount || 0), roundingAdjustment: rounding, writeOffReason: value.writeOffReason });
      window.dispatchEvent(new Event('fintax:records-changed')); await onSaved(); onClose();
    } catch (error) { throw new Error(savedPayment ? `Phiếu ${savedPayment.code} đã lưu. ${messageOf(error)}` : messageOf(error)); }
    finally { setBusy(false); }
  }}/>;
}

export function CancelDocument({ entity, record, onClose, onSaved }: { entity: string; record: any; onClose: () => void; onSaved: () => Promise<void> }) {
  const [allocations, setAllocations] = useState<any[]>([]), [reason, setReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocusTrap(dialogRef, onClose, busy);
  useEffect(() => { if (entity === 'invoices') void api.get(`/invoices/${record.id}/details`).then(({ data }) => setAllocations(data.allocations.filter((row: any) => !['CANCELLED','UNALLOCATED'].includes(row.status)))).catch((error) => setError(messageOf(error))); }, [entity, record.id]);
  const submit = async () => { setBusy(true); setError(''); try { await api.delete(`/${entity}/${record.id}`, { data: { reason, autoUnallocate: allocations.length > 0 } }); await onSaved(); onClose(); } catch (error) { setError(messageOf(error)); } finally { setBusy(false); } };
  const modal = <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-4" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label="Hủy giấy tờ" className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"><h2 className="text-base font-bold text-red-800">Hủy {record.code || record.name || 'giấy tờ'}</h2>{allocations.length > 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5"><p className="text-xs font-semibold text-amber-900">Gỡ {allocations.length} khoản đã gán trước khi hủy</p><ul className="mt-1.5 space-y-1 text-xs text-amber-900">{allocations.map((row) => <li key={row.id}>{row.paymentCode} · {new Intl.NumberFormat('vi-VN').format(row.allocatedAmount)} ₫</li>)}</ul><p className="mt-2 text-[11px] text-amber-800">Số dư chưa gán vào hóa đơn được hoàn lại cho phiếu. Tiền còn nợ và lịch sử được cập nhật cùng lúc.</p></div>}<label className="mt-4 block text-xs font-semibold text-slate-700">Lý do hủy <span className="text-red-600">*</span><textarea autoFocus aria-label="Lý do hủy" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm outline-none focus:border-brand-500"/></label>{error && <p role="alert" className="mt-2.5 text-xs text-red-700">{error}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">Giữ giấy tờ</button><button type="button" disabled={busy || !reason.trim()} onClick={() => void submit()} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Đang xử lý…' : allocations.length ? 'Gỡ khỏi hóa đơn & Hủy' : 'Xác nhận hủy'}</button></div></section></div>;
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
