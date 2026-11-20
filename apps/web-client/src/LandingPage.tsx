import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Factory,
  FileText,
  Layers,
  Package,
  Receipt,
  Wallet,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const ledeSentence =
  'FinWorkshop kết nối báo giá, định mức vật tư, lệnh sản xuất, kho và hóa đơn kế toán trong cùng một không gian vận hành — để mỗi con số trên sổ sách đều lần ngược được về đúng đơn hàng tại xưởng.';

const stageSlides = [
  {
    code: '01 / TỔNG QUAN ĐIỀU HÀNH',
    title: 'Dòng tiền & công việc cần xử lý',
    copy: 'Bàn làm việc theo vai trò hiển thị báo giá chờ duyệt, lệnh sản xuất đang chạy và công nợ đến hạn trên một màn hình duy nhất.',
    source: '/media/finworkshop-dashboard.png',
    alt: 'Bàn làm việc tổng quan của FinWorkshop với dòng tiền và công việc cần xử lý',
    meta: 'FINWORKSHOP / DASHBOARD',
  },
  {
    code: '02 / QUẢN LÝ SẢN XUẤT & KHO',
    title: 'Từ định mức BOM đến lệnh xưởng',
    copy: 'Chuyển báo giá đã chốt thành lệnh sản xuất. Theo dõi vật tư thực xuất, giờ công thợ xưởng và tiến độ nghiệm thu thành phẩm.',
    source: '/media/finworkshop-production.png',
    alt: 'Danh sách lệnh sản xuất và công đoạn trong FinWorkshop',
    meta: 'FINWORKSHOP / PRODUCTION',
  },
  {
    code: '03 / HÓA ĐƠN, CÔNG NỢ & MÃ CQT',
    title: 'Đối chiếu chứng từ & cổng thuế',
    copy: 'Quản lý hóa đơn mua bán, gán phiếu thu chi từng đợt, cấp mã Cơ quan Thuế (Mã CQT) và đồng bộ hai chiều với lõi kế toán Odoo 16.',
    source: '/media/finworkshop-invoices.png',
    alt: 'Danh sách hóa đơn và công nợ trong FinWorkshop',
    meta: 'FINWORKSHOP / INVOICES & TAX',
  },
];

const arcModules = [
  {
    code: 'MOD 01',
    tag: 'BÁO GIÁ & BOM',
    title: 'Định mức & Báo giá',
    copy: 'Xây dựng giá thành dự kiến từ vật tư, nhân công và chi phí máy. Lưu phiên bản và luồng duyệt hai chiều.',
    to: '/giai-phap/san-xuat',
    icon: FileText,
  },
  {
    code: 'MOD 02',
    tag: 'XƯỞNG SẢN XUẤT',
    title: 'Lệnh sản xuất',
    copy: 'Phân công công đoạn, ghi nhận giờ làm thực tế của từng thợ và nghiệm thu thành phẩm nhập kho.',
    to: '/giai-phap/san-xuat',
    icon: Factory,
  },
  {
    code: 'MOD 03',
    tag: 'KHO & VẬT TƯ',
    title: 'Tồn kho theo lệnh',
    copy: 'Ghi phiếu nhập, xuất vật tư theo mã lệnh, trả kho và hao hụt để đối chiếu kế hoạch với thực tế.',
    to: '/san-pham',
    icon: Package,
  },
  {
    code: 'MOD 04',
    tag: 'CHỨNG TỪ & THUẾ',
    title: 'Hóa đơn & Mã CQT',
    copy: 'Phát hành hóa đơn mua bán, cấp mã CQT tra cứu tức thì và theo dõi trạng thái tất toán từng đợt.',
    to: '/giai-phap/ke-toan',
    icon: Receipt,
  },
  {
    code: 'MOD 05',
    tag: 'SỔ QUỸ & ERP',
    title: 'Dòng tiền & Odoo 16',
    copy: 'Nhập sao kê CSV/XLSX, tách tiền xưởng với cá nhân, khóa kỳ kế toán và đồng bộ sổ cái Odoo.',
    to: '/giai-phap/ke-toan',
    icon: Wallet,
  },
];

