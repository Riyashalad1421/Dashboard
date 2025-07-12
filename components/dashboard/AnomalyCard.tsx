"use client"

import React from 'react'
import { LucideIcon } from 'lucide-react'

interface AnomalyCardProps {
  icon: LucideIcon
  label: string
  taxiId?: string
  primaryValue: string
  secondaryValue?: string
  location?: string
  iconColor?: string
  bgColor?: string
}

export function AnomalyCard({
  icon: Icon,
  label,
  taxiId,
  primaryValue,
  secondaryValue,
  location,
  iconColor = "text-blue-400",
  bgColor = "bg-[#2a2a2a]"
}: AnomalyCardProps) {
  return (
    <div className={`${bgColor} rounded-lg p-4 border border-[#3a3a3a] hover:border-[#4a4a4a] transition-all duration-200 h-full flex flex-col hover:shadow-lg overflow-hidden card-hover`}>
      {/* Header with icon and label */}
      <div className="flex items-center gap-3 mb-3 flex-shrink-0">
        <div className={`p-2 rounded-lg ${bgColor.replace('bg-', 'bg-').replace('/20', '/30')}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <span className="text-sm font-medium text-gray-300 truncate flex-1">{label}</span>
      </div>
      
      {/* Main content */}
      {taxiId ? (
        <div className="flex-1 flex flex-col justify-between min-h-0">
          {/* Taxi ID */}
          <div className="mb-3 flex-shrink-0">
            <div className="text-lg font-bold text-white truncate">Taxi {taxiId}</div>
          </div>
          
          {/* Primary value */}
          <div className="mb-3 flex-shrink-0">
            <div className="text-xl font-semibold text-white truncate">{primaryValue}</div>
            {secondaryValue && (
              <div className="text-sm text-gray-400 truncate">{secondaryValue}</div>
            )}
          </div>
          
          {/* Location */}
          {location && (
            <div className="text-sm text-gray-500 truncate flex-shrink-0" title={location}>
              📍 {location}
            </div>
          )}
        </div>
      ) : (
        /* No data fallback */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 text-base">No Data</div>
            <div className="text-sm text-gray-600 mt-1">Available</div>
          </div>
        </div>
      )}
    </div>
  )
}