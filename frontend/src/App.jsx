import { useEffect, useState } from 'react'
import { getHealth } from './api/client'
import Header from './components/Header'
import JourneyPlanner from './components/JourneyPlanner'
import AnalyticsView from './components/AnalyticsView'
import AboutView from './components/AboutView'

export default function App() {
  const [view, setView] = useState('planner')
  const [health, setHealth] = useState(null)
  const [healthState, setHealthState] = useState('checking')

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    async function loadHealth() {
      try {
        const data = await getHealth(controller.signal)
        if (!active) return
        setHealth(data)
        setHealthState(data?.status === 'healthy' ? 'online' : 'offline')
      } catch (error) {
        if (!active || error?.name === 'AbortError') return
        setHealth(null)
        setHealthState('offline')
      }
    }

    loadHealth()
    const timer = setInterval(loadHealth, 30000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#080f1c] text-slate-200">
      <Header view={view} onView={setView} health={health} healthState={healthState} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {view === 'planner' ? <JourneyPlanner /> : null}
        {view === 'analytics' ? <AnalyticsView /> : null}
        {view === 'about' ? <AboutView /> : null}
      </main>
    </div>
  )
}
