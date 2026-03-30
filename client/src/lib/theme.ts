/**
 * Modern Navbar Theme Configuration
 * Customize all navbar colors here
 * 
 * To change colors, modify the values below. All colors support both light and dark themes.
 */

export const navbarTheme = {
  // Light theme colors – vibrant palette
  light: {
    background: "bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70",
    border: "border-b border-neutral-200/50",
    text: {
      primary: "text-neutral-900",
      secondary: "text-neutral-600",
      hover: "text-neutral-900",
      active: "text-neutral-900 font-semibold",
    },
    button: {
      primary: {
        bg: "bg-gradient-to-r from-[hsl(221,83%,53%)] to-[hsl(187,85%,53%)]",
        hover: "hover:from-[hsl(221,83%,48%)] hover:to-[hsl(187,85%,48%)] hover:shadow-lg hover:shadow-cyan-500/30",
        text: "text-white",
        transition: "transition-all duration-300 ease-out",
      },
      secondary: {
        bg: "bg-neutral-100/80 backdrop-blur-sm",
        hover: "hover:bg-neutral-200/80 hover:shadow-md",
        text: "text-neutral-700",
        transition: "transition-all duration-200",
      },
    },
    mobile: {
      background: "bg-white/95 backdrop-blur-xl",
      overlay: "bg-black/60 backdrop-blur-sm",
      border: "border-neutral-200/50",
    },
    link: {
      hover: "hover:bg-neutral-100/50",
      active: "bg-neutral-100/80",
    },
  },
  // Dark theme colors
  dark: {
    background: "dark:bg-neutral-950/80 dark:backdrop-blur-xl dark:supports-[backdrop-filter]:dark:bg-neutral-950/70",
    border: "dark:border-neutral-800/50",
    text: {
      primary: "dark:text-neutral-100",
      secondary: "dark:text-neutral-400",
      hover: "dark:text-white",
      active: "dark:text-white dark:font-semibold",
    },
    button: {
      primary: {
        bg: "dark:bg-gradient-to-r dark:from-[hsl(221,83%,53%)] dark:to-[hsl(187,85%,53%)]",
        hover: "dark:hover:from-[hsl(221,83%,48%)] dark:hover:to-[hsl(187,85%,48%)] dark:hover:shadow-lg dark:hover:shadow-cyan-500/30",
        text: "dark:text-white",
        transition: "transition-all duration-300 ease-out",
      },
      secondary: {
        bg: "dark:bg-neutral-800/80 dark:backdrop-blur-sm",
        hover: "dark:hover:bg-neutral-700/80 dark:hover:shadow-md",
        text: "dark:text-neutral-200",
        transition: "transition-all duration-200",
      },
    },
    mobile: {
      background: "dark:bg-neutral-950/95 dark:backdrop-blur-xl",
      overlay: "dark:bg-black/70 dark:backdrop-blur-sm",
      border: "dark:border-neutral-800/50",
    },
    link: {
      hover: "dark:hover:bg-neutral-800/50",
      active: "dark:bg-neutral-800/80",
    },
  },
} as const;

// Helper function to combine light and dark classes
export const combineTheme = (light: string, dark: string) => `${light} ${dark}`;
