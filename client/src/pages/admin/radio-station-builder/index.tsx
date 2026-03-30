import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Radio, ListMusic, Radio as RadioIcon, ArrowLeft, Activity, Plus, Settings, Play, Pause } from "lucide-react";
import { Link, Switch, Route, useLocation } from "wouter";
import RadioStationsManager from "./RadioStationsManager";
import RadioStationScheduler from "./RadioStationScheduler";
import RadioStationStreamer from "./RadioStationStreamer";

export default function RadioStationBuilderPage() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Redirect base path to stations
    if (location === "/admin/radio-station-builder" || location === "/admin/radio-station-builder/") {
      setLocation("/admin/radio-station-builder/stations");
    }
  }, [location, setLocation]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl shadow-lg">
                <RadioIcon className="h-8 w-8 text-white" />
              </div>
              Radio Station Builder
            </h1>
            <p className="text-gray-500 mt-2">Create and manage radio stations with scheduling and live streaming</p>
          </div>
          <Button variant="outline" onClick={() => (window.location.href = "/admin")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white border shadow-sm p-1 rounded">
          <nav className="flex gap-2 p-1">
            <Link
              href="/admin/radio-station-builder/stations"
              className={`inline-flex items-center gap-2 px-3 py-2 rounded ${
                String(location).startsWith("/admin/radio-station-builder/stations") ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Radio className="h-4 w-4" />
              Stations
            </Link>

            <Link
              href="/admin/radio-station-builder/scheduler"
              className={`inline-flex items-center gap-2 px-3 py-2 rounded ${
                String(location).startsWith("/admin/radio-station-builder/scheduler") ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Settings className="h-4 w-4" />
              Station Scheduler
            </Link>

            <Link
              href="/admin/radio-station-builder/streamer"
              className={`inline-flex items-center gap-2 px-3 py-2 rounded ${
                String(location).startsWith("/admin/radio-station-builder/streamer") ? "bg-blue-500 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Play className="h-4 w-4" />
              Live Streamer
            </Link>
          </nav>
        </div>

        <div>
          <Switch>
            <Route path="/admin/radio-station-builder/stations">
              <RadioStationsManager />
            </Route>
            <Route path="/admin/radio-station-builder/scheduler">
              <RadioStationScheduler />
            </Route>
            <Route path="/admin/radio-station-builder/streamer">
              <RadioStationStreamer />
            </Route>
            {/* fallback to stations when no path matches */}
            <Route path="/admin/radio-station-builder">
              <RadioStationsManager />
            </Route>
          </Switch>
        </div>
      </div>
    </div>
  );
}