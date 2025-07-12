"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTaxiDataContext } from "@/context/taxi-data-context"
import { motion } from "framer-motion"
import { CarFront, Gauge, MapPin, AlertTriangle } from "lucide-react"

export function MetricsPanel() {
  const {
    totalTaxis,
    totalActiveTaxis,
    totalAverageSpeed,
    totalViolations,
    totalDistance
  } = useTaxiDataContext()

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
    >
      <Card className="bg-[#1a1a1a] text-white border border-[#2a2a2a] shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Total Taxis (Seen)</CardTitle>
          <CarFront className="h-4 w-4 text-blue-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalTaxis}</div>
          <p className="text-xs text-gray-400">Unique taxis in stream (global)</p>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1a1a] text-white border border-[#2a2a2a] shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Active Taxis</CardTitle>
          <CarFront className="h-4 w-4 text-green-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalActiveTaxis}</div>
          <p className="text-xs text-gray-400">In current view (updated in last 30s)</p>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1a1a] text-white border border-[#2a2a2a] shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Average Speed</CardTitle>
          <Gauge className="h-4 w-4 text-purple-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAverageSpeed.toFixed(1)} km/h</div>
          <p className="text-xs text-gray-400">Avg. of taxis in current view</p>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1a1a] text-white border border-[#2a2a2a] shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Total Violations</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalViolations}</div>
          <p className="text-xs text-gray-400">Cumulative in current view</p>
        </CardContent>
      </Card>

      <Card className="bg-[#1a1a1a] text-white border border-[#2a2a2a] shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-300">Total Distance</CardTitle>
          <MapPin className="h-4 w-4 text-yellow-400" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {typeof totalDistance === "number" ? `${totalDistance.toFixed(2)} km` : "N/A"}
          </div>
          <p className="text-xs text-gray-400">Cumulative in current view</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}