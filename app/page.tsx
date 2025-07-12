"use client"

import dynamic from "next/dynamic"
import { Suspense, useState } from "react"
import { MetricsPanel } from "@/components/dashboard/MetricsPanel"
import { LiveActivityFeed } from "@/components/dashboard/LiveActivityFeed"
import { SimpleLiveTaxiList } from "@/components/dashboard/SimpleLiveTaxiList"
import { FleetPerformanceMonitor } from "@/components/dashboard/FleetPerformanceMonitor"
import { InsightPanel } from "@/components/dashboard/InsightPanel"
import { ReplayControls } from "@/components/dashboard/ReplayControls"
import { TaxiDataProvider } from "@/context/taxi-data-context"
import { ReplayProvider, useReplayContext } from "@/context/replay-context"
import type { Taxi } from "@/lib/types"

// Dynamically import the map component to prevent SSR issues with Leaflet
const TaxiMap = dynamic(() => import("@/components/map/TaxiMap"), { ssr: false })

// Inner component that uses replay context
function DashboardContent() {
  const [selectedTaxi, setSelectedTaxi] = useState<Taxi | null>(null)
  const { isPlaying, currentSpeed, setIsPlaying, setCurrentSpeed, restart } = useReplayContext()

  const handleTaxiSelect = (taxi: Taxi | null) => {
    console.log('🏠 MAIN PAGE: Taxi selection changed:', taxi?.id || 'null')
    setSelectedTaxi(taxi)
  }

  const handleTaxiDeselect = () => {
    console.log('🏠 MAIN PAGE: Manual deselect triggered')
    setSelectedTaxi(null)
  }

  const handleSpeedChange = (speed: number) => {
    console.log(`🎛️ REPLAY: Speed changed to ${speed}x`)
    setCurrentSpeed(speed)
  }

  const handlePlayPause = (playing: boolean) => {
    console.log(`🎛️ REPLAY: ${playing ? 'Playing' : 'Paused'}`)
    setIsPlaying(playing)
  }

  const handleRestart = () => {
    console.log('🎛️ REPLAY: Restarting simulation')
    restart()
    setSelectedTaxi(null) // Clear selection on restart
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      {/* Header - Fixed at top */}
      <header className="sticky top-0 z-50 p-4 border-b border-[#2a2a2a] flex items-center justify-between bg-[#1a1a1a] shadow-lg">
        <h1 className="text-2xl font-bold text-green-400">Beijing Taxi Monitor</h1>
        {/* Debug indicator */}
        {selectedTaxi && (
          <div className="text-sm text-yellow-400 bg-blue-600/20 px-3 py-1 rounded-lg border border-blue-500/30">
            🎯 SELECTED: Taxi {selectedTaxi.id}
          </div>
        )}
      </header>

      <main className="p-4 space-y-4 bg-[#121212]">
        <TaxiDataProvider>
          {/* NEW: Replay Controls - Add this right after header */}
          <div>
            <ReplayControls
              onSpeedChange={handleSpeedChange}
              onPlayPause={handlePlayPause}
              onRestart={handleRestart}
              isPlaying={isPlaying}
              currentSpeed={currentSpeed}
            />
          </div>

          {/* Top Metrics Panel */}
          <div>
            <MetricsPanel />
          </div>
          
          {/* Main Content Area - Fixed height for map */}
          <div className="flex gap-4" style={{ height: '600px' }}>
            {/* Left Column - Live Taxi List */}
            <div className="w-80 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden flex-shrink-0">
              <SimpleLiveTaxiList 
                onTaxiSelect={handleTaxiSelect}
                selectedTaxiId={selectedTaxi?.id || undefined}
              />
            </div>

            {/* Center - Map */}
            <div className="flex-1 relative rounded-lg overflow-hidden border border-[#2a2a2a] min-w-0">
              <Suspense
                fallback={
                  <div className="flex justify-center items-center h-full w-full bg-gray-800 rounded-lg">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div>
                    <p className="ml-4 text-lg text-gray-400">Loading Map...</p>
                  </div>
                }
              >
                <TaxiMap 
                  selectedTaxi={selectedTaxi}
                  onTaxiDeselect={handleTaxiDeselect}
                />
              </Suspense>
            </div>

            {/* Right Column - Two Components Stacked */}
            <div className="w-80 flex flex-col gap-4 flex-shrink-0">
              {/* Top Right - Live Activity Feed */}
              <div className="h-72 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
                <LiveActivityFeed />
              </div>
              
              {/* Bottom Right - Fleet Performance Monitor */}
              <div className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
                <FleetPerformanceMonitor />
              </div>
            </div>
          </div>

          {/* Bottom Panel - Real-time Insights */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <InsightPanel />
          </div>

          {/* System Status & Connectivity - Updated with Replay Status */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-400 mb-4">System Status & Connectivity</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#2a2a2a] rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-300">WebSocket Connected</span>
                </div>
              </div>
              <div className="bg-[#2a2a2a] rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-300">Backend API Online</span>
                </div>
              </div>
              <div className="bg-[#2a2a2a] rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isPlaying ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                  <span className="text-sm text-gray-300">
                    Replay: {isPlaying ? `${currentSpeed}x Speed` : 'Paused'}
                  </span>
                </div>
              </div>
              <div className="bg-[#2a2a2a] rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-300">Data Processing Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">
              Beijing Taxi Monitor © 2025 - Real-time Traffic Monitoring System with Replay Controls
            </p>
          </footer>
        </TaxiDataProvider>
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ReplayProvider>
      <DashboardContent />
    </ReplayProvider>
  )
}