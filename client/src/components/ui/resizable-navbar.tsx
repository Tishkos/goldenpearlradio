"use client";
import { cn } from "@/lib/utils";
import { Menu, X, Radio, ShoppingBag, MessageSquare, LogIn, Phone } from "lucide-react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import React, { useRef, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: {
    name: string;
    link: string;
    icon?: React.ReactNode;
  }[];
  className?: string;
  onItemClick?: () => void;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface MobileNavToggleProps {
  isOpen: boolean;
  onClick: () => void;
}

interface NavbarButtonProps {
  href?: string;
  asChild?: boolean;
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark" | "gradient";
  onClick?: () => void;
  iconOnly?: boolean;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

interface NavbarLogoProps {
  className?: string;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  // Always show the scrolled/visible state
  const visible = true;

  return (
    <motion.div
      className={cn("relative lg:sticky inset-x-0 top-0 z-40 w-full bg-transparent", className)}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    // Small delay to ensure smooth animation on page load
    const timer = setTimeout(() => {
      setMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <motion.div
      initial={{
        width: "100%",
        y: 0,
        boxShadow: "none",
      }}
      animate={{
        backdropFilter: "blur(34px) saturate(190%) brightness(1.16)",
        boxShadow: mounted ? "0 14px 42px rgba(74, 111, 148, 0.18)" : "none",
        width: mounted ? "82%" : "100%",
        y: mounted ? 20 : 0,
      }}
      transition={{
        type: "spring",
        stiffness: 150,
        damping: 40,
        duration: 0.8,
      }}
      style={{
        minWidth: "1000px",
      }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full max-w-7xl flex-row items-center justify-between self-start rounded-full px-8 py-4 lg:flex",
        "bg-[rgba(255,255,255,0.15)]",
        "border border-white/35",
        "shadow-[0_14px_42px_rgba(74,111,148,0.18)]",
        className,
      )}
    >
      {/* Subtle gradient - matches Recommendations & News glass */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.08)_40%,rgba(74,111,148,0.08)_100%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />

      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [location] = useLocation();

  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "hidden flex-row items-center justify-end space-x-2 text-base font-medium text-zinc-600 transition duration-200 hover:text-zinc-800 lg:flex lg:space-x-2",
        className,
      )}
    >
      {items.map((item, idx) => {
        const isActive = location === item.link || (item.link !== "/" && location.startsWith(item.link));
        const isHovered = hovered === idx;
        const isHoveredOrActive = isHovered || (isActive && hovered === null);
        // In light mode, if another item is hovered, show active item with grey background
        const showActiveGrey = isActive && hovered !== null && hovered !== idx;
        return (
          <Link
            key={`link-${idx}`}
            href={item.link}
            onClick={onItemClick}
            onMouseEnter={() => setHovered(idx)}
            className={cn(
              "relative px-5 py-2.5 flex items-center gap-2 text-white dark:text-white text-base font-medium rounded-full transition-colors",
              isActive && "font-semibold"
            )}
          >
            {showActiveGrey && (
              <motion.div
                layoutId="active-grey"
                className="absolute inset-0 h-full w-full rounded-full bg-white/14 border border-white/25"
              />
            )}
            {isHoveredOrActive && !showActiveGrey && (
              <motion.div
                layoutId="hovered"
                className="absolute inset-0 h-full w-full rounded-full bg-white/30 border border-white/40 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
              />
            )}
            {item.icon && (
              <span className={cn(
                "relative z-20 flex items-center transition-colors text-white"
              )}>
                {item.icon}
              </span>
            )}
            <span className={cn(
              "relative z-20 transition-colors text-white font-semibold"
            )}>{item.name}</span>
          </Link>
        );
      })}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  // Always show the scrolled/visible state
  const isVisible = true;
  