const wireframeSteps = [
  {
    code: '01',
    title: 'Báo giá từ định mức BOM',
    copy: 'Tách rõ vật tư, giờ công và hao hụt trước khi gửi khách. Không còn tính nhẩm rời rạc trên nhiều file Excel.',
    to: '/giai-phap/san-xuat',
    svg: (
      <svg viewBox="0 0 240 240" fill="none" stroke="#111c20" strokeWidth="1.15">
        <path className="fw-draw-path" d="M 120 0 V 120 L 0 240" />
        <path className="fw-draw-path" d="M 120 120 H 240" />
        <path className="fw-draw-path" d="M 120 0 A 120 120 0 0 0 240 120" />
        <path className="fw-draw-path" d="M 185 35 L 240 35 L 210 0 Z" stroke="#a91517" />
        <path className="fw-draw-path" d="M 90 150 H 240 M 60 180 H 240 M 30 210 H 240" />
      </svg>
    ),
  },
  {
    code: '02',
    title: 'Chuyển thẳng thành lệnh xưởng',
    copy: 'Báo giá khách chốt sinh lệnh sản xuất tự động. Chủ xưởng theo dõi tiến độ từng công đoạn theo thời gian thực.',
    to: '/giai-phap/san-xuat',
    svg: (
      <svg viewBox="0 0 240 240" fill="none" stroke="#111c20" strokeWidth="1.15">
        <circle className="fw-draw-path" cx="120" cy="120" r="118" />
        <path className="fw-draw-path" d="M 0 120 H 240 M 120 0 V 240" />
        <path className="fw-draw-path" d="M 120 120 L 204 36 M 204 36 V 240 M 204 120 H 240" stroke="#a91517" />
        <path className="fw-draw-path" d="M 36 120 V 240" />
      </svg>
    ),
  },
  {
    code: '03',
    title: 'Kiểm soát vật tư & giá thành',
    copy: 'Xuất dùng, trả lại và hao hụt gắn trực tiếp với mã lệnh để cuối kỳ biết chính xác đơn hàng nào lãi hay lỗ.',
    to: '/san-pham',
    svg: (
      <svg viewBox="0 0 240 240" fill="none" stroke="#111c20" strokeWidth="1.15">
        <path className="fw-draw-path" d="M 120 0 V 120 L 240 240" />
        <path className="fw-draw-path" d="M 0 120 H 120" />
        <path className="fw-draw-path" d="M 0 120 A 120 120 0 0 0 120 0" />
        <path className="fw-draw-path" d="M 0 150 H 150 M 0 180 H 180 M 0 210 H 210" />
        <path className="fw-draw-path" d="M 0 42 H 55 L 28 0 Z" stroke="#a91517" />
      </svg>
    ),
  },
  {
    code: '04',
    title: 'Hóa đơn, Mã CQT & công nợ',
    copy: 'Gán thanh toán từng lần vào hóa đơn, cấp mã CQT tra cứu trực tuyến và đối chiếu sao kê ngân hàng minh bạch.',
    to: '/giai-phap/ke-toan',
    svg: (
      <svg viewBox="0 0 240 240" fill="none" stroke="#111c20" strokeWidth="1.15">
        <path className="fw-draw-path" d="M 0 120 A 120 120 0 0 1 240 120" />
        <path className="fw-draw-path" d="M 0 120 H 240 M 120 120 V 240" />
        <path className="fw-draw-path" d="M 0 160 H 120 M 0 200 H 120" />
        <path className="fw-draw-path" d="M 0 240 L 120 120" stroke="#a91517" />
        <path className="fw-draw-path" d="M 180 120 V 240" />
      </svg>
    ),
  },
];

