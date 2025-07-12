"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTaxiDataContext } from "@/context/taxi-data-context"
import { 
  AlertTriangle, 
  Car, 
  MapPin, 
  Clock, 
  Zap,
  Activity
} from "lucide-react"

interface ActivityEvent {
  id: string
  type: 'violation' | 'speed_change' | 'new_taxi' | 'status_change'
  taxiId: string
  timestamp: Date
  message: string
  severity: 'low' | 'medium' | 'high'
  location?: string
  details?: any
}

export function LiveActivityFeed() {
  const { activeTaxis, totalActiveTaxis } = useTaxiDataContext()
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [filter, setFilter] = useState<'all' | 'violations' | 'speed' | 'status'>('all')
  const [isClient, setIsClient] = useState(false)
  
  const lastProcessedTime = useRef<number>(0)
  const processedTaxiIds = useRef<Set<string>>(new Set())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !activeTaxis || activeTaxis.length === 0) {
      return
    }

    const generateActivities = () => {
      const currentTime = Date.now()
      
      if (currentTime - lastProcessedTime.current < 4000) {
        return
      }

      try {
        const newActivities: ActivityEvent[] = []
        const timestamp = new Date(currentTime)
        
        const taxisToProcess = activeTaxis.slice(0, 10)
        
        taxisToProcess.forEach((taxi) => {
          const taxiKey = `${taxi.id}`

          if (taxi.violations && taxi.violations > 0) {
            const violationId = `violation-${taxi.id}-${Math.floor(currentTime / 30000)}`
            
            newActivities.push({
              id: violationId,
              type: 'violation',
              taxiId: taxi.id,
              timestamp,
              message: `Traffic violation detected`,
              severity: taxi.violations >= 3 ? 'high' : taxi.violations >= 2 ? 'medium' : 'low',
              location: `${taxi.latitude?.toFixed(3)}, ${taxi.longitude?.toFixed(3)}`,
              details: { violationCount: taxi.violations, speed: taxi.avgSpeed }
            })
          }

          if (taxi.avgSpeed && taxi.avgSpeed > 70) {
            const speedId = `speed-${taxi.id}-${Math.floor(currentTime / 20000)}`
            
            newActivities.push({
              id: speedId,
              type: 'speed_change',
              taxiId: taxi.id,
              timestamp,
              message: `High speed detected`,
              severity: taxi.avgSpeed > 90 ? 'high' : 'medium',
              location: `${taxi.latitude?.toFixed(3)}, ${taxi.longitude?.toFixed(3)}`,
              details: { speed: taxi.avgSpeed }
            })
          }

          if (!processedTaxiIds.current.has(taxiKey)) {
            newActivities.push({
              id: `new-taxi-${taxi.id}-${currentTime}`,
              type: 'new_taxi',
              taxiId: taxi.id,
              timestamp,
              message: `Started tracking`,
              severity: 'low',
              location: `${taxi.latitude?.toFixed(3)}, ${taxi.longitude?.toFixed(3)}`,
              details: { speed: taxi.avgSpeed, violations: taxi.violations }
            })
            
            processedTaxiIds.current.add(taxiKey)
          }
        })

        if (newActivities.length > 0) {
          setActivities(prev => {
            const existingIds = new Set(prev.map(a => a.id))
            const uniqueNewActivities = newActivities.filter(a => !existingIds.has(a.id))
            
            if (uniqueNewActivities.length > 0) {
              const combined = [...uniqueNewActivities, ...prev]
              return combined.slice(0, 30)
            }
            return prev
          })
        }

        lastProcessedTime.current = currentTime
      } catch (error) {
        console.error('Error generating activities:', error)
      }
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    intervalRef.current = setInterval(generateActivities, 6000)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isClient, activeTaxis.length])

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities
    return activities.filter(activity => {
      switch (filter) {
        case 'violations':
          return activity.type === 'violation'
        case 'speed':
          return activity.type === 'speed_change'
        case 'status':
          return activity.type === 'new_taxi' || activity.type === 'status_change'
        default:
          return true
      }
    })
  }, [activities, filter])

  const activityCounts = useMemo(() => ({
    all: activities.length,
    violations: activities.filter(a => a.type === 'violation').length,
    speed: activities.filter(a => a.type === 'speed_change').length,
    status: activities.filter(a => a.type === 'new_taxi' || a.type === 'status_change').length
  }), [activities])

  const getEventIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'violation':
        return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
      case 'speed_change':
        return <Zap className="h-3.5 w-3.5 text-yellow-400" />
      case 'new_taxi':
        return <Car className="h-3.5 w-3.5 text-green-400" />
      case 'status_change':
        return <Activity className="h-3.5 w-3.5 text-blue-400" />
      default:
        return <Clock className="h-3.5 w-3.5 text-gray-400" />
    }
  }

  const getSeverityColor = (severity: ActivityEvent['severity']) => {
    switch (severity) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'outline'
      case 'low':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    try {
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000)
      
      if (diffInSeconds < 60) return `${Math.max(0, diffInSeconds)}s ago`
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
      return timestamp.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } catch (error) {
      return 'Just now'
    }
  }

  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">Loading activity feed...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col text-white">
      {/* Header - More compact */}
      <div className="p-3 pb-2 flex-shrink-0 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-green-400 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Live Activity
          </div>
          <Badge variant="outline" className="text-gray-300 border-gray-600 text-xs px-1.5 py-0.5">
            {filteredActivities.length}
          </Badge>
        </div>
        
        {/* Filter buttons - More compact */}
        <div className="flex gap-1">
          {[
            { key: 'all', label: 'All', count: activityCounts.all },
            { key: 'violations', label: 'Alerts', count: activityCounts.violations },
            { key: 'speed', label: 'Speed', count: activityCounts.speed },
            { key: 'status', label: 'Status', count: activityCounts.status }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-2 py-1 rounded text-xs transition-all flex-1 ${
                filter === key
                  ? 'bg-green-600 text-white'
                  : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Activity List - Optimized for more visible items */}
      <div className="flex-1 min-h-0 p-2">
        <ScrollArea className="h-full">
          {filteredActivities.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <div className="text-center">
                <Activity className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activities</p>
                <p className="text-xs mt-1">Monitoring {totalActiveTaxis || 0} taxis</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-[#2a2a2a] rounded-lg p-2.5 border border-[#3a3a3a] hover:border-[#4a4a4a] transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex-shrink-0">
                      {getEventIcon(activity.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium">
                            Taxi {activity.taxiId}
                          </p>
                          <p className="text-xs text-gray-300 truncate">
                            {activity.message}
                          </p>
                        </div>
                        <Badge 
                          variant={getSeverityColor(activity.severity)}
                          className="text-xs shrink-0 px-1.5 py-0.5"
                        >
                          {activity.severity.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(activity.timestamp)}
                        </span>
                        
                        {activity.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3" />
                            {activity.location}
                          </span>
                        )}
                      </div>
                      
                      {activity.details && (
                        <div className="mt-1 text-xs text-gray-500">
                          {activity.type === 'speed_change' && activity.details.speed && (
                            <span>Speed: {activity.details.speed.toFixed(1)} km/h</span>
                          )}
                          {activity.type === 'violation' && activity.details.violationCount && (
                            <span>Count: {activity.details.violationCount}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}