  return (
    <div
      className={cn(
        "relative z-50 mx-auto mt-4 flex w-[94%] max-w-[calc(100vw-1.5rem)] flex-col items-stretch justify-between overflow-hidden rounded-[2rem] px-5 py-4 lg:hidden",
        "bg-[rgba(255,255,255,0.08)]",
        "shadow-[0_14px_36px_rgba(74,111,148,0.12)]",
        className,
      )}
      style={{ backdropFilter: "blur(34px) saturate(180%) brightness(1.08)" }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_40%,rgba(74,111,148,0.06)_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden="true" />
      {children}
    </div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
  onClose,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "relative mt-4 flex w-full flex-col items-center justify-start gap-1 rounded-[1.6rem] px-4 py-5 overflow-hidden",
            "bg-[rgba(74,111,148,0.08)]",
            "shadow-[0_12px_28px_rgba(15,23,42,0.06)]",
            className,
          )}
          style={{
            maxWidth: 'calc(100vw - 2rem)',
            backdropFilter: "blur(64px) saturate(170%) brightness(1.04)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.04)_30%,rgba(255,255,255,0.015)_100%)]"
            aria-hidden="true"
          />
          <div className="relative z-10 flex w-full flex-col gap-2.5">
          {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: MobileNavToggleProps) => {
  return (
    <button
      onClick={onClick}
      className="text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
      aria-label={isOpen ? "Close menu" : "Open menu"}
    >
      {isOpen ? (
        <X className="h-6 w-6" />
      ) : (
        <Menu className="h-6 w-6" />
      )}
    </button>
  );
};

/* Pill-bar logo: 4 horizontal bars (blue-blue-red-blue) */
const PillBarLogo = () => (
  <div className="flex flex-col gap-0.5 mr-3" aria-hidden>
    <div className="h-1.5 w-6 rounded-full bg-[#4A6F94]" />
    <div className="h-1.5 w-6 rounded-full bg-[#4A6F94]/80" />
    <div className="h-1.5 w-6 rounded-full bg-[#E5534B]" />
    <div className="h-1.5 w-6 rounded-full bg-[#4A6F94]" />
  </div>
);

export const NavbarLogo = ({ className }: NavbarLogoProps) => {
  return (
    <Link
      href="/"
      className={cn(
        "relative z-20 flex items-center",
        className
      )}
    >
      <PillBarLogo />
      <span className="font-poppins text-xl text-white leading-tight">
        Golden Pearl Radio Dubai
      </span>
    </Link>
  );
};

export const NavbarButton = ({
  href,
  asChild = false,
  children,
  className,
  variant = "primary",
  onClick,
  iconOnly = false,
  icon,
  ariaLabel,
  ...props
}: NavbarButtonProps & React.ComponentPropsWithoutRef<"a"> & React.ComponentPropsWithoutRef<"button">) => {
  const baseStyles = iconOnly
    ? "p-2.5 rounded-full bg-white dark:bg-neutral-800 text-black dark:text-neutral-200 relative cursor-pointer hover:-translate-y-0.5 hover:text-white transition duration-200 inline-flex items-center justify-center"
    : "px-4 py-2 rounded-md bg-white dark:bg-neutral-800 text-black dark:text-neutral-200 text-sm font-bold relative cursor-pointer hover:-translate-y-0.5 hover:text-white transition duration-200 inline-flex items-center gap-2 text-center";

  const variantStyles = {
    primary:
      "shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
    secondary: "bg-transparent shadow-none dark:text-white",
    dark: "bg-black text-white shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]",
    gradient:
      "text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset]",
  };

  const content = (
    <>
      {icon && <span className={iconOnly ? "" : ""}>{icon}</span>}
      {!iconOnly && children}
    </>
  );

  if (asChild && href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(baseStyles, variantStyles[variant], className)}
        aria-label={ariaLabel}
      >
        {content}
      </Link>
    );
  }

  if (href && !asChild) {
    return (
      <a
        href={href}
        onClick={onClick}
        className={cn(baseStyles, variantStyles[variant], className)}
        aria-label={ariaLabel}
        {...(props as any)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(baseStyles, variantStyles[variant], className)}
      aria-label={ariaLabel}
      {...(props as any)}
    >
      {content}
    </button>
  );
};