const questions = [
  [
    'Có thể trải nghiệm trước khi tạo doanh nghiệp không?',
    'Có. Trang Trải nghiệm sản phẩm cho phép chọn 1 trong 4 vai trò (Chủ xưởng, Kế toán, Thủ kho, Thợ xưởng) và đăng nhập trực tiếp với dữ liệu mẫu để kiểm tra mọi phân hệ.',
  ],
  [
    'FinWorkshop dành cho những mô hình xưởng nào?',
    'Hệ thống phục vụ xưởng cơ khí, nội thất, gia công theo đơn và doanh nghiệp sản xuất nhỏ cần kết nối báo giá, định mức BOM, lệnh sản xuất, kho và tài chính.',
  ],
  [
    'Dữ liệu Excel và lõi kế toán Odoo 16 hoạt động ra sao?',
    'Hỗ trợ nhập sao kê CSV/XLSX, xuất sổ sách ra Excel và đồng bộ hai chiều đối tác, hóa đơn, bút toán với Odoo 16 ERP.',
  ],
  [
    'Phiên bản trình diễn đã kết nối ngân hàng và thuế thật chưa?',
    'Chưa. Mã CQT của hóa đơn hiện được cấp qua Cổng tra cứu Hóa đơn mô phỏng phục vụ kiểm thử và trình diễn; chưa ký số hoặc nộp tờ khai thuế thật.',
  ],
];

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*';

function scrambleElement(el: HTMLElement) {
  const finalText = el.dataset.scrambleText || el.textContent || '';
  if (!finalText) return;
  const obj = { progress: 0 };
  gsap.to(obj, {
    progress: 1,
    duration: 0.9,
    ease: 'power2.out',
    onUpdate: () => {
      const revealedCount = Math.floor(obj.progress * finalText.length);
      let out = '';
      for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        if (ch === ' ' || ch === '.' || ch === '\n') {
          out += ch;
        } else if (i < revealedCount) {
          out += ch;
        } else {
          out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        }
      }
      el.textContent = out;
    },
    onComplete: () => {
      el.textContent = finalText;
    },
  });
}

function DitherPlasmaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bayer4 = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];

    let rafId = 0;
    let width = 0;
    let height = 0;
    const cell = 6;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.ceil(width / cell);
      canvas.height = Math.ceil(height / cell);
    };

    resize();
    window.addEventListener('resize', resize);

    let time = 0;
    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const img = ctx.createImageData(w, h);
      const data = img.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = x / w;
          const ny = y / h;
          const wave =
            Math.sin(nx * 5.4 + time * 0.65) * 0.34 +
            Math.cos(ny * 4.2 - time * 0.5) * 0.34 +
            Math.sin((nx + ny) * 4.8 + time * 0.4) * 0.32;
          const intensity = Math.max(0, Math.min(1, (wave + 1) * 0.44));
          const threshold = (bayer4[y & 3][x & 3] + 0.5) / 16;
          const idx = (y * w + x) * 4;

          if (intensity > threshold * 0.92 + 0.16) {
            const isCrimsonPeak = intensity > 0.72 && (x + y) % 5 === 0;
            data[idx] = isCrimsonPeak ? 185 : 196;
            data[idx + 1] = isCrimsonPeak ? 36 : 206;
            data[idx + 2] = isCrimsonPeak ? 38 : 210;
            data[idx + 3] = isCrimsonPeak ? 120 : 145;
          } else {
            data[idx] = 255;
            data[idx + 1] = 255;
            data[idx + 2] = 255;
            data[idx + 3] = 255;
          }
        }
      }
      ctx.putImageData(img, 0, 0);

      if (!reducedMotion) {
        time += 0.022;
        rafId = requestAnimationFrame(render);
      }
    };

    render();
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fw-dither-canvas" aria-hidden="true" />;
}

