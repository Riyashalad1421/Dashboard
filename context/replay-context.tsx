"use client"
import React, { createContext, useContext, useState, useCallback } from 'react'

interface ReplayContextType {
  isPlaying: boolean
  currentSpeed: number
  setIsPlaying: (playing: boolean) => void
  setCurrentSpeed: (speed: number) => void
  getDataUpdateInterval: () => number
  restart: () => void
}

const ReplayContext = createContext<ReplayContextType | undefined>(undefined)

export function ReplayProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(true) // Start playing by default
  const [currentSpeed, setCurrentSpeed] = useState(1) // Default 1x speed

  // Enhanced interval calculation for better taxi movement visualization
  const getDataUpdateInterval = useCallback(() => {
    if (!isPlaying) return Number.MAX_SAFE_INTEGER // Essentially pause
    
    // Base interval optimized for smooth taxi movement
    const baseInterval = 1000 // Base 1 second for better responsiveness
    
    // Calculate interval based on speed with better scaling
    let interval: number
    
    switch (currentSpeed) {
      case 0.25:
        interval = baseInterval * 4 // 4 seconds for very slow
        break
      case 0.5:
        interval = baseInterval * 2 // 2 seconds for slow
        break
      case 1:
        interval = baseInterval // 1 second for normal
        break
      case 2:
        interval = baseInterval / 2 // 0.5 seconds for fast
        break
      case 3:
        interval = baseInterval / 3 // ~0.33 seconds for very fast
        break
      default:
        interval = baseInterval / currentSpeed
    }
    
    // Ensure minimum interval for performance (100ms minimum)
    // and maximum for very slow speeds (8 seconds maximum)
    return Math.max(100, Math.min(8000, interval))
  }, [isPlaying, currentSpeed])

  const restart = useCallback(() => {
    // This could reset data or restart simulation
    console.log('🔄 Replay restarted')
    setIsPlaying(true)
    // In a real implementation, this might reset the data source
  }, [])

  // Enhanced logging for debugging
  React.useEffect(() => {
    const interval = getDataUpdateInterval()
    console.log(`🎮 Replay Settings: Speed=${currentSpeed}x, Interval=${interval}ms, Playing=${isPlaying}`)
  }, [currentSpeed, isPlaying, getDataUpdateInterval])

  const contextValue = {
    isPlaying,
    currentSpeed,
    setIsPlaying,
    setCurrentSpeed,
    getDataUpdateInterval,
    restart
  }

  return (
    <ReplayContext.Provider value={contextValue}>
      {children}
    </ReplayContext.Provider>
  )
}

export function useReplayContext() {
  const context = useContext(ReplayContext)
  if (context === undefined) {
    throw new Error('useReplayContext must be used within a ReplayProvider')
  }
  return context
}