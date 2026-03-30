import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Menu, X, Radio, MessageSquare, ShoppingBag, Mic, Podcast } from 'lucide-react';
import { useOptionalAuth } from '@/contexts/AuthContext';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { user } = useOptionalAuth();
  
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const navItems = [
    { href: '/', label: 'Live Radio', icon: Radio },
    { href: '/shop', label: 'Shop', icon: ShoppingBag },
    { href: '/programme', label: 'Programme', icon: Mic },
    { href: '/podcasts', label: 'Podcasts', icon: Podcast },
    { href: '/contact', label: 'Contact us', icon: MessageSquare },
  ] as const;
  
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--gp-border-gold)] bg-[rgba(6,13,26,0.85)] backdrop-blur-[12px]">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <Link href="/" className="flex items-center gap-3 no-underline">
              <span className="hidden sm:inline">
                <span className="flex flex-col gap-0.5" aria-hidden="true">
                  <span className="h-1.5 w-7 rounded-full bg-[#4A6F94]" />
                  <span className="h-1.5 w-7 rounded-full bg-[#4A6F94]/80" />
                  <span className="h-1.5 w-7 rounded-full bg-[#E5534B]" />
                  <span className="h-1.5 w-7 rounded-full bg-[#4A6F94]" />
                </span>
              </span>
              <span className="font-gp-display text-[1.05rem] sm:text-[1.15rem] font-semibold tracking-[0.02em] text-white">
                Golden Pearl Radio Dubai
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
              {navItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "font-gp-sans text-[0.72rem] font-medium uppercase tracking-[0.1em]",
                      "flex items-center gap-2 px-4 py-2 rounded-[2px] transition-colors",
                      isActive
                        ? "bg-[var(--gp-gold)] text-[var(--gp-navy-deep)]"
                        : "text-[color:var(--gp-muted)] hover:text-[var(--gp-gold-bright)]",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              {user ? (
                <span className="hidden lg:inline font-gp-sans text-xs tracking-[0.08em] uppercase text-[color:var(--gp-subtle)]">
                  {user.email}
                </span>
              ) : null}

              <button
                onClick={toggleMobileMenu}
                className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-[2px] border border-[var(--gp-border-gold)] text-[color:var(--gp-muted)] hover:text-[var(--gp-gold-bright)] transition-colors"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-[var(--gp-border-gold)] bg-[rgba(6,13,26,0.92)] backdrop-blur-[12px]">
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-1" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-3 py-3 px-4 rounded-[2px] transition-colors",
                    "font-gp-sans text-xs uppercase tracking-[0.12em]",
                    isActive
                      ? "bg-[var(--gp-gold)] text-[var(--gp-navy-deep)]"
                      : "text-[color:var(--gp-muted)] hover:text-[var(--gp-gold-bright)] hover:bg-white/5",
                  ].join(" ")}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {user && (
              <div className="py-3 px-4 border-t border-[var(--gp-border-gold)] mt-2">
                <span className="font-gp-sans text-xs tracking-[0.1em] uppercase text-[color:var(--gp-subtle)]">
                  Signed in as {user.email}
                </span>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
