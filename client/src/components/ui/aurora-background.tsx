"use client"

import type React from "react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const COLORS = {
  blue: "#4A6F94",
  orange: "#D4632A",
} as const

interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  showRadialGradient?: boolean
  showBottomOverlay?: boolean
  animationSpeed?: number
  isPlaying?: boolean
  audioIntensity?: number
}

export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  showBottomOverlay = false,
  animationSpeed = 60,
  isPlaying = false,
  audioIntensity = 0,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden", className)}>
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        {/* Only the two colors: blue and orange, no dark */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 90% 70% at 75% 25%, ${COLORS.blue} 0%, ${COLORS.blue} 50%, transparent 70%),
              radial-gradient(ellipse 80% 60% at 25% 75%, ${COLORS.orange} 0%, ${COLORS.orange} 50%, transparent 70%),
              linear-gradient(135deg, ${COLORS.blue} 0%, ${COLORS.orange} 100%)
            `,
          }}
        />
        {showBottomOverlay && (
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-transparent pointer-events-none" />
        )}
      </div>
      <div className="relative z-10 pointer-events-auto w-full">
        {children}
      </div>
    </div>
  )
}

export default function AuroraBackgroundDemo() {
  return (
    <AuroraBackground showRadialGradient={true} showBottomOverlay={true} animationSpeed={15}>
      <div className="pointer-events-none" />
    </AuroraBackground>
  )
}
