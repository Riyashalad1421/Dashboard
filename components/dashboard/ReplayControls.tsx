"use client"
import React, { useState, useCallback } from 'react'
import { Play, Pause, RotateCcw, Gauge } from 'lucide-react'

interface ReplayControlsProps {
  onSpeedChange: (speed: number) => void
  onPlayPause: (isPlaying: boolean) => void
  onRestart: () => void
  isPlaying: boolean
  currentSpeed: number
}

export function ReplayControls({
  onSpeedChange,
  onPlayPause,
  onRestart,
  isPlaying,
  currentSpeed
}: ReplayControlsProps) {
  // Enhanced speed options with 0.25x and 3x
  const speedOptions = [0.25, 0.5, 1, 2, 3]
  
  const handleSpeedChange = useCallback((speed: number) => {
    onSpeedChange(speed)
  }, [onSpeedChange])
  
  const handlePlayPause = useCallback(() => {
    onPlayPause(!isPlaying)
  }, [isPlaying, onPlayPause])

  // Helper function to get speed label
  const getSpeedLabel = (speed: number) => {
    if (speed === 0.25) return '0.25x'
    if (speed === 0.5) return '0.5x'
    return `${speed}x`
  }

  // Helper function to get speed description
  const getSpeedDescription = (speed: number) => {
    switch (speed) {
      case 0.25: return 'Very Slow (4x slower)'
      case 0.5: return 'Slow (2x slower)'
      case 1: return 'Normal Speed'
      case 2: return 'Fast (2x faster)'
      case 3: return 'Very Fast (3x faster)'
      default: return `${speed}x Speed`
    }
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
      <div className="flex items-center justify-between">
        {/* Left: Title */}
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-blue-400">Replay Controls</h3>
        </div>

        {/* Center: Play/Pause and Restart */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayPause}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Play
              </>
            )}
          </button>

          <button
            onClick={onRestart}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-gray-600 hover:bg-gray-700 text-white transition-all duration-200"
          >
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>
        </div>

        {/* Right: Speed Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300 mr-2">Speed:</span>
          {speedOptions.map((speed) => (
            <button
              key={speed}
              onClick={() => handleSpeedChange(speed)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                currentSpeed === speed
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a] hover:text-white'
              }`}
              title={getSpeedDescription(speed)}
            >
              {getSpeedLabel(speed)}
            </button>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-gray-400">
                Status: {isPlaying ? 'Playing' : 'Paused'}
              </span>
            </div>
            <div className="text-gray-400">
              Speed: {getSpeedLabel(currentSpeed)} ({getSpeedDescription(currentSpeed)})
            </div>
          </div>
          <div className="text-gray-500 text-xs">
            Replay controls data flow and visualization speed
          </div>
        </div>
      </div>
    </div>
  )
}