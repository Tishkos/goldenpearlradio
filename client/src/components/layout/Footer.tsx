import { Link } from 'wouter';
import { Facebook, Instagram, Twitter, Youtube, MapPin, Mail, Phone, Plus, Radio, Archive, Headphones, Newspaper, CalendarDays, Podcast } from 'lucide-react';
import { useOptionalAuth } from '@/contexts/AuthContext';

interface FooterProps {
  variant?: "default" | "public-ocean";
}

export default function Footer({ variant = "default" }: FooterProps) {
  const { user } = useOptionalAuth();
  const isPublicOcean = variant === "public-ocean";

  // Check if user is admin - user object already has isAdmin property from AuthContext
  const isAdmin = user?.isAdmin || false;

  return (
    <footer
      className={[
        "relative z-10",
        isPublicOcean
          ? "border-t border-white/15 bg-[linear-gradient(180deg,#cc6128_0%,#d2682f_100%)]"
          : "border-t border-[var(--gp-border-gold)] bg-[color:var(--gp-navy-deepest)]",
      ].join(" ")}
    >
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="min-h-[24px] flex items-end mb-4">
              <div className={["font-gp-brand text-[1.08rem] sm:text-[1.15rem] font-semibold tracking-[0.05em]", isPublicOcean ? "text-white" : "text-[var(--gp-gold-bright)]"].join(" ")}>
                Golden Pearl Radio
              </div>
            </div>
            <p className={["font-gp-serif text-[0.98rem] italic leading-relaxed", isPublicOcean ? "text-white/90" : "text-[color:var(--gp-white)]/90"].join(" ")}>
              The ultimate audio companion for your Dubai and Tbilisi experience.
            </p>
            <div className="flex gap-2.5 mt-4">
              <a
                href="#"
                className={[
                  "h-8 w-8 grid place-items-center rounded-[2px] transition-colors",
                  isPublicOcean
                    ? "border border-white/35 text-white hover:bg-white/25 hover:border-white/45 hover:text-white backdrop-blur-sm"
                    : "border border-[var(--gp-border-gold)] text-[color:var(--gp-gold-dim)] hover:bg-[var(--gp-gold)] hover:text-[var(--gp-navy-deep)] hover:border-[var(--gp-gold)]",
                ].join(" ")}
                aria-label="Facebook"
              >
                <Facebook size={18} />
              </a>
              <a
                href="#"
                className={[
                  "h-8 w-8 grid place-items-center rounded-[2px] transition-colors",
                  isPublicOcean
                    ? "border border-white/35 text-white hover:bg-white/25 hover:border-white/45 hover:text-white backdrop-blur-sm"
                    : "border border-[var(--gp-border-gold)] text-[color:var(--gp-gold-dim)] hover:bg-[var(--gp-gold)] hover:text-[var(--gp-navy-deep)] hover:border-[var(--gp-gold)]",
                ].join(" ")}
                aria-label="Instagram"
              >
                <Instagram size={18} />
              </a>
              <a
                href="#"
                className={[
                  "h-8 w-8 grid place-items-center rounded-[2px] transition-colors",
                  isPublicOcean
                    ? "border border-white/35 text-white hover:bg-white/25 hover:border-white/45 hover:text-white backdrop-blur-sm"
                    : "border border-[var(--gp-border-gold)] text-[color:var(--gp-gold-dim)] hover:bg-[var(--gp-gold)] hover:text-[var(--gp-navy-deep)] hover:border-[var(--gp-gold)]",
                ].join(" ")}
                aria-label="X"
              >
                <Twitter size={18} />
              </a>
              <a
                href="#"
                className={[
                  "h-8 w-8 grid place-items-center rounded-[2px] transition-colors",
                  isPublicOcean
                    ? "border border-white/35 text-white hover:bg-white/25 hover:border-white/45 hover:text-white backdrop-blur-sm"
                    : "border border-[var(--gp-border-gold)] text-[color:var(--gp-gold-dim)] hover:bg-[var(--gp-gold)] hover:text-[var(--gp-navy-deep)] hover:border-[var(--gp-gold)]",
                ].join(" ")}
                aria-label="YouTube"
              >
                <Youtube size={18} />
              </a>
            </div>
          </div>

          <div>
            <div className="min-h-[24px] flex items-end mb-4">
              <div className={["font-gp-sans text-[0.65rem] uppercase tracking-[0.25em]", isPublicOcean ? "text-white/90" : "text-[var(--gp-gold-bright)]"].join(" ")}>
                Quick Links
              </div>
            </div>
            <ul className="space-y-2.5">
              <li>
                <Link href="/" className={["flex items-center gap-2 text-[0.95rem] transition-colors", isPublicOcean ? "text-white/90 hover:text-white" : "text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)]"].join(" ")}>
                  <Radio className="h-4 w-4" />
                  <span>Live Radio</span>
                </Link>
              </li>
              <li>
                <Link href="/shop" className={["flex items-center gap-2 text-[0.95rem] transition-colors", isPublicOcean ? "text-white/90 hover:text-white" : "text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)]"].join(" ")}>
                  <Archive className="h-4 w-4" />
                  <span>Shop</span>
                </Link>
              </li>
              <li>
                <Link href="/news" className={["flex items-center gap-2 text-[0.95rem] transition-colors", isPublicOcean ? "text-white/90 hover:text-white" : "text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)]"].join(" ")}>
                  <Newspaper className="h-4 w-4" />
                  <span>News</span>
                </Link>
              </li>
              <li>
                <Link href="/programme" className={["flex items-center gap-2 text-[0.95rem] transition-colors", isPublicOcean ? "text-white/90 hover:text-white" : "text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)]"].join(" ")}>
                  <CalendarDays className="h-4 w-4" />
                  <span>Programme</span>
                </Link>
              </li>
              <li>
                <Link href="/podcasts" className={["flex items-center gap-2 text-[0.95rem] transition-colors", isPublicOcean ? "text-white/90 hover:text-white" : "text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)]"].join(" ")}>
                  <Podcast className="h-4 w-4" />
                  <span>Podcasts</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className={["flex items-center gap-2 text-[0.95rem] transition-colors", isPublicOcean ? "text-white/90 hover:text-white" : "text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)]"].join(" ")}>
                  <Headphones className="h-4 w-4" />
                  <span>Business</span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="min-h-[24px] flex items-end mb-4">
              <div className={["font-gp-sans text-[0.65rem] uppercase tracking-[0.25em]", isPublicOcean ? "text-white/90" : "text-[var(--gp-gold-bright)]"].join(" ")}>
                Contact Us
              </div>
            </div>
            <div className={["space-y-2.5 text-[0.95rem]", isPublicOcean ? "text-white" : "text-[color:var(--gp-white)]"].join(" ")}>
              <div className="flex items-start gap-2">
                <MapPin className={["h-4 w-4 mt-1", isPublicOcean ? "text-white/80" : "text-[color:var(--gp-gold-dim)]"].join(" ")} />
                <span>Dubai and Tbilisi</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className={["h-4 w-4", isPublicOcean ? "text-white/80" : "text-[color:var(--gp-gold-dim)]"].join(" ")} />
                <span>info@goldenpearlradio.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className={["h-4 w-4", isPublicOcean ? "text-white/80" : "text-[color:var(--gp-gold-dim)]"].join(" ")} />
                <span>+36 70 406 6713</span>
              </div>
              <p className={["font-gp-serif italic text-[0.95rem] mt-2.5", isPublicOcean ? "text-white/90" : "text-[color:var(--gp-white)]/90"].join(" ")}>
                An independent media project by Daniel Astudillo Estrella
              </p>
            </div>
          </div>
        </div>

        <div className={["mt-10 pt-5 flex flex-col md:flex-row items-center justify-between gap-4", isPublicOcean ? "border-t border-white/20" : "border-t border-[var(--gp-border-gold)]"].join(" ")}>
          <span className={["font-gp-sans text-[0.7rem] uppercase tracking-[0.12em]", isPublicOcean ? "text-white/90" : "text-[color:var(--gp-white)]/90"].join(" ")}>
            &copy; 2026 Golden Pearl Radio Dubai and Tbilisi. All rights reserved.
          </span>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                href="/admin"
                className={[
                  "inline-flex items-center gap-2 px-4 py-2 rounded-[2px] font-gp-sans text-[0.65rem] uppercase tracking-[0.12em] transition-colors",
                  isPublicOcean
                    ? "border border-white/35 text-white hover:bg-white/25 hover:border-white/45 hover:text-white backdrop-blur-sm"
                    : "border border-[var(--gp-border-gold)] text-[color:var(--gp-muted)] hover:bg-[var(--gp-gold)] hover:text-[var(--gp-navy-deep)] hover:border-[var(--gp-gold)]",
                ].join(" ")}
              >
                <Plus className="h-4 w-4" />
                Admin Dashboard
              </Link>
            )}
            <span className={["font-gp-sans text-[0.7rem] uppercase tracking-[0.2em]", isPublicOcean ? "text-white/90" : "text-[color:var(--gp-white)]/90"].join(" ")}>
              Dubai and Tbilisi
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
