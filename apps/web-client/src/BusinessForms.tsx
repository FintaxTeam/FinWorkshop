import { useEffect,useRef,useState,type FormEvent,type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Plus,Trash2,X,Copy,FileText,Sparkles,Percent } from 'lucide-react';
import { api,getRecords,formatVnd,today,messageOf } from './api';
import { useAuth } from './auth';
import { Button,Card,MoneyInput,SmartNumberInput,useDialogFocusTrap,useToast } from './components';

type Row=Record<string,any>;
type FormProps={initial?:Row;onClose:()=>void;onSubmit:(value:Row)=>Promise<void>};
const input='mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-900 outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400';

function Field({label,children}: {label:string;children:ReactNode}){
  return <label className="block text-xs font-semibold text-slate-700">{label}{children}</label>;
}

function FormShell({title,onClose,onSubmit,submitLabel='Lưu',secondarySubmitLabel,onSecondarySubmit,children}:{title:string;onClose:()=>void;onSubmit:()=>Promise<void>;submitLabel?:string;secondarySubmitLabel?:string;onSecondarySubmit?:()=>Promise<void>;children:ReactNode}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const dialogRef=useRef<HTMLFormElement>(null);
  useDialogFocusTrap(dialogRef,onClose,busy);
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{await onSubmit();}catch(reason){setError(messageOf(reason));}finally{setBusy(false);}};
  const submitSecondary=async()=>{
    if (dialogRef.current && !dialogRef.current.reportValidity()) return;
    if (!onSecondarySubmit) return;
    setBusy(true);setError('');
    try{await onSecondarySubmit();}catch(reason){setError(messageOf(reason));}finally{setBusy(false);}
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] p-2 sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onSubmit={submit}
        className="flex max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700 border border-brand-200">
              <FileText size={14}/>
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
              <p className="text-[11px] text-slate-500">Biểu mẫu nghiệp vụ chuẩn · Nhấn ESC để đóng</p>
            </div>
          </div>
          <button type="button" aria-label="Đóng biểu mẫu" onClick={onClose} disabled={busy} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors">
            <X size={16}/>
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3.5">
          {children}
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-5 py-3">
          <span className="text-[11px] text-slate-400 hidden sm:inline">Kiểm tra kỹ số liệu trước khi lưu</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="ghost" compact onClick={onClose} disabled={busy}>Hủy</Button>
            {secondarySubmitLabel && onSecondarySubmit && (
              <Button variant="secondary" compact onClick={()=>void submitSecondary()} disabled={busy}>
                {busy ? 'Đang lưu…' : secondarySubmitLabel}
              </Button>
            )}
            <Button type="submit" compact disabled={busy}>{busy ? 'Đang lưu…' : submitLabel}</Button>
          </div>
        </footer>
      </form>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}

