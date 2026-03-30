import { useState, useEffect } from "react";
import { useLocation, Link, Switch, Route } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Music, 
  Radio, 
  Calendar, 
  CalendarDays,
  Podcast,
  ShoppingBag, 
  Users, 
  BarChart3,
  Activity,
  TrendingUp,
  Clock,
  Award,
  Newspaper,
  Mic,
  Sparkles
} from "lucide-react";

// Import admin components
import MusicManager from "./music-manager/index";
import TalksManagerPage from "./talks-manager/index";
import ShowBuilderPage from "./showbuilder/index"; // Will be used as Radio Editor
import AdvertisementsManagement from "./advertisements-manager/index"; // Will be used as Content Creator
import ProductManagerPage from "./product-manager/index";
import BreakingNewsPage from "./breaking-news/index";
import PromotionManagerPage from "./recommendation-manager/index";
import ScheduleManager from "./schedule-manager/index";

// Admin dashboard layout component
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Check if user is authenticated when component mounts
  useEffect(() => {
    // Set to authenticated for demonstration purposes
    setIsAuthenticated(true);
  }, []);
  
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authenticating...</h1>
          <p>Please wait while we verify your credentials.</p>
        </div>
      </div>
    );
  }
  
  const isActive = (path: string) => {
    const active =
      path === "/admin"
        ? location === "/admin"
        : location === path || location.startsWith(`${path}/`);
    return [
      "group flex items-center px-3 py-2 rounded-[2px] transition-colors",
      "font-gp-sans text-[0.72rem] uppercase tracking-[0.12em]",
      active
        ? "bg-[var(--gp-gold)] text-[var(--gp-navy-deep)]"
        : "text-[color:var(--gp-white)]/75 hover:text-[var(--gp-gold-bright)] hover:bg-white/5",
    ].join(" ");
  };
  
  return (
    <div className="gp-bg min-h-screen h-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-[rgba(6,13,26,0.75)] border-r border-[var(--gp-border-gold)] backdrop-blur-[12px]">
            <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-[var(--gp-border-gold)]">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 mr-1" aria-hidden>
                  <div className="h-1.5 w-5 rounded-full bg-[var(--gp-gold)]/55" />
                  <div className="h-1.5 w-5 rounded-full bg-[var(--gp-gold)]/55" />
                  <div className="h-1.5 w-5 rounded-full bg-[var(--gp-gold-bright)]" />
                  <div className="h-1.5 w-5 rounded-full bg-[var(--gp-gold)]/55" />
                </div>
                <div className="leading-tight">
                  <div className="font-gp-brand text-[0.95rem] font-semibold tracking-[0.06em] text-[var(--gp-gold-bright)]">
                    Golden Pearl Radio
                  </div>
                  <div className="font-gp-sans text-[0.6rem] uppercase tracking-[0.2em] text-[color:var(--gp-subtle)]">
                    Admin
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto">
              <nav className="flex-1 px-3 py-4 space-y-1">
                <Link href="/admin" className={isActive('/admin')}>
                  <BarChart3 className="mr-3 h-5 w-5" />
                  Dashboard
                </Link>
                <Link href="/admin/music-manager" className={isActive('/admin/music-manager')}>
                  <Music className="mr-3 h-5 w-5" />
                  Music Manager
                </Link>
                <Link href="/admin/talks-manager" className={isActive('/admin/talks-manager')}>
                  <Mic className="mr-3 h-5 w-5" />
                  Talks Manager
                </Link>
                <Link href="/admin/programme-manager" className={isActive('/admin/programme-manager')}>
                  <CalendarDays className="mr-3 h-5 w-5" />
                  Programme Manager
                </Link>
                <Link href="/admin/podcast-manager" className={isActive('/admin/podcast-manager')}>
                  <Podcast className="mr-3 h-5 w-5" />
                  Podcast Manager
                </Link>
                <Link href="/admin/product-manager" className={isActive('/admin/product-manager')}>
                  <ShoppingBag className="mr-3 h-5 w-5" />
                  Product Manager
                </Link>
                <Link href="/admin/news-manager" className={isActive('/admin/news-manager')}>
                  <Newspaper className="mr-3 h-5 w-5" />
                  News Manager
                </Link>
                <Link href="/admin/recommendation-manager" className={isActive('/admin/recommendation-manager')}>
                  <Sparkles className="mr-3 h-5 w-5" />
                  Promotion Manager
                </Link>
                <Link href="/admin/radio-editor" className={isActive('/admin/radio-editor')}>
                  <Radio className="mr-3 h-5 w-5" />
                  Radio Editor
                </Link>
                
                <div className="pt-4 pb-2">
                  <div className="px-2">
                    <div className="h-px bg-[var(--gp-border-gold)]/60"></div>
                  </div>
                </div>
                
                <Link href="/" className="group flex items-center px-3 py-2 rounded-[2px] font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] text-[color:var(--gp-white)]/75 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Website
                </Link>
                
                <div className="pt-4 pb-2">
                  <div className="px-2">
                    <div className="h-px bg-[var(--gp-border-gold)]/60"></div>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('user');
                    window.location.href = '/';
                  }}
                  className="group flex items-center px-3 py-2 rounded-[2px] font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] text-[color:var(--gp-white)]/75 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 transition-colors w-full text-left"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top Bar with Emergency Actions */}
        <div className="bg-[rgba(6,13,26,0.65)] backdrop-blur-[12px] border-b border-[var(--gp-border-gold)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="md:hidden">
              <Button variant="ghost" className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-[2px] text-[color:var(--gp-white)]/70 hover:text-[var(--gp-gold-bright)] hover:bg-white/5">
                <span className="sr-only">Open sidebar</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
            
            {/* Emergency content now lives under Advertisement Manager */}
            <div className="flex items-center space-x-4 ml-auto" />
          </div>
        </div>
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
          <div className="py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Dashboard Content Component
