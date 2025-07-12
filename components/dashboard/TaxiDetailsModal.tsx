"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Gauge, AlertTriangle, Route } from "lucide-react"
import { useState, useEffect } from "react"
import { getTaxiDetails, getTaxiViolations } from "@/lib/api"
import type { Taxi } from "@/lib/types"
import { ViolationDetailsModal } from "@/components/dashboard/ViolationDetailsModal"

interface TaxiDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  taxi: Taxi | null
}

export function TaxiDetailsModal({ isOpen, onClose, taxi }: TaxiDetailsModalProps) {
  const [details, setDetails] = useState<any>(null)
  const [violations, setViolations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && taxi) {
      setLoading(true)
      Promise.all([
        getTaxiDetails(taxi.id),
        getTaxiViolations(taxi.id),
      ])
        .then(([detailData, violationData]) => {
          setDetails(detailData)
          setViolations(violationData)
        })
        .catch((err) => {
          console.error("❌ Error loading taxi data:", err)
          setDetails(null)
          setViolations([])
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, taxi])

  const getSafeFixed = (val: any, digits: number = 1) => {
    const num = typeof val === "string" ? parseFloat(val) : val
    return typeof num === "number" && !isNaN(num) ? num.toFixed(digits) : "N/A"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-[#1a1a1a] text-white border border-[#2a2a2a] shadow-lg z-[1000]">
        <DialogHeader>
          <DialogTitle className="text-yellow-400">Taxi ID: {taxi?.id}</DialogTitle>
          <DialogDescription className="text-gray-400">Live taxi details & violations</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="animate-spin w-6 h-6 text-white" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#2a2a2a] p-3 rounded-lg">
                <Gauge className="inline mr-2" />
                Avg Speed:{" "}
                {details ? `${getSafeFixed(details.avgSpeed)} km/h` : "N/A"}
              </div>

              <div className="bg-[#2a2a2a] p-3 rounded-lg">
                <Route className="inline mr-2" />
                Distance:{" "}
                {details ? `${getSafeFixed(details.totalDistance)} km` : "N/A"}
              </div>

              <div className="bg-[#2a2a2a] p-3 rounded-lg col-span-2">
                <AlertTriangle className="inline mr-2 text-red-400" />
                Violations:{" "}
                {details?.violations ?? "N/A"}
              </div>
            </div>

            {/* Violations */}
            {violations.length > 0 && (
              <div className="mt-4">
                <h3 className="text-red-400 font-semibold mb-2">Violation History</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {violations.map((v, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#2f2f2f]">
                      <div className="flex justify-between text-sm text-gray-300">
                        <span>{new Date(v.timestamp).toLocaleString()}</span>
                        <Badge variant="destructive">{v.type === "Unknown" ? "Violation" : v.type}</Badge>
                      </div>
                      {v.location && (
                        <div className="text-gray-400 text-sm mt-1">{v.location}</div>
                      )}
                      {v.description && (
                        <div className="text-white mt-1">{v.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}