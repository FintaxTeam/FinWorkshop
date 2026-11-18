import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, LayoutDashboard, Mail, FileText, Settings, Users,
  Factory, CheckCircle2, Clock, AlertCircle, ExternalLink, Send,
  RefreshCw, Search, Filter, ArrowLeft, Building2, Database,
  Server, ChevronRight, Plus, Trash2, LogOut, X, Check,
  Layers, Globe, Sparkles, MessageSquare, Phone, Building,
  KeyRound, Lock, Unlock, HelpCircle, Landmark, Edit, Percent,
  Calculator, UserPlus, History, UserCheck, ShieldAlert, ListFilter,
  ArrowRight, Play, Eye
} from 'lucide-react';
import { api, messageOf } from './api';
import { useAuth } from './auth';
import { useLanguage } from './language';
import { useToast } from './components';

// ==========================================
// TYPES
// ==========================================
type Inquiry = {
  id: string;
  reference: string;
  inquiryType: 'CONTACT' | 'DEMO' | 'IMPLEMENTATION';
  name: string;
  email: string;
  company: string;
  phone: string;
  message: string;
  consentAt: string;
  createdAt: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESPONDED' | 'CLOSED';
  adminNotes: string;
  replySubject: string;
  replyMessage: string;
  respondedAt: string | null;
  respondedBy: string | null;
  updatedAt: string;
};

type InquiryStats = {
  total: number;
  newCount: number;
  inProgressCount: number;
  respondedCount: number;
  closedCount: number;
};

type SystemStatus = {
  uptimeSeconds: number;
  nodeVersion: string;
  memory: { rss: number; heapUsed: number; heapTotal: number };
  environment: string;
  database: { status: string; latencyMs: number; name: string };
  odoo: { connected: boolean; label: string; mode?: string; database?: string };
  mockTax: { status: string; url: string };
  counts: { workshops: number; users: number; inquiries: number; newInquiries: number };
  services: Array<{ name: string; url?: string; status: string; badge: string }>;
};

type WorkshopItem = {
  id: string;
  name: string;
  code: string;
  tax_id: string;
  active: boolean;
  created_at: string;
  member_count: number;
};

type UserItem = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  active: boolean;
  created_at: string;
  workshop_id: string;
  workshop_name: string;
};

type TaxRule = {
  id: string;
  code: string;
  name: string;
  taxMode: 'VAT_CREDIT' | 'HKD_REVENUE' | 'EXEMPT';
  taxRate: number;
  vatRate: number;
  pitRate: number;
  status: 'ACTIVE' | 'REVIEW_REQUIRED' | 'INACTIVE';
  version: number;
  effectiveFrom: string;
  effectiveTo: string;
  legalReference: string;
  notes: string;
};

