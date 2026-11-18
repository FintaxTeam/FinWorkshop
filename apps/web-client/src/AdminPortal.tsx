import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, LayoutDashboard, Mail, FileText, Settings, Users,
  Factory, CheckCircle2, Clock, AlertCircle, ExternalLink, Send,
  RefreshCw, Search, Filter, ArrowLeft, Building2, Database,
  Server, ChevronRight, Plus, Trash2, LogOut, X, Check,
  Layers, Globe, Sparkles, MessageSquare, Phone, Building,
  KeyRound, Lock, Unlock, HelpCircle
} from 'lucide-react';
import { api, messageOf } from './api';
import { useAuth } from './auth';
import { useLanguage } from './language';
import { useToast } from './components';

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

export default function AdminPortal() {
  const { user, logout } = useAuth();
  const { isEn, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'inquiries' | 'system' | 'workshops' | 'users'>('inquiries');
  const [loading, setLoading] = useState(false);

  // Inquiries State
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats>({ total: 0, newCount: 0, inProgressCount: 0, respondedCount: 0, closedCount: 0 });
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  // Reply Form State
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState<'RESPONDED' | 'IN_PROGRESS' | 'CLOSED'>('RESPONDED');
  const [adminNotes, setAdminNotes] = useState('');
  const [sendEmailDirectly, setSendEmailDirectly] = useState(true);
  const [replying, setReplying] = useState(false);

  // System Status State
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [checkingSystem, setCheckingSystem] = useState(false);

  // Workshops & Users State
  const [workshops, setWorkshops] = useState<WorkshopItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [resetPasswordModal, setResetPasswordModal] = useState<{ open: boolean; userId: string; userEmail: string; newPassword: string }>({
    open: false, userId: '', userEmail: '', newPassword: ''
  });

  // Verify Admin Access
  const isAdmin = user?.role === 'ADMIN' || user?.isAdmin;

  // Load Inquiries
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

  // Load System Status
  const loadSystemStatus = useCallback(async () => {
    setCheckingSystem(true);
    try {
      const res = await api.get('/admin/system/status');
      setSystemStatus(res.data);
    } catch (err) {
      toast(messageOf(err), 'error');
    } finally {
      setCheckingSystem(false);
    }
  }, [toast]);

  // Load Workshops
  const loadWorkshops = useCallback(async () => {
    try {
      const res = await api.get('/admin/workshops');
      setWorkshops(res.data || []);
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  }, [toast]);

  // Load Users
  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data || []);
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'inquiries') loadInquiries();
    else if (activeTab === 'system') loadSystemStatus();
    else if (activeTab === 'workshops') loadWorkshops();
    else if (activeTab === 'users') loadUsers();
  }, [activeTab, loadInquiries, loadSystemStatus, loadWorkshops, loadUsers]);

  // Open Reply Modal
  const openReplyModal = (inq: Inquiry) => {
    setSelectedInquiry(inq);
    setReplySubject(inq.replySubject || `[FinWorkshop] Phản hồi yêu cầu tư vấn (${inq.reference})`);
    setReplyMessage(inq.replyMessage || '');
    setReplyStatus(inq.status === 'NEW' ? 'RESPONDED' : inq.status);
    setAdminNotes(inq.adminNotes || '');
    setSendEmailDirectly(true);
  };

  // Preset Fast Reply Templates
  const applyTemplate = (type: 'DEMO' | 'QUOTE' | 'EXPERIENCE') => {
    if (!selectedInquiry) return;
    if (type === 'DEMO') {
      setReplySubject(`[FinWorkshop] Lịch Demo & Giới thiệu giải pháp quản lý sản xuất cho ${selectedInquiry.name}`);
      setReplyMessage(
        `Chào ${selectedInquiry.name},\n\nĐội ngũ FinWorkshop rất vui mừng nhận được yêu cầu của bạn về giải pháp quản lý sản xuất và kế toán cho xưởng.\n\nChúng tôi xin đề xuất một buổi Demo trực tuyến (30 phút) để giới thiệu chi tiết:\n1. Tự động hóa tính định mức nguyên vật liệu (BOM) và giá thành đơn hàng.\n2. Quản lý tiến độ sản xuất xưởng và xuất nhập kho theo thời gian thực.\n3. Đồng bộ hóa đơn, dòng tiền và kết nối với nền tảng ERP Odoo 16.\n\nBạn có thể phản hồi lại email này với khung giờ thuận tiện nhất (Ví dụ: 10h00 sáng mai) để chúng tôi chuẩn bị buổi làm việc chu đáo nhất nhé.\n\nTrân trọng,\nĐội ngũ FinWorkshop\nHotline: 0943 863 108\nWebsite: https://fintaxauto.space`
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

  // Submit Reply
  const handleSendReply = async () => {
    if (!selectedInquiry) return;
    if (!replyMessage.trim()) {
      toast('Vui lòng nhập nội dung phản hồi cho khách hàng.', 'error');
      return;
    }

    setReplying(true);
    try {
      // First save admin notes if modified
      if (adminNotes !== selectedInquiry.adminNotes) {
        await api.patch(`/website/inquiries/${selectedInquiry.id}`, { adminNotes });
      }

      // Send reply
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

  // Toggle User Active Status
  const handleToggleUser = async (userId: string, currentActive: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { active: !currentActive });
      toast(!currentActive ? 'Đã kích hoạt tài khoản.' : 'Đã khóa tài khoản.', 'success');
      loadUsers();
    } catch (err) {
      toast(messageOf(err), 'error');
    }
  };

  // Reset User Password
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

  const statusBadge = (st: string) => {
    switch (st) {
      case 'NEW':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200"><span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />Mới tiếp nhận</span>;
      case 'IN_PROGRESS':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200"><Clock size={11} />Đang xử lý</span>;
      case 'RESPONDED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200"><CheckCircle2 size={11} />Đã phản hồi</span>;
      case 'CLOSED':
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">Đã đóng</span>;
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
                <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Quản trị Website & Hạ tầng Nền tảng</p>
              </div>
            </Link>
          </div>

          {/* Quick Actions & Switch to Workshop ERP */}
          <div className="flex items-center gap-2">
            <Link
              to="/app"
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
                <span className="block text-[10px] text-slate-400">Quản trị viên Hệ thống</span>
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

      {/* 2. ADMIN NAVIGATION TABS */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
          <button
            onClick={() => setActiveTab('inquiries')}
            className={`flex items-center gap-2 border-b-2 py-3.5 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'inquiries'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Mail size={16} />
            <span>Yêu cầu Tư vấn & Demo (/lien-he)</span>
            {stats.newCount > 0 && (
              <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                {stats.newCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 border-b-2 py-3.5 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'system'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Server size={16} />
            <span>Công cụ & Dịch vụ Nền tảng</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          </button>

          <button
            onClick={() => setActiveTab('workshops')}
            className={`flex items-center gap-2 border-b-2 py-3.5 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'workshops'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Factory size={16} />
            <span>Quản lý Doanh nghiệp & Xưởng</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 border-b-2 py-3.5 px-3 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            <Users size={16} />
            <span>Quản lý Người dùng Toàn hệ thống</span>
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
            {/* Header & Description */}
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

            {/* Filter and Search Bar */}
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
                  <option value="CLOSED">Đã đóng</option>
                </select>
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

            {/* Inquiries Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              {loading ? (
                <div className="p-12 text-center text-xs text-slate-500">Đang tải dữ liệu yêu cầu...</div>
              ) : inquiries.length === 0 ? (
                <div className="p-12 text-center">
                  <Mail size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Chưa có yêu cầu nào phù hợp</p>
                  <p className="text-xs text-slate-400 mt-1">Khi khách hàng gửi form tại trang /lien-he, dữ liệu sẽ tự động xuất hiện tại đây.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                      {inquiries.map((inq) => (
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
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <button
                              onClick={() => openReplyModal(inq)}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 border border-brand-200 transition shadow-2xs"
                            >
                              <MessageSquare size={13} />
                              <span>{inq.status === 'RESPONDED' ? 'Xem & Gửi tiếp' : 'Xem & Trả lời'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: SYSTEM TOOLS & INTEGRATIONS (SWAGGER, ODOO...) */}
        {/* ==================================================== */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Công cụ & Dịch vụ Nền tảng (Developer & System Tools)
                </h1>
                <p className="text-xs text-slate-500">
                  Giám sát trạng thái hoạt động của các dịch vụ lõi: Swagger API, Odoo 16 ERP, Mock Tax, PostgreSQL, Cloudflare Tunnel.
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
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                      systemStatus?.odoo?.connected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {systemStatus?.odoo?.connected ? 'ĐÃ KẾT NỐI (XML-RPC)' : 'CHƯA KẾT NỐI'}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">Odoo 16 ERP Platform</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Hệ thống ERP lõi quản lý kế toán đa tiền tệ (VND / USD), sổ cái, đối tác và phân bổ thanh toán.
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 border border-slate-200 space-y-0.5">
                    <div>Database: <strong>{systemStatus?.odoo?.database || 'fintax_clean'}</strong></div>
                    <div>Chế độ: <strong>{systemStatus?.odoo?.mode || 'MULTICURRENCY (VND)'}</strong></div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a
                    href="http://localhost:8069"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <ExternalLink size={13} />
                    <span>Mở Odoo (:8069)</span>
                  </a>
                  <Link
                    to="/settings"
                    className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition shadow-2xs"
                  >
                    <span>Cài đặt</span>
                  </Link>
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
                      ONLINE (PORT 4000)
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">Cổng Tra cứu Thuế Giả Lập</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Dịch vụ giả lập cổng Tổng Cục Thuế Việt Nam để kiểm tra MST và cấp mã hóa đơn CQT tự động.
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700 border border-slate-200">
                    Endpoint: <strong className="text-amber-700">/api/v1/invoices/issue</strong>
                  </div>
                </div>

                <a
                  href="http://localhost:4000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  <ExternalLink size={14} />
                  <span>Mở Cổng Thuế Giả Lập (:4000)</span>
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
                    <div>Database: <strong>finworkshop</strong> & <strong>fintax_clean</strong></div>
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
        {/* TAB 3: WORKSHOPS MANAGEMENT */}
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

              <button
                onClick={loadWorkshops}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <RefreshCw size={13} className="text-slate-500" />
                <span>Làm mới</span>
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tên Xưởng / Doanh nghiệp</th>
                    <th className="px-4 py-3">Mã xưởng</th>
                    <th className="px-4 py-3">Mã số thuế</th>
                    <th className="px-4 py-3">Số lượng tài khoản</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="px-4 py-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workshops.map((w) => (
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
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                          Hoạt động
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: USERS MANAGEMENT */}
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

              <button
                onClick={loadUsers}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <RefreshCw size={13} className="text-slate-500" />
                <span>Làm mới</span>
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                  {users.map((u) => (
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
          </div>
        )}
      </main>

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
                  rows={6}
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
            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
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
    </div>
  );
}
