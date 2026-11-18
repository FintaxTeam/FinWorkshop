import { randomUUID } from 'node:crypto';
import { Router, json } from 'express';
import { getPool } from './db.js';
import { sendCustomEmail } from './mailer.js';

const inquiryTypes = new Set(['DEMO', 'CONTACT', 'IMPLEMENTATION']);

// Public website requests are deliberately separate from workshop/accounting data.
export async function initWebsiteInquiries(database = getPool()) {
  await database.query(`CREATE TABLE IF NOT EXISTS website_inquiries (
    id UUID PRIMARY KEY,
    reference VARCHAR(40) NOT NULL UNIQUE,
    inquiry_type VARCHAR(20) NOT NULL CHECK (inquiry_type IN ('DEMO', 'CONTACT', 'IMPLEMENTATION')),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    company VARCHAR(160),
    phone VARCHAR(32),
    message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 3000),
    consent_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'NEW',
    admin_notes TEXT,
    reply_subject VARCHAR(255),
    reply_message TEXT,
    responded_at TIMESTAMPTZ,
    responded_by VARCHAR(120),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);
}

export function validateWebsiteInquiry(body) {
  const fields = {}, value = {};
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  function text(key, min, max, optional = false) {
    const raw = input[key];
    if (optional && (raw === undefined || raw === null || raw === '')) return '';
    if (typeof raw !== 'string') { fields[key] = 'Vui lòng nhập thông tin hợp lệ.'; return ''; }
    const result = raw.trim();
    const controls = key === 'message' ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
    if (result.length < min || result.length > max || controls.test(result)) fields[key] = `Vui lòng nhập từ ${min} đến ${max} ký tự hợp lệ.`;
    return result;
  }
  value.name = text('name', 2, 120);
  value.email = text('email', 3, 254).toLowerCase();
  value.company = text('company', 0, 160, true);
  value.phone = text('phone', 0, 32, true);
  value.message = text('message', 10, 3000);
  if (!fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) fields.email = 'Địa chỉ email chưa hợp lệ.';
  if (value.phone && !fields.phone && (!/^[+\d().\s-]+$/.test(value.phone) || !/^\d{7,15}$/.test(value.phone.replace(/\D/g, '')))) fields.phone = 'Số điện thoại cần từ 7 đến 15 chữ số.';
  if (typeof input.type !== 'string' || !inquiryTypes.has(input.type)) fields.type = 'Vui lòng chọn loại yêu cầu hợp lệ.';
  else value.type = input.type;
  if (input.consent !== true) fields.consent = 'Cần đồng ý để FinWorkshop lưu và xử lý thông tin yêu cầu.';
  return { value, fields };
}

export function websiteInquiryRateLimit({ max = 10, windowMs = 15 * 60 * 1000, now = Date.now } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const time = now(), key = String(req.ip || req.socket?.remoteAddress || 'unknown');
    let bucket = buckets.get(key);
    if (!bucket || time - bucket.startedAt >= windowMs) {
      if (buckets.size >= 5000) buckets.delete(buckets.keys().next().value);
      bucket = { startedAt: time, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((windowMs - (time - bucket.startedAt)) / 1000))));
      return res.status(429).json({ error: 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau ít phút.' });
    }
    next();
  };
}

export function createWebsiteRouter({
  database = getPool,
  rateLimit = websiteInquiryRateLimit(),
  requireAuth = (_req, _res, next) => next(),
  requireAdmin = (_req, _res, next) => next(),
} = {}) {
  const router = Router();

  // Public: Gửi yêu cầu tư vấn / demo từ website (/lien-he hoặc /demo)
  router.post('/inquiries', rateLimit, json({ limit: '16kb' }), async (req, res, next) => {
    const { value, fields } = validateWebsiteInquiry(req.body);
    if (Object.keys(fields).length) return res.status(400).json({ error: 'Vui lòng kiểm tra thông tin gửi yêu cầu.', fields });
    const id = randomUUID(), reference = `FW-${id.toUpperCase()}`, receivedAt = new Date().toISOString();
    try {
      await database().query(`INSERT INTO website_inquiries
        (id, reference, inquiry_type, name, email, company, phone, message, consent_at, created_at, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, 'NEW')`,
      [id, reference, value.type, value.name, value.email, value.company || null, value.phone || null, value.message, receivedAt]);
      res.status(201).json({ ok: true, reference, receivedAt, message: 'Yêu cầu đã được ghi nhận.' });
    } catch (error) { next(error); }
  });

  // Admin: Lấy danh sách yêu cầu tư vấn & thống kê (Dành cho Chủ web)
  router.get('/inquiries', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const type = req.query.type ? String(req.query.type).trim() : null;
      const status = req.query.status ? String(req.query.status).trim() : null;
      const q = req.query.q ? `%${String(req.query.q).trim()}%` : null;

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (type && inquiryTypes.has(type)) {
        params.push(type);
        whereClause += ` AND inquiry_type = $${params.length}`;
      }

      if (status) {
        params.push(status);
        whereClause += ` AND status = $${params.length}`;
      }

      if (q) {
        params.push(q);
        whereClause += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length} OR company ILIKE $${params.length} OR reference ILIKE $${params.length})`;
      }

      const sql = `SELECT * FROM website_inquiries ${whereClause} ORDER BY created_at DESC LIMIT 500`;
      const [rows] = await database().query(sql, params);

      // Thống kê tổng quan
      const [allRows] = await database().query(`SELECT status, count(*)::int as count FROM website_inquiries GROUP BY status`);
      const counts = { total: 0, newCount: 0, inProgressCount: 0, respondedCount: 0, closedCount: 0 };
      for (const row of allRows) {
        const count = Number(row.count) || 0;
        counts.total += count;
        if (row.status === 'NEW') counts.newCount += count;
        else if (row.status === 'IN_PROGRESS') counts.inProgressCount += count;
        else if (row.status === 'RESPONDED') counts.respondedCount += count;
        else if (row.status === 'CLOSED') counts.closedCount += count;
      }

      res.json({
        stats: counts,
        items: rows.map(r => ({
          id: r.id,
          reference: r.reference,
          inquiryType: r.inquiry_type,
          name: r.name,
          email: r.email,
          company: r.company || '',
          phone: r.phone || '',
          message: r.message,
          consentAt: r.consent_at,
          createdAt: r.created_at,
          status: r.status || 'NEW',
          adminNotes: r.admin_notes || '',
          replySubject: r.reply_subject || '',
          replyMessage: r.reply_message || '',
          respondedAt: r.responded_at || null,
          respondedBy: r.responded_by || null,
          updatedAt: r.updated_at || r.created_at
        }))
      });
    } catch (error) { next(error); }
  });

  // Admin: Lấy chi tiết 1 yêu cầu tư vấn
  router.get('/inquiries/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const [rows] = await database().query('SELECT * FROM website_inquiries WHERE id = $1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy yêu cầu.' });
      const r = rows[0];
      res.json({
        id: r.id,
        reference: r.reference,
        inquiryType: r.inquiry_type,
        name: r.name,
        email: r.email,
        company: r.company || '',
        phone: r.phone || '',
        message: r.message,
        consentAt: r.consent_at,
        createdAt: r.created_at,
        status: r.status || 'NEW',
        adminNotes: r.admin_notes || '',
        replySubject: r.reply_subject || '',
        replyMessage: r.reply_message || '',
        respondedAt: r.responded_at || null,
        respondedBy: r.responded_by || null,
        updatedAt: r.updated_at || r.created_at
      });
    } catch (error) { next(error); }
  });

  // Admin: Cập nhật trạng thái / ghi chú nội bộ của yêu cầu
  router.patch('/inquiries/:id', requireAuth, requireAdmin, json({ limit: '32kb' }), async (req, res, next) => {
    try {
      const { status, adminNotes } = req.body || {};
      const updates = [];
      const params = [req.params.id];

      if (status !== undefined) {
        params.push(String(status).trim());
        updates.push(`status = $${params.length}`);
      }
      if (adminNotes !== undefined) {
        params.push(String(adminNotes).trim());
        updates.push(`admin_notes = $${params.length}`);
      }

      if (!updates.length) return res.status(400).json({ error: 'Không có dữ liệu cập nhật.' });

      updates.push(`updated_at = NOW()`);
      const sql = `UPDATE website_inquiries SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
      const [rows] = await database().query(sql, params);
      if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy yêu cầu.' });
      res.json({ ok: true, item: rows[0] });
    } catch (error) { next(error); }
  });

  // Admin: Trả lời yêu cầu tư vấn của khách hàng (Lưu nội dung trả lời & gửi email nếu cấu hình)
  router.post('/inquiries/:id/reply', requireAuth, requireAdmin, json({ limit: '64kb' }), async (req, res, next) => {
    try {
      const { subject, message, sendEmail = true, status = 'RESPONDED' } = req.body || {};
      if (!message || typeof message !== 'string' || message.trim().length < 5) {
        return res.status(400).json({ error: 'Nội dung phản hồi cần ít nhất 5 ký tự.' });
      }

      const [rows] = await database().query('SELECT * FROM website_inquiries WHERE id = $1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy yêu cầu để trả lời.' });
      const inquiry = rows[0];

      const cleanSubject = String(subject || `[FinWorkshop] Phản hồi yêu cầu tư vấn (${inquiry.reference})`).trim();
      const cleanMessage = String(message).trim();
      const responder = req.user?.email || 'admin@fintaxauto.space';
      const now = new Date().toISOString();

      // Cập nhật database
      const [updatedRows] = await database().query(`
        UPDATE website_inquiries
        SET status = $2,
            reply_subject = $3,
            reply_message = $4,
            responded_at = $5,
            responded_by = $6,
            updated_at = $5
        WHERE id = $1
        RETURNING *
      `, [req.params.id, status, cleanSubject, cleanMessage, now, responder]);

      // Gửi email nếu có yêu cầu
      let emailResult = { ok: false, note: 'Chưa kích hoạt gửi email.' };
      if (sendEmail) {
        emailResult = await sendCustomEmail({
          to: inquiry.email,
          subject: cleanSubject,
          text: `Kính gửi ${inquiry.name},\n\n${cleanMessage}\n\nTrân trọng,\nĐội ngũ FinWorkshop\nWebsite: https://fintaxauto.space`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #0f172a; padding: 24px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 20px;">FinWorkshop · Phản Hồi Tư Vấn</h2>
                <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Mã yêu cầu: ${inquiry.reference}</p>
              </div>
              <div style="padding: 24px; background-color: #ffffff;">
                <p>Kính gửi <strong>${inquiry.name}</strong>,</p>
                <p>Cảm ơn Quý khách đã gửi yêu cầu tư vấn đến FinWorkshop về: <em>${inquiry.inquiry_type === 'DEMO' ? 'Đăng ký Demo sản phẩm' : inquiry.inquiry_type === 'IMPLEMENTATION' ? 'Khảo sát nhu cầu triển khai' : 'Tìm hiểu sản phẩm'}</em>.</p>
                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px; white-space: pre-wrap;">${cleanMessage}</div>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 12px; color: #64748b;">
                  Nếu Quý khách có thêm câu hỏi hoặc cần hỗ trợ trực tiếp, vui lòng phản hồi email này hoặc truy cập <a href="https://fintaxauto.space" style="color: #2563eb;">fintaxauto.space</a>.
                </p>
              </div>
              <div style="background-color: #f1f5f9; padding: 16px 24px; font-size: 11px; color: #64748b; text-align: center;">
                © 2026 FinWorkshop · Nền tảng Kế toán & Quản trị Xưởng Sản Xuất
              </div>
            </div>
          `
        });
      }

      res.json({
        ok: true,
        message: 'Đã lưu phản hồi thành công.',
        emailSent: emailResult.ok,
        emailNote: emailResult.note || emailResult.error || (emailResult.ok ? 'Đã gửi email đến khách hàng.' : null),
        inquiry: updatedRows[0]
      });
    } catch (error) { next(error); }
  });

  // Admin: Xóa yêu cầu (dùng khi thử nghiệm hoặc dọn rác)
  router.delete('/inquiries/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const [resDel] = await database().query('DELETE FROM website_inquiries WHERE id = $1', [req.params.id]);
      res.json({ ok: true, message: 'Đã xóa yêu cầu.' });
    } catch (error) { next(error); }
  });

  return router;
}
