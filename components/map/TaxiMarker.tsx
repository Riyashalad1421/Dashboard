"use client"

import type React from "react"
import { memo } from "react"
import { Marker } from "react-leaflet"
import type { Taxi } from "@/lib/types"
import L from "leaflet"

interface TaxiMarkerProps {
  taxi: Taxi
  onClick: (taxi: Taxi) => void
  isSelected?: boolean
}

// Simple taxi SVG
const taxiSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
  <!-- Taxi body -->
  <rect x="4" y="9" width="16" height="8" rx="1" fill="currentColor"/>
  <!-- Taxi roof/top -->
  <rect x="7" y="6" width="10" height="4" rx="1" fill="currentColor"/>
  <!-- Taxi sign on top -->
  <rect x="9" y="4" width="6" height="2" rx="1" fill="currentColor" opacity="0.8"/>
  <!-- Front windshield -->
  <path d="M7 9 L9 6 L15 6 L17 9 Z" fill="rgba(255,255,255,0.3)"/>
  <!-- Wheels -->
  <circle cx="7" cy="17" r="1.5" fill="currentColor" opacity="0.8"/>
  <circle cx="17" cy="17" r="1.5" fill="currentColor" opacity="0.8"/>
  <!-- Headlights -->
  <circle cx="4.5" cy="11" r="0.8" fill="rgba(255,255,255,0.6)"/>
  <circle cx="4.5" cy="15" r="0.8" fill="rgba(255,255,255,0.6)"/>
  <!-- Door handle -->
  <rect x="11" y="12" width="0.5" height="2" rx="0.25" fill="rgba(255,255,255,0.4)"/>
</svg>
`

const TaxiMarker: React.FC<TaxiMarkerProps> = memo(({ taxi, onClick, isSelected = false }) => {
  const position: [number, number] = [taxi.latitude, taxi.longitude]

  console.log(`🚩 MARKER: Creating marker for taxi ${taxi.id}, isSelected=${isSelected}`)
  
  // Simple color logic - no fancy animations
  const hasViolations = taxi.violations !== undefined && taxi.violations > 0
  
  let iconColor = "#22c55e" // green-500
  
  if (isSelected) {
    iconColor = "#3b82f6" // blue-500 - SIMPLE BLUE
  } else if (hasViolations) {
    iconColor = "#ef4444" // red-500
  }

  // SIMPLE HTML - no rings, no animations, no fancy stuff
  const iconHtml = `
    <div class="relative flex items-center justify-center">
      <div class="relative flex items-center justify-center rounded-full p-1" style="color: ${iconColor};">
        ${taxiSvg}
      </div>
    </div>
  `

  const customIcon = new L.DivIcon({
    html: iconHtml,
    className: "bg-transparent",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  })

  return <Marker position={position} icon={customIcon} eventHandlers={{ click: () => onClick(taxi) }} />
})

TaxiMarker.displayName = "TaxiMarker"

export default TaxiMarker