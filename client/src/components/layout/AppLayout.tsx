import { ReactNode } from 'react';
import AppNavbar from './Navbar';
import Footer from './Footer';
import { useLocation } from 'wouter';
import { useIntro } from '@/contexts/IntroContext';
import PublicMiniRadioCard from './PublicMiniRadioCard';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { introActive } = useIntro();
  const isAdminPage = location.startsWith('/admin');
  const isAuthPage = location === '/login' || location === '/signup' || location === '/reset-password';
  const isHomePage = location === '/';
  const isPublicDesignRoute =
    location === '/' ||
    location === '/store' ||
    location === '/shop' ||
    location === '/contact' ||
    location === '/news' ||
    location.startsWith('/programme') ||
    location.startsWith('/podcasts') ||
    location.startsWith('/shop/') ||
    location.startsWith('/store/');
  const showPublicMiniPlayer =
    !isAdminPage &&
    !isAuthPage &&
    !isHomePage &&
    (location === '/contact' ||
      location === '/news' ||
      location.startsWith('/podcasts') ||
      location.startsWith('/programme') ||
      location.startsWith('/store') ||
      location.startsWith('/shop'));
  const hideChrome = !isAdminPage && !isAuthPage && introActive;

  return (
    <div className={["flex flex-col min-h-screen", isPublicDesignRoute ? "aurora-bg" : "bg-transparent"].join(" ")}>
      {!isAdminPage && !isAuthPage && (
        <div className={hideChrome ? 'invisible pointer-events-none' : undefined}>
          <AppNavbar />
        </div>
      )}

      <main className="flex-grow px-4 md:px-0 pt-4 lg:pt-0">
        {children}
      </main>

      {!isAdminPage && !isAuthPage && (
        <div className={hideChrome ? 'invisible pointer-events-none' : undefined}>
          <Footer variant={isPublicDesignRoute ? "public-ocean" : "default"} />
        </div>
      )}

      {showPublicMiniPlayer && <PublicMiniRadioCard />}
    </div>
  );
}
