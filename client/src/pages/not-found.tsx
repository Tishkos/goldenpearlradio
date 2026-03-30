import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="gp-bg min-h-screen w-full flex items-center justify-center px-4">
      <Card className="gp-card w-full max-w-lg border border-[var(--gp-border-gold)] bg-[rgba(6,13,26,0.84)]">
        <CardContent className="pt-8 pb-7 px-7">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="h-8 w-8 text-[var(--gp-gold-bright)]" />
            <h1 className="font-gp-display text-3xl font-bold text-[color:var(--gp-white)]">404 Page Not Found</h1>
          </div>

          <p className="mt-4 font-gp-serif text-[1.05rem] text-[color:var(--gp-muted)]">
            The page you requested does not exist or may have been moved.
          </p>

          <div className="mt-7">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[2px] border border-[var(--gp-border-gold)] text-[color:var(--gp-gold-bright)] font-gp-sans text-[0.72rem] uppercase tracking-[0.12em] hover:bg-[var(--gp-gold)] hover:text-[var(--gp-navy-deep)] transition-colors"
            >
              <Home className="h-4 w-4" />
              Back Home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
