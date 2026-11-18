import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import taxRoutes from './routes/taxRoutes.js';
import { taxController } from './controllers/taxController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Mock-Tax-API] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'FinWorkshop Mock Tax Authority API',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  if (req.accepts('html') && !req.query.format) {
    return res.send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Cổng Tra Cứu Hóa Đơn Điện Tử — Tổng Cục Thuế</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #f8fafc; color: #0f172a; }
    header { background: #1e3a8a; color: #fff; padding: 18px 28px; display: flex; align-items: center; justify-content: space-between; }
    .badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 99px; padding: 4px 12px; font-size: 12px; font-weight: 600; }
    main { max-width: 820px; margin: 36px auto; padding: 0 20px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 24px; box-shadow: 0 2px 8px rgba(15,23,42,0.04); }
    h1 { margin: 0; font-size: 17px; letter-spacing: .02em; }
    h2 { margin: 0 0 8px; font-size: 16px; color: #0f172a; }
    .search-row { display: flex; gap: 10px; margin-top: 14px; }
    input { flex: 1; padding: 11px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; font-family: monospace; outline: none; }
    input:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px rgba(29,78,216,0.12); }
    button { padding: 11px 20px; background: #1d4ed8; color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
    button:hover { background: #1e40af; }
    .result-box { margin-top: 20px; border-radius: 12px; border: 1px solid #a7f3d0; background: #ecfdf5; padding: 20px; }
    .error-box { margin-top: 20px; border-radius: 12px; border: 1px solid #fecdd3; background: #fff1f2; padding: 16px; color: #9f1239; font-size: 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #a7f3d0; font-size: 13px; }
    .label { color: #047857; font-size: 11px; text-transform: uppercase; font-weight: 700; }
    .val { font-weight: 700; color: #064e3b; margin-top: 2px; font-size: 14px; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>🏛️ CỔNG TRA CỨU HÓA ĐƠN ĐIỆN TỬ — CƠ QUAN THUẾ (MOCK TAX PORTAL)</h1>
      <div style="font-size:12px;opacity:.8;margin-top:3px">Hệ thống xác thực Mã của Cơ Quan Thuế (CQT) cấp cho Hóa đơn điện tử</div>
    </div>
    <span class="badge">● Cổng Thuế :${PORT}</span>
  </header>
  <main>
    <div class="card">
      <h2>Tra cứu Hóa đơn điện tử theo Mã Cơ Quan Thuế (Mã CQT)</h2>
      <p style="margin:0;font-size:13px;color:#64748b">Dán mã CQT vừa được cấp bên phần mềm Xưởng (FinWorkshop) vào ô bên dưới để kiểm tra thông tin hóa đơn đã đăng ký trên Cổng Thuế.</p>
      <form class="search-row" onsubmit="event.preventDefault();verifyCode()">
        <input id="codeInput" placeholder="Dán Mã CQT vào đây (VD: C26-XXXX-XXXXXXXX)" autofocus />
        <button type="submit">Tra cứu hóa đơn</button>
      </form>
      <div id="verifyResult"></div>
    </div>
  </main>
  <script>
    const fmtMoney = (n) => new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + ' ₫';
    async function verifyCode() {
      const code = document.getElementById('codeInput').value.trim();
      const box = document.getElementById('verifyResult');
      if (!code) return;
      const res = await fetch('/api/tax/invoice/verify/' + encodeURIComponent(code));
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        box.innerHTML = '<div class="error-box"><b>Không tìm thấy hóa đơn:</b> ' + (json.message || 'Mã CQT không tồn tại trên hệ thống.') + '</div>';
        return;
      }
      const d = json.data;
      box.innerHTML = \`
        <div class="result-box">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:800;color:#065f46;font-size:15px">✓ HÓA ĐƠN ĐIỆN TỬ HỢP LỆ — ĐÃ CẤP MÃ CQT</span>
            <span style="font-family:monospace;font-weight:800;background:#fff;padding:4px 10px;border-radius:6px;border:1px solid #6ee7b7;color:#047857">\${d.taxAuthorityCode}</span>
          </div>
          <div class="grid">
            <div><div class="label">Số hóa đơn</div><div class="val">\${d.invoiceNumber}</div></div>
            <div><div class="label">Ngày lập hóa đơn</div><div class="val">\${d.invoiceDate}</div></div>
            <div><div class="label">Đơn vị bán hàng</div><div class="val">\${d.sellerName || 'Xưởng Sản Xuất FinWorkshop'} (MST: \${d.sellerTaxCode || '0316890123'})</div></div>
            <div><div class="label">Đơn vị mua hàng</div><div class="val">\${d.buyerName || 'Khách hàng'}</div></div>
            <div><div class="label">Tiền trước thuế / Thuế GTGT</div><div class="val">\${fmtMoney(d.subtotal)} / \${fmtMoney(d.taxAmount)}</div></div>
            <div><div class="label">Tổng tiền thanh toán</div><div class="val" style="font-size:16px">\${fmtMoney(d.totalAmount)}</div></div>
            <div style="grid-column:span 2"><div class="label">Thời điểm Cơ Quan Thuế cấp mã</div><div class="val">\${new Date(d.issuedAt).toLocaleString('vi-VN')}</div></div>
          </div>
        </div>
      \`;
    }
  </script>
</body>
</html>`);
  }
  res.json({
    message: 'Chào mừng đến với Cổng Giả lập Tổng Cục Thuế Việt Nam (FinWorkshop Mock Tax API)',
    endpoints: {
      health: 'GET /health',
      checkMst: 'GET /api/tax/check-mst/:mst',
      issueInvoiceCode: 'POST /api/tax/invoice/issue-code',
      verifyInvoice: 'GET /api/tax/invoice/verify/:code',
      history: 'GET /api/tax/history',
      middlewareInvoiceCode: 'POST /api/v1/invoices/issue',
    },
  });
});

// API Routes
app.use('/api/tax', taxRoutes);
// Backward-compatible endpoint used by the FinTax middleware.
app.post('/api/v1/invoices/issue', taxController.issueTaxAuthorityCode);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint không tồn tại trên Cổng Thuế',
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 [Mock Tax API] đang chạy tại: http://localhost:${PORT}`);
  console.log(`📋 Kiểm tra sức khỏe: http://localhost:${PORT}/health`);
  console.log(`🔍 Tra cứu MST: http://localhost:${PORT}/api/tax/check-mst/:mst`);
  console.log(`====================================================`);
});
