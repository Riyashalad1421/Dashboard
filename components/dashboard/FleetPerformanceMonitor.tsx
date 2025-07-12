"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { useTaxiDataContext } from "@/context/taxi-data-context"
import { 
  TrendingUp, 
  TrendingDown, 
  Gauge, 
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Zap
} from "lucide-react"

interface FleetMetrics {
  efficiencyScore: number
  averageUtilization: number
  violationRate: number
  speedCompliance: number
  performanceChange: number
}

export function FleetPerformanceMonitor() {
  const { activeTaxis, totalActiveTaxis, totalAverageSpeed, totalViolations } = useTaxiDataContext()
  const [metrics, setMetrics] = useState<FleetMetrics>({
    efficiencyScore: 0,
    averageUtilization: 0,
    violationRate: 0,
    speedCompliance: 0,
    performanceChange: 0
  })
  const [previousScore, setPreviousScore] = useState(0)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !activeTaxis || activeTaxis.length === 0) return

    try {
      const totalTaxis = activeTaxis.length
      const violatingTaxis = activeTaxis.filter(taxi => taxi.violations && taxi.violations > 0).length
      const speedingTaxis = activeTaxis.filter(taxi => taxi.avgSpeed && taxi.avgSpeed > 80).length
      
      const violationRate = totalTaxis > 0 ? (violatingTaxis / totalTaxis) * 100 : 0
      const speedCompliance = totalTaxis > 0 ? ((totalTaxis - speedingTaxis) / totalTaxis) * 100 : 100
      const averageUtilization = 78
      
      const efficiencyScore = Math.round(
        (speedCompliance * 0.4) + 
        (averageUtilization * 0.3) + 
        ((100 - violationRate) * 0.3)
      )
      
      const performanceChange = previousScore > 0 ? efficiencyScore - previousScore : 0
      
      setMetrics({
        efficiencyScore,
        averageUtilization,
        violationRate,
        speedCompliance,
        performanceChange
      })
      
      if (previousScore === 0) {
        setPreviousScore(efficiencyScore)
      }
    } catch (error) {
      console.error('Error calculating metrics:', error)
    }
  }, [activeTaxis, previousScore, isClient])

  const getPerformanceStatus = (score: number) => {
    if (score >= 85) return { status: 'Excellent', color: 'text-green-400', bg: 'bg-green-400/10' }
    if (score >= 70) return { status: 'Good', color: 'text-blue-400', bg: 'bg-blue-400/10' }
    if (score >= 55) return { status: 'Fair', color: 'text-yellow-400', bg: 'bg-yellow-400/10' }
    return { status: 'Needs Attention', color: 'text-red-400', bg: 'bg-red-400/10' }
  }

  const performanceStatus = getPerformanceStatus(metrics.efficiencyScore)

  const performanceIndicators = useMemo(() => [
    {
      label: 'Efficiency',
      value: metrics.efficiencyScore,
      unit: '%',
      icon: <BarChart3 className="h-4 w-4" />,
      color: performanceStatus.color,
      change: metrics.performanceChange
    },
    {
      label: 'Speed Compliance',
      value: metrics.speedCompliance,
      unit: '%',
      icon: <Gauge className="h-4 w-4" />,
      color: metrics.speedCompliance >= 80 ? 'text-green-400' : 'text-yellow-400',
      change: isClient ? 1.2 : 0
    },
    {
      label: 'Violation Rate',
      value: metrics.violationRate,
      unit: '%',
      icon: <AlertTriangle className="h-4 w-4" />,
      color: metrics.violationRate <= 5 ? 'text-green-400' : 'text-red-400',
      change: isClient ? -0.5 : 0
    },
    {
      label: 'Utilization',
      value: metrics.averageUtilization,
      unit: '%',
      icon: <Clock className="h-4 w-4" />,
      color: metrics.averageUtilization >= 70 ? 'text-green-400' : 'text-blue-400',
      change: isClient ? 2.1 : 0
    }
  ], [metrics, performanceStatus, isClient])

  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading performance data...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      {/* Header */}
      <div className="p-3 pb-2 flex-shrink-0 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-blue-400 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Fleet Performance
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${performanceStatus.bg} ${performanceStatus.color}`}>
            {performanceStatus.status}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col min-h-0">
        {/* Main Performance Score */}
        <div className="text-center mb-3 p-2 rounded-lg bg-[#2a2a2a] border border-[#3a3a3a] flex-shrink-0">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xl font-bold">{metrics.efficiencyScore}%</span>
            {metrics.performanceChange !== 0 && (
              <div className={`flex items-center text-xs ${
                metrics.performanceChange > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {metrics.performanceChange > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span className="ml-1">{Math.abs(metrics.performanceChange).toFixed(1)}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400">Overall Fleet Efficiency</p>
        </div>

        {/* Performance Indicators Grid */}
        <div className="grid grid-cols-2 gap-2 mb-3 flex-1">
          {performanceIndicators.map((indicator) => (
            <div
              key={indicator.label}
              className="bg-[#2a2a2a] rounded-lg p-2 border border-[#3a3a3a] hover:border-[#4a4a4a] transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1">
                <div className={`${indicator.color}`}>
                  {indicator.icon}
                </div>
                {indicator.change !== 0 && (
                  <div className={`flex items-center text-xs ${
                    indicator.change > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {indicator.change > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span className="ml-1">{Math.abs(indicator.change).toFixed(1)}</span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex flex-col justify-center">
                <span className="text-base font-semibold">
                  {indicator.value.toFixed(1)}{indicator.unit}
                </span>
              </div>
              
              <p className="text-xs text-gray-400 truncate">{indicator.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Status Bar */}
        <div className="flex justify-between text-xs border-t border-[#3a3a3a] pt-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-400" />
            <span className="text-gray-400">{totalActiveTaxis || 0} Active</span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-yellow-400" />
            <span className="text-gray-400">Avg: {(totalAverageSpeed || 0).toFixed(1)} km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-400" />
            <span className="text-gray-400">{totalViolations || 0} Issues</span>
          </div>
        </div>
      </div>
    </div>
  )
}