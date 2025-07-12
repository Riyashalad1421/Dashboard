"use client"

import React, { useState } from 'react'
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTaxiDataContext } from "@/context/taxi-data-context"
import { 
  Car, 
  AlertTriangle,
  Gauge,
  Eye,
  Search,
  X
} from "lucide-react"
import type { Taxi } from "@/lib/types"

interface SimpleLiveTaxiListProps {
  onTaxiSelect?: (taxi: Taxi | null) => void
  selectedTaxiId?: string | null
}

export function SimpleLiveTaxiList({ onTaxiSelect, selectedTaxiId }: SimpleLiveTaxiListProps) {
  const { activeTaxis, totalActiveTaxis } = useTaxiDataContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [filter, setFilter] = useState<'all' | 'violations' | 'high-speed'>('all')

  // Filter and search taxis
  const filteredTaxis = activeTaxis
    .filter(taxi => {
      // Search filter
      if (searchTerm && !taxi.id.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false
      }
      
      // Type filter
      switch (filter) {
        case 'violations':
          return taxi.violations > 0
        case 'high-speed':
          return taxi.avgSpeed > 60
        default:
          return true
      }
    })
    .slice(0, 25) // Limit to prevent performance issues

  const handleTaxiClick = (taxi: Taxi) => {
    console.log('🚕 LIST: Taxi clicked -', taxi.id)
    console.log('🚕 LIST: Current selected -', selectedTaxiId)
    console.log('🚕 LIST: Full taxi object:', taxi)
    
    if (!onTaxiSelect) {
      console.error('🚨 LIST: onTaxiSelect function not provided!')
      return
    }

    if (selectedTaxiId === taxi.id) {
      // Deselect if clicking the same taxi
      console.log('🔄 LIST: Deselecting taxi', taxi.id)
      onTaxiSelect(null)
    } else {
      // Select new taxi
      console.log('✅ LIST: Selecting taxi', taxi.id)
      onTaxiSelect(taxi)
    }
  }

  const handleDeselect = () => {
    console.log('❌ LIST: Manual deselect triggered')
    if (onTaxiSelect) {
      onTaxiSelect(null)
    }
  }

  const getViolationColor = (violations: number): string => {
    if (violations >= 3) return 'text-red-400'
    if (violations >= 1) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getSpeedColor = (speed: number): string => {
    if (speed > 80) return 'text-red-400'
    if (speed > 60) return 'text-yellow-400'
    return 'text-green-400'
  }

  const filterOptions = [
    { key: 'all', label: 'All', count: activeTaxis.length },
    { key: 'violations', label: 'Violations', count: activeTaxis.filter(t => t.violations > 0).length },
    { key: 'high-speed', label: 'High Speed', count: activeTaxis.filter(t => t.avgSpeed > 60).length }
  ]

  // Debug logs
  console.log('🚕 LIST RENDER: selectedTaxiId =', selectedTaxiId)
  console.log('🚕 LIST RENDER: Available taxis =', filteredTaxis.map(t => t.id))

  return (
    <div className="h-full flex flex-col text-white">
      {/* Header */}
      <div className="p-4 pb-3 flex-shrink-0 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold text-blue-400 flex items-center gap-2">
            <Car className="h-5 w-5" />
            Live Taxi List
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-gray-300 border-gray-600">
              {filteredTaxis.length} / {totalActiveTaxis}
            </Badge>
            {selectedTaxiId && (
              <button
                onClick={handleDeselect}
                className="text-blue-400 hover:text-blue-300 transition-colors"
                title="Deselect taxi"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Selected Taxi Indicator */}
        {selectedTaxiId && (
          <div className="mb-3 p-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-blue-300">Selected: Taxi {selectedTaxiId}</span>
              </div>
              <button
                onClick={handleDeselect}
                className="text-blue-400 hover:text-blue-300 transition-colors text-xs"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search taxi ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors text-sm"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-1">
          {filterOptions.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-3 py-1 rounded-md text-xs transition-all flex-1 ${
                filter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] hover:text-white'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Taxi List */}
      <div className="flex-1 min-h-0 p-2">
        <ScrollArea className="h-full custom-scrollbar">
          {filteredTaxis.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 px-4">
              <div className="text-center">
                <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {searchTerm || filter !== 'all' ? 'No matching taxis' : 'No active taxis'}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="text-xs text-blue-400 hover:underline mt-1"
                  >
                    Clear search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTaxis.map((taxi) => {
                const isSelected = selectedTaxiId === taxi.id
                return (
                  <div
                    key={taxi.id}
                    onClick={() => handleTaxiClick(taxi)}
                    className={`rounded-lg p-3 border cursor-pointer transition-all duration-200 card-hover ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 shadow-lg ring-2 ring-blue-500/30'
                        : 'bg-[#2a2a2a] border-[#3a3a3a] hover:border-blue-500 hover:bg-[#2f2f2f]'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-blue-400" />
                        <span className="font-medium text-white">Taxi {taxi.id}</span>
                        {isSelected && (
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3 text-blue-400" />
                            <span className="text-xs text-blue-400 font-medium">SELECTED</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Status Badge */}
                      {taxi.violations > 0 ? (
                        <Badge variant="destructive" className="text-xs px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {taxi.violations}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-green-600/20 text-green-400 border-green-600/30">
                          ✓ OK
                        </Badge>
                      )}
                    </div>

                    {/* Details Row */}
                    <div className="flex justify-between items-center text-xs">
                      {/* Speed */}
                      <div className="flex items-center gap-1">
                        <Gauge className="h-3 w-3 text-gray-400" />
                        <span className={getSpeedColor(taxi.avgSpeed || 0)}>
                          {taxi.avgSpeed?.toFixed(1) || '0'} km/h
                        </span>
                      </div>

                      {/* Last Update */}
                      <div className="text-gray-500">
                        {new Date(taxi.lastUpdate).toLocaleTimeString('en-US', { 
                          hour12: false, 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </div>
                    </div>

                    {/* Action Hint */}
                    <div className="mt-2 text-xs text-center">
                      <span className="text-gray-500">
                        {isSelected 
                          ? 'Click to deselect • Should be highlighted on map' 
                          : 'Click to locate and highlight on map'
                        }
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Footer Info */}
      {totalActiveTaxis > 25 && (
        <div className="p-3 border-t border-[#2a2a2a] flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">
            Showing first 25 taxis for optimal performance
          </p>
        </div>
      )}
    </div>
  )
}