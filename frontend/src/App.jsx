
import { useEffect, useState } from 'react'
import { BusFront } from 'lucide-react'
import CrowdingExplorer from './components/CrowdingExplorer'
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

        setHealthState(
          data?.status === 'healthy'
            ? 'online'
            : 'offline'
        )

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

  function changeView(nextView) {
    setView(nextView)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  return (

    <div className="app-background flex min-h-screen flex-col text-slate-200">

      <Header
        view={view}
        onView={changeView}
        health={health}
        healthState={healthState}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-8 sm:px-8">

      {view === 'planner' && <JourneyPlanner />}
      {view === 'explorer' && <CrowdingExplorer />}
      {view === 'analytics' && <AnalyticsView />}
      {view === 'about' && <AboutView />}

      </main>

      <footer className="border-t border-slate-800 bg-[#080f1c]">

        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-8">

          <div className="flex items-center gap-3">

            <BusFront className="size-5 text-teal-400" />

            <div>

              <p className="text-sm font-semibold text-slate-200">
                TransitIQ
              </p>

              <p className="text-xs text-slate-400">
                Travel smarter. Ride comfortably.
              </p>

            </div>

          </div>

          <div className="text-xs leading-relaxed text-slate-400">
            Powered by Delhi Bus GTFS and ONDC ticketing data.
            <br />
            Historical crowdedness estimates. Scheduled timings.
          </div>

          <span className="text-xs text-slate-400">
            Team SAG | Hackathon 2026
          </span>

        </div>

      </footer>

    </div>
  )
}