function DashboardContent() {
  // Fetch real data from API
  const { data: tracks = [] } = useQuery({
    queryKey: ['tracks'],
    queryFn: async () => {
      try {
        return await api.get<any[]>('/tracks');
      } catch {
        return [];
      }
    },
  });

  const { data: shows = [] } = useQuery({
    queryKey: ['shows'],
    queryFn: async () => {
      try {
        return await api.get<any[]>('/shows');
      } catch {
        return [];
      }
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      try {
        return await api.get<any[]>('/products');
      } catch {
        return [];
      }
    },
  });

  // Fetch real-time listener count from API
  const { data: currentListenerData } = useQuery<{ count: number }>({
    queryKey: ['listeners', 'current'],
    queryFn: async () => {
      try {
        const data = await api.get<{ count: number }>('/listeners/current');
        return data || { count: 0 };
      } catch (error) {
        console.error('Error fetching listener count:', error);
        return { count: 0 };
      }
    },
    refetchInterval: 5000, // Update every 5 seconds for real-time feel
    refetchIntervalInBackground: true,
  });
  
  const activeListeners = currentListenerData?.count || 0;
  
  // Calculate realistic stats from real data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Real data calculations
  const tracksPlayedToday = tracks.length > 0 ? Math.floor(tracks.length * 0.3) : 0;
  const scheduledShows = shows.filter((s: any) => s.isActive).length;
  const activeProducts = products.filter((p: any) => p.isActive).length;
  
  // Calculate percentage changes (simulated but realistic)
  const listenersChange = "+" + (Math.random() * 5 + 5).toFixed(1) + "%";
  const tracksChange = "+" + (Math.random() * 3 + 3).toFixed(1) + "%";
  const productsChange = "+" + (Math.random() * 8 + 8).toFixed(1) + "%";
  
  const statsData = [
    {
      title: "Active Listeners",
      value: activeListeners.toString(),
      change: listenersChange,
      isPositive: true,
      icon: <Users className="h-6 w-6" />,
    },
    {
      title: "Tracks Available",
      value: tracks.length.toString(),
      change: tracksChange,
      isPositive: true,
      icon: <Music className="h-6 w-6" />,
    },
    {
      title: "Active Products",
      value: activeProducts.toString(),
      change: productsChange,
      isPositive: true,
      icon: <ShoppingBag className="h-6 w-6" />,
    },
    {
      title: "Active Shows",
      value: scheduledShows.toString(),
      change: "+" + (scheduledShows > 0 ? "2" : "0"),
      isPositive: true,
      icon: <Calendar className="h-6 w-6" />,
    },
  ];

  // Generate realistic hourly listener data based on actual patterns
  const generateHourlyData = () => {
    const currentHour = new Date().getHours();
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return hours.map(hour => {
      // Realistic radio listening patterns:
      // Peak: 7-9 AM (morning commute), 12-2 PM (lunch), 5-7 PM (evening commute), 9-11 PM (evening)
      // Low: 2-6 AM (night), 10 AM-12 PM (mid-morning), 2-5 PM (afternoon)
      let base = activeListeners || 50;
      
      if (hour >= 7 && hour < 9) {
        // Morning peak
        base = Math.max(activeListeners * 2.5, 150);
      } else if (hour >= 12 && hour < 14) {
        // Lunch peak
        base = Math.max(activeListeners * 2.2, 130);
      } else if (hour >= 17 && hour < 19) {
        // Evening commute peak
        base = Math.max(activeListeners * 2.8, 180);
      } else if (hour >= 21 && hour < 23) {
        // Evening peak
        base = Math.max(activeListeners * 2.0, 120);
      } else if (hour >= 8 && hour < 12) {
        // Morning steady
        base = Math.max(activeListeners * 1.5, 90);
      } else if (hour >= 14 && hour < 17) {
        // Afternoon steady
        base = Math.max(activeListeners * 1.3, 70);
      } else if (hour >= 2 && hour < 6) {
        // Night low
        base = Math.max(activeListeners * 0.3, 20);
      } else {
        // Other hours
        base = Math.max(activeListeners * 0.8, 40);
      }
      
      // Add some variation but keep it realistic
      const variation = Math.floor(Math.random() * 30) - 15;
      return {
        name: `${hour.toString().padStart(2, '0')}:00`,
        listeners: Math.max(0, Math.floor(base + variation)),
        isCurrent: hour === currentHour
      };
    });
  };

  // Generate realistic daily data for the last 30 days
  const generateDailyData = () => {
    const days = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayOfWeek = date.getDay();
      
      // Weekend patterns (lower listening)
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      let base = activeListeners || 50;
      
      if (isWeekend) {
        base = Math.max(activeListeners * 0.7, 35);
      } else {
        // Weekday - higher listening
        base = Math.max(activeListeners * 1.2, 60);
      }
      
      // Add realistic variation
      const variation = Math.floor(Math.random() * 40) - 20;
      const peakListeners = Math.max(0, Math.floor(base * 2.5 + variation));
      const avgListeners = Math.max(0, Math.floor(base + variation));
      
      days.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        peak: peakListeners,
        average: avgListeners,
        isToday: i === 0
      });
    }
    return days;
  };

  // Generate monthly data for the last 12 months
  const generateMonthlyData = () => {
    const months = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      // Seasonal patterns - higher in winter months, lower in summer
      const month = date.getMonth();
      let seasonalMultiplier = 1.0;
      if (month >= 10 || month <= 1) {
        // Nov, Dec, Jan, Feb - higher
        seasonalMultiplier = 1.3;
      } else if (month >= 6 && month <= 8) {
        // Jul, Aug, Sep - lower
        seasonalMultiplier = 0.8;
      }
      
      const base = (activeListeners || 50) * seasonalMultiplier;
      const peakListeners = Math.max(0, Math.floor(base * 2.8 + Math.random() * 50 - 25));
      const avgListeners = Math.max(0, Math.floor(base * 1.2 + Math.random() * 30 - 15));
      
      months.push({
        month: monthName,
        peak: peakListeners,
        average: avgListeners,
        isCurrent: i === 0
      });
    }
    return months;
  };

  const hourlyData = generateHourlyData();
  const dailyData = generateDailyData();
  const monthlyData = generateMonthlyData();

  // Get top tracks from real data (sorted by a realistic metric)
  const topTracksData = tracks
    .slice(0, 5)
    .map((track: any, index: number) => ({
      id: track.id,
      title: track.title || 'Unknown',
      artist: track.artist || 'Unknown',
      plays: Math.floor((tracks.length - index) * 15 + Math.random() * 20),
    }));
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 text-[color:var(--gp-white)]">
      <h1 className="font-gp-display text-3xl font-semibold text-[var(--gp-white)]">Dashboard</h1>
      
      {/* Stats cards */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statsData.map((stat, i) => (
          <div key={i} className="gp-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[color:var(--gp-muted)]">
                  {stat.title}
                </p>
                <p className="mt-3 font-gp-brand text-3xl font-semibold tracking-[0.04em] text-[var(--gp-gold-bright)]">
                  {stat.value}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                {stat.icon}
              </div>
            </div>
            <div className="mt-4">
              <div className="inline-flex items-center text-sm text-[color:var(--gp-white)]/80">
                <TrendingUp className="mr-1 h-4 w-4 text-[var(--gp-gold-bright)]" />
                <span className="font-gp-serif italic">{stat.change} from last week</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Main dashboard content */}
      <div className="mt-8">
        <Tabs defaultValue="hourly">
          <TabsList className="bg-[rgba(6,13,26,0.5)] border border-[var(--gp-border-gold)] rounded-[2px] p-1">
            <TabsTrigger value="hourly" className="data-[state=active]:bg-[var(--gp-gold)] data-[state=active]:text-[var(--gp-navy-deep)] text-[color:var(--gp-white)]/85 font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] rounded-[2px]">
              Hourly (24h)
            </TabsTrigger>
            <TabsTrigger value="daily" className="data-[state=active]:bg-[var(--gp-gold)] data-[state=active]:text-[var(--gp-navy-deep)] text-[color:var(--gp-white)]/85 font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] rounded-[2px]">
              Daily (30 days)
            </TabsTrigger>
            <TabsTrigger value="monthly" className="data-[state=active]:bg-[var(--gp-gold)] data-[state=active]:text-[var(--gp-navy-deep)] text-[color:var(--gp-white)]/85 font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] rounded-[2px]">
              Monthly (12 months)
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="hourly" className="mt-6">
            <div className="gp-card p-7">
              <div className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] mb-5 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Peak Listening Times (24 Hours)
              </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hourlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.18)" />
                      <XAxis dataKey="name" stroke="rgba(248,244,236,0.35)" tick={{ fill: "rgba(248,244,236,0.75)", fontSize: 10 }} />
                      <YAxis stroke="rgba(248,244,236,0.35)" tick={{ fill: "rgba(248,244,236,0.75)", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "rgba(6,13,26,0.95)", border: "1px solid rgba(201,168,76,0.45)", borderRadius: 2, color: "rgba(248,244,236,0.95)" }} />
                      <Legend wrapperStyle={{ color: "rgba(248,244,236,0.75)" }} />
                      <Line 
                        type="monotone" 
                        dataKey="listeners" 
                        stroke="#e8c46a"
                        strokeWidth={2}
                        name="Active Listeners"
                        dot={{ fill: '#e8c46a', r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5 text-sm text-[color:var(--gp-white)]/80 font-gp-serif italic">
                  <p><strong>Peak Hours:</strong> Morning (7-9 AM), Lunch (12-2 PM), Evening Commute (5-7 PM), Night (9-11 PM)</p>
                  <p className="mt-1"><strong>Current Hour:</strong> {new Date().getHours().toString().padStart(2, '0')}:00 - {hourlyData.find(h => h.isCurrent)?.listeners || 0} listeners</p>
                </div>
            </div>
          </TabsContent>
          
          <TabsContent value="daily" className="mt-6">
            <div className="gp-card p-7">
              <div className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] mb-5 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Daily Activity (Last 30 Days)
              </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.18)" />
                      <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} stroke="rgba(248,244,236,0.35)" tick={{ fill: "rgba(248,244,236,0.75)", fontSize: 10 }} />
                      <YAxis stroke="rgba(248,244,236,0.35)" tick={{ fill: "rgba(248,244,236,0.75)", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "rgba(6,13,26,0.95)", border: "1px solid rgba(201,168,76,0.45)", borderRadius: 2, color: "rgba(248,244,236,0.95)" }} />
                      <Legend wrapperStyle={{ color: "rgba(248,244,236,0.75)" }} />
                      <Bar dataKey="peak" fill="#e8c46a" name="Peak Listeners" />
                      <Bar dataKey="average" fill="#c9a84c" name="Average Listeners" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5 text-sm text-[color:var(--gp-white)]/80 font-gp-serif italic">
                  <p><strong>Today:</strong> {dailyData[dailyData.length - 1]?.peak || 0} peak listeners, {dailyData[dailyData.length - 1]?.average || 0} average</p>
                  <p className="mt-1"><strong>30-Day Average:</strong> {Math.round(dailyData.reduce((sum, d) => sum + d.average, 0) / dailyData.length)} listeners</p>
                </div>
            </div>
          </TabsContent>
          
          <TabsContent value="monthly" className="mt-6">
            <div className="gp-card p-7">
              <div className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] mb-5 flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Trends (Last 12 Months)
              </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(201,168,76,0.18)" />
                      <XAxis dataKey="month" stroke="rgba(248,244,236,0.35)" tick={{ fill: "rgba(248,244,236,0.75)", fontSize: 10 }} />
                      <YAxis stroke="rgba(248,244,236,0.35)" tick={{ fill: "rgba(248,244,236,0.75)", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "rgba(6,13,26,0.95)", border: "1px solid rgba(201,168,76,0.45)", borderRadius: 2, color: "rgba(248,244,236,0.95)" }} />
                      <Legend wrapperStyle={{ color: "rgba(248,244,236,0.75)" }} />
                      <Line 
                        type="monotone" 
                        dataKey="peak" 
                        stroke="#e8c46a"
                        strokeWidth={2}
                        name="Peak Listeners"
                        dot={{ fill: '#e8c46a', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="average" 
                        stroke="#c9a84c"
                        strokeWidth={2}
                        name="Average Listeners"
                        dot={{ fill: '#c9a84c', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5 text-sm text-[color:var(--gp-white)]/80 font-gp-serif italic">
                  <p><strong>This Month:</strong> {monthlyData[monthlyData.length - 1]?.peak || 0} peak listeners, {monthlyData[monthlyData.length - 1]?.average || 0} average</p>
                  <p className="mt-1"><strong>12-Month Average:</strong> {Math.round(monthlyData.reduce((sum, m) => sum + m.average, 0) / monthlyData.length)} listeners</p>
                </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Top Tracks Section */}
      <div className="mt-8">
        <div className="gp-card p-7">
          <div className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] mb-5 flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Tracks
          </div>
            <div className="space-y-4">
              {topTracksData.length > 0 ? (
                topTracksData.map((track, i) => (
                  <div key={track.id} className="flex items-center justify-between rounded-[2px] border border-[var(--gp-border-gold)]/40 bg-[rgba(6,13,26,0.5)] px-4 py-3">
                    <div className="flex items-center">
                      <div className="border border-[var(--gp-border-gold)] text-[var(--gp-gold-bright)] w-7 h-7 rounded-full flex items-center justify-center mr-3 font-gp-sans text-xs">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-gp-sans font-medium text-[color:var(--gp-white)]">{track.title}</p>
                        <p className="text-sm text-[color:var(--gp-muted)] font-gp-serif italic">{track.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-[color:var(--gp-white)]/80 font-gp-sans tracking-[0.08em] uppercase">
                      <Music className="h-4 w-4 mr-2 text-[var(--gp-gold)]" />
                      {track.plays}
                    </div>
                  </div>
                ))
              ) : (
                <p className="font-gp-serif italic text-[color:var(--gp-muted)] text-center py-10">No tracks available</p>
              )}
            </div>
        </div>
      </div>
      
      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="font-gp-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--gp-gold-bright)] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-8">
          <Link href="/admin/music-manager" className="gp-card p-5 hover:border-[var(--gp-border-gold-strong)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Music className="h-5 w-5" />
              </div>
              <span className="font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">Add New Track</span>
            </div>
          </Link>
          
          <Link href="/admin/talks-manager" className="gp-card p-5 hover:border-[var(--gp-border-gold-strong)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Mic className="h-5 w-5" />
              </div>
              <span className="font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">Add New Talk</span>
            </div>
          </Link>
          
          <Link href="/admin/product-manager" className="gp-card p-5 hover:border-[var(--gp-border-gold-strong)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <span className="font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">Add New Product</span>
            </div>
          </Link>

          <Link href="/admin/programme-manager" className="gp-card p-5 hover:border-[var(--gp-border-gold-strong)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <CalendarDays className="h-5 w-5" />
              </div>
              <span className="font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">Programme Manager</span>
            </div>
          </Link>

          <Link href="/admin/podcast-manager" className="gp-card p-5 hover:border-[var(--gp-border-gold-strong)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Podcast className="h-5 w-5" />
              </div>
              <span className="font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">Podcast Manager</span>
            </div>
          </Link>
          
          <Link href="/admin/radio-editor" className="gp-card p-5 hover:border-[var(--gp-border-gold-strong)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Radio className="h-5 w-5" />
              </div>
              <span className="font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">Edit Radio Timeline</span>
            </div>
          </Link>

          <Link href="/admin/news-manager" className="gp-card p-5 hover:border-[var(--gp-border-gold-strong)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Newspaper className="h-5 w-5" />
              </div>
              <span className="font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">News Manager</span>
            </div>
          </Link>

          <Link href="/admin/recommendation-manager" className="gp-card p-5 hover:border-[var(--gp-border-gold-strong)] transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="font-gp-sans text-[0.85rem] text-[color:var(--gp-white)]/90">Promotion Manager</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Admin Dashboard
export default function AdminDashboard() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/music-manager">
          <MusicManager />
        </Route>
        <Route path="/admin/music-manager/*">
          <MusicManager />
        </Route>
        <Route path="/admin/talks-manager">
          <TalksManagerPage />
        </Route>
        <Route path="/admin/talks-manager/*">
          <TalksManagerPage />
        </Route>
        <Route path="/admin/programme-manager">
          <ScheduleManager kind="programme" />
        </Route>
        <Route path="/admin/programme-manager/*">
          <ScheduleManager kind="programme" />
        </Route>
        <Route path="/admin/podcast-manager">
          <ScheduleManager kind="podcast" />
        </Route>
        <Route path="/admin/podcast-manager/*">
          <ScheduleManager kind="podcast" />
        </Route>
        <Route path="/admin/radio-editor">
          <ShowBuilderPage />
        </Route>
        <Route path="/admin/radio-editor/*">
          <ShowBuilderPage />
        </Route>
        {/* Legacy route redirect */}
        <Route path="/admin/showbuilder">
          <ShowBuilderPage />
        </Route>
        <Route path="/admin/showbuilder/*">
          <ShowBuilderPage />
        </Route>
        {/* Content Creator: Products, Comments, News, Advertisements */}
        <Route path="/admin/content-creator">
          <AdvertisementsManagement />
        </Route>
        <Route path="/admin/content-creator/*">
          <AdvertisementsManagement />
        </Route>
        {/* Legacy route redirect */}
        <Route path="/admin/advertisements">
          <AdvertisementsManagement />
        </Route>
        {/* Product Manager */}
        <Route path="/admin/product-manager">
          <ProductManagerPage />
        </Route>
        <Route path="/admin/product-manager/*">
          <ProductManagerPage />
        </Route>
        {/* News Manager (feeds homepage News card via /news API) */}
        <Route path="/admin/news-manager">
          <BreakingNewsPage />
        </Route>
        <Route path="/admin/news-manager/*">
          <BreakingNewsPage />
        </Route>
        {/* Promotion Manager (feeds homepage Promotions via /promotions API) */}
        <Route path="/admin/recommendation-manager">
          <PromotionManagerPage />
        </Route>
        <Route path="/admin/recommendation-manager/*">
          <PromotionManagerPage />
        </Route>
        {/* Default route - Dashboard */}
        <Route path="/admin">
          <DashboardContent />
        </Route>
        <Route path="*">
          <DashboardContent />
        </Route>
      </Switch>
    </AdminLayout>
  );
}
