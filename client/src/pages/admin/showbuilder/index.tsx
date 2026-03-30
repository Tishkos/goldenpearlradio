import { Button } from "@/components/ui/button";
import { Radio, ArrowLeft } from "lucide-react";
import { Switch, Route } from "wouter";
import RadioEditor from "./RadioEditor";
import ShowsManager from "./ShowsManager";
import ShowBuilder from "./ShowBuilder";

export default function ShowBuilderPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="font-gp-display text-3xl md:text-4xl font-semibold text-[var(--gp-white)] flex items-center gap-3">
              <div className="h-12 w-12 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)] bg-[rgba(6,13,26,0.35)]">
                <Radio className="h-6 w-6" />
              </div>
              Radio Editor
            </h1>
            <p className="font-gp-serif text-[color:var(--gp-white)]/85 mt-2 text-base">
              Edit the timeline for Golden Pearl Radio and manage daily playback content.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/admin")}
            className="gap-2 border-[var(--gp-border-gold)] text-[color:var(--gp-white)]/90 hover:text-[var(--gp-gold-bright)] hover:bg-white/5 font-sans text-sm font-semibold tracking-normal"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </div>
      </div>

      <div>
        <Switch>
          {/* Radio Editor - simplified with date selection */}
          <Route path="/admin/radio-editor">
            <RadioEditor />
          </Route>
          <Route path="/admin/radio-editor/:rest*">
            <RadioEditor />
          </Route>
          {/* Legacy Show Builder routes (for backward compatibility) */}
          <Route path="/admin/showbuilder/shows">
            <ShowsManager />
          </Route>
          <Route path="/admin/showbuilder/builder">
            <ShowBuilder />
          </Route>
          <Route path="/admin/showbuilder">
            <ShowsManager />
          </Route>
        </Switch>
      </div>
    </div>
  );
}
