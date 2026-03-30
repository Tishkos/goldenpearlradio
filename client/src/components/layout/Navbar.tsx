"use client";
import { useState } from "react";

import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { Radio, ShoppingBag, MessageSquare, Newspaper, CalendarDays, Podcast } from "lucide-react";

export default function AppNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const navItems = [
    {
      name: "Live Radio",
      link: "/",
      icon: <Radio className="h-4 w-4" />,
    },
    {
      name: "Shop",
      link: "/shop",
      icon: <ShoppingBag className="h-4 w-4" />,
    },
    {
      name: "Programme",
      link: "/programme",
      icon: <CalendarDays className="h-4 w-4" />,
    },
    {
      name: "Podcasts",
      link: "/podcasts",
      icon: <Podcast className="h-4 w-4" />,
    },
    {
      name: "News",
      link: "/news",
      icon: <Newspaper className="h-4 w-4" />,
    },
    {
      name: "Business",
      link: "/contact",
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ];

  return (
    <Navbar>
      {/* Desktop Navigation */}
      <NavBody>
        <NavbarLogo />
        <div className="flex flex-1 items-center justify-end gap-4">
          <NavItems items={navItems} onItemClick={() => {}} />
        </div>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle
            isOpen={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        >
          {navItems.map((item, idx) => {
            const isActive = location === item.link || (item.link !== "/" && location.startsWith(item.link));
            return (
              <Link
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  "relative flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl w-full text-center transition-colors",
                  "bg-[rgba(255,255,255,0.09)] text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl",
                  "hover:bg-[rgba(255,255,255,0.14)]",
                  isActive && "bg-[rgba(255,255,255,0.18)] text-white hover:bg-[rgba(255,255,255,0.2)]"
                )}
              >
                {item.icon && <span className="relative z-10 flex items-center">{item.icon}</span>}
                <span className="relative z-10 block">{item.name}</span>
              </Link>
            );
          })}
          <div className="flex w-full flex-col gap-3 pt-4 mt-2 items-center" />
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
