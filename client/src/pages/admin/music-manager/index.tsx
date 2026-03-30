import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Music, ListMusic, Disc, ArrowLeft, Activity } from "lucide-react";
import TracksManager from "./TracksManager";
import { Link, Switch, Route, useLocation } from "wouter";

export default function MusicManager() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Redirect base path to tracks
    if (location === "/admin/music-manager" || location === "/admin/music-manager/") {
      setLocation("/admin/music-manager/tracks");
    }
  }, [location, setLocation]);

  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h1 className="font-gp-display text-3xl font-semibold text-[var(--gp-white)] flex items-center gap-3">
                <div className="h-12 w-12 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)] bg-[rgba(6,13,26,0.35)]">
                  <Music className="h-6 w-6" />
                </div>
                Music Manager
              </h1>
              <p className="font-gp-serif italic text-[color:var(--gp-white)]/80 mt-2">
                Manage your radio station&apos;s music library, albums, and playlists
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/admin")}
              className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/85 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="gp-card p-1">
            <nav className="flex gap-2 p-1">
              <Link
                href="/admin/music-manager/tracks"
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-[2px] font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] transition-colors ${
                  String(location).startsWith("/admin/music-manager/tracks")
                    ? "bg-[var(--gp-gold)] text-[var(--gp-navy-deep)]"
                    : "text-[color:var(--gp-white)]/75 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
                }`}
              >
                <Music className="h-4 w-4" />
                Tracks
              </Link>
             
            </nav>
          </div>

          <div>
            <Switch>
              <Route path="/admin/music-manager/tracks">
                <TracksManager />
              </Route>
              {/* fallback to tracks when no path matches */}
              <Route path="/admin/music-manager">
                <TracksManager />
              </Route>
            </Switch>
          </div>
        </div>
      </div>
   
  );
}