export default function LandingPage() {
  const [activeStage, setActiveStage] = useState(0);
  const [activeArc, setActiveArc] = useState(2);
  const [faq, setFaq] = useState<number | null>(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageTriggerRef = useRef<ScrollTrigger | null>(null);
  const dragStartX = useRef<number | null>(null);

  // Main GSAP + ScrollTrigger Choreography
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // 1. Hero Entrance Timeline + Bidirectional Scroll Drift
      const heroTl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      heroTl
        .fromTo('.fw-coda-hero .fw-eyebrow', { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.6 })
        .fromTo(
          '.fw-hero-display .fw-line-inner',
          { yPercent: 115, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.95, stagger: 0.11 },
          '-=0.3'
        )
        .fromTo(
          '.fw-hero-footer-bar > *',
          { y: 24, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, stagger: 0.1 },
          '-=0.5'
        );

      gsap.to('.fw-coda-hero-inner', {
        yPercent: -14,
        opacity: 0.25,
        ease: 'none',
        scrollTrigger: {
          trigger: '.fw-coda-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      // 2. Bidirectional Word-by-Word Scroll Illumination Lede (Codapress Signature)
      const ledeWords = root.querySelectorAll('.fw-lede-word');
      if (ledeWords.length) {
        gsap.to(ledeWords, {
          color: '#111c20',
          stagger: 0.12,
          ease: 'none',
          scrollTrigger: {
            trigger: '.fw-lede-section',
            start: 'top 78%',
            end: 'bottom 45%',
            scrub: 0.45,
          },
        });
      }

      // 3. Cipher Scramble Section Headings on Scroll Entry
      root.querySelectorAll<HTMLElement>('[data-scramble-text]').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 86%',
          once: true,
          onEnter: () => scrambleElement(el),
        });
      });

      // 4. 1px Architectural Wireframe SVG Path Drawing on Scroll
      const wireCards = root.querySelectorAll('.fw-wire-card');
      wireCards.forEach((card, index) => {
        const paths = card.querySelectorAll<SVGGeometryElement>('.fw-draw-path');
        paths.forEach((p) => {
          const len = p.getTotalLength ? p.getTotalLength() : 320;
          gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        });
        gsap.to(paths, {
          strokeDashoffset: 0,
          duration: 1.15,
          stagger: 0.08,
          delay: index * 0.08,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.fw-wireframe-grid',
            start: 'top 82%',
            once: true,
          },
        });
      });

      gsap.fromTo(
        '.fw-wire-card',
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.fw-wireframe-grid', start: 'top 84%', once: true },
        }
      );

      // 5. Bidirectional Featured Image Parallax (Codapress Latest Release Signature)
      gsap.fromTo(
        '.fw-parallax-inner',
        { scale: 1.14, yPercent: -7 },
        {
          scale: 1.14,
          yPercent: 7,
          ease: 'none',
          scrollTrigger: {
            trigger: '.fw-parallax-media',
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      );
    });

    // 6. Desktop Pinned Scroll-Morphing Image Stage (scroll down & up to morph between 3 screenshots)
    mm.add('(min-width: 961px) and (prefers-reduced-motion: no-preference)', () => {
      const slide1 = root.querySelector<HTMLElement>('.fw-stage-slide-1');
      const slide2 = root.querySelector<HTMLElement>('.fw-stage-slide-2');
      const img1 = slide1?.querySelector('img');
      const img2 = slide2?.querySelector('img');
      const rail = root.querySelector<HTMLElement>('.fw-stage-rail');

      if (!slide1 || !slide2 || !rail) return;

      gsap.set([slide1, slide2], { clipPath: 'inset(100% 0% 0% 0%)' });
      if (img1) gsap.set(img1, { scale: 1.1 });
      if (img2) gsap.set(img2, { scale: 1.1 });

      const stageTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.fw-stage-section',
          start: 'top top',
          end: '+=210%',
          pin: '.fw-stage-pin',
          scrub: 0.65,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;
            const nextIndex = p < 0.36 ? 0 : p < 0.72 ? 1 : 2;
            setActiveStage((prev) => (prev === nextIndex ? prev : nextIndex));
          },
        },
      });

      stageTriggerRef.current = stageTl.scrollTrigger || null;

      stageTl
        .to(rail, { scaleY: 0.66, duration: 1, ease: 'none' }, 0)
        .to(slide1, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.inOut' }, 0)
        .to(img1 || slide1, { scale: 1, duration: 1, ease: 'power2.out' }, 0)
        .to(rail, { scaleY: 1, duration: 1, ease: 'none' }, 1.15)
        .to(slide2, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.inOut' }, 1.15)
        .to(img2 || slide2, { scale: 1, duration: 1, ease: 'power2.out' }, 1.15);
    });

    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 160);

    return () => {
      window.clearTimeout(refreshTimer);
      stageTriggerRef.current = null;
      mm.revert();
    };
  }, []);

  // Convex Arc Carousel GSAP Physics
  useLayoutEffect(() => {
    const cards = rootRef.current?.querySelectorAll<HTMLElement>('.fw-arc-card');
    if (!cards?.length) return;
    const isMobile = window.innerWidth < 680;
    const xSpacing = isMobile ? 205 : 275;

    cards.forEach((card, i) => {
      const offset = i - activeArc;
      const abs = Math.abs(offset);
      const x = offset * xSpacing;
      const y = abs * abs * 22;
      const rotate = offset * 7.5;
      const scale = Math.max(0.82, 1 - abs * 0.085);
      const opacity = abs > 2 ? 0 : 1 - abs * 0.22;

      gsap.to(card, {
        x,
        y,
        rotate,
        scale,
        opacity,
        zIndex: 20 - abs,
        duration: 0.65,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    });
  }, [activeArc]);

  const jumpToStage = (index: number) => {
    setActiveStage(index);
    const st = stageTriggerRef.current;
    if (st && window.innerWidth >= 961) {
      const targets = [0.02, 0.52, 0.98];
      const scrollY = st.start + (st.end - st.start) * targets[index];
      window.scrollTo({ top: scrollY, behavior: 'smooth' });
    }
  };

  const handleArcPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const handleArcPointerUp = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) > 45) {
      setActiveArc((prev) =>
        delta < 0 ? Math.min(arcModules.length - 1, prev + 1) : Math.max(0, prev - 1)
      );
    }
  };

  const words = ledeSentence.split(' ');
  const isDesktopPin = typeof window !== 'undefined' && window.innerWidth >= 961;

  return (
    <div ref={rootRef}>
      {/* 1. Full-Viewport Dither Plasma Hero */}
      <section className="fw-coda-hero">
        <DitherPlasmaCanvas />
        <div className="fw-hero-vignette" aria-hidden="true" />
        <div className="fw-container fw-coda-hero-inner">
          <p className="fw-eyebrow">
            <span />
            FINWORKSHOP · HỆ THỐNG QUẢN TRỊ XƯỞNG &amp; TÀI CHÍNH
          </p>
          <h1 className="fw-hero-display">
            <span className="fw-line fw-line-1">
              <span className="fw-line-inner">Vận hành xưởng.</span>
            </span>
            <span className="fw-line fw-line-2">
              <span className="fw-line-inner">Kiểm soát</span>
            </span>
            <span className="fw-line fw-line-3">
              <span className="fw-line-inner">
                <em>Tài chính.</em>
              </span>
            </span>
          </h1>
          <div className="fw-hero-footer-bar">
            <div>
              <p className="fw-hero-sub">
                Một hồ sơ xuyên suốt từ báo giá định mức BOM, lệnh sản xuất, xuất kho vật tư đến hóa đơn cấp mã CQT và đồng bộ lõi kế toán Odoo 16.
              </p>
              <div className="fw-scroll-cue">
                <span className="fw-scroll-dot" aria-hidden="true" />
                CUỘN XUỐNG ĐỂ KHÁM PHÁ CHUYỂN ĐỘNG HỆ THỐNG
              </div>
            </div>
            <div className="fw-action-row">
              <Link className="fw-btn fw-btn-primary" to="/demo">
                Trải nghiệm sản phẩm <ArrowRight size={15} />
              </Link>
              <Link className="fw-btn fw-btn-secondary" to="/san-pham">
                Xem phân hệ <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Scroll-Scrubbed Illuminating Lede */}
      <section className="fw-lede-section">
        <div className="fw-container">
          <p className="fw-lede-text" aria-label={ledeSentence}>
            {words.map((word, idx) => (
              <span key={`${word}-${idx}`} className="fw-lede-word">
                {word}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* 3. Pinned Scroll-Morphing Visual Showcase (Hình ảnh đổi mượt khi kéo lên xuống) */}
      <section className="fw-stage-section" aria-label="Không gian làm việc tương tác theo cuộn trang">
        <div className="fw-stage-pin">
          <div className="fw-container">
            <div className="fw-stage-header">
              <div>
                <p className="fw-eyebrow">
                  <span />
                  KHÔNG GIAN LÀM VIỆC · CUỘN ĐỂ CHUYỂN MÀN HÌNH
                </p>
                <h2 className="fw-section-title" data-scramble-text="Một bức tranh xuyên suốt.">
                  Một bức tranh xuyên suốt.
                </h2>
              </div>
              <Link className="fw-btn fw-btn-secondary" to="/demo">
                Mở bản dùng thử <ArrowUpRight size={15} />
              </Link>
            </div>

            <div className="fw-stage-grid">
              <div className="fw-stage-chapters" role="tablist" aria-label="Màn hình sản phẩm">
                <div className="fw-stage-rail" aria-hidden="true" />
                {stageSlides.map((slide, idx) => (
                  <button
                    key={slide.code}
                    type="button"
                    role="tab"
                    aria-selected={activeStage === idx}
                    className={`fw-stage-tab ${activeStage === idx ? 'is-active' : ''}`}
                    onClick={() => jumpToStage(idx)}
                  >
                    <span className="fw-stage-tab-code">{slide.code}</span>
                    <h3>{slide.title}</h3>
                    <p>{slide.copy}</p>
                  </button>
                ))}
              </div>

              <div className="fw-stage-viewport">
                <div className="fw-stage-chrome">
                  <span className="fw-stage-chrome-left">
                    <i />
                    <span>{stageSlides[activeStage].meta}</span>
                  </span>
                  <span>0{activeStage + 1} / 03 · SCROLL-SYNCED</span>
                </div>

                <div className="fw-stage-frame">
                  {stageSlides.map((slide, idx) => (
                    <div
                      key={slide.code}
                      className={`fw-stage-slide fw-stage-slide-${idx}`}
                      style={
                        !isDesktopPin
                          ? {
                              opacity: activeStage === idx ? 1 : 0,
                              transition: 'opacity 0.4s ease',
                              zIndex: activeStage === idx ? 3 : 1,
                            }
                          : { zIndex: idx + 1 }
                      }
                    >
                      <img src={slide.source} alt={slide.alt} width="1440" height="1028" />
                    </div>
                  ))}
                </div>

                <div className="fw-stage-caption">
                  <span>{stageSlides[activeStage].title}</span>
                  <Link className="fw-text-link" to="/demo">
                    Thao tác trực tiếp <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Convex Arc Module Carousel (Codapress Arc Signature) */}
      <section className="fw-arc-section">
        <div className="fw-container">
          <div className="fw-section-heading">
            <div>
              <p className="fw-eyebrow">
                <span />
                KIẾN TRÚC PHÂN HỆ · KÉO HOẶC BẤM ĐỂ XOAY
              </p>
              <h2 className="fw-section-title" data-scramble-text="Năm phân hệ cốt lõi.">
                Năm phân hệ cốt lõi.
              </h2>
            </div>
            <div className="fw-arc-controls">
              <button
                type="button"
                className="fw-arc-btn"
                aria-label="Phân hệ trước"
                onClick={() => setActiveArc((prev) => Math.max(0, prev - 1))}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                className="fw-arc-btn"
                aria-label="Phân hệ tiếp theo"
                onClick={() => setActiveArc((prev) => Math.min(arcModules.length - 1, prev + 1))}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div
            className="fw-arc-stage"
            onPointerDown={handleArcPointerDown}
            onPointerUp={handleArcPointerUp}
          >
            {arcModules.map((mod, i) => {
              const Icon = mod.icon;
              const isCenter = i === activeArc;
              return (
                <article
                  key={mod.code}
                  className={`fw-arc-card ${isCenter ? 'is-center' : ''}`}
                  onClick={() => setActiveArc(i)}
                >
                  <div>
                    <div className="fw-arc-card-top">
                      <span>{mod.code}</span>
                      <span>{mod.tag}</span>
                    </div>
                    <div className="fw-arc-card-icon">
                      <Icon size={22} strokeWidth={1.6} />
                    </div>
                    <h3>{mod.title}</h3>
                    <p>{mod.copy}</p>
                  </div>
                  <div className="fw-arc-card-foot">
                    <span>{isCenter ? 'Đang chọn' : 'Xem chi tiết'}</span>
                    <Link
                      to={mod.to}
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      Mở <ArrowUpRight size={14} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. 1px Architectural Wireframe Workflow Grid */}
      <section className="fw-section">
        <div className="fw-container">
          <div className="fw-section-heading">
            <div>
              <p className="fw-eyebrow">
                <span />
                QUY TRÌNH LIÊN KẾT · 01 → 04
              </p>
              <h2 className="fw-section-title" data-scramble-text="Hồ sơ có nguồn đối chiếu.">
                Hồ sơ có nguồn đối chiếu.
              </h2>
            </div>
            <Link className="fw-btn fw-btn-secondary" to="/san-pham">
              Tất cả phân hệ <ArrowRight size={15} />
            </Link>
          </div>

          <div className="fw-wireframe-grid">
            {wireframeSteps.map((step) => (
              <article key={step.code} className="fw-wire-card">
                <div className="fw-wire-art" aria-hidden="true">
                  {step.svg}
                </div>
                <h3>
                  {step.code} · {step.title}
                </h3>
                <p>{step.copy}</p>
                <Link className="fw-text-link" to={step.to}>
                  Tìm hiểu quy trình <ArrowUpRight size={13} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Bidirectional Parallax Feature Split */}
      <section className="fw-section">
        <div className="fw-container fw-parallax-feature">
          <div className="fw-parallax-media">
            <div className="fw-parallax-inner">
              <img
                src="/media/finworkshop-invoices.png"
                alt="Đối chiếu hóa đơn, mã CQT và công nợ trên FinWorkshop"
                width="1440"
                height="1028"
              />
            </div>
            <div className="fw-parallax-overlay" aria-hidden="true" />
            <span className="fw-parallax-badge">
              <Layers size={12} style={{ display: 'inline', marginRight: 6, verticalAlign: '-1px' }} />
              HYBRID ERP · ODOO 16 + CỔNG THUẾ CQT
            </span>
          </div>

          <div className="fw-feature-copy">
            <p className="fw-eyebrow">
              <span />
              TÀI CHÍNH &amp; ĐỐI SOÁT HAI CHIỀU
            </p>
            <h2 data-scramble-text="Mọi khoản tiền đều có chứng từ gốc.">
              Mọi khoản tiền đều có chứng từ gốc.
            </h2>
            <p>
              Phân tách rõ hóa đơn mua vào và bán ra, phân bổ phiếu thu chi cho từng đợt thanh toán, cấp Mã CQT để tra cứu đối chiếu trên Cổng Hóa đơn Điện tử và đồng bộ sổ cái sang Odoo 16.
            </p>
            <ul className="fw-feature-list">
              <li>
                <Check size={15} />
                Phân quyền rõ 4 vai trò: Chủ xưởng, Kế toán, Thủ kho, Thợ xưởng
              </li>
              <li>
                <Check size={15} />
                Cấp mã Cơ quan Thuế (Mã CQT) và tra cứu độc lập tức thì
              </li>
              <li>
                <Check size={15} />
                Khóa kỳ kế toán và lưu nhật ký kiểm toán mọi thao tác
              </li>
            </ul>
            <div className="fw-action-row">
              <Link className="fw-btn fw-btn-primary" to="/demo">
                Thử ngay dữ liệu mẫu <ArrowRight size={15} />
              </Link>
              <Link className="fw-text-link" to="/giai-phap/ke-toan">
                Xem giải pháp kế toán <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="fw-section">
        <div className="fw-container fw-faq">
          <div>
            <p className="fw-eyebrow">
              <span />
              THÔNG TIN CẦN BIẾT
            </p>
            <h2 className="fw-section-title" data-scramble-text="Trước khi bắt đầu.">
              Trước khi bắt đầu.
            </h2>
            <p className="fw-section-summary">
              Phạm vi hoạt động hiện tại của sản phẩm và cách trải nghiệm nhanh các phân hệ.
            </p>
            <Link className="fw-text-link" to="/tai-lieu">
              Đọc hướng dẫn sử dụng <ArrowRight size={15} />
            </Link>
          </div>
          <div className="fw-faq-list">
            {questions.map(([question, answer], i) => (
              <div key={question}>
                <h3>
                  <button
                    type="button"
                    id={'fw-faq-' + i}
                    aria-expanded={faq === i}
                    aria-controls={'fw-answer-' + i}
                    onClick={() => setFaq(faq === i ? null : i)}
                  >
                    {question}
                    <ChevronDown size={18} className={faq === i ? 'fw-rotated' : ''} />
                  </button>
                </h3>
                <div id={'fw-answer-' + i} aria-labelledby={'fw-faq-' + i} hidden={faq !== i}>
                  <p>{answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
