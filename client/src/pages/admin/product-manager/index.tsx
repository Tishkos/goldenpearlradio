import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import ProductsManager from "./ProductsManager";
import { Link, Switch, Route, useLocation } from "wouter";

export default function ProductManagerPage() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    // Redirect base path to products
    if (location === "/admin/product-manager" || location === "/admin/product-manager/") {
      setLocation("/admin/product-manager/products");
    }
  }, [location, setLocation]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h1 className="font-gp-display text-3xl md:text-4xl font-semibold text-[var(--gp-white)] flex items-center gap-3">
              <div className="h-12 w-12 rounded-full border border-[var(--gp-border-gold)] grid place-items-center text-[color:var(--gp-gold)] bg-[rgba(6,13,26,0.35)]">
                <ShoppingBag className="h-6 w-6" />
              </div>
              Product Manager
            </h1>
            <p className="font-gp-serif text-[color:var(--gp-white)]/85 mt-2 text-base">
              Manage your products with links, covers, and audio content
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

      <div className="space-y-6">
        <div className="gp-card p-1 rounded-[2px]">
          <nav className="flex gap-2 p-1">
            <Link
              href="/admin/product-manager/products"
              className={`inline-flex items-center gap-2 px-3 py-2 rounded font-sans text-sm font-semibold tracking-normal ${
                String(location).startsWith("/admin/product-manager/products")
                  ? "bg-[var(--gp-gold)] text-[var(--gp-navy-deep)]"
                  : "text-[color:var(--gp-white)]/75 hover:text-[var(--gp-gold-bright)] hover:bg-white/5"
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Products
            </Link>
          </nav>
        </div>

        <div>
          <Switch>
            <Route path="/admin/product-manager/products">
              <ProductsManager />
            </Route>
            {/* fallback to products when no path matches */}
            <Route path="/admin/product-manager">
              <ProductsManager />
            </Route>
          </Switch>
        </div>
      </div>
    </div>
  );
}

