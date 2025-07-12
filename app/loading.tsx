export default function Loading() {
  return (
    <div className="flex justify-center items-center h-screen bg-gray-900 text-white">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-green-500"></div>
      <p className="ml-4 text-lg">Loading Dashboard...</p>
    </div>
  )
}
