import React, { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import PlayerDock from "@/components/player/PlayerDock";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Podcasts from "@/pages/podcasts/index";
import Contact from "@/pages/Contact";
import News from "@/pages/News";
import NewsDetailPage from "@/pages/NewsDetail";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ResetPassword from "@/pages/ResetPassword";
import AdminDashboard from "@/pages/admin/index";
import TermsOfUse from "@/pages/TermsOfUse";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import ProductPage from "@/pages/store/ProductPage";
import StorePage from "@/pages/store";
import AppLayout from "@/components/layout/AppLayout";
import { IntroScreen, getStoredIntroId } from "@/components/intros";
import { IntroProvider } from "@/contexts/IntroContext";
import { PublicRadioProvider } from "@/contexts/PublicRadioContext";
import ProgrammePage from "@/pages/programme";
import PromotionDetailPage from "@/pages/PromotionDetail";

/** When user lands on home ("/") and a today's intro is set, show intro as overlay (same page/background); navbar, player, footer are hidden until intro finishes. Shows again on every load/refresh. */
function IntroGate({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [introDone, setIntroDone] = useState(false);
  const introId = getStoredIntroId();

  // Intro animation disabled for now – set to true to show again: (location === "/" && introId && !introDone)
  const showIntro = false;

  return (
    <IntroProvider value={{ introActive: showIntro }}>
      {children}
      {showIntro && introId && (
        <div className="fixed inset-0 z-[100]" aria-hidden="true">
          <IntroScreen id={introId} onFinish={() => setIntroDone(true)} />
        </div>
      )}
    </IntroProvider>
  );
}

// Protected Route Component for Admin pages
function ProtectedRoute({ component: Component, requireAdmin = true, ...rest }: { component: React.ComponentType<any>, path: string, requireAdmin?: boolean }) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (requireAdmin && user) {
      // Check isAdmin status from user object
      if (!user.isAdmin) {
        // Not an admin, redirect to home
        console.log('Access denied: User is not an admin');
        window.location.href = '/';
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
      }
    } else if (!requireAdmin) {
      setIsAdmin(true); // No admin check needed
    }
  }, [user, requireAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-radio-orange mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to login if not authenticated
    window.location.href = '/login';
    return null;
  }

  // Check if admin access is required

  if (requireAdmin && isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-radio-orange mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return null; // Will redirect in the useEffect
  }

  return <Route {...rest} component={Component} />;
}

function Router() {
  return (
    <Switch>
      {/* Auth routes */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Main routes */}
      <Route path="/" component={Home} />
      <Route path="/programme" component={ProgrammePage} />
      <Route path="/programme/:rest*" component={ProgrammePage} />
      <Route path="/podcasts" component={Podcasts} />
      <Route path="/podcasts/:rest*" component={Podcasts} />
      <Route path="/contact" component={Contact} />
      <Route path="/promotions/:id" component={PromotionDetailPage} />
      <Route path="/news/:id" component={NewsDetailPage} />
      <Route path="/news" component={News} />
      <Route path="/terms-of-use" component={TermsOfUse} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/store" component={StorePage} />
      <Route path="/shop" component={StorePage} />
      <Route path="/store/product/:id" component={ProductPage} />
      <Route path="/shop/product/:id" component={ProductPage} />

  {/* Admin routes - handled internally by AdminDashboard component */}
  <ProtectedRoute path="/admin" component={AdminDashboard} />
  <ProtectedRoute path="/admin/*" component={AdminDashboard} />

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

const localQueryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={localQueryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <PlayerProvider>
              <IntroGate>
                <PublicRadioProvider>
                  <AppLayout>
                    <Router />
                  </AppLayout>
                </PublicRadioProvider>
                <PlayerDock />
              </IntroGate>
              <Toaster />
            </PlayerProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