export function BomModal({initial={},onClose,onSubmit}:FormProps){
  const [header,setHeader]=useState<Row>({...initial,wasteRate:Number(initial.wasteRate||0)*100,marginRate:Number(initial.marginRate||0)*100,version:initial.version||1});
  const [items,setItems]=useState<Row[]>(initial.items?.length?initial.items:[{materialId:'',quantity:1}]),[materials,setMaterials]=useState<Row[]>([]),[products,setProducts]=useState<Row[]>([]),[loadError,setLoadError]=useState('');
  useEffect(()=>{void Promise.all([getRecords<Row>('materials'),getRecords<Row>('products')]).then(([m,p])=>{setMaterials(m.filter((row:Row)=>row.trackInventory!==false&&!['INACTIVE','CANCELLED'].includes(row.status)));setProducts(p.filter(row=>!['INACTIVE','CANCELLED'].includes(row.status)));}).catch(reason=>setLoadError(messageOf(reason)));},[]);
  const patch=(index:number,value:Row)=>setItems(rows=>rows.map((row,i)=>i===index?{...row,...value}:row));
  const materialCost=items.reduce((sum,row)=>sum+Number(row.quantity||0)*Number(materials.find(item=>item.id===row.materialId)?.unitCost||0),0);
  const set=(key:string,value:any)=>setHeader(row=>({...row,[key]:value}));
  return <FormShell title={initial.id?'Sửa công thức làm sản xuất':'Lập công thức làm sản xuất'} onClose={onClose} onSubmit={()=>onSubmit({...header,items,wasteRate:Number(header.wasteRate||0)/100,marginRate:Number(header.marginRate||0)/100})}>
    {loadError&&<p role="alert" className="text-xs text-red-700">{loadError}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Mã công thức làm"><input className={input} value={header.code||''} onChange={e=>set('code',e.target.value)} required/></Field>
      <Field label="Sản phẩm"><select className={input} required value={header.productId||''} onChange={e=>{const product=products.find(row=>row.id===e.target.value);setHeader(row=>({...row,productId:product?.id,productName:product?.name}));}}><option value="">Chọn sản phẩm</option>{products.map(row=><option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></Field>
      <Field label="Phiên bản"><div className="mt-1"><SmartNumberInput min={1} step={1} value={header.version} onChange={num=>set('version',num)}/></div></Field>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500">
          <tr><th className="px-3 py-2">STT</th><th className="px-3 py-2">Vật tư cho 1 sản phẩm</th><th className="px-3 py-2">Định lượng</th><th className="px-3 py-2">ĐVT</th><th className="px-3 py-2 text-right">Chi phí</th><th className="w-8"/></tr>
        </thead>
        <tbody>
          {items.map((row,index)=>{
            const material=materials.find(item=>item.id===row.materialId);
            return <tr key={index} className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-500">{index+1}</td>
              <td className="min-w-48 px-3 py-2"><select aria-label={`Vật tư dòng ${index+1}`} required className={input} value={row.materialId} onChange={e=>patch(index,{materialId:e.target.value})}><option value="">Chọn vật tư</option>{materials.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></td>
              <td className="w-28 px-3 py-2"><SmartNumberInput ariaLabel={`Định lượng dòng ${index+1}`} required min={0.0001} step="any" value={row.quantity} onChange={num=>patch(index,{quantity:num})}/></td>
              <td className="px-3 py-2 text-slate-600">{material?.unit||'—'}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatVnd(Number(row.quantity||0)*Number(material?.unitCost||0))}</td>
              <td className="px-2 py-2"><button type="button" aria-label={`Xóa dòng ${index+1}`} disabled={items.length===1} onClick={()=>setItems(rows=>rows.filter((_,i)=>i!==index))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><Trash2 size={14}/></button></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    <div className="flex items-center justify-between gap-2">
      <Button variant="secondary" compact onClick={()=>setItems(rows=>[...rows,{materialId:'',quantity:1}])}><Plus size={14}/>Thêm vật tư</Button>
      <div className="rounded-lg border border-brand-100 bg-brand-50/70 px-3 py-1.5 text-xs">
        <span className="text-slate-600 mr-2">Vật tư / 1 SP:</span>
        <strong className="tabular-nums text-brand-700">{formatVnd(materialCost)}</strong>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      {[['laborHours','Giờ công / sản phẩm'],['laborRate','Tiền một giờ công (₫)'],['machineCost','Tiền điện, máy / sản phẩm (₫)'],['wasteRate','Hao hụt dự kiến (%)'],['marginRate','Biên lợi nhuận mục tiêu (%)']].map(([key,label])=><Field key={key} label={label}><div className="mt-1">{['laborRate','machineCost'].includes(key)?<MoneyInput value={header[key]??0} onChange={num=>set(key,num)}/>:<SmartNumberInput step="any" min={0} max={key.endsWith('Rate')?99.99:undefined} suffix={key.endsWith('Rate')?'%':undefined} value={header[key]??0} onChange={num=>set(key,num)}/>}</div></Field>)}
    </div>
  </FormShell>;
}

export function QuotationModal({initial={},onClose,onSubmit}:FormProps){
  const {user}=useAuth();
  const [header,setHeader]=useState<Row>({
    date:today(),
    discountAmount:Number(initial.discountAmount||0),
    discountRate:Number(initial.discountRate||0),
    ...initial,
    wasteRate:Number(initial.wasteRate||0)*100,
    marginRate:Number(initial.marginRate||0)*100,
  });
  const [discountMode,setDiscountMode]=useState<'AMOUNT'|'PERCENT'>(Number(initial.discountRate)>0?'PERCENT':'AMOUNT');
  const [lines,setLines]=useState<Row[]>(()=>{
    if (Array.isArray(initial.items) && initial.items.length > 0) {
      return initial.items.map((it:Row, idx:number)=>({
        productId: it.productId || (idx===0 ? initial.productId : '') || '',
        name: it.name || (idx===0 ? initial.title : '') || '',
        unit: it.unit || 'sản phẩm',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        taxRuleId: it.taxRuleId || (idx===0 ? initial.taxRuleId : '') || '',
        taxRate: Number(it.taxRate ?? initial.taxRate ?? 8),
        bomId: it.bomId || (idx===0 ? initial.bomId : '') || '',
        bom: it.bom || (idx===0 ? initial.bom : undefined),
        materialCost: Number(it.materialCost ?? (idx===0 ? initial.materialCost : 0) ?? 0),
        laborHours: Number(it.laborHours ?? (idx===0 ? initial.laborHours : 0) ?? 0),
        laborRate: Number(it.laborRate ?? (idx===0 ? initial.laborRate : 0) ?? 0),
        machineCost: Number(it.machineCost ?? (idx===0 ? initial.machineCost : 0) ?? 0),
        wasteRate: Number(it.wasteRate ?? (idx===0 ? Number(initial.wasteRate||0)*100 : 0) ?? 0),
        marginRate: Number(it.marginRate ?? (idx===0 ? Number(initial.marginRate||0)*100 : 20) ?? 20),
      }));
    }
    return [{
      productId: initial.productId || '',
      name: initial.title || '',
      unit: initial.unit || 'sản phẩm',
      quantity: Number(initial.quantity || 1),
      unitPrice: Number(initial.unitPrice || 0),
      taxRuleId: initial.taxRuleId || '',
      taxRate: Number(initial.taxRate ?? 8),
      bomId: initial.bomId || '',
      bom: initial.bom,
      materialCost: Number(initial.materialCost || 0),
      laborHours: Number(initial.laborHours || 0),
      laborRate: Number(initial.laborRate || 0),
      machineCost: Number(initial.machineCost || 0),
      wasteRate: Number(initial.wasteRate || 0) * 100,
      marginRate: Number(initial.marginRate || 0) * 100 || 20,
    }];
  });
  const [products,setProducts]=useState<Row[]>([]),[boms,setBoms]=useState<Row[]>([]),[customers,setCustomers]=useState<Row[]>([]),[rules,setRules]=useState<Row[]>([]),[error,setError]=useState('');

  useEffect(()=>{
    void Promise.all([getRecords<Row>('products'),getRecords<Row>('boms'),getRecords<Row>('customers'),getRecords<Row>('tax-rules')])
      .then(([p,b,c,t])=>{
        const activeRules = t.filter(row=>!['INACTIVE','CANCELLED'].includes(row.status));
        setProducts(p.filter(row=>!['INACTIVE','CANCELLED'].includes(row.status)));
        setBoms(b.filter(row=>!['INACTIVE','CANCELLED'].includes(row.status)));
        setCustomers(c.filter(row=>!['INACTIVE','CANCELLED'].includes(row.status)));
        setRules(activeRules);
        const defaultRule = activeRules.find(r=>r.code==='VAT_8') || activeRules.find(r=>r.code==='VAT_10') || activeRules[0];
        if (defaultRule) {
          setLines(prev=>prev.map(line=>line.taxRuleId ? line : { ...line, taxRuleId: defaultRule.id, taxRate: Number(defaultRule.taxRate ?? 8) }));
        }
      })
      .catch(reason=>setError(messageOf(reason)));
  },[]);

  const set=(key:string,value:any)=>setHeader(row=>({...row,[key]:value}));
  const patchLine=(idx:number,patch:Row)=>setLines(prev=>prev.map((row,i)=>i===idx?{...row,...patch}:row));

  const calcLineSuggested=(line:Row)=>{
    const baseCost = (Number(line.materialCost||0) + Number(line.laborHours||0)*Number(line.laborRate||0) + Number(line.machineCost||0)) * (1 + Number(line.wasteRate||0)/100);
    const margin = Math.min(99, Math.max(0, Number(line.marginRate||0))) / 100;
    const suggested = baseCost > 0 ? Math.round(baseCost / (1 - margin)) : 0;
    return { baseCost: Math.round(baseCost), suggested };
  };

  const selectProductOnLine=(idx:number, productId:string)=>{
    const product = products.find(p=>p.id===productId);
    if (!product) {
      patchLine(idx, { productId:'', bomId:'', bom:undefined });
      return;
    }
    const matchingBom = boms.find(b=>b.productId===product.id);
    const rule = rules.find(r=>r.id===product.outputTaxRuleId) || rules.find(r=>Number(r.taxRate)===Number(product.outputTaxRate)) || rules[0];
    const bomFields = matchingBom ? {
      bomId: matchingBom.id,
      bom: matchingBom,
      materialCost: Number(matchingBom.materialCost||0),
      laborHours: Number(matchingBom.laborHours||0),
      laborRate: Number(matchingBom.laborRate||0),
      machineCost: Number(matchingBom.machineCost||0),
      wasteRate: Number(matchingBom.wasteRate||0)*100,
      marginRate: Number(matchingBom.marginRate||0)*100 || 20,
    } : {
      bomId: '',
      bom: undefined,
      materialCost: 0,
      laborHours: 0,
      laborRate: 0,
      machineCost: 0,
      wasteRate: 0,
      marginRate: 20,
    };
    patchLine(idx, {
      productId: product.id,
      name: product.name,
      unit: product.unit || 'sản phẩm',
      unitPrice: Number(product.price || 0),
      taxRuleId: rule?.id || '',
      taxRate: Number(rule?.taxRate ?? product.outputTaxRate ?? 8),
      ...bomFields,
    });
  };

  const selectBomOnLine=(idx:number, bomId:string)=>{
    const bom = boms.find(b=>b.id===bomId);
    if (!bom) {
      patchLine(idx, { bomId:'', bom:undefined, materialCost:0, laborHours:0, laborRate:0, machineCost:0, wasteRate:0 });
      return;
    }
    const baseCost = (Number(bom.materialCost||0) + Number(bom.laborHours||0)*Number(bom.laborRate||0) + Number(bom.machineCost||0)) * (1 + Number(bom.wasteRate||0));
    const margin = Number(bom.marginRate||0.2);
    const suggested = Math.round(baseCost / (1 - margin));
    patchLine(idx, {
      bomId: bom.id,
      bom,
      productId: bom.productId || lines[idx].productId,
      name: lines[idx].name || bom.productName || '',
      materialCost: Number(bom.materialCost||0),
      laborHours: Number(bom.laborHours||0),
      laborRate: Number(bom.laborRate||0),
      machineCost: Number(bom.machineCost||0),
      wasteRate: Number(bom.wasteRate||0)*100,
      marginRate: Number(bom.marginRate||0)*100 || 20,
      unitPrice: lines[idx].unitPrice || suggested,
    });
  };

  const normalizedItems: Row[] = lines.map((line): Row => {
    const { suggested } = calcLineSuggested(line);
    const unitPrice = Number(line.unitPrice) || suggested || 0;
    const rule = rules.find(r=>r.id===line.taxRuleId);
    const taxRate = Number(rule?.taxRate ?? line.taxRate ?? 0);
    const quantity = Number(line.quantity || 1);
    const lineSub = Math.round(quantity * unitPrice);
    const lineTax = Math.round(lineSub * taxRate / 100);
    return {
      ...line,
      quantity,
      unitPrice,
      taxRate,
      taxRuleId: rule?.id || line.taxRuleId || '',
      subtotal: lineSub,
      taxAmount: lineTax,
    };
  });

  const subtotal = normalizedItems.reduce((sum,it)=>sum+it.subtotal, 0);
  const tax = normalizedItems.reduce((sum,it)=>sum+it.taxAmount, 0);
  const discount = discountMode === 'PERCENT'
    ? Math.round(subtotal * Math.min(100, Math.max(0, Number(header.discountRate || 0))) / 100)
    : Number(header.discountAmount || 0);
  const effectiveDiscountPct = subtotal > 0 ? Math.round((discount / subtotal) * 10000) / 100 : 0;
  const grandTotal = Math.max(0, subtotal + tax - discount);

  const handleSave = async (submitAction: 'DRAFT' | 'SUBMIT' | 'APPROVE' = user?.role === 'OWNER' ? 'APPROVE' : 'SUBMIT') => {
    const primary = normalizedItems[0];
    const summaryTitle = normalizedItems.length > 1
      ? `${primary.name} (+${normalizedItems.length - 1} mục)`
      : primary.name;
    await onSubmit({
      ...header,
      submitAction,
      autoApprove: user?.role === 'OWNER' && submitAction === 'APPROVE',
      title: summaryTitle,
      productId: primary.productId || undefined,
      unit: primary.unit || 'sản phẩm',
      quantity: primary.quantity,
      unitPrice: primary.unitPrice,
      taxRuleId: primary.taxRuleId || '',
      taxRate: primary.taxRate,
      bomId: primary.bomId || '',
      bom: primary.bomId ? primary.bom : undefined,
      materialCost: Number(primary.materialCost || 0),
      laborHours: Number(primary.laborHours || 0),
      laborRate: Number(primary.laborRate || 0),
      machineCost: Number(primary.machineCost || 0),
      wasteRate: Number(primary.wasteRate || 0) / 100,
      marginRate: Number(primary.marginRate || 0) / 100,
      discountAmount: discount,
      discountRate: discountMode === 'PERCENT' ? Number(header.discountRate || 0) : effectiveDiscountPct,
      items: normalizedItems.map(it=>({
        productId: it.productId || undefined,
        name: it.name,
        unit: it.unit || 'sản phẩm',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        taxRuleId: it.taxRuleId || '',
        bomId: it.bomId || undefined,
      })),
    });
  };

  return <FormShell
    title={initial.id?`Sửa báo giá · v${initial.version||1}`:'Lập báo giá khách hàng'}
    onClose={onClose}
    onSubmit={() => handleSave(user?.role === 'OWNER' ? 'APPROVE' : 'SUBMIT')}
    submitLabel={user?.role === 'OWNER' ? 'Lưu' : 'Lưu & Gửi duyệt ngay'}
    secondarySubmitLabel={user?.role !== 'OWNER' ? 'Lưu bản nháp' : undefined}
    onSecondarySubmit={user?.role !== 'OWNER' ? () => handleSave('DRAFT') : undefined}
  >
    {(initial.rejectionNote||initial.sourceRejectionNote)&&<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><strong>Lý do từ chối: </strong>{initial.rejectionNote||initial.sourceRejectionNote}</p>}
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}

    {/* Thông tin chung của báo giá */}
    <div className="grid gap-3 sm:grid-cols-4">
      <Field label="Số báo giá">
        <input required className={input} placeholder="VD: BG-2026-01" value={header.code||''} onChange={e=>set('code',e.target.value)}/>
      </Field>
      <Field label="Khách hàng">
        <select className={input} required value={header.customerId||customers.find(row=>row.name===header.customerName)?.id||''} onChange={e=>{const customer=customers.find(row=>row.id===e.target.value);setHeader(row=>({...row,customerId:customer?.id,customerName:customer?.name}));}}>
          <option value="">Chọn khách hàng</option>
          {customers.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </Field>
      <Field label="Ngày báo giá">
        <input className={input} type="date" required value={header.date} onChange={e=>set('date',e.target.value)}/>
      </Field>
      <Field label="Hiệu lực đến">
        <input className={input} type="date" min={header.date} value={header.validUntil||''} onChange={e=>set('validUntil',e.target.value)}/>
      </Field>
    </div>

    {/* Danh sách Sản phẩm / Dịch vụ báo giá */}
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Danh sách sản phẩm / dịch vụ ({lines.length})</span>
        <Button
          variant="secondary"
          compact
          onClick={()=>{
            const defaultRule = rules.find(r=>r.code==='VAT_8') || rules.find(r=>r.code==='VAT_10') || rules[0];
            setLines(prev=>[...prev, {
              productId:'', name:'', unit:'sản phẩm', quantity:1, unitPrice:0,
              taxRuleId: defaultRule?.id || '', taxRate: Number(defaultRule?.taxRate ?? 8),
              bomId:'', bom:undefined, materialCost:0, laborHours:0, laborRate:0, machineCost:0, wasteRate:0, marginRate:20,
            }]);
          }}
        >
          <Plus size={14}/>Thêm sản phẩm / dịch vụ
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((line, idx) => {
          const { baseCost, suggested } = calcLineSuggested(line);
          const availableBoms = line.productId
            ? boms.filter(b=>b.productId===line.productId || (line.name && b.productName===line.name))
            : [];
          const hasBom = availableBoms.length > 0;
          const selectedRule = rules.find(r=>r.id===line.taxRuleId);
          const lineTotal = Math.round(Number(line.quantity||0) * (Number(line.unitPrice)||suggested||0));

          return (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{idx+1}</span>
                  Hạng mục báo giá #{idx+1}
                </span>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={()=>setLines(prev=>prev.filter((_,i)=>i!==idx))}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={13}/>Xóa dòng
                  </button>
                )}
              </div>

              <div className="grid gap-2.5 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <Field label="Chọn từ danh mục">
                    <select
                      aria-label={`Sản phẩm dòng ${idx+1}`}
                      className={input}
                      value={line.productId||''}
                      onChange={e=>selectProductOnLine(idx, e.target.value)}
                    >
                      <option value="">-- Tự nhập tên riêng --</option>
                      {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="sm:col-span-4">
                  <Field label="Tên hiển thị trên báo giá">
                    <input
                      required
                      aria-label={`Tên mặt hàng dòng ${idx+1}`}
                      className={input}
                      placeholder="Nhập tên sản phẩm / gia công"
                      value={line.name||''}
                      onChange={e=>patchLine(idx,{name:e.target.value})}
                    />
                  </Field>
                </div>

                <div className="sm:col-span-4">
                  <Field label="Thuế suất theo quy định Nhà nước">
                    <select
                      aria-label={`Mức thuế dòng ${idx+1}`}
                      className={input}
                      value={line.taxRuleId||''}
                      onChange={e=>{
                        const rule = rules.find(r=>r.id===e.target.value);
                        patchLine(idx, { taxRuleId: rule?.id || '', taxRate: Number(rule?.taxRate ?? 0) });
                      }}
                    >
                      {rules.map(r=>(
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.taxRate}%)
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-12 sm:items-start">
                <div className="sm:col-span-3">
                  <Field label={`Số lượng (${line.unit||'SP'})`}>
                    <div className="mt-1">
                      <SmartNumberInput
                        ariaLabel={`Số lượng dòng ${idx+1}`}
                        required
                        min={0.0001}
                        step="any"
                        value={line.quantity}
                        onChange={num=>patchLine(idx,{quantity:num})}
                      />
                    </div>
                  </Field>
                </div>

                <div className="sm:col-span-5">
                  <Field label="Đơn giá bán 1 sản phẩm (VNĐ)">
                    <div className="mt-1">
                      <MoneyInput
                        ariaLabel={`Đơn giá dòng ${idx+1}`}
                        placeholder={suggested ? `Gợi ý: ${suggested}` : 'Nhập đơn giá'}
                        value={line.unitPrice}
                        onChange={num=>patchLine(idx,{unitPrice:num})}
                      />
                    </div>
                  </Field>
                </div>

                <div className="sm:col-span-4">
                  <Field label="Định mức sản xuất">
                    <select
                      aria-label={`Định mức sản xuất dòng ${idx+1}`}
                      className={input}
                      disabled={!hasBom}
                      value={hasBom ? (line.bomId||'') : ''}
                      onChange={e=>selectBomOnLine(idx, e.target.value)}
                    >
                      <option value="">{hasBom ? 'Không dùng' : 'Không có'}</option>
                      {availableBoms.map(b=><option key={b.id} value={b.id}>{b.code||b.productName} · v{b.version}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Thanh thông tin BOM & Gợi ý giá thông minh */}
              {(line.bom || suggested > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-700">
                    <Sparkles size={13} className="text-brand-600 shrink-0"/>
                    <span>Giá vốn dự kiến: <b className="tabular-nums">{formatVnd(baseCost)}</b></span>
                    <span>→ Giá bán gợi ý (lãi {line.marginRate||0}%): <b className="tabular-nums text-brand-700">{formatVnd(suggested)}</b></span>
                  </div>
                  {suggested > 0 && Number(line.unitPrice) !== suggested && (
                    <button
                      type="button"
                      onClick={()=>patchLine(idx,{unitPrice:suggested})}
                      className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-700 transition-colors"
                    >
                      Áp dụng giá gợi ý
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2 text-xs">
                <details className="group">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-brand-700">
                    Tùy chỉnh chi phí vật tư / nhân công để tính giá gợi ý
                  </summary>
                  <div className="mt-2 grid gap-2.5 sm:grid-cols-3 rounded-lg border border-slate-200 bg-white p-2.5">
                    {[['materialCost','Vật tư / SP (₫)'],['laborHours','Giờ công / SP'],['laborRate','Đơn giá giờ công (₫)'],['machineCost','Điện, máy / SP (₫)'],['wasteRate','Hao hụt (%)'],['marginRate','Lãi mục tiêu (%)']].map(([key,label])=>(
                      <Field key={key} label={label}>
                        <div className="mt-1">
                          {['materialCost','laborRate','machineCost'].includes(key)
                            ? <MoneyInput showPresets={false} value={line[key]??0} onChange={num=>patchLine(idx,{[key]:num})}/>
                            : <SmartNumberInput min={0} step="any" max={['wasteRate','marginRate'].includes(key)?99.99:undefined} suffix={['wasteRate','marginRate'].includes(key)?'%':undefined} value={line[key]??0} onChange={num=>patchLine(idx,{[key]:num})}/>}
                        </div>
                      </Field>
                    ))}
                  </div>
                </details>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-slate-500">Thuế ({selectedRule?.taxRate ?? line.taxRate ?? 0}%): <b className="tabular-nums text-slate-700">{formatVnd(Math.round(lineTotal * Number(selectedRule?.taxRate ?? line.taxRate ?? 0) / 100))}</b></span>
                  <span className="text-slate-700">Thành tiền: <b className="tabular-nums text-slate-900">{formatVnd(lineTotal)}</b></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Chiết khấu báo giá: Theo % hoặc Số tiền */}
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Percent size={13} className="text-brand-600"/>
          Chiết khấu thương mại
        </span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={()=>setDiscountMode('PERCENT')}
            className={`rounded-md px-2.5 py-0.5 transition-all ${discountMode==='PERCENT'?'bg-white text-brand-700 shadow-xs':'text-slate-600 hover:text-slate-900'}`}
          >
            Theo %
          </button>
          <button
            type="button"
            onClick={()=>{setDiscountMode('AMOUNT');set('discountAmount',discount);}}
            className={`rounded-md px-2.5 py-0.5 transition-all ${discountMode==='AMOUNT'?'bg-white text-brand-700 shadow-xs':'text-slate-600 hover:text-slate-900'}`}
          >
            Số tiền (₫)
          </button>
        </div>
      </div>
      {discountMode === 'PERCENT' ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-center gap-2">
            <SmartNumberInput min={0} max={100} step="0.1" suffix="%" placeholder="Nhập % chiết khấu" value={header.discountRate} onChange={rate=>setHeader(r=>({...r,discountRate:Math.min(100,Math.max(0,rate))}))}/>
            {[2,5,8,10].map(pct=>(
              <button key={pct} type="button" onClick={()=>set('discountRate',pct)} className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold ${Number(header.discountRate)===pct?'border-brand-600 bg-brand-600 text-white':'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-300'}`}>{pct}%</button>
            ))}
          </div>
          <span className="text-xs font-bold tabular-nums text-emerald-700">− {formatVnd(discount)}</span>
        </div>
      ) : (
        <MoneyInput placeholder="Nhập số tiền chiết khấu (VNĐ)" value={header.discountAmount} onChange={amt=>set('discountAmount',amt)}/>
      )}
    </div>

    <Field label="Ghi chú & điều khoản báo giá"><textarea className={input} rows={2} placeholder="Điều kiện giao hàng, thanh toán, bảo hành..." value={header.terms||''} onChange={e=>set('terms',e.target.value)}/></Field>

    <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-brand-100 bg-brand-50/70 p-3 text-xs sm:grid-cols-4">
      {[
        ['Tổng tiền hàng', subtotal],
        ['Chiết khấu', discount],
        ['Tổng tiền thuế', tax],
        ['Khách thanh toán', grandTotal],
      ].map(([label,amount])=>(
        <div key={String(label)}>
          <span className="text-[11px] text-slate-500">{label}</span>
          <strong className={`mt-0.5 block text-sm font-bold tabular-nums ${label==='Khách thanh toán'?'text-brand-700':label==='Chiết khấu'&&Number(amount)>0?'text-emerald-700':'text-slate-900'}`}>
            {label==='Chiết khấu'&&Number(amount)>0 ? `− ${formatVnd(Number(amount))}` : formatVnd(Number(amount))}
          </strong>
        </div>
      ))}
    </div>
  </FormShell>;
}

export function StockMovementModal({initial={},onClose,onSubmit}:FormProps){
  const {user}=useAuth();const owner=user?.role==='OWNER',worker=user?.role==='WORKSHOP';
  const [header,setHeader]=useState<Row>({type:(worker||user?.role==='WAREHOUSE')?'ISSUE':'RECEIPT',quantity:1,date:today(),...initial}),[items,setItems]=useState<Row[]>([]),[jobs,setJobs]=useState<Row[]>([]),[moves,setMoves]=useState<Row[]>([]),[invoices,setInvoices]=useState<Row[]>([]),[error,setError]=useState('');
  useEffect(()=>{void Promise.all([getRecords<Row>('materials'),worker?Promise.resolve([]):getRecords<Row>('products'),getRecords<Row>('production-orders'),getRecords<Row>('stock-movements'),worker?Promise.resolve([]):api.get('/stock-references').then(result=>result.data)]).then(([m,p,j,s,i])=>{setItems([...m.map(row=>({...row,itemEntity:'materials'})),...p.map(row=>({...row,itemEntity:'products'}))].filter((row:Row)=>row.trackInventory!==false&&!['INACTIVE','CANCELLED'].includes(row.status)));setJobs(j.filter(row=>['DRAFT','IN_PROGRESS'].includes(row.status)));setMoves(s.filter(row=>row.status!=='CANCELLED'));setInvoices(i);}).catch(reason=>setError(messageOf(reason)));},[worker]);
  const set=(key:string,value:any)=>setHeader(row=>({...row,[key]:value}));
  const item=items.find(row=>row.id===(header.productId||header.materialId)),invoice=invoices.find(row=>row.id===header.invoiceId);
  const types=[...(!worker?[['RECEIPT','Nhập kho (mua về)'],['DELIVERY','Giao hàng cho khách']]:[]),['ISSUE','Lấy vật tư cho việc đang làm'],['RETURN','Trả vật tư về kho'],['WASTE','Báo vật tư hao hoặc hỏng'],...(owner?[['OPENING','Số tồn lúc bắt đầu dùng'],['ADJUST_IN','Kiểm kê: kho nhiều hơn sổ'],['ADJUST_OUT','Kiểm kê: kho ít hơn sổ']]:[])];
  const needsJob=['ISSUE','RETURN','WASTE'].includes(header.type),needsInvoice=header.type==='DELIVERY'||user?.role==='WAREHOUSE'&&header.type==='RECEIPT';
  const sources=moves.filter(row=>row.type==='ISSUE'&&row.materialId===header.materialId&&row.productionOrderId===header.productionOrderId);
  return <FormShell title="Ghi vật tư vào hoặc ra kho" onClose={onClose} onSubmit={()=>onSubmit({...header,code:header.code||`${header.type==='RECEIPT'?'NK':'XK'}-${Date.now()}`,itemEntity:item?.itemEntity||'materials'})}>
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Mã phiếu (không cần điền)"><input className={input} placeholder="Hệ thống tự tạo" value={header.code||''} onChange={e=>set('code',e.target.value)}/></Field>
      <Field label="Bạn muốn làm gì?"><select className={input} value={header.type} onChange={e=>setHeader(row=>({...row,type:e.target.value,invoiceId:'',sourceIssueId:''}))}>{types.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Ngày"><input className={input} required type="date" value={header.date} onChange={e=>set('date',e.target.value)}/></Field>
      {['RECEIPT','DELIVERY'].includes(header.type)&&<Field label={`Hóa đơn ${header.type==='DELIVERY'?'bán ra':'mua vào'}${needsInvoice?' *':''}`}><select className={input} required={needsInvoice} value={header.invoiceId||''} onChange={e=>setHeader(row=>({...row,invoiceId:e.target.value,invoiceLineIndex:undefined,materialId:'',productId:''}))}><option value="">Chưa gắn hóa đơn</option>{invoices.filter(row=>row.direction===(header.type==='DELIVERY'?'OUTPUT':'INPUT')).map(row=><option key={row.id} value={row.id}>{row.code} · {row.counterparty}</option>)}</select></Field>}
      {invoice&&<Field label="Dòng hàng trên hóa đơn"><select className={input} required value={header.invoiceLineIndex??''} onChange={e=>{const index=Number(e.target.value),line=invoice.items[index];const selected=items.find(row=>row.id===(line.productId||line.materialId));setHeader(row=>({...row,invoiceLineIndex:index,materialId:selected?.itemEntity==='materials'?selected.id:'',productId:selected?.itemEntity==='products'?selected.id:'',quantity:line.quantity}));}}><option value="">Chọn dòng hàng</option>{invoice.items.map((line:Row,index:number)=><option key={index} value={index}>{index+1}. {line.name} · {line.quantity} {line.unit}</option>)}</select></Field>}
      <Field label="Vật tư nào?"><select className={input} required disabled={Boolean(invoice)} value={header.productId||header.materialId||''} onChange={e=>{const selected=items.find(row=>row.id===e.target.value);setHeader(row=>({...row,materialId:selected?.itemEntity==='materials'?selected.id:'',productId:selected?.itemEntity==='products'?selected.id:'',sourceIssueId:''}));}}><option value="">Chọn vật tư</option>{items.filter(row=>header.type==='DELIVERY'?row.itemEntity==='products':needsJob?row.itemEntity==='materials':true).map(row=><option key={row.id} value={row.id}>{row.name} · {row.stock} {row.unit}</option>)}</select></Field>
      <Field label={`Số lượng ${item?.unit?`(${item.unit})`:''}`}><div className="mt-1"><SmartNumberInput required min={0.0001} step="any" value={header.quantity} onChange={num=>set('quantity',num)}/></div></Field>
      {needsJob&&<Field label="Cho việc nào?"><select className={input} required value={header.productionOrderId||''} onChange={e=>set('productionOrderId',e.target.value)}><option value="">Chọn việc</option>{jobs.map(row=><option key={row.id} value={row.id}>{row.code} · {row.productName}</option>)}</select></Field>}
      {header.type==='RETURN'&&<Field label="Lần đã lấy trước đó"><select required className={input} value={header.sourceIssueId||''} onChange={e=>set('sourceIssueId',e.target.value)}><option value="">Chọn lần đã lấy</option>{sources.map(row=>{const returned=moves.filter(move=>move.type==='RETURN'&&move.sourceIssueId===row.id).reduce((sum,move)=>sum+Number(move.quantity),0);return <option key={row.id} value={row.id}>{row.code} · Còn được trả {Number(row.quantity)-returned} {row.unit}</option>;})}</select></Field>}
      {['OWNER','ACCOUNTANT'].includes(user?.role||'')&&['OPENING','RECEIPT','ADJUST_IN'].includes(header.type)&&!invoice&&<Field label="Đơn giá nhập (₫)"><div className="mt-1"><MoneyInput required value={header.unitCost??0} onChange={num=>set('unitCost',num)}/></div></Field>}
    </div>
    {item&&<div className="field-highlight flex justify-between text-xs"><span>Trong kho còn · {item.name}</span><strong className="tabular-nums">{item.stock} {item.unit}</strong></div>}
    <Field label={['OPENING','ADJUST_IN','ADJUST_OUT'].includes(header.type)?'Lý do kiểm kê *':'Ghi chú (không bắt buộc)'}><textarea required={['OPENING','ADJUST_IN','ADJUST_OUT'].includes(header.type)} className={input} rows={2} value={header.note||''} onChange={e=>set('note',e.target.value)}/></Field>
  </FormShell>;
}

export function OpeningBalanceModal({partner,partnerType,onClose,onSaved}:{partner:Row;partnerType:'CUSTOMER'|'SUPPLIER';onClose:()=>void;onSaved:()=>Promise<void>}){
  const [date,setDate]=useState(today()),[amount,setAmount]=useState(0),[reason,setReason]=useState('');
  return <FormShell title={`Tiền còn nợ đầu kỳ · ${partner.name}`} onClose={onClose} onSubmit={async()=>{await api.post('/opening-balances',{partnerId:partner.id,partnerType,date,amount:Number(amount),reason});await onSaved();onClose();}}>
    <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">Giấy tờ đầu kỳ được lưu riêng. Tiền còn nợ hiện hành tự cập nhật theo hóa đơn và thanh toán.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Ngày đầu kỳ"><input required type="date" max={today()} className={input} value={date} onChange={e=>setDate(e.target.value)}/></Field>
      <Field label="Số dư tiền còn nợ (₫)"><div className="mt-1"><MoneyInput required value={amount} onChange={num=>setAmount(num)}/></div></Field>
    </div>
    <Field label="Căn cứ đối chiếu"><textarea required className={input} rows={2} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
  </FormShell>;
}

export function WorkspaceProfile(){
  const {user}=useAuth(),toast=useToast();const [profile,setProfile]=useState<Row>({settings:{accountingRegime:'TT133',taxMethod:'VAT_CREDIT'}}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{void api.get('/workshop').then(({data})=>setProfile({...data,settings:{accountingRegime:'TT133',taxMethod:'VAT_CREDIT',...data.settings}})).catch(reason=>setError(messageOf(reason)));},[]);
  const save=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');try{await api.put('/workshop',{name:profile.name,taxId:profile.tax_id,code:profile.code,settings:profile.settings});toast('Đã lưu thông tin xưởng.');}catch(reason){setError(messageOf(reason));}finally{setBusy(false);}};
  return <Card className="p-5"><form onSubmit={save} className="space-y-4"><h2 className="text-sm font-bold text-slate-900">Thông tin xưởng của bạn</h2><div className="grid gap-3 sm:grid-cols-2">{[['name','Tên doanh nghiệp'],['tax_id','Mã số thuế'],['code','Mã nội bộ (không bắt buộc)']].map(([key,label])=><Field key={key} label={label}><input className={input} required={key==='name'} disabled={user?.role!=='OWNER'} value={profile[key]||''} onChange={e=>setProfile(row=>({...row,[key]:e.target.value}))}/></Field>)}<Field label="Loại hình kinh doanh"><select className={input} disabled={user?.role!=='OWNER'} value={profile.settings.accountingRegime} onChange={e=>setProfile(row=>({...row,settings:{...row.settings,accountingRegime:e.target.value,taxMethod:e.target.value==='HKD_TT152'?'HKD_REVENUE':'VAT_CREDIT'}}))}><option value="TT133">Doanh nghiệp nhỏ và vừa</option><option value="HKD_TT152">Hộ kinh doanh · Tính thuế theo doanh thu</option>{profile.settings.accountingRegime==='DEMO'&&<option value="DEMO">Dữ liệu trình diễn nhiều phương pháp</option>}</select></Field><Field label="Cách tính thuế VAT"><input className={input} readOnly value={profile.settings.taxMethod==='HKD_REVENUE'?'Theo tỷ lệ phần trăm trên doanh thu':profile.settings.taxMethod==='MIXED_DEMO'?'Dữ liệu minh họa nhiều phương pháp':'Có trừ thuế đầu vào'}/></Field><Field label="Đồng tiền và cách tính giá vật tư"><input className={input} readOnly value="VNĐ · Giá trung bình sau mỗi lần nhập kho"/></Field></div><p className="text-xs leading-5 text-slate-500">Năm tài chính 01/01–31/12. Đã có hóa đơn thì chuyển phương pháp cần đối chiếu theo kỳ. Các báo cáo trong ứng dụng chỉ để tham khảo, chưa thay thế báo cáo tài chính hay tờ khai thuế.</p>{error&&<p role="alert" className="text-xs text-red-700">{error}</p>}{user?.role==='OWNER'&&<Button type="submit" compact disabled={busy}>{busy?'Đang lưu…':'Lưu hồ sơ'}</Button>}</form></Card>;
}

export function MemberInvitations(){
  const [email,setEmail]=useState(''),[role,setRole]=useState('ACCOUNTANT'),[link,setLink]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);const toast=useToast();
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');setLink('');try{const {data}=await api.post('/invitations',{email,role});setLink(new URL(data.path,window.location.origin).href);}catch(reason){setError(messageOf(reason));}finally{setBusy(false);}};
  return <Card className="mb-4 p-4"><form onSubmit={submit} className="space-y-3"><h2 className="text-sm font-semibold text-slate-900">Mời nhân viên vào doanh nghiệp</h2><div className="grid items-end gap-3 sm:grid-cols-[1fr_180px_auto]"><Field label="Email người nhận"><input required type="email" className={input} value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Vai trò"><select className={input} value={role} onChange={e=>setRole(e.target.value)}><option value="ACCOUNTANT">Kế toán</option><option value="WAREHOUSE">Thủ kho</option><option value="WORKSHOP">Thợ xưởng</option></select></Field><Button type="submit" compact disabled={busy}>{busy?'Đang tạo…':'Tạo lời mời'}</Button></div>{link&&<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="mb-2 text-xs text-emerald-800">Lời mời dùng một lần, hiệu lực 7 ngày. Sao chép và gửi cho đúng người nhận.</p><div className="flex gap-2"><input aria-label="Liên kết lời mời" className={`${input} min-w-0 flex-1`} readOnly value={link}/><Button variant="secondary" compact onClick={async()=>{try{await navigator.clipboard.writeText(link);toast('Đã sao chép lời mời.');}catch{setError('Chọn và sao chép liên kết lời mời.');}}}><Copy size={14}/>Sao chép</Button></div></div>}{error&&<p role="alert" className="text-xs text-red-700">{error}</p>}</form></Card>;
}
