"use client"

import React, { useMemo } from 'react'
import { useTaxiDataContext } from "@/context/taxi-data-context"
import { AnomalyCard } from "./AnomalyCard"
import { 
  Zap, 
  AlertTriangle, 
  Clock, 
  Navigation,
  TrendingUp
} from "lucide-react"
import type { Taxi } from "@/lib/types"

// Beijing center coordinates (Tiananmen Square)
const BEIJING_CENTER = { lat: 39.9042, lng: 116.4074 }

export function InsightPanel() {
  const { activeTaxis } = useTaxiDataContext()

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371 // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Format location coordinates
  const formatLocation = (lat: number, lng: number): string => {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }

  // Calculate idle time (mock calculation based on speed)
  const calculateIdleTime = (taxi: Taxi): number => {
    if (taxi.avgSpeed < 2) {
      const now = new Date()
      const lastUpdate = new Date(taxi.lastUpdate)
      return Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60)) // minutes
    }
    return 0
  }

  // Determine area name based on coordinates (simplified)
  const getAreaName = (lat: number, lng: number): string => {
    if (lat >= 39.9000 && lat <= 39.9200 && lng >= 116.3900 && lng <= 116.4200) {
      return "Central Beijing"
    } else if (lat >= 39.9100 && lat <= 39.9300 && lng >= 116.4600 && lng <= 116.4900) {
      return "CBD Area"
    } else if (lat >= 39.9800 && lat <= 40.0000 && lng >= 116.2900 && lng <= 116.3200) {
      return "Zhongguancun"
    } else if (lat >= 39.9300 && lat <= 39.9500 && lng >= 116.4500 && lng <= 116.4800) {
      return "Sanlitun"
    } else {
      return "Beijing Outskirts"
    }
  }

  const insights = useMemo(() => {
    if (!activeTaxis || activeTaxis.length === 0) {
      return {
        fastest: null,
        mostViolations: null,
        longestIdle: null,
        farthest: null
      }
    }

    // 1. Fastest Taxi
    const fastest = activeTaxis.reduce((fastest, taxi) => 
      (taxi.avgSpeed || 0) > (fastest?.avgSpeed || 0) ? taxi : fastest
    )

    // 2. Most Violations
    const mostViolations = activeTaxis.reduce((most, taxi) => 
      (taxi.violations || 0) > (most?.violations || 0) ? taxi : most
    )

    // 3. Longest Idle (based on low speed)
    const idleTaxis = activeTaxis.map(taxi => ({
      ...taxi,
      idleTime: calculateIdleTime(taxi)
    })).filter(taxi => taxi.idleTime > 0)
    
    const longestIdle = idleTaxis.length > 0 
      ? idleTaxis.reduce((longest, taxi) => 
          taxi.idleTime > longest.idleTime ? taxi : longest
        )
      : null

    // 4. Farthest from Beijing Center
    const farthest = activeTaxis.reduce((farthest, taxi) => {
      const distance = calculateDistance(
        taxi.latitude, 
        taxi.longitude, 
        BEIJING_CENTER.lat, 
        BEIJING_CENTER.lng
      )
      const farthestDistance = farthest ? calculateDistance(
        farthest.latitude, 
        farthest.longitude, 
        BEIJING_CENTER.lat, 
        BEIJING_CENTER.lng
      ) : 0
      
      return distance > farthestDistance ? taxi : farthest
    })

    return {
      fastest: fastest?.avgSpeed > 0 ? fastest : null,
      mostViolations: mostViolations?.violations > 0 ? mostViolations : null,
      longestIdle,
      farthest
    }
  }, [activeTaxis])

  return (
    <div className="text-white p-6">
      {/* Header - Better spacing */}
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-6 w-6 text-green-400" />
        <h2 className="text-xl font-semibold text-green-400">Real-time Insights</h2>
      </div>
      
      {/* Insights Grid - Properly sized for scrollable layout */}
      <div className="grid grid-cols-4 gap-6">
        {/* Fastest Taxi */}
        <div className="h-40">
          <AnomalyCard
            icon={Zap}
            label="Fastest Taxi"
            taxiId={insights.fastest?.id}
            primaryValue={insights.fastest ? `${insights.fastest.avgSpeed.toFixed(1)} km/h` : ""}
            secondaryValue={insights.fastest ? "Current Speed" : undefined}
            location={insights.fastest ? getAreaName(insights.fastest.latitude, insights.fastest.longitude) : undefined}
            iconColor="text-yellow-400"
            bgColor="bg-yellow-900/20"
          />
        </div>

        {/* Most Violations */}
        <div className="h-40">
          <AnomalyCard
            icon={AlertTriangle}
            label="Most Violations"
            taxiId={insights.mostViolations?.id}
            primaryValue={insights.mostViolations ? `${insights.mostViolations.violations} violations` : ""}
            secondaryValue={insights.mostViolations ? "Current Count" : undefined}
            location={insights.mostViolations ? getAreaName(insights.mostViolations.latitude, insights.mostViolations.longitude) : undefined}
            iconColor="text-red-400"
            bgColor="bg-red-900/20"
          />
        </div>

        {/* Longest Idle */}
        <div className="h-40">
          <AnomalyCard
            icon={Clock}
            label="Longest Idle"
            taxiId={insights.longestIdle?.id}
            primaryValue={insights.longestIdle ? `${insights.longestIdle.idleTime} mins` : ""}
            secondaryValue={insights.longestIdle ? "Idle Time" : undefined}
            location={insights.longestIdle ? formatLocation(insights.longestIdle.latitude, insights.longestIdle.longitude) : undefined}
            iconColor="text-blue-400"
            bgColor="bg-blue-900/20"
          />
        </div>

        {/* Farthest from Center */}
        <div className="h-40">
          <AnomalyCard
            icon={Navigation}
            label="Farthest Away"
            taxiId={insights.farthest?.id}
            primaryValue={insights.farthest ? 
              `${calculateDistance(
                insights.farthest.latitude, 
                insights.farthest.longitude, 
                BEIJING_CENTER.lat, 
                BEIJING_CENTER.lng
              ).toFixed(1)} km` : ""
            }
            secondaryValue={insights.farthest ? "From Center" : undefined}
            location={insights.farthest ? getAreaName(insights.farthest.latitude, insights.farthest.longitude) : undefined}
            iconColor="text-purple-400"
            bgColor="bg-purple-900/20"
          />
        </div>
      </div>
    </div>
  )
}