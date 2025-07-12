"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { getTaxiViolations } from "@/lib/api" // 🔧 FIXED: Use centralized API

interface Violation {
  timestamp: string
  type: string
  location?: string
  description?: string
}

interface ViolationDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  taxiId: string
}

export function ViolationDetailsModal({ isOpen, onClose, taxiId }: ViolationDetailsModalProps) {
  const [violations, setViolations] = useState<Violation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOpen && taxiId) {
      setIsLoading(true)
      
      // 🔧 FIXED: Use the centralized API function instead of direct fetch
      getTaxiViolations(taxiId)
        .then((data) => {
          if (Array.isArray(data)) {
            setViolations(data)
          } else {
            console.warn("Unexpected violation response:", data)
            setViolations([])
          }
        })
        .catch((err) => {
          console.error("Failed to fetch violations:", err)
          setViolations([])
        })
        .finally(() => setIsLoading(false))
    }
  }, [isOpen, taxiId])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#1a1a1a] text-white border border-[#2a2a2a] shadow-lg z-[1000]">
        <DialogHeader>
          <DialogTitle className="text-red-400">Violations for Taxi ID: {taxiId}</DialogTitle>
          <DialogDescription className="text-gray-400">Live violation history</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        ) : violations.length === 0 ? (
          <p className="text-center text-gray-400">No violations recorded.</p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="space-y-4">
              {violations.map((v, idx) => (
                <li key={idx} className="bg-[#2a2a2a] rounded-lg p-3">
                  <div className="flex justify-between text-sm text-gray-300">
                    <span>{new Date(v.timestamp).toLocaleTimeString("en-US", { hour12: false })}</span>
                    <Badge variant="destructive">{v.type || "Violation"}</Badge>
                  </div>
                  {v.location && (
                    <div className="mt-1 text-gray-400 text-sm">{v.location}</div>
                  )}
                  {v.description && (
                    <div className="mt-1 text-gray-200">{v.description}</div>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}