type OdooJob = {
  id: string;
  workshop_id: string;
  workshop_name?: string;
  workshop_code?: string;
  entity: string;
  record_id: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type OdooQueueStats = {
  total: number;
  pending: number;
  synced: number;
  failed: number;
};

type AuditItem = {
  id: string;
  actor: { name?: string; email?: string; role?: string };
  action: string;
  entity: string;
  createdAt: string;
  recordId?: string;
  workshopId?: string;
  afterData?: any;
};

export default function AdminPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'inquiries' | 'taxes' | 'tools' | 'workshops' | 'users' | 'odoo' | 'system' | 'audit'>('inquiries');
  const [loading, setLoading] = useState(false);

  // ==========================================
  // INQUIRIES STATE
  // ==========================================
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats>({ total: 0, newCount: 0, inProgressCount: 0, respondedCount: 0, closedCount: 0 });
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inquiryGroupBy, setInquiryGroupBy] = useState<'NONE' | 'STATUS' | 'TYPE'>('NONE');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  // Reply Form State
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState<'RESPONDED' | 'IN_PROGRESS' | 'CLOSED'>('RESPONDED');
  const [adminNotes, setAdminNotes] = useState('');
  const [sendEmailDirectly, setSendEmailDirectly] = useState(true);
  const [replying, setReplying] = useState(false);

  // Convert Inquiry to Workshop Modal
  const [convertModal, setConvertModal] = useState<{ open: boolean; inq: Inquiry | null; tempPassword: string; busy: boolean }>({
    open: false, inq: null, tempPassword: 'FinTax@2026', busy: false
  });

  // ==========================================
  // TAX RULES STATE
  // ==========================================
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxSearch, setTaxSearch] = useState('');
  const [taxModeFilter, setTaxModeFilter] = useState('ALL');
  const [taxStatusFilter, setTaxStatusFilter] = useState('ALL');
  const [taxGroupBy, setTaxGroupBy] = useState<'NONE' | 'MODE' | 'STATUS'>('MODE');
  const [taxModal, setTaxModal] = useState<{ open: boolean; isEdit: boolean; rule: Partial<TaxRule> }>({
    open: false, isEdit: false, rule: {}
  });

  // ==========================================
  // TAX CALCULATOR & TOOLS STATE
  // ==========================================
  const [calcAmount, setCalcAmount] = useState<number>(10000000);
  const [calcSelectedRule, setCalcSelectedRule] = useState<string>('VAT_10');
  const [searchMst, setSearchMst] = useState('0316890123');
  const [mstResult, setMstResult] = useState<any>(null);
  const [mstLoading, setMstLoading] = useState(false);
  const [testCodeResult, setTestCodeResult] = useState<any>(null);
  const [testCodeLoading, setTestCodeLoading] = useState(false);

  // ==========================================
  // WORKSHOPS STATE
  // ==========================================
  const [workshops, setWorkshops] = useState<WorkshopItem[]>([]);
  const [workshopSearch, setWorkshopSearch] = useState('');
  const [workshopStatusFilter, setWorkshopStatusFilter] = useState('ALL');
  const [workshopGroupBy, setWorkshopGroupBy] = useState<'NONE' | 'STATUS'>('NONE');
  const [createWorkshopModal, setCreateWorkshopModal] = useState({ open: false, name: '', code: '', tax_id: '', busy: false });

  // ==========================================
  // USERS STATE
  // ==========================================
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userWorkshopFilter, setUserWorkshopFilter] = useState('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');
  const [userGroupBy, setUserGroupBy] = useState<'NONE' | 'ROLE' | 'WORKSHOP'>('NONE');
  const [createUserModal, setCreateUserModal] = useState({
    open: false, email: '', password: 'FinTax@2026', full_name: '', role: 'OWNER', workshop_id: '', busy: false
  });
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; userId: string; userEmail: string; newPassword: string }>({
    open: false, userId: '', userEmail: '', newPassword: ''
  });

  // ==========================================
  // ODOO ERP QUEUE STATE
  // ==========================================
  const [odooJobs, setOdooJobs] = useState<OdooJob[]>([]);
  const [odooStats, setOdooStats] = useState<OdooQueueStats>({ total: 0, pending: 0, synced: 0, failed: 0 });
  const [odooLoading, setOdooLoading] = useState(false);
  const [odooStatusFilter, setOdooStatusFilter] = useState('ALL');
  const [odooEntityFilter, setOdooEntityFilter] = useState('ALL');
  const [odooSearch, setOdooSearch] = useState('');
  const [odooGroupBy, setOdooGroupBy] = useState<'NONE' | 'ENTITY' | 'STATUS'>('ENTITY');
  const [selectedOdooJob, setSelectedOdooJob] = useState<OdooJob | null>(null);
  const [syncingAllOdoo, setSyncingAllOdoo] = useState(false);

  // ==========================================
  // SYSTEM & SMTP STATE
  // ==========================================
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [checkingSystem, setCheckingSystem] = useState(false);
  const [smtpInfo, setSmtpInfo] = useState<any>(null);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);

  // ==========================================
  // AUDIT LOGS STATE
  // ==========================================
  const [auditLogs, setAuditLogs] = useState<AuditItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('ALL');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditGroupBy, setAuditGroupBy] = useState<'NONE' | 'ENTITY' | 'ACTION'>('NONE');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditItem | null>(null);

  // ==========================================
  // API LOADERS
  // ==========================================
  const loadInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== 'ALL') params.set('type', filterType);
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await api.get(`/website/inquiries?${params.toString()}`);
      setInquiries(res.data.items || []);
      setStats(res.data.stats || { total: 0, newCount: 0, inProgressCount: 0, respondedCount: 0, closedCount: 0 });
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, searchQuery, toast]);

  const loadTaxRules = useCallback(async () => {
    setTaxLoading(true);
    try {
      const res = await api.get('/admin/tax-rules');
      setTaxRules(res.data || []);
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setTaxLoading(false);
    }
  }, [toast]);

  const loadWorkshops = useCallback(async () => {
    try {
      const res = await api.get('/admin/workshops');
      setWorkshops(res.data || []);
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  }, [toast]);

  const loadOdooQueue = useCallback(async () => {
    setOdooLoading(true);
    try {
      const params = new URLSearchParams();
      if (odooStatusFilter !== 'ALL') params.set('status', odooStatusFilter);
      if (odooEntityFilter !== 'ALL') params.set('entity', odooEntityFilter);
      if (odooSearch.trim()) params.set('q', odooSearch.trim());

      const res = await api.get(`/admin/odoo/queue?${params.toString()}`);
      setOdooJobs(res.data.items || []);
      setOdooStats(res.data.stats || { total: 0, pending: 0, synced: 0, failed: 0 });
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setOdooLoading(false);
    }
  }, [odooStatusFilter, odooEntityFilter, odooSearch, toast]);

  const loadSystemStatus = useCallback(async () => {
    setCheckingSystem(true);
    try {
      const [sysRes, smtpRes] = await Promise.all([
        api.get('/admin/system/status'),
        api.get('/admin/smtp/status').catch(() => ({ data: null }))
      ]);
      setSystemStatus(sysRes.data);
      if (smtpRes?.data) setSmtpInfo(smtpRes.data);
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setCheckingSystem(false);
    }
  }, [toast]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api.get('/admin/audit-logs');
      setAuditLogs(res.data || []);
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setAuditLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'inquiries') loadInquiries();
    else if (activeTab === 'taxes' || activeTab === 'tools') loadTaxRules();
    else if (activeTab === 'workshops') loadWorkshops();
    else if (activeTab === 'users') { loadUsers(); loadWorkshops(); }
    else if (activeTab === 'odoo') loadOdooQueue();
    else if (activeTab === 'system') loadSystemStatus();
    else if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab, loadInquiries, loadTaxRules, loadWorkshops, loadUsers, loadOdooQueue, loadSystemStatus, loadAuditLogs]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const openReplyModal = (inq: Inquiry) => {
    setSelectedInquiry(inq);
    setReplySubject(inq.replySubject || `[FinWorkshop] Phản hồi yêu cầu tư vấn (${inq.reference})`);
    setReplyMessage(inq.replyMessage || '');
    setReplyStatus(inq.status === 'NEW' ? 'RESPONDED' : inq.status);
    setAdminNotes(inq.adminNotes || '');
    setSendEmailDirectly(true);
  };

  const applyTemplate = (type: 'DEMO' | 'QUOTE' | 'EXPERIENCE') => {
    if (!selectedInquiry) return;
    if (type === 'DEMO') {
      setReplySubject(`[FinWorkshop] Lịch Demo & Giới thiệu giải pháp quản lý sản xuất cho ${selectedInquiry.name}`);
      setReplyMessage(
        `Chào ${selectedInquiry.name},\n\nĐội ngũ FinWorkshop rất vui mừng nhận được yêu cầu của bạn về giải pháp quản lý sản xuất và kế toán cho xưởng.\n\nChúng tôi xin đề xuất một buổi Demo trực tuyến (30 phút) để giới thiệu chi tiết:\n1. Tự động hóa tính định mức nguyên vật liệu (BOM) và giá thành đơn hàng.\n2. Quản lý tiến độ sản xuất xưởng và xuất nhập kho theo thời gian thực.\n3. Đồng bộ hóa đơn, dòng tiền và kết nối với nền tảng ERP Odoo 16.\n\nBạn có thể phản hồi lại email này với khung giờ thuận tiện nhất (Ví dụ: 10h00 sáng mai) để chúng tôi chuẩn bị chu đáo nhất nhé.\n\nTrân trọng,\nĐội ngũ FinWorkshop\nHotline: 0943 863 108\nWebsite: https://fintaxauto.space`
      );
    } else if (type === 'QUOTE') {
      setReplySubject(`[FinWorkshop] Báo giá & Tư vấn gói giải pháp FinWorkshop`);
      setReplyMessage(
        `Chào ${selectedInquiry.name},\n\nFinWorkshop xin gửi thông tin sơ bộ về giải pháp phần mềm quản trị xưởng sản xuất và kế toán thuế dành cho doanh nghiệp của bạn.\n\nHiện tại FinWorkshop đang cung cấp các gói triển khai:\n- Gói Khởi nghiệp (Dưới 10 nhân sự): Đầy đủ tính năng báo giá, kho, thu chi và 7 sổ kế toán.\n- Gói Xưởng Tiêu chuẩn: Tích hợp Lệnh sản xuất, định mức vật tư BOM và cấp mã hóa đơn CQT.\n- Gói Doanh nghiệp Tích hợp Odoo: Kết nối hai chiều với ERP Odoo 16 và đối soát ngân hàng tự động.\n\nChuyên viên của chúng tôi sẽ gọi điện trực tiếp qua số ${selectedInquiry.phone || 'của bạn'} để trao đổi cụ thể hơn nhé.\n\nTrân trọng,\nĐội ngũ FinWorkshop`
      );
    } else if (type === 'EXPERIENCE') {
      setReplySubject(`[FinWorkshop] Hướng dẫn trải nghiệm & Tài khoản thử nghiệm`);
      setReplyMessage(
        `Chào ${selectedInquiry.name},\n\nFinWorkshop đã ghi nhận thông tin đăng ký của bạn. Bạn có thể bắt đầu trải nghiệm trực tiếp hệ thống ngay tại:\n👉 Website: https://fintaxauto.space/demo\n\nBạn có thể thử nghiệm 4 vai trò chính:\n1. Chủ xưởng: Xem tổng quan tài chính, duyệt hóa đơn và theo dõi dòng tiền.\n2. Kế toán: Quản lý hóa đơn Mua/Bán, báo cáo thuế và đối soát công nợ.\n3. Thủ kho: Quản lý xuất nhập tồn kho vật tư và thành phẩm.\n4. Thợ xưởng: Ghi nhận giờ công lao động và tiến độ công việc.\n\nNếu cần hỗ trợ kỹ thuật trong quá trình dùng thử, bạn hãy liên hệ ngay với chúng tôi nhé!\n\nTrân trọng,\nĐội ngũ FinWorkshop`
      );
    }
  };

  const handleSendReply = async () => {
    if (!selectedInquiry) return;
    if (!replyMessage.trim()) {
      toast('Vui lòng nhập nội dung phản hồi cho khách hàng.', 'error');
      return;
    }
    setReplying(true);
    try {
      if (adminNotes !== selectedInquiry.adminNotes) {
        await api.patch(`/website/inquiries/${selectedInquiry.id}`, { adminNotes });
      }
      const res = await api.post(`/website/inquiries/${selectedInquiry.id}/reply`, {
        subject: replySubject,
        message: replyMessage,
        status: replyStatus,
        sendEmail: sendEmailDirectly
      });
      toast(res.data.emailSent ? 'Đã gửi phản hồi và email đến khách hàng!' : 'Đã lưu phản hồi vào hồ sơ yêu cầu.', 'success');
      setSelectedInquiry(null);
      await loadInquiries();
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setReplying(false);
    }
  };

  const handleConvertToWorkshop = async () => {
    if (!convertModal.inq) return;
    setConvertModal(prev => ({ ...prev, busy: true }));
    try {
      const res = await api.post(`/admin/inquiries/${convertModal.inq.id}/convert-to-workshop`, {
        password: convertModal.tempPassword
      });
      toast(res.data.message || 'Đã khởi tạo xưởng và cấp tài khoản thành công!', 'success');
      setConvertModal({ open: false, inq: null, tempPassword: 'FinTax@2026', busy: false });
      setSelectedInquiry(null);
      await loadInquiries();
      await loadWorkshops();
    } catch (err) {
      toast(messageOf(err), 'error');
      setConvertModal(prev => ({ ...prev, busy: false }));
    }
  };

  const handleSaveTaxRule = async () => {
    const { code, name, taxMode, vatRate, pitRate, legalReference, notes, effectiveFrom, effectiveTo, status } = taxModal.rule;
    if (!code?.trim() || !name?.trim()) {
      toast('Vui lòng nhập đầy đủ mã quy tắc và tên mức thuế.', 'error');
      return;
    }
    try {
      if (taxModal.isEdit && taxModal.rule.id) {
        await api.put(`/admin/tax-rules/${taxModal.rule.id}`, {
          name, taxMode, vatRate, pitRate, legalReference, notes, effectiveFrom, effectiveTo, status
        });
        toast('Đã cập nhật quy tắc thuế trên toàn hệ thống!', 'success');
      } else {
        await api.post('/admin/tax-rules', {
          code, name, taxMode: taxMode || 'VAT_CREDIT',
          vatRate: vatRate !== undefined ? Number(vatRate) : 10,
          pitRate: pitRate !== undefined ? Number(pitRate) : 0,
          status: status || 'ACTIVE',
          effectiveFrom: effectiveFrom || new Date().toISOString().slice(0, 10),
          effectiveTo: effectiveTo || '',
          legalReference: legalReference || '',
          notes: notes || ''
        });
        toast('Đã thêm mức thuế mới và áp dụng cho toàn bộ xưởng!', 'success');
      }
      setTaxModal({ open: false, isEdit: false, rule: {} });
      await loadTaxRules();
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  };

  const handleToggleTaxStatus = async (rule: TaxRule) => {
    const nextStatus = rule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/admin/tax-rules/${rule.id}/status`, { status: nextStatus });
      toast(`Đã chuyển quy tắc thuế sang ${nextStatus === 'ACTIVE' ? 'Áp dụng' : 'Tạm ngừng'}.`, 'success');
      await loadTaxRules();
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  };

  const handleCheckMst = async () => {
    if (!searchMst.trim()) return;
    setMstLoading(true);
    setMstResult(null);
    try {
      const res = await api.post('/admin/tax-tools/check-mst', { mst: searchMst.trim() });
      setMstResult(res.data);
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setMstLoading(false);
    }
  };

  const handleTestIssueCode = async () => {
    setTestCodeLoading(true);
    setTestCodeResult(null);
    try {
      const res = await api.post('/admin/tax-tools/issue-test-code', {});
      setTestCodeResult(res.data);
      toast('Đã thử nghiệm cấp mã CQT thành công!', 'success');
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setTestCodeLoading(false);
    }
  };

  const handleCreateWorkshop = async () => {
    if (!createWorkshopModal.name.trim()) {
      toast('Vui lòng nhập tên xưởng / doanh nghiệp.', 'error');
      return;
    }
    setCreateWorkshopModal(prev => ({ ...prev, busy: true }));
    try {
      await api.post('/admin/workshops', {
        name: createWorkshopModal.name,
        code: createWorkshopModal.code,
        tax_id: createWorkshopModal.tax_id
      });
      toast('Đã tạo xưởng mới thành công!', 'success');
      setCreateWorkshopModal({ open: false, name: '', code: '', tax_id: '', busy: false });
      await loadWorkshops();
    } catch (err) {
      toast(messageOf(err), 'error');
      setCreateWorkshopModal(prev => ({ ...prev, busy: false }));
    }
  };

  const handleToggleWorkshopStatus = async (wid: string, currentActive: boolean) => {
    try {
      await api.patch(`/admin/workshops/${wid}/status`, { active: !currentActive });
      toast(!currentActive ? 'Đã kích hoạt xưởng hoạt động.' : 'Đã tạm ngừng hoạt động xưởng.', 'success');
      await loadWorkshops();
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  };

  const handleCreateUser = async () => {
    const { email, password, full_name, role, workshop_id } = createUserModal;
    if (!email.trim() || !password || !full_name.trim()) {
      toast('Vui lòng điền đầy đủ email, mật khẩu và họ tên.', 'error');
      return;
    }
    setCreateUserModal(prev => ({ ...prev, busy: true }));
    try {
      await api.post('/admin/users', { email, password, full_name, role, workshop_id: workshop_id || undefined });
      toast('Đã tạo tài khoản người dùng thành công!', 'success');
      setCreateUserModal({ open: false, email: '', password: 'FinTax@2026', full_name: '', role: 'OWNER', workshop_id: '', busy: false });
      await loadUsers();
    } catch (err) {
      toast(messageOf(err), 'error');
      setCreateUserModal(prev => ({ ...prev, busy: false }));
    }
  };

  const handleToggleUser = async (userId: string, currentActive: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { active: !currentActive });
      toast(!currentActive ? 'Đã kích hoạt tài khoản.' : 'Đã khóa tài khoản.', 'success');
      loadUsers();
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordModal.newPassword || resetPasswordModal.newPassword.length < 8) {
      toast('Mật khẩu mới cần ít nhất 8 ký tự.', 'error');
      return;
    }
    try {
      await api.post(`/admin/users/${resetPasswordModal.userId}/reset-password`, {
        newPassword: resetPasswordModal.newPassword
      });
      toast(`Đã đặt lại mật khẩu mới cho ${resetPasswordModal.userEmail}!`, 'success');
      setResetPasswordModal({ open: false, userId: '', userEmail: '', newPassword: '' });
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  };

  const handleRetryOdooJob = async (jobId: string) => {
    try {
      await api.post(`/admin/odoo/retry-job/${jobId}`);
      toast('Đã đặt lại job đồng bộ thành PENDING để tiến trình chạy lại!', 'success');
      await loadOdooQueue();
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  };

  const handleSyncAllOdoo = async () => {
    setSyncingAllOdoo(true);
    try {
      const res = await api.post('/admin/odoo/sync-all');
      toast(`Đồng bộ Odoo hoàn tất: ${res.data?.result?.attempted || 0} bản ghi đã xử lý.`, 'success');
      await loadOdooQueue();
      await loadSystemStatus();
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setSyncingAllOdoo(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailTo.trim()) {
      toast('Vui lòng nhập địa chỉ email nhận test.', 'error');
      return;
    }
    setTestEmailSending(true);
    try {
      const res = await api.post('/admin/smtp/test', { to: testEmailTo.trim() });
      toast(res.data.message || 'Đã gửi email kiểm tra thành công!', 'success');
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setTestEmailSending(false);
    }
  };

  // ==========================================
  // BADGES & HELPERS
  // ==========================================
  const statusBadge = (st: string) => {
    switch (st) {
      case 'NEW':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200"><span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />Mới tiếp nhận</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200"><Clock size={11} />Đang xử lý</span>;
      case 'RESPONDED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200"><CheckCircle2 size={11} />Đã phản hồi</span>;
      case 'CLOSED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">Đã đóng / Xưởng</span>;
      case 'ACTIVE':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200"><CheckCircle2 size={11} />Đang áp dụng</span>;
      case 'REVIEW_REQUIRED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200"><Clock size={11} />Cần rà soát</span>;
      case 'INACTIVE':
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">Ngừng áp dụng</span>;
      case 'SYNCED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200"><CheckCircle2 size={11} />Đã đồng bộ</span>;
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200"><Clock size={11} />Chờ đồng bộ</span>;
      case 'FAILED':
      case 'PENDING_RETRY':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200"><AlertCircle size={11} />Lỗi đồng bộ</span>;
      default:
        return <span className="text-xs text-slate-500">{st}</span>;
    }
  };

  const typeBadge = (tp: string) => {
    switch (tp) {
      case 'DEMO':
        return <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">Đăng ký Demo</span>;
      case 'IMPLEMENTATION':
        return <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">Tư vấn Triển khai</span>;
      case 'CONTACT':
      default:
        return <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200">Tìm hiểu Sản phẩm</span>;
    }
  };

  // Selected Tax Rule for Calculator
  const currentCalcRule = taxRules.find(r => r.code === calcSelectedRule) || taxRules[0];
  const calculatedTax = currentCalcRule ? Math.round((calcAmount * (currentCalcRule.vatRate || 0)) / 100) : 0;
  const calculatedPit = currentCalcRule && currentCalcRule.taxMode === 'HKD_REVENUE' ? Math.round((calcAmount * (currentCalcRule.pitRate || 0)) / 100) : 0;
  const calculatedTotal = calcAmount + calculatedTax;

  // ==========================================
  // SMART FILTERED & GROUPED DATA
  // ==========================================
  // 1. Inquiries Grouping
  const filteredInquiries = useMemo(() => {
    return inquiries.filter(inq => {
      if (filterType !== 'ALL' && inq.inquiryType !== filterType) return false;
      if (filterStatus !== 'ALL' && inq.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = inq.name.toLowerCase().includes(q) ||
          inq.email.toLowerCase().includes(q) ||
          (inq.phone && inq.phone.includes(q)) ||
          (inq.company && inq.company.toLowerCase().includes(q)) ||
          inq.reference.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [inquiries, filterType, filterStatus, searchQuery]);

  const groupedInquiries = useMemo(() => {
    if (inquiryGroupBy === 'NONE') return { 'Tất cả yêu cầu': filteredInquiries };
    const groups: Record<string, Inquiry[]> = {};
    for (const item of filteredInquiries) {
      let key = 'Khác';
      if (inquiryGroupBy === 'STATUS') {
        key = item.status === 'NEW' ? 'Mới tiếp nhận' : item.status === 'IN_PROGRESS' ? 'Đang xử lý' : item.status === 'RESPONDED' ? 'Đã phản hồi' : 'Đã đóng / Xưởng';
      } else if (inquiryGroupBy === 'TYPE') {
        key = item.inquiryType === 'DEMO' ? 'Đăng ký Demo' : item.inquiryType === 'IMPLEMENTATION' ? 'Khảo sát Triển khai' : 'Tìm hiểu Sản phẩm';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredInquiries, inquiryGroupBy]);

  // 2. Tax Rules Grouping
  const filteredTaxRules = useMemo(() => {
    return taxRules.filter(r => {
      if (taxModeFilter !== 'ALL' && r.taxMode !== taxModeFilter) return false;
      if (taxStatusFilter !== 'ALL' && r.status !== taxStatusFilter) return false;
      if (taxSearch.trim()) {
        const q = taxSearch.toLowerCase();
        const match = r.code.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          (r.legalReference && r.legalReference.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [taxRules, taxModeFilter, taxStatusFilter, taxSearch]);

  const groupedTaxRules = useMemo(() => {
    if (taxGroupBy === 'NONE') return { 'Tất cả mức thuế': filteredTaxRules };
    const groups: Record<string, TaxRule[]> = {};
    for (const item of filteredTaxRules) {
      let key = 'Khác';
      if (taxGroupBy === 'MODE') {
        key = item.taxMode === 'VAT_CREDIT' ? 'Phương pháp Khấu trừ GTGT (Doanh nghiệp)' : item.taxMode === 'HKD_REVENUE' ? 'Phương pháp Doanh thu Trực tiếp (Hộ kinh doanh)' : 'Miễn thuế / Không chịu thuế';
      } else if (taxGroupBy === 'STATUS') {
        key = item.status === 'ACTIVE' ? 'Đang áp dụng chính thức' : item.status === 'REVIEW_REQUIRED' ? 'Cần rà soát chính sách' : 'Ngừng áp dụng';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredTaxRules, taxGroupBy]);

  // 3. Workshops Grouping
  const filteredWorkshops = useMemo(() => {
    return workshops.filter(w => {
      if (workshopStatusFilter === 'ACTIVE' && !w.active) return false;
      if (workshopStatusFilter === 'INACTIVE' && w.active) return false;
      if (workshopSearch.trim()) {
        const q = workshopSearch.toLowerCase();
        const match = w.name.toLowerCase().includes(q) ||
          (w.code && w.code.toLowerCase().includes(q)) ||
          (w.tax_id && w.tax_id.includes(q)) ||
          w.id.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [workshops, workshopStatusFilter, workshopSearch]);

  const groupedWorkshops = useMemo(() => {
    if (workshopGroupBy === 'NONE') return { 'Tất cả xưởng & doanh nghiệp': filteredWorkshops };
    const groups: Record<string, WorkshopItem[]> = {};
    for (const item of filteredWorkshops) {
      const key = item.active ? 'Đang hoạt động (Active)' : 'Tạm ngừng (Suspended)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredWorkshops, workshopGroupBy]);

  // 4. Users Grouping
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
      if (userWorkshopFilter !== 'ALL' && u.workshop_id !== userWorkshopFilter) return false;
      if (userStatusFilter === 'ACTIVE' && !u.active) return false;
      if (userStatusFilter === 'LOCKED' && u.active) return false;
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const match = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [users, userRoleFilter, userWorkshopFilter, userStatusFilter, userSearch]);

  const groupedUsers = useMemo(() => {
    if (userGroupBy === 'NONE') return { 'Tất cả tài khoản': filteredUsers };
    const groups: Record<string, UserItem[]> = {};
    for (const item of filteredUsers) {
      let key = 'Khác';
      if (userGroupBy === 'ROLE') {
        key = item.role === 'ADMIN' ? 'Quản trị viên Website (Admin)' : item.role === 'OWNER' ? 'Chủ xưởng / Quản lý' : item.role === 'ACCOUNTANT' ? 'Kế toán viên' : item.role === 'WAREHOUSE' ? 'Thủ kho' : 'Thợ xưởng';
      } else if (userGroupBy === 'WORKSHOP') {
        key = item.workshop_name || 'Hệ thống nền tảng';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredUsers, userGroupBy]);

  // 5. Odoo Jobs Grouping
  const filteredOdooJobs = useMemo(() => {
    return odooJobs.filter(j => {
      if (odooStatusFilter !== 'ALL' && j.status !== odooStatusFilter) return false;
      if (odooEntityFilter !== 'ALL' && j.entity !== odooEntityFilter) return false;
      if (odooSearch.trim()) {
        const q = odooSearch.toLowerCase();
        const match = j.record_id.toLowerCase().includes(q) ||
          (j.last_error && j.last_error.toLowerCase().includes(q)) ||
          (j.workshop_name && j.workshop_name.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [odooJobs, odooStatusFilter, odooEntityFilter, odooSearch]);

  const groupedOdooJobs = useMemo(() => {
    if (odooGroupBy === 'NONE') return { 'Tất cả chứng từ đồng bộ': filteredOdooJobs };
    const groups: Record<string, OdooJob[]> = {};
    for (const item of filteredOdooJobs) {
      let key = 'Khác';
      if (odooGroupBy === 'ENTITY') {
        key = item.entity === 'invoices' ? 'Hóa đơn Mua / Bán (invoices)' : item.entity === 'quotations' ? 'Báo giá xưởng (quotations)' : item.entity === 'partners' ? 'Khách hàng & Nhà cung cấp (partners)' : item.entity === 'products' ? 'Vật tư & Sản phẩm (products)' : item.entity === 'users' ? 'Tài khoản nhân sự (users)' : item.entity;
      } else if (odooGroupBy === 'STATUS') {
        key = item.status === 'SYNCED' ? 'Đã đồng bộ thành công' : item.status === 'PENDING' ? 'Đang trong hàng đợi chờ đồng bộ' : 'Thất bại (Cần xử lý lại)';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredOdooJobs, odooGroupBy]);

  // 6. Audit Logs Grouping
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (auditEntityFilter !== 'ALL' && log.entity !== auditEntityFilter) return false;
      if (auditActionFilter !== 'ALL' && log.action !== auditActionFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const match = (log.actor?.name && log.actor.name.toLowerCase().includes(q)) ||
          (log.actor?.email && log.actor.email.toLowerCase().includes(q)) ||
          log.action.toLowerCase().includes(q) ||
          log.entity.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [auditLogs, auditEntityFilter, auditActionFilter, auditSearch]);

  const groupedAuditLogs = useMemo(() => {
    if (auditGroupBy === 'NONE') return { 'Tất cả nhật ký': filteredAuditLogs };
    const groups: Record<string, AuditItem[]> = {};
    for (const item of filteredAuditLogs) {
      let key = 'Khác';
      if (auditGroupBy === 'ENTITY') {
        key = `Phân hệ: ${item.entity}`;
      } else if (auditGroupBy === 'ACTION') {
        key = `Hành động: ${item.action}`;
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filteredAuditLogs, auditGroupBy]);

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900">
      {/* 1. TOP HEADER - ADMIN BRANDING & QUICK SWITCHER */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="flex items-center gap-2 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-sm ring-1 ring-black/10">
                <ShieldCheck size={18} className="text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-tight text-slate-900">FinWorkshop</span>
                  <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 border border-amber-300">
                    Chủ Web · Admin
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Quản trị Website, Thuế, Odoo & Hạ tầng Nền tảng</p>
              </div>
            </Link>
          </div>

          {/* Quick Actions & Switch to Workshop ERP */}
          <div className="flex items-center gap-2">
            <Link
              to="/app?view=workshop"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-700 transition shadow-2xs"
              title="Chuyển đến Bàn làm việc của Chủ xưởng (Nghiệp vụ sản xuất & Kế toán)"
            >
              <Factory size={14} className="text-brand-600" />
              <span className="hidden md:inline">Đến</span> <span>Bàn làm việc Xưởng</span>
            </Link>

            <a
              href="/api-docs/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-700 transition shadow-2xs"
            >
              <FileText size={14} className="text-blue-600" />
              <span className="hidden sm:inline">Swagger API</span>
              <ExternalLink size={12} className="text-slate-400" />
            </a>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <Globe size={14} className="text-emerald-600" />
              <span>Xem Website</span>
            </a>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {/* User & Logout */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-right">
                <span className="block text-xs font-semibold text-slate-800 leading-tight">{user?.name || user?.email}</span>
                <span className="block text-[10px] text-slate-400">Quản trị viên Website</span>
              </span>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                title="Đăng xuất"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 2. ADMIN NAVIGATION TABS (8 PHÂN HỆ QUẢN TRỊ TOÀN DIỆN) */}
      <div className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'inquiries'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Mail size={15} />
            <span>Yêu cầu Tư vấn & Demo (/lien-he)</span>
            {stats.newCount > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs animate-pulse">
                {stats.newCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('taxes')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'taxes'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Landmark size={15} />
            <span>Biểu Thuế & Chính sách Thuế</span>
            <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[10px] font-bold">
              {taxRules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'tools'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Calculator size={15} />
            <span>Công cụ Tính Thuế & Tra Cứu MST</span>
          </button>

          <button
            onClick={() => setActiveTab('workshops')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'workshops'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Factory size={15} />
            <span>Quản lý Doanh nghiệp & Xưởng</span>
            <span className="rounded-full bg-blue-100 text-blue-800 px-1.5 py-0.2 text-[10px] font-bold">
              {workshops.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Users size={15} />
            <span>Quản lý Người dùng Toàn hệ thống</span>
            <span className="rounded-full bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('odoo')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'odoo'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Building2 size={15} />
            <span>Giám sát ERP Odoo & Hàng đợi</span>
            {odooStats.pending > 0 && (
              <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-bold">
                {odooStats.pending}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'system'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Server size={15} />
            <span>Hạ tầng & Email SMTP</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <History size={15} />
            <span>Nhật ký Kiểm toán</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN TAB CONTENT */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* ==================================================== */}
        {/* TAB 1: WEBSITE INQUIRIES & DEMO REQUESTS */}
        {/* ==================================================== */}
        {activeTab === 'inquiries' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Quản lý Yêu cầu Tư vấn & Demo từ Website
                </h1>
                <p className="text-xs text-slate-500">
                  Tiếp nhận các form gửi từ <a href="/lien-he" target="_blank" className="font-semibold text-brand-600 underline">https://fintaxauto.space/lien-he</a> và trang Demo.
                </p>
              </div>

              <button
                onClick={loadInquiries}
                disabled={loading}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin text-brand-600' : 'text-slate-500'} />
                <span>Làm mới danh sách</span>
              </button>
            </div>

            {/* 4 Metric Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                onClick={() => setFilterStatus('NEW')}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  filterStatus === 'NEW' ? 'border-rose-300 bg-rose-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Mới tiếp nhận</span>
                  <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                </div>
                <div className="mt-2 text-2xl font-black text-rose-600">{stats.newCount}</div>
                <p className="mt-1 text-[11px] text-slate-400">Khách hàng đang chờ phản hồi</p>
              </div>

              <div
                onClick={() => setFilterStatus('IN_PROGRESS')}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  filterStatus === 'IN_PROGRESS' ? 'border-amber-300 bg-amber-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Đang xử lý</span>
                  <Clock size={14} className="text-amber-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-amber-600">{stats.inProgressCount}</div>
                <p className="mt-1 text-[11px] text-slate-400">Đang trao đổi hoặc hẹn lịch</p>
              </div>

              <div
                onClick={() => setFilterStatus('RESPONDED')}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  filterStatus === 'RESPONDED' ? 'border-emerald-300 bg-emerald-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Đã phản hồi</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-600">{stats.respondedCount}</div>
                <p className="mt-1 text-[11px] text-slate-400">Đã gửi giải pháp & báo giá</p>
              </div>

              <div
                onClick={() => setFilterStatus('ALL')}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  filterStatus === 'ALL' ? 'border-brand-300 bg-brand-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Tổng cộng</span>
                  <Layers size={14} className="text-slate-400" />
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900">{stats.total}</div>
                <p className="mt-1 text-[11px] text-slate-400">Tất cả yêu cầu gửi về</p>
              </div>
            </div>

            {/* Filter and Search Bar with Smart Grouping */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 pl-1">Lọc:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả loại yêu cầu</option>
                  <option value="CONTACT">Tìm hiểu sản phẩm</option>
                  <option value="DEMO">Đăng ký Demo</option>
                  <option value="IMPLEMENTATION">Khảo sát Triển khai</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="NEW">Mới tiếp nhận</option>
                  <option value="IN_PROGRESS">Đang xử lý</option>
                  <option value="RESPONDED">Đã phản hồi</option>
                  <option value="CLOSED">Đã đóng / Xưởng</option>
                </select>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <ListFilter size={13} className="text-slate-400" />
                  <span>Gom nhóm:</span>
                  <select
                    value={inquiryGroupBy}
                    onChange={(e) => setInquiryGroupBy(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="NONE">Không gom nhóm</option>
                    <option value="STATUS">Gom theo trạng thái</option>
                    <option value="TYPE">Gom theo loại yêu cầu</option>
                  </select>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, email, sđt, công ty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Inquiries Grouped View */}
            <div className="space-y-6">
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-2xs">
                  Đang tải dữ liệu yêu cầu...
                </div>
              ) : Object.keys(groupedInquiries).length === 0 || filteredInquiries.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
                  <Mail size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Chưa có yêu cầu nào phù hợp</p>
                  <p className="text-xs text-slate-400 mt-1">Khi khách hàng gửi form tại trang /lien-he, dữ liệu sẽ tự động xuất hiện tại đây.</p>
                </div>
              ) : (
                Object.entries(groupedInquiries).map(([groupTitle, items]) => (
                  <div key={groupTitle} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                    {inquiryGroupBy !== 'NONE' && (
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{groupTitle}</span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {items.length} yêu cầu
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Mã yêu cầu</th>
                            <th className="px-4 py-3">Khách hàng & Công ty</th>
                            <th className="px-4 py-3">Nhu cầu</th>
                            <th className="px-4 py-3">Nội dung lời nhắn</th>
                            <th className="px-4 py-3">Thời gian</th>
                            <th className="px-4 py-3">Trạng thái</th>
                            <th className="px-4 py-3 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((inq) => (
                            <tr key={inq.id} className="hover:bg-slate-50/70 transition">
                              <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-slate-700">
                                {inq.reference}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-900">{inq.name}</div>
                                <div className="text-[11px] text-slate-500">{inq.email}</div>
                                {inq.phone && <div className="text-[11px] text-slate-500">{inq.phone}</div>}
                                {inq.company && <div className="text-[11px] font-medium text-brand-700">🏢 {inq.company}</div>}
                              </td>
                              <td className="px-4 py-3.5">
                                {typeBadge(inq.inquiryType)}
                              </td>
                              <td className="px-4 py-3.5 max-w-xs">
                                <p className="line-clamp-2 text-slate-600 text-xs">
                                  {inq.message}
                                </p>
                                {inq.replyMessage && (
                                  <p className="mt-1 line-clamp-1 text-[10px] text-emerald-700 font-medium">
                                    💬 Đã trả lời: {inq.replyMessage}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                                {new Date(inq.createdAt).toLocaleString('vi-VN', {
                                  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                                })}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                {statusBadge(inq.status)}
                              </td>
                              <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  onClick={() => openReplyModal(inq)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 border border-brand-200 transition shadow-2xs"
                                >
                                  <MessageSquare size={13} />
                                  <span>{inq.status === 'RESPONDED' ? 'Xem & Gửi tiếp' : 'Xem & Trả lời'}</span>
                                </button>
                                {inq.status !== 'CLOSED' && (
                                  <button
                                    onClick={() => setConvertModal({ open: true, inq, tempPassword: 'FinTax@2026', busy: false })}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition shadow-2xs"
                                    title="Tự động khởi tạo Xưởng mới và tài khoản Chủ xưởng cho khách hàng này"
                                  >
                                    <Factory size={13} />
                                    <span>Cấp Xưởng</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: TAX RULES & POLICY MANAGEMENT (CHÍNH SÁCH THUẾ) */}
        {/* ==================================================== */}
        {activeTab === 'taxes' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Quản lý Thuế & Cập nhật Chính sách Thuế Quốc Gia
                </h1>
                <p className="text-xs text-slate-500">
                  Thiết lập và cập nhật các biểu thuế GTGT (VAT), thuế suất Hộ kinh doanh & Doanh nghiệp áp dụng trên toàn bộ nền tảng FinWorkshop.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadTaxRules}
                  disabled={taxLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <RefreshCw size={13} className={taxLoading ? 'animate-spin text-brand-600' : 'text-slate-500'} />
                  <span>Làm mới</span>
                </button>
                <button
                  onClick={() => setTaxModal({ open: true, isEdit: false, rule: { taxMode: 'VAT_CREDIT', vatRate: 10, pitRate: 0, status: 'ACTIVE', effectiveFrom: new Date().toISOString().slice(0, 10) } })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-2xs"
                >
                  <Plus size={14} />
                  <span>Thêm mức thuế mới</span>
                </button>
              </div>
            </div>

            {/* Quick summary cards for Tax policy */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Biểu thuế GTGT (VAT) Khấu trừ</span>
                  <Percent size={14} className="text-brand-600" />
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900">
                  {taxRules.filter(r => r.taxMode === 'VAT_CREDIT').length} mức
                </div>
                <p className="mt-1 text-[11px] text-slate-400">VAT 0%, 5%, 8% (giảm 2%), 10% chuẩn</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Biểu thuế Trực tiếp Doanh thu (HKD)</span>
                  <Landmark size={14} className="text-purple-600" />
                </div>
                <div className="mt-2 text-2xl font-black text-purple-700">
                  {taxRules.filter(r => r.taxMode === 'HKD_REVENUE').length} mức
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Sản xuất cơ khí (4.5%), Dịch vụ (7%), Phân phối (1.5%)</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>Quy tắc đang áp dụng</span>
                  <CheckCircle2 size={14} className="text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-600">
                  {taxRules.filter(r => r.status === 'ACTIVE').length} / {taxRules.length}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Đã đồng bộ sang tính thuế hóa đơn & Odoo</p>
              </div>
            </div>

            {/* Smart Filters & Grouping Bar for Taxes */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 pl-1">Lọc:</span>
                <select
                  value={taxModeFilter}
                  onChange={(e) => setTaxModeFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả chế độ tính</option>
                  <option value="VAT_CREDIT">Khấu trừ GTGT (Doanh nghiệp)</option>
                  <option value="HKD_REVENUE">Doanh thu Trực tiếp (Hộ kinh doanh)</option>
                  <option value="EXEMPT">Miễn thuế / Không chịu thuế</option>
                </select>

                <select
                  value={taxStatusFilter}
                  onChange={(e) => setTaxStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang áp dụng</option>
                  <option value="REVIEW_REQUIRED">Cần rà soát</option>
                  <option value="INACTIVE">Ngừng áp dụng</option>
                </select>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <ListFilter size={13} className="text-slate-400" />
                  <span>Gom nhóm:</span>
                  <select
                    value={taxGroupBy}
                    onChange={(e) => setTaxGroupBy(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="MODE">Gom theo chế độ thuế</option>
                    <option value="STATUS">Gom theo trạng thái</option>
                    <option value="NONE">Không gom nhóm</option>
                  </select>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo mã, tên, căn cứ pháp lý..."
                  value={taxSearch}
                  onChange={(e) => setTaxSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Tax Rules Grouped Table */}
            <div className="space-y-6">
              {taxLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-2xs">
                  Đang tải danh sách mức thuế...
                </div>
              ) : Object.keys(groupedTaxRules).length === 0 || filteredTaxRules.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
                  <Landmark size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Chưa có mức thuế nào phù hợp</p>
                </div>
              ) : (
                Object.entries(groupedTaxRules).map(([groupTitle, items]) => (
                  <div key={groupTitle} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                    {taxGroupBy !== 'NONE' && (
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{groupTitle}</span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {items.length} mức thuế
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Mã quy tắc</th>
                            <th className="px-4 py-3">Tên mức thuế</th>
                            <th className="px-4 py-3">Chế độ tính</th>
                            <th className="px-4 py-3">Thuế suất</th>
                            <th className="px-4 py-3">Căn cứ pháp lý & Nghị định</th>
                            <th className="px-4 py-3">Hiệu lực</th>
                            <th className="px-4 py-3">Trạng thái</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((rule) => (
                            <tr key={rule.id} className="hover:bg-slate-50/70 transition">
                              <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-slate-800">
                                {rule.code}
                              </td>
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-900">{rule.name}</div>
                                {rule.notes && <div className="text-[11px] text-slate-500 line-clamp-1">{rule.notes}</div>}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
                                  rule.taxMode === 'VAT_CREDIT'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : rule.taxMode === 'HKD_REVENUE'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {rule.taxMode === 'VAT_CREDIT' ? 'Khấu trừ VAT' : rule.taxMode === 'HKD_REVENUE' ? 'Doanh thu HKD' : 'Miễn thuế'}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 font-bold text-brand-700 whitespace-nowrap">
                                {rule.taxRate}%
                                {rule.taxMode === 'HKD_REVENUE' && (
                                  <span className="block text-[10px] font-normal text-slate-400">
                                    (VAT: {rule.vatRate}% + TNCN: {rule.pitRate}%)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-slate-600 max-w-xs text-[11px]">
                                {rule.legalReference || 'Chưa cập nhật'}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap text-[11px] text-slate-500">
                                <div>Từ: {rule.effectiveFrom || 'Bắt đầu'}</div>
                                {rule.effectiveTo && <div>Đến: {rule.effectiveTo}</div>}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                {statusBadge(rule.status)}
                              </td>
                              <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                                <button
                                  onClick={() => setTaxModal({ open: true, isEdit: true, rule })}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleToggleTaxStatus(rule)}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border shadow-2xs ${
                                    rule.status === 'ACTIVE'
                                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                >
                                  {rule.status === 'ACTIVE' ? 'Tạm ngừng' : 'Kích hoạt'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: TAX CALCULATOR & MST TOOLS */}
        {/* ==================================================== */}
        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                Công cụ Tính Thử Thuế & Tra Cứu Cổng Thuế Trực Tiếp
              </h1>
              <p className="text-xs text-slate-500">
                Kiểm tra tính toán thuế VAT / TNCN thực tế theo các biểu thuế mới nhất và tra cứu thông tin doanh nghiệp qua Cổng Tổng Cục Thuế.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tool 1: Live Tax Simulator */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                    <Calculator size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Mô phỏng Tính Thuế Hóa đơn Trực tiếp</h2>
                    <p className="text-[11px] text-slate-400">Kiểm thử công thức tính thuế cho từng ngành hàng và quy mô</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số tiền hàng trước thuế (VND)</label>
                    <input
                      type="number"
                      step="100000"
                      value={calcAmount}
                      onChange={(e) => setCalcAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-sm font-bold text-slate-900 outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Chọn quy tắc thuế áp dụng</label>
                    <select
                      value={calcSelectedRule}
                      onChange={(e) => setCalcSelectedRule(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                    >
                      {taxRules.map(r => (
                        <option key={r.code} value={r.code}>
                          {r.name} ({r.taxRate}%) — {r.taxMode === 'VAT_CREDIT' ? 'Khấu trừ VAT' : 'Trực tiếp HKD'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentCalcRule && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 mt-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Tiền hàng gốc:</span>
                        <strong className="font-mono text-slate-900">{calcAmount.toLocaleString('vi-VN')} đ</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Thuế GTGT ({currentCalcRule.vatRate}%):</span>
                        <strong className="font-mono text-brand-700">+{calculatedTax.toLocaleString('vi-VN')} đ</strong>
                      </div>
                      {currentCalcRule.taxMode === 'HKD_REVENUE' && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">Thuế TNCN ({currentCalcRule.pitRate}%):</span>
                          <strong className="font-mono text-purple-700">{calculatedPit.toLocaleString('vi-VN')} đ</strong>
                        </div>
                      )}
                      <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
                        <span>Tổng tiền thanh toán:</span>
                        <span className="text-emerald-700 font-mono">{calculatedTotal.toLocaleString('vi-VN')} đ</span>
                      </div>
                      <p className="text-[10px] text-slate-400 pt-1">
                        Căn cứ: {currentCalcRule.legalReference || 'Chính sách hiện hành'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool 2: MST Checker & Mock Tax Test */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <Search size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Tra Cứu Mã Số Thuế & Thử Nghiệm CQT</h2>
                    <p className="text-[11px] text-slate-400">Kết nối trực tiếp Mock Tax API qua Nginx Proxy (/tax-portal/)</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tra cứu thông tin theo Mã Số Thuế (MST)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nhập MST (ví dụ: 0316890123)..."
                        value={searchMst}
                        onChange={(e) => setSearchMst(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs outline-none focus:border-brand-500"
                      />
                      <button
                        onClick={handleCheckMst}
                        disabled={mstLoading}
                        className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 shadow-2xs"
                      >
                        {mstLoading ? 'Đang tra...' : 'Tra cứu MST'}
                      </button>
                    </div>
                  </div>

                  {mstResult && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs space-y-1">
                      <div className="font-bold text-emerald-900">{mstResult.name || 'DOANH NGHIỆP HỢP LỆ'}</div>
                      <div className="text-slate-600">MST: <strong className="font-mono">{mstResult.taxCode || searchMst}</strong></div>
                      <div className="text-slate-600">Trạng thái thuế: <span className="text-emerald-700 font-bold">{mstResult.status || 'Đang hoạt động (Đã cấp mã)'}</span></div>
                      {mstResult.address && <div className="text-slate-500 text-[11px]">{mstResult.address}</div>}
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3">
                    <label className="block font-bold text-slate-700 mb-1">Thử nghiệm Cấp Mã Hóa Đơn Cơ Quan Thuế (CQT)</label>
                    <p className="text-[11px] text-slate-500 mb-2">Gửi thử gói tin hóa đơn điện tử giả lập để kiểm tra độ trễ và sinh mã CQT.</p>
                    <button
                      onClick={handleTestIssueCode}
                      disabled={testCodeLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3.5 py-2 font-semibold text-brand-700 hover:bg-brand-100 transition shadow-2xs"
                    >
                      <Sparkles size={14} />
                      <span>{testCodeLoading ? 'Đang cấp mã...' : 'Thử cấp mã CQT ngay'}</span>
                    </button>

                    {testCodeResult && (
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1 font-mono">
                        <div className="text-slate-400">Kết quả phản hồi CQT:</div>
                        <div className="font-bold text-emerald-700">Mã CQT: {testCodeResult.mockTaxCode || testCodeResult.taxAuthorityCode}</div>
                        <div className="text-slate-600 text-[11px]">Thời gian: {testCodeResult.issuedAt || new Date().toISOString()}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: WORKSHOPS MANAGEMENT */}
        {/* ==================================================== */}
        {activeTab === 'workshops' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Quản lý Doanh nghiệp & Xưởng Sản Xuất
                </h1>
                <p className="text-xs text-slate-500">
                  Danh sách các doanh nghiệp khách hàng và xưởng đăng ký trên nền tảng FinWorkshop.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadWorkshops}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <RefreshCw size={13} className="text-slate-500" />
                  <span>Làm mới</span>
                </button>
                <button
                  onClick={() => setCreateWorkshopModal({ open: true, name: '', code: '', tax_id: '', busy: false })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-2xs"
                >
                  <Plus size={14} />
                  <span>Thêm Xưởng Mới</span>
                </button>
              </div>
            </div>

            {/* Smart Filters & Grouping Bar for Workshops */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 pl-1">Lọc:</span>
                <select
                  value={workshopStatusFilter}
                  onChange={(e) => setWorkshopStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Tạm ngừng</option>
                </select>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <ListFilter size={13} className="text-slate-400" />
                  <span>Gom nhóm:</span>
                  <select
                    value={workshopGroupBy}
                    onChange={(e) => setWorkshopGroupBy(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="NONE">Không gom nhóm</option>
                    <option value="STATUS">Gom theo trạng thái</option>
                  </select>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên xưởng, mã, MST..."
                  value={workshopSearch}
                  onChange={(e) => setWorkshopSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Workshops Grouped View */}
            <div className="space-y-6">
              {Object.entries(groupedWorkshops).map(([groupTitle, items]) => (
                <div key={groupTitle} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                  {workshopGroupBy !== 'NONE' && (
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{groupTitle}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {items.length} xưởng
                        </span>
                      </div>
                    </div>
                  )}
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Tên Xưởng / Doanh nghiệp</th>
                        <th className="px-4 py-3">Mã xưởng</th>
                        <th className="px-4 py-3">Mã số thuế</th>
                        <th className="px-4 py-3">Nhân sự</th>
                        <th className="px-4 py-3">Ngày tạo</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-900">{w.name}</div>
                            <div className="font-mono text-[10px] text-slate-400">ID: {w.id}</div>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-semibold text-slate-700">
                            {w.code || 'CHƯA ĐẶT'}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-600">
                            {w.tax_id || 'Chưa cập nhật'}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                              {w.member_count} nhân viên
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                            {new Date(w.created_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-4 py-3.5">
                            {w.active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                Hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                                Tạm ngừng
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                            <Link
                              to={`/app?view=workshop`}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                              title="Truy cập Bàn làm việc Xưởng này"
                            >
                              Vào Bàn làm việc
                            </Link>
                            <button
                              onClick={() => handleToggleWorkshopStatus(w.id, w.active)}
                              className={`rounded-lg px-2.5 py-1 text-xs font-semibold border shadow-2xs ${
                                w.active
                                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {w.active ? 'Tạm ngừng' : 'Kích hoạt'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 5: USERS MANAGEMENT */}
        {/* ==================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Quản lý Toàn bộ Người dùng Hệ thống
                </h1>
                <p className="text-xs text-slate-500">
                  Danh sách tài khoản Chủ web, Chủ xưởng, Kế toán, Thủ kho và Thợ xưởng trên toàn hệ thống.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadUsers}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <RefreshCw size={13} className="text-slate-500" />
                  <span>Làm mới</span>
                </button>
                <button
                  onClick={() => setCreateUserModal({ open: true, email: '', password: 'FinTax@2026', full_name: '', role: 'OWNER', workshop_id: workshops[0]?.id || '', busy: false })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-2xs"
                >
                  <UserPlus size={14} />
                  <span>Tạo Tài Khoản Mới</span>
                </button>
              </div>
            </div>

            {/* Smart Filters & Grouping Bar for Users */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 pl-1">Lọc:</span>
                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả vai trò</option>
                  <option value="ADMIN">Quản trị viên Website (Admin)</option>
                  <option value="OWNER">Chủ xưởng / Quản lý</option>
                  <option value="ACCOUNTANT">Kế toán viên</option>
                  <option value="WAREHOUSE">Thủ kho</option>
                  <option value="WORKSHOP">Thợ xưởng</option>
                </select>

                <select
                  value={userWorkshopFilter}
                  onChange={(e) => setUserWorkshopFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả xưởng</option>
                  {workshops.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>

                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="LOCKED">Đã khóa</option>
                </select>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <ListFilter size={13} className="text-slate-400" />
                  <span>Gom nhóm:</span>
                  <select
                    value={userGroupBy}
                    onChange={(e) => setUserGroupBy(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="NONE">Không gom nhóm</option>
                    <option value="ROLE">Gom theo vai trò</option>
                    <option value="WORKSHOP">Gom theo xưởng</option>
                  </select>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo họ tên, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Users Grouped View */}
            <div className="space-y-6">
              {Object.entries(groupedUsers).map(([groupTitle, items]) => (
                <div key={groupTitle} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                  {userGroupBy !== 'NONE' && (
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{groupTitle}</span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {items.length} tài khoản
                        </span>
                      </div>
                    </div>
                  )}
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Họ và tên</th>
                        <th className="px-4 py-3">Email đăng nhập</th>
                        <th className="px-4 py-3">Vai trò</th>
                        <th className="px-4 py-3">Xưởng trực thuộc</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {u.name}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                            {u.email}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold border ${
                              u.role === 'ADMIN'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : u.role === 'OWNER'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {u.roleLabel || u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {u.workshop_name || 'Hệ thống chung'}
                          </td>
                          <td className="px-4 py-3.5">
                            {u.active ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                Hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                                Đã khóa
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                            <button
                              onClick={() => setResetPasswordModal({ open: true, userId: u.id, userEmail: u.email, newPassword: '' })}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                            >
                              Đổi MK
                            </button>
                            <button
                              onClick={() => handleToggleUser(u.id, u.active)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-semibold border shadow-2xs ${
                                u.active
                                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {u.active ? 'Khóa' : 'Mở khóa'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 6: ODOO 16 ERP QUEUE & SYNC MONITOR */}
        {/* ==================================================== */}
        {activeTab === 'odoo' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Giám Sát ERP Odoo 16 & Hàng Đợi Đồng Bộ (Sync Queue)
                </h1>
                <p className="text-xs text-slate-500">
                  Theo dõi hàng đợi đồng bộ hai chiều hóa đơn, báo giá, khách hàng và sổ kế toán sang hệ thống ERP Odoo 16.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadOdooQueue}
                  disabled={odooLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <RefreshCw size={13} className={odooLoading ? 'animate-spin text-brand-600' : 'text-slate-500'} />
                  <span>Làm mới hàng đợi</span>
                </button>
                <button
                  onClick={handleSyncAllOdoo}
                  disabled={syncingAllOdoo}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition shadow-2xs disabled:opacity-50"
                >
                  <Play size={13} className={syncingAllOdoo ? 'animate-spin' : ''} />
                  <span>{syncingAllOdoo ? 'Đang đồng bộ...' : 'Đồng bộ toàn bộ ngay'}</span>
                </button>
                <a
                  href="/odoo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 shadow-2xs"
                >
                  <Building2 size={13} />
                  <span>Mở Odoo ERP UI</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Odoo Connection Header Banner */}
            <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/50 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
                  <Building2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Máy chủ Odoo 16 Community</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      ĐÃ KẾT NỐI (XML-RPC)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                    <span>Database: <strong className="font-mono text-purple-900">fintax_clean</strong></span>
                    <span>Tài khoản Admin: <strong className="font-mono text-slate-700">admin</strong></span>
                    <span>URL Nginx Proxy: <strong className="font-mono text-slate-700">/odoo/</strong> (Port 8069)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Metric Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div
                onClick={() => setOdooStatusFilter('ALL')}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  odooStatusFilter === 'ALL' ? 'border-brand-300 bg-brand-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <span className="text-xs font-semibold text-slate-500">Tổng số Jobs</span>
                <div className="mt-2 text-2xl font-black text-slate-900">{odooStats.total}</div>
                <p className="mt-1 text-[11px] text-slate-400">Toàn bộ chứng từ đã ghi nhận</p>
              </div>

              <div
                onClick={() => setOdooStatusFilter('SYNCED')}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  odooStatusFilter === 'SYNCED' ? 'border-emerald-300 bg-emerald-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Đã đồng bộ (SYNCED)</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-emerald-600">{odooStats.synced}</div>
                <p className="mt-1 text-[11px] text-slate-400">Đã phản chiếu sang Odoo</p>
              </div>

              <div
                onClick={() => setOdooStatusFilter('PENDING')}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  odooStatusFilter === 'PENDING' ? 'border-amber-300 bg-amber-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Chờ xử lý (PENDING)</span>
                  <Clock size={14} className="text-amber-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-amber-600">{odooStats.pending}</div>
                <p className="mt-1 text-[11px] text-slate-400">Đang trong hàng đợi</p>
              </div>

              <div
                onClick={() => setOdooStatusFilter('FAILED')}
                className={`cursor-pointer rounded-2xl border p-4 transition ${
                  odooStatusFilter === 'FAILED' ? 'border-rose-300 bg-rose-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Lỗi / Cần thử lại</span>
                  <AlertCircle size={14} className="text-rose-500" />
                </div>
                <div className="mt-2 text-2xl font-black text-rose-600">{odooStats.failed}</div>
                <p className="mt-1 text-[11px] text-slate-400">Nhấp để xem và đặt lại</p>
              </div>
            </div>

            {/* Smart Filters & Grouping Bar for Odoo */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 pl-1">Lọc:</span>
                <select
                  value={odooEntityFilter}
                  onChange={(e) => setOdooEntityFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả chứng từ</option>
                  <option value="invoices">Hóa đơn (invoices)</option>
                  <option value="quotations">Báo giá (quotations)</option>
                  <option value="partners">Đối tác / Khách hàng (partners)</option>
                  <option value="products">Vật tư & Hàng hóa (products)</option>
                  <option value="users">Người dùng (users)</option>
                </select>

                <select
                  value={odooStatusFilter}
                  onChange={(e) => setOdooStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="SYNCED">Đã đồng bộ (SYNCED)</option>
                  <option value="PENDING">Chờ xử lý (PENDING)</option>
                  <option value="FAILED">Thất bại / Lỗi</option>
                </select>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <ListFilter size={13} className="text-slate-400" />
                  <span>Gom nhóm:</span>
                  <select
                    value={odooGroupBy}
                    onChange={(e) => setOdooGroupBy(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="ENTITY">Gom theo loại chứng từ</option>
                    <option value="STATUS">Gom theo trạng thái</option>
                    <option value="NONE">Không gom nhóm</option>
                  </select>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo mã chứng từ, lỗi, xưởng..."
                  value={odooSearch}
                  onChange={(e) => setOdooSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Odoo Jobs Grouped View */}
            <div className="space-y-6">
              {odooLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-2xs">
                  Đang tải hàng đợi đồng bộ Odoo...
                </div>
              ) : Object.keys(groupedOdooJobs).length === 0 || filteredOdooJobs.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Hàng đợi đồng bộ trống</p>
                  <p className="text-xs text-slate-400 mt-1">Toàn bộ chứng từ phát sinh đã được chuyển sang Odoo hoàn tất.</p>
                </div>
              ) : (
                Object.entries(groupedOdooJobs).map(([groupTitle, items]) => (
                  <div key={groupTitle} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                    {odooGroupBy !== 'NONE' && (
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{groupTitle}</span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {items.length} bản ghi
                          </span>
                        </div>
                      </div>
                    )}
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Loại chứng từ</th>
                          <th className="px-4 py-3">Mã bản ghi (Record ID)</th>
                          <th className="px-4 py-3">Xưởng</th>
                          <th className="px-4 py-3">Số lần thử</th>
                          <th className="px-4 py-3">Thời gian</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          <th className="px-4 py-3 text-right">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3.5">
                              <span className="rounded-md bg-purple-50 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-700 border border-purple-200">
                                {job.entity}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-slate-700 font-semibold">
                              {job.record_id}
                              {job.last_error && (
                                <div className="text-[10px] text-rose-600 font-normal truncate max-w-xs mt-0.5">
                                  Lỗi: {job.last_error}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-slate-600">
                              {job.workshop_name || 'Mặc định'}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-slate-600">
                              {job.attempts}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                              {new Date(job.created_at).toLocaleString('vi-VN')}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              {statusBadge(job.status)}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                              {job.status !== 'SYNCED' && (
                                <button
                                  onClick={() => handleRetryOdooJob(job.id)}
                                  className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 border border-amber-200 shadow-2xs"
                                >
                                  Thử lại
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedOdooJob(job)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                              >
                                Xem chi tiết
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 7: SYSTEM TOOLS, INTEGRATIONS & SMTP */}
        {/* ==================================================== */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Hạ Tầng Nền Tảng & Cấu Hình Email SMTP
                </h1>
                <p className="text-xs text-slate-500">
                  Giám sát trạng thái hoạt động của các dịch vụ lõi: Swagger API, Odoo 16 ERP, Mock Tax, PostgreSQL, Cloudflare Tunnel và Gmail SMTP.
                </p>
              </div>

              <button
                onClick={loadSystemStatus}
                disabled={checkingSystem}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <RefreshCw size={13} className={checkingSystem ? 'animate-spin text-brand-600' : 'text-slate-500'} />
                <span>Kiểm tra trạng thái</span>
              </button>
            </div>

            {/* GMAIL SMTP CONFIGURATION & TESTER BOX */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Dịch Vụ Gửi Thư Khôi Phục & Phản Hồi (Gmail SMTP)</h2>
                    <p className="text-[11px] text-slate-400">Gửi mã OTP khôi phục mật khẩu và phản hồi khách hàng tự động</p>
                  </div>
                </div>

                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
                  smtpInfo?.configured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {smtpInfo?.configured ? 'SMTP ĐÃ SẴN SÀNG' : 'CHƯA CẤU HÌNH GMAIL APP PASS'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                  <div className="text-slate-500">Máy chủ gửi thư: <strong className="font-mono text-slate-800">{smtpInfo?.host || 'smtp.gmail.com'} (Port 587 TLS)</strong></div>
                  <div className="text-slate-500">Tài khoản gửi: <strong className="font-mono text-slate-800">{smtpInfo?.sender || 'Chưa thiết lập SMTP_USER'}</strong></div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                    Gợi ý: Cấu hình biến môi trường <code className="bg-white px-1 py-0.5 rounded border">SMTP_USER</code> và <code className="bg-white px-1 py-0.5 rounded border">SMTP_PASS</code> (Mật khẩu ứng dụng 16 ký tự của Google) để gửi email thật.
                  </p>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Thử nghiệm gửi email kiểm tra (Test Email)</label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="Nhập email nhận thử nghiệm..."
                        value={testEmailTo}
                        onChange={(e) => setTestEmailTo(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white p-2 font-mono text-xs outline-none focus:border-brand-500"
                      />
                      <button
                        onClick={handleSendTestEmail}
                        disabled={testEmailSending}
                        className="rounded-xl bg-slate-900 px-3.5 py-2 font-semibold text-white hover:bg-slate-800 disabled:opacity-50 shadow-2xs whitespace-nowrap"
                      >
                        {testEmailSending ? 'Đang gửi...' : 'Gửi Test'}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">Hệ thống sẽ gửi gói tin test để kiểm tra cổng kết nối mạng ra internet.</p>
                </div>
              </div>
            </div>

            {/* Core Services Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* SWAGGER API DOCS CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                      <FileText size={20} />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      SẴN SÀNG (200 OK)
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">Swagger API Documentation</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Tài liệu OpenAPI 3.0 tương tác trực tiếp, đầy đủ endpoint xác thực JWT, nghiệp vụ xưởng, kế toán và Odoo sync.
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 border border-slate-200">
                    URL: <strong className="text-brand-700">/api-docs/</strong>
                  </div>
                </div>

                <a
                  href="/api-docs/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                >
                  <ExternalLink size={14} />
                  <span>Mở Swagger API UI (Tab mới)</span>
                </a>
              </div>

              {/* ODOO 16 ERP CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-200">
                      <Building2 size={20} />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      ĐÃ KẾT NỐI (XML-RPC)
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">Odoo 16 ERP Platform</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Hệ thống ERP lõi quản lý kế toán đa tiền tệ (VND / USD), sổ cái, đối tác và phân bổ thanh toán.
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 border border-slate-200 space-y-0.5">
                    <div>Database: <strong>fintax_clean</strong></div>
                    <div>Chế độ: <strong>MULTICURRENCY (VND)</strong></div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href="/odoo/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <ExternalLink size={13} />
                    <span>Mở Odoo ERP</span>
                  </a>
                  <button
                    onClick={() => setActiveTab('odoo')}
                    className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition shadow-2xs"
                  >
                    <span>Hàng đợi</span>
                  </button>
                </div>
              </div>

              {/* MOCK TAX PORTAL CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                      <ShieldCheck size={20} />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      ONLINE (200 OK)
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">Cổng Tra cứu Thuế Giả Lập</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Dịch vụ giả lập cổng Tổng Cục Thuế Việt Nam để kiểm tra MST và cấp mã hóa đơn CQT tự động.
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 border border-slate-200">
                    Proxy URL: <strong className="text-amber-700">/tax-portal/</strong>
                  </div>
                </div>

                <a
                  href="/tax-portal/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <ExternalLink size={14} />
                  <span>Mở Cổng Thuế Giả Lập (CQT)</span>
                </a>
              </div>

              {/* POSTGRESQL DATABASE CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-200">
                      <Database size={20} />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      CONNECTED
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">PostgreSQL 15 Database</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Cơ sở dữ liệu lưu trữ cấu trúc quan hệ: xưởng sản xuất, giao dịch thu chi, hóa đơn, vật tư và đơn hàng.
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 border border-slate-200 space-y-0.5">
                    <div>Databases: <strong>finworkshop</strong> & <strong>fintax_clean</strong></div>
                    <div>Độ trễ truy vấn: <strong>{systemStatus?.database?.latencyMs || 1} ms</strong></div>
                  </div>
                </div>
              </div>

              {/* CLOUDFLARE ZERO TRUST TUNNEL CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                      <Globe size={20} />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      ACTIVE & SECURED
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">Cloudflare Tunnel & SSL</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Định tuyến tên miền chính thức fintaxauto.space qua Cloudflare Named Tunnel fintax-vps, mã hóa HTTPS tự động.
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 border border-slate-200">
                    Domain: <strong className="text-orange-700">fintaxauto.space</strong>
                  </div>
                </div>

                <a
                  href="https://fintaxauto.space"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <ExternalLink size={14} />
                  <span>Truy cập Domain Chính Thức</span>
                </a>
              </div>

              {/* SERVER HEALTH & RUNTIME CARD */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                      <Server size={20} />
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                      UPTIME ACTIVE
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">Máy chủ & Node.js Runtime</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Thông tin tài nguyên tiến trình Express API, bộ nhớ đệm và phiên bản Node.js.
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 border border-slate-200 space-y-0.5">
                    <div>Node: <strong>{systemStatus?.nodeVersion || 'v20.x'}</strong></div>
                    <div>Môi trường: <strong>{systemStatus?.environment || 'production'}</strong></div>
                    <div>Thời gian chạy: <strong>{Math.floor((systemStatus?.uptimeSeconds || 0) / 60)} phút</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 8: AUDIT LOGS (NHẬT KÝ KIỂM TOÁN HỆ THỐNG) */}
        {/* ==================================================== */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Nhật Ký Kiểm Toán & An Ninh Hệ Thống (Audit Logs)
                </h1>
                <p className="text-xs text-slate-500">
                  Ghi nhận đầy đủ mọi thao tác tạo mới, sửa đổi, cấp quyền và đồng bộ hóa trên toàn nền tảng.
                </p>
              </div>

              <button
                onClick={loadAuditLogs}
                disabled={auditLoading}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <RefreshCw size={13} className={auditLoading ? 'animate-spin text-brand-600' : 'text-slate-500'} />
                <span>Làm mới nhật ký</span>
              </button>
            </div>

            {/* Smart Filters & Grouping Bar for Audit */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 pl-1">Lọc:</span>
                <select
                  value={auditEntityFilter}
                  onChange={(e) => setAuditEntityFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                >
                  <option value="ALL">Tất cả phân hệ</option>
                  <option value="tax-rules">Chính sách thuế (tax-rules)</option>
                  <option value="workshops">Doanh nghiệp xưởng (workshops)</option>
                  <option value="users">Người dùng (users)</option>
                  <option value="website_inquiries">Yêu cầu tư vấn (website_inquiries)</option>
                  <option value="odoo_sync_jobs">Đồng bộ Odoo (odoo_sync_jobs)</option>
                </select>

                <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                  <ListFilter size={13} className="text-slate-400" />
                  <span>Gom nhóm:</span>
                  <select
                    value={auditGroupBy}
                    onChange={(e) => setAuditGroupBy(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="NONE">Không gom nhóm</option>
                    <option value="ENTITY">Gom theo phân hệ</option>
                    <option value="ACTION">Gom theo hành động</option>
                  </select>
                </div>
              </div>

              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo người thực hiện, hành động..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Audit Logs Grouped View */}
            <div className="space-y-6">
              {auditLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 shadow-2xs">
                  Đang tải nhật ký kiểm toán...
                </div>
              ) : Object.keys(groupedAuditLogs).length === 0 || filteredAuditLogs.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
                  <History size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Chưa có bản ghi nhật ký phù hợp</p>
                </div>
              ) : (
                Object.entries(groupedAuditLogs).map(([groupTitle, items]) => (
                  <div key={groupTitle} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                    {auditGroupBy !== 'NONE' && (
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{groupTitle}</span>
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {items.length} bản ghi
                          </span>
                        </div>
                      </div>
                    )}
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Người thực hiện</th>
                          <th className="px-4 py-3">Hành động</th>
                          <th className="px-4 py-3">Phân hệ</th>
                          <th className="px-4 py-3">Thời gian</th>
                          <th className="px-4 py-3">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/70 transition">
                            <td className="px-4 py-3.5 font-bold text-slate-900">
                              {log.actor?.name || log.actor?.email || 'Hệ thống'}
                              <div className="text-[10px] text-slate-400 font-normal">{log.actor?.role}</div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-mono text-[11px] text-brand-700 font-semibold">
                              {log.entity}
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('vi-VN')}
                            </td>
                            <td className="px-4 py-3.5 max-w-xs">
                              <button
                                onClick={() => setSelectedAuditLog(log)}
                                className="font-mono text-[10px] text-brand-600 hover:underline truncate max-w-full block"
                              >
                                {JSON.stringify(log.afterData || {})}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* ==================================================== */}
      {/* MODAL: KHỞI TẠO XƯỞNG TỪ YÊU CẦU TƯ VẤN (CONVERT LEAD) */}
      {/* ==================================================== */}
      {convertModal.open && convertModal.inq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Factory size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Khởi Tạo Xưởng Mới & Cấp Tài Khoản</h3>
                <p className="text-xs text-slate-500">Chuyển đổi khách hàng tiềm năng thành doanh nghiệp chính thức.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 space-y-1">
                <div>Khách hàng: <strong>{convertModal.inq.name}</strong></div>
                <div>Email đăng nhập: <strong className="font-mono text-brand-700">{convertModal.inq.email}</strong></div>
                <div>Tên Doanh nghiệp / Xưởng: <strong>{convertModal.inq.company || `Xưởng ${convertModal.inq.name}`}</strong></div>
                <div>Điện thoại: <strong>{convertModal.inq.phone || 'Chưa có'}</strong></div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật khẩu tạm thời cho Chủ xưởng</label>
                <input
                  type="text"
                  value={convertModal.tempPassword}
                  onChange={(e) => setConvertModal(prev => ({ ...prev, tempPassword: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs outline-none focus:border-brand-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Khách hàng sẽ dùng email và mật khẩu này để đăng nhập vào Bàn làm việc Xưởng.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setConvertModal({ open: false, inq: null, tempPassword: 'FinTax@2026', busy: false })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={convertModal.busy}
                onClick={handleConvertToWorkshop}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
              >
                <Check size={14} />
                <span>{convertModal.busy ? 'Đang tạo xưởng...' : 'Khởi tạo Xưởng Ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: THÊM XƯỞNG MỚI */}
      {/* ==================================================== */}
      {createWorkshopModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Thêm Doanh Nghiệp / Xưởng Mới</h3>
            <p className="text-xs text-slate-500 mb-4">Hệ thống sẽ tự động khởi tạo danh mục vật tư chuẩn và các sổ kế toán ban đầu.</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên Xưởng / Doanh nghiệp *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Xưởng Gỗ Minh Phát..."
                  value={createWorkshopModal.name}
                  onChange={(e) => setCreateWorkshopModal(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã xưởng (Code)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: X-MINHPHAT..."
                  value={createWorkshopModal.code}
                  onChange={(e) => setCreateWorkshopModal(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs uppercase outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã số thuế (nếu có)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 0316890123..."
                  value={createWorkshopModal.tax_id}
                  onChange={(e) => setCreateWorkshopModal(prev => ({ ...prev, tax_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setCreateWorkshopModal({ open: false, name: '', code: '', tax_id: '', busy: false })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                disabled={createWorkshopModal.busy}
                onClick={handleCreateWorkshop}
                className="rounded-xl bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-2xs disabled:opacity-50"
              >
                {createWorkshopModal.busy ? 'Đang tạo...' : 'Tạo Xưởng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: TẠO TÀI KHOẢN NGƯỜI DÙNG MỚI */}
      {/* ==================================================== */}
      {createUserModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">Tạo Tài Khoản Người Dùng Mới</h3>
            <p className="text-xs text-slate-500 mb-4">Cấp quyền truy cập trực tiếp cho nhân viên hoặc chủ xưởng.</p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Họ và tên *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A..."
                  value={createUserModal.full_name}
                  onChange={(e) => setCreateUserModal(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email đăng nhập *</label>
                <input
                  type="email"
                  placeholder="email@doanhnghiep.vn..."
                  value={createUserModal.email}
                  onChange={(e) => setCreateUserModal(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mật khẩu ban đầu *</label>
                <input
                  type="text"
                  value={createUserModal.password}
                  onChange={(e) => setCreateUserModal(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vai trò</label>
                  <select
                    value={createUserModal.role}
                    onChange={(e) => setCreateUserModal(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                  >
                    <option value="OWNER">Chủ xưởng / Quản lý</option>
                    <option value="ACCOUNTANT">Kế toán viên</option>
                    <option value="WAREHOUSE">Thủ kho</option>
                    <option value="WORKSHOP">Thợ xưởng</option>
                    <option value="ADMIN">Quản trị viên Website (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Xưởng trực thuộc</label>
                  <select
                    value={createUserModal.workshop_id}
                    onChange={(e) => setCreateUserModal(prev => ({ ...prev, workshop_id: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                  >
                    {workshops.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setCreateUserModal({ open: false, email: '', password: 'FinTax@2026', full_name: '', role: 'OWNER', workshop_id: '', busy: false })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                disabled={createUserModal.busy}
                onClick={handleCreateUser}
                className="rounded-xl bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-2xs disabled:opacity-50"
              >
                {createUserModal.busy ? 'Đang tạo...' : 'Tạo Tài Khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: THÊM / SỬA MỨC THUẾ HỆ THỐNG */}
      {/* ==================================================== */}
      {taxModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <button
              onClick={() => setTaxModal({ open: false, isEdit: false, rule: {} })}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Landmark size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {taxModal.isEdit ? `Chỉnh sửa Quy tắc Thuế: ${taxModal.rule.code}` : 'Thêm Mức Thuế Mới Cho Toàn Hệ Thống'}
                </h2>
                <p className="text-xs text-slate-500">Mức thuế này sẽ áp dụng ngay cho tất cả xưởng và công thức tính hóa đơn.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã quy tắc thuế *</label>
                  <input
                    type="text"
                    disabled={taxModal.isEdit}
                    placeholder="Ví dụ: VAT_10, VAT_8, VAT_5..."
                    value={taxModal.rule.code || ''}
                    onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, code: e.target.value.toUpperCase() } }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-mono text-xs uppercase outline-none focus:border-brand-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chế độ tính thuế</label>
                  <select
                    value={taxModal.rule.taxMode || 'VAT_CREDIT'}
                    onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, taxMode: e.target.value as any } }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                  >
                    <option value="VAT_CREDIT">Phương pháp Khấu trừ GTGT (VAT Credit)</option>
                    <option value="HKD_REVENUE">Phương pháp Trực tiếp Doanh thu (HKD)</option>
                    <option value="EXEMPT">Miễn thuế / Không chịu thuế</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên hiển thị mức thuế *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: GTGT 10% — Thuế suất tiêu chuẩn theo Luật thuế mới"
                  value={taxModal.rule.name || ''}
                  onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, name: e.target.value } }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thuế suất VAT (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxModal.rule.vatRate ?? 10}
                    onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, vatRate: Number(e.target.value) } }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Thuế TNCN / TNDN (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxModal.rule.pitRate ?? 0}
                    onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, pitRate: Number(e.target.value) } }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái</label>
                  <select
                    value={taxModal.rule.status || 'ACTIVE'}
                    onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, status: e.target.value as any } }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                  >
                    <option value="ACTIVE">Đang áp dụng</option>
                    <option value="REVIEW_REQUIRED">Cần rà soát</option>
                    <option value="INACTIVE">Ngừng áp dụng</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Căn cứ pháp lý & Nghị định áp dụng</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Luật 48/2024/QH15; Nghị định 174/2025/NĐ-CP; Thông tư 40/2021/TT-BTC"
                  value={taxModal.rule.legalReference || ''}
                  onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, legalReference: e.target.value } }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày hiệu lực từ</label>
                  <input
                    type="date"
                    value={taxModal.rule.effectiveFrom || ''}
                    onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, effectiveFrom: e.target.value } }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày hết hiệu lực (nếu có)</label>
                  <input
                    type="date"
                    value={taxModal.rule.effectiveTo || ''}
                    onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, effectiveTo: e.target.value } }))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú hướng dẫn áp dụng</label>
                <textarea
                  rows={2}
                  placeholder="Ghi chú điều kiện áp dụng, ví dụ: Áp dụng cho ngành sản xuất gia công kim loại..."
                  value={taxModal.rule.notes || ''}
                  onChange={(e) => setTaxModal(prev => ({ ...prev, rule: { ...prev.rule, notes: e.target.value } }))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setTaxModal({ open: false, isEdit: false, rule: {} })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveTaxRule}
                className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm"
              >
                {taxModal.isEdit ? 'Lưu cập nhật' : 'Thêm mức thuế mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: XEM CHI TIẾT & TRẢ LỜI YÊU CẦU TƯ VẤN */}
      {/* ==================================================== */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
            <button
              onClick={() => setSelectedInquiry(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 border border-brand-200">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Phản hồi Yêu cầu Tư vấn: {selectedInquiry.reference}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {typeBadge(selectedInquiry.inquiryType)}
                  {statusBadge(selectedInquiry.status)}
                </div>
              </div>
            </div>

            {/* Customer Details Box */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Khách hàng:</span> <strong className="text-slate-900">{selectedInquiry.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Email:</span> <a href={`mailto:${selectedInquiry.email}`} className="font-semibold text-brand-700 underline">{selectedInquiry.email}</a>
                </div>
                <div>
                  <span className="text-slate-400">Số điện thoại:</span> <strong>{selectedInquiry.phone || 'Chưa cung cấp'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Doanh nghiệp:</span> <strong>{selectedInquiry.company || 'Cá nhân / Chưa nhập'}</strong>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 mt-2">
                <span className="block font-semibold text-slate-700 mb-1">Nội dung khách hàng đã gửi:</span>
                <p className="rounded-lg bg-white p-3 text-slate-800 border border-slate-200 text-xs leading-relaxed whitespace-pre-wrap">
                  {selectedInquiry.message}
                </p>
              </div>

              {selectedInquiry.respondedAt && (
                <div className="border-t border-slate-200 pt-2 text-[11px] text-emerald-700">
                  ✓ Đã từng phản hồi vào {new Date(selectedInquiry.respondedAt).toLocaleString('vi-VN')} bởi {selectedInquiry.respondedBy || 'Admin'}.
                </div>
              )}
            </div>

            {/* Template Buttons */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700">Gợi ý mẫu phản hồi nhanh (1-Click):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyTemplate('DEMO')}
                  className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition shadow-2xs"
                >
                  📅 Hẹn lịch Demo sản xuất
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('QUOTE')}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition shadow-2xs"
                >
                  💼 Gửi báo giá & Tư vấn
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('EXPERIENCE')}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition shadow-2xs"
                >
                  🔑 Hướng dẫn dùng thử
                </button>
              </div>
            </div>

            {/* Reply Form */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề phản hồi (Subject)</label>
                <input
                  type="text"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung phản hồi chi tiết *</label>
                <textarea
                  rows={5}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Nhập nội dung trả lời gửi tới khách hàng..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 leading-relaxed font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái sau phản hồi</label>
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-brand-500"
                  >
                    <option value="RESPONDED">Đã phản hồi (Hoàn tất phản hồi)</option>
                    <option value="IN_PROGRESS">Đang xử lý (Cần tiếp tục theo dõi)</option>
                    <option value="CLOSED">Đóng yêu cầu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú quản trị nội bộ</label>
                  <input
                    type="text"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Khách tiềm năng, cần gọi lại..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={sendEmailDirectly}
                  onChange={(e) => setSendEmailDirectly(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Gửi email phản hồi trực tiếp tới hộp thư <strong className="text-slate-900">{selectedInquiry.email}</strong>
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              {selectedInquiry.status !== 'CLOSED' && (
                <button
                  type="button"
                  onClick={() => {
                    const inq = selectedInquiry;
                    setSelectedInquiry(null);
                    setConvertModal({ open: true, inq, tempPassword: 'FinTax@2026', busy: false });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition shadow-2xs"
                >
                  <Factory size={14} />
                  <span>Khởi tạo Xưởng cho khách này</span>
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={replying}
                  onClick={handleSendReply}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-sm disabled:opacity-50"
                >
                  <Send size={13} className={replying ? 'animate-spin' : ''} />
                  <span>{replying ? 'Đang gửi...' : 'Gửi phản hồi & Lưu'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ĐẶT LẠI MẬT KHẨU NGƯỜI DÙNG */}
      {/* ==================================================== */}
      {resetPasswordModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Đặt lại mật khẩu cho tài khoản</h3>
            <p className="text-xs text-slate-500 mt-1 font-mono">{resetPasswordModal.userEmail}</p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu mới (ít nhất 8 ký tự)</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu mới..."
                value={resetPasswordModal.newPassword}
                onChange={(e) => setResetPasswordModal(prev => ({ ...prev, newPassword: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setResetPasswordModal({ open: false, userId: '', userEmail: '', newPassword: '' })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleResetPassword}
                className="rounded-xl bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 shadow-2xs"
              >
                Lưu mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CHI TIẾT JOB ĐỒNG BỘ ODOO */}
      {/* ==================================================== */}
      {selectedOdooJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Chi Tiết Job Đồng Bộ Odoo</span>
                <span className="font-mono text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {selectedOdooJob.entity}
                </span>
              </div>
              <button
                onClick={() => setSelectedOdooJob(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div>Job ID: <strong className="font-mono text-slate-700">{selectedOdooJob.id}</strong></div>
              <div>Mã bản ghi (Record ID): <strong className="font-mono text-brand-700">{selectedOdooJob.record_id}</strong></div>
              <div>Xưởng trực thuộc: <strong>{selectedOdooJob.workshop_name || selectedOdooJob.workshop_id}</strong></div>
              <div>Trạng thái: {statusBadge(selectedOdooJob.status)}</div>
              <div>Số lần thử: <strong>{selectedOdooJob.attempts}</strong></div>
              <div>Thời gian tạo: <span className="text-slate-500">{new Date(selectedOdooJob.created_at).toLocaleString('vi-VN')}</span></div>
              {selectedOdooJob.last_error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 mt-2">
                  <div className="font-bold text-rose-800 mb-1">Lỗi ghi nhận:</div>
                  <div className="font-mono text-[11px] text-rose-700 whitespace-pre-wrap">{selectedOdooJob.last_error}</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-3">
              {selectedOdooJob.status !== 'SYNCED' && (
                <button
                  onClick={() => {
                    handleRetryOdooJob(selectedOdooJob.id);
                    setSelectedOdooJob(null);
                  }}
                  className="rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 shadow-2xs"
                >
                  Thử lại ngay
                </button>
              )}
              <button
                onClick={() => setSelectedOdooJob(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CHI TIẾT NHẬT KÝ KIỂM TOÁN (AUDIT DIFF) */}
      {/* ==================================================== */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History size={18} className="text-brand-600" />
                <span className="font-bold text-slate-900 text-sm">Chi Tiết Nhật Ký Kiểm Toán</span>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {selectedAuditLog.action}
                </span>
              </div>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>Người thực hiện: <strong>{selectedAuditLog.actor?.name || selectedAuditLog.actor?.email || 'Hệ thống'}</strong></div>
                <div>Vai trò: <strong>{selectedAuditLog.actor?.role || 'SYSTEM'}</strong></div>
                <div>Phân hệ: <strong className="font-mono text-brand-700">{selectedAuditLog.entity}</strong></div>
                <div>Thời gian: <strong>{new Date(selectedAuditLog.createdAt).toLocaleString('vi-VN')}</strong></div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Dữ liệu ghi nhận (Payload JSON):</label>
                <pre className="max-h-60 overflow-y-auto rounded-xl bg-slate-900 p-3 text-[11px] text-emerald-400 font-mono">
                  {JSON.stringify(selectedAuditLog.afterData, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-3">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
