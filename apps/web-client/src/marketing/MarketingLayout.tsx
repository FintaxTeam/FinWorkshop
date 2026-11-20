import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useAuth } from '../auth';
import './marketing.css';

gsap.registerPlugin(ScrollTrigger);

const titles: Record<string, string> = {
  '/': 'Quản trị sản xuất và tài chính',
  '/san-pham': 'Nền tảng FinWorkshop',
  '/giai-phap/san-xuat': 'Giải pháp cho xưởng sản xuất',
  '/giai-phap/ke-toan': 'Giải pháp tài chính và kế toán',
  '/trien-khai': 'Phạm vi và triển khai',
  '/tai-lieu': 'Hướng dẫn sử dụng',
  '/lien-he': 'Liên hệ và yêu cầu tư vấn',
  '/demo': 'Trải nghiệm sản phẩm',
  '/bao-mat': 'Dữ liệu và bảo mật',
  '/dieu-khoan': 'Điều khoản sử dụng',
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [isPill, setIsPill] = useState(false);

  const siteRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const solutions = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const solutionsButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setSolutionsOpen(false);
    window.scrollTo(0, 0);
    document.title = (titles[pathname] || 'Sản phẩm') + ' | FinWorkshop';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'FinWorkshop kết nối báo giá, sản xuất, kho và tài chính trong cùng hệ thống. Tìm hiểu chức năng, phạm vi triển khai và trải nghiệm ứng dụng.'
      );
  }, [pathname]);

  // Bidirectional Scroll-Scrubbed Morphing Pill Header (Codapress signature)
  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const mm = gsap.matchMedia();
    mm.add('(min-width: 961px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.set(header, {
        width: 'min(1260px, 100%)',
        borderRadius: '0px',
        backgroundColor: 'rgba(255, 255, 255, 0)',
        backdropFilter: 'blur(0px)',
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: document.documentElement,
          start: 'top top',
          end: '+=320',
          scrub: 0.35,
          onUpdate: (self) => {
            setIsPill(self.progress > 0.45);
          },
        },
      });

      tl.to(header, {
        width: '740px',
        borderRadius: '999px',
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(14px)',
        ease: 'none',
      });
    });

    mm.add('(max-width: 960px)', () => {
      const trigger = ScrollTrigger.create({
        trigger: document.documentElement,
        start: 'top -40',
        onEnter: () => {
          setIsPill(true);
          gsap.to(header, {
            borderRadius: '999px',
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            duration: 0.25,
          });
        },
        onLeaveBack: () => {
          setIsPill(false);
          gsap.to(header, {
            borderRadius: '0px',
            backgroundColor: 'rgba(255, 255, 255, 0)',
            backdropFilter: 'blur(0px)',
            duration: 0.25,
          });
        },
      });
      return () => trigger.kill();
    });

    return () => {
      setIsPill(false);
      mm.revert();
    };
  }, [pathname]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (solutionsOpen) {
        setSolutionsOpen(false);
        solutionsButton.current?.focus();
      }
      if (mobileOpen) {
        setMobileOpen(false);
        menuButton.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (solutions.current && !solutions.current.contains(event.target as Node)) setSolutionsOpen(false);
    };
    window.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [mobileOpen, solutionsOpen]);

  return (
    <div ref={siteRef} className="fw-site">
      <a className="fw-skip" href="#fw-content">
        Đến nội dung chính
      </a>
      <div className="fw-header-wrap">
        <header ref={headerRef} className={`fw-header ${isPill ? 'is-pill' : ''}`}>
          <Link className="fw-brand" to="/" aria-label="FinWorkshop - Trang chủ">
            <span className="fw-brand-mark">
              <img src="/fintax-icon.png" alt="" width="24" height="24" />
            </span>
            <span className="fw-brand-text">
              <strong>FinWorkshop</strong>
              <small>FINANCE &amp; OPERATIONS</small>
            </span>
          </Link>

          <nav className="fw-desktop-nav" aria-label="Điều hướng chính">
            <NavLink to="/san-pham">Sản phẩm</NavLink>
            <div className="fw-nav-disclosure" ref={solutions}>
              <button
                type="button"
                ref={solutionsButton}
                aria-expanded={solutionsOpen}
                aria-controls="fw-solutions-menu"
                className={pathname.startsWith('/giai-phap') ? 'active' : ''}
                onClick={() => setSolutionsOpen((v) => !v)}
              >
                Giải pháp <ChevronDown size={13} aria-hidden="true" />
              </button>
              {solutionsOpen && (
                <div id="fw-solutions-menu" className="fw-nav-dropdown">
                  <Link to="/giai-phap/san-xuat">
                    <strong>Sản xuất &amp; kho</strong>
                    <span>Báo giá, định mức và thực hiện đơn hàng</span>
                  </Link>
                  <Link to="/giai-phap/ke-toan">
                    <strong>Tài chính &amp; kế toán</strong>
                    <span>Chứng từ, công nợ và đối chiếu số liệu</span>
                  </Link>
                </div>
              )}
            </div>
            <NavLink to="/trien-khai">Triển khai</NavLink>
            <NavLink to="/tai-lieu">Tài liệu</NavLink>
          </nav>

          <div className="fw-header-actions">
            <Link className="fw-login" to={user ? '/app' : '/login'}>
              {user ? 'Vào app' : 'Đăng nhập'}
            </Link>
            <Link className="fw-btn fw-btn-primary fw-header-demo" to="/demo">
              Demo <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <button
              ref={menuButton}
              type="button"
              className="fw-menu-toggle"
              aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={mobileOpen}
              aria-controls="fw-mobile-menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>
      </div>

      {mobileOpen && (
        <nav id="fw-mobile-menu" className="fw-mobile-nav" aria-label="Điều hướng di động">
          <Link to="/san-pham">Sản phẩm</Link>
          <Link to="/giai-phap/san-xuat">Giải pháp sản xuất &amp; kho</Link>
          <Link to="/giai-phap/ke-toan">Giải pháp tài chính &amp; kế toán</Link>
          <Link to="/trien-khai">Triển khai</Link>
          <Link to="/tai-lieu">Tài liệu</Link>
          <Link to="/lien-he">Liên hệ</Link>
          <Link to="/demo" className="fw-mobile-primary">
            Trải nghiệm sản phẩm <ArrowRight size={16} />
          </Link>
        </nav>
      )}

      <main id="fw-content">{children}</main>

      <section className="fw-bottom-cta">
        <div className="fw-container fw-bottom-cta-inner">
          <div>
            <p className="fw-eyebrow">
              <span />
              BƯỚC TIẾP THEO
            </p>
            <h2>Xem cách FinWorkshop vận hành trên dữ liệu xưởng thực tế.</h2>
          </div>
          <div className="fw-action-row">
            <Link className="fw-btn fw-btn-primary" to="/demo">
              Mở bản trải nghiệm <ArrowRight size={15} />
            </Link>
            <Link className="fw-btn fw-btn-secondary" to="/lien-he">
              Trao đổi nhu cầu
            </Link>
          </div>
        </div>
      </section>

      <footer className="fw-footer">
        <div className="fw-container fw-footer-grid">
          <div className="fw-footer-intro">
            <Link className="fw-brand" to="/">
              <span className="fw-brand-mark">
                <img src="/fintax-icon.png" alt="" width="24" height="24" />
              </span>
              <span className="fw-brand-text" style={{ maxWidth: 200, opacity: 1 }}>
                <strong>FinWorkshop</strong>
                <small>BY FINTAX AUTOMATION</small>
              </span>
            </Link>
            <p>
              Nền tảng kết nối vận hành xưởng
              <br />
              với dữ liệu tài chính và kế toán.
            </p>
            <span className="fw-footer-edition">Phiên bản trình diễn</span>
          </div>
          <div>
            <h3>Sản phẩm</h3>
            <Link to="/san-pham">Chức năng nền tảng</Link>
            <Link to="/demo">Trải nghiệm ứng dụng</Link>
            <Link to="/trien-khai">Phạm vi triển khai</Link>
          </div>
          <div>
            <h3>Giải pháp</h3>
            <Link to="/giai-phap/san-xuat">Sản xuất &amp; kho</Link>
            <Link to="/giai-phap/ke-toan">Tài chính &amp; kế toán</Link>
            <Link to="/tai-lieu">Hướng dẫn sử dụng</Link>
          </div>
          <div>
            <h3>Thông tin</h3>
            <Link to="/lien-he">Liên hệ</Link>
            <Link to="/bao-mat">Dữ liệu &amp; bảo mật</Link>
            <Link to="/dieu-khoan">Điều khoản sử dụng</Link>
          </div>
        </div>
        <div className="fw-container fw-footer-bottom">
          <span>© {new Date().getFullYear()} FinTax Automation. All rights reserved.</span>
          <span>Chưa phát hành hóa đơn, ký số hoặc kết nối ngân hàng thật.</span>
        </div>
      </footer>
    </div>
  );
}
