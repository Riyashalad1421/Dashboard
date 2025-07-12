"use client"

import type React from "react"
import { memo } from "react"
import { Marker } from "react-leaflet"
import type { Taxi } from "@/lib/types"
import L from "leaflet"

interface TaxiMarkerProps {
  taxi: Taxi
  onClick: (taxi: Taxi) => void
}

// Using the car-front SVG from Lucide React, as requested
const taxiSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-car-front">
  <path d="M19 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z"/>
  <path d="M7 17v2"/>
  <path d="M17 17v2"/>
  <path d="M5 15h14"/>
  <path d="M7 9h4"/>
  <path d="M13 9h4"/>
</svg>
`

const TaxiMarker: React.FC<TaxiMarkerProps> = memo(({ taxi, onClick }) => {
  const position: [number, number] = [taxi.latitude, taxi.longitude]

  // Determine icon color and animation based on violations
  // Note: taxi.violations here comes from the WebSocket. If WS doesn't provide it, it will be 0.
  const iconColorClass = taxi.violations > 0 ? "text-red-500" : "text-green-500"
  const glowAnimationClass = taxi.violations > 0 ? "animate-pulse-red" : "animate-pulse-green"

  // Construct the HTML for the custom DivIcon, without labels
  const iconHtml = `
    <div class="relative flex items-center justify-center rounded-full p-1 ${glowAnimationClass}">
      <div class="relative z-10 ${iconColorClass}">
        ${taxiSvg}
      </div>
    </div>
  `

  const customIcon = new L.DivIcon({
    html: iconHtml,
    className: "bg-transparent", // Remove default Leaflet icon background
    iconSize: [32, 32], // Adjust size for icon only
    iconAnchor: [16, 16], // Center the icon
  })

  return <Marker position={position} icon={customIcon} eventHandlers={{ click: () => onClick(taxi) }} />
})

TaxiMarker.displayName = "TaxiMarker"

export default TaxiMarker
