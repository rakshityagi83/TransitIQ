import { useEffect, useId, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { searchStops } from '../api/client'

export default function StopField({
  label,
  stop,
  onSelect,
  placeholder,
}) {
  const inputId = useId()
  const listId = useId()
  const [query, setQuery] = useState(stop?.stop_name ?? '')
  const [trackedStopId, setTrackedStopId] = useState(stop?.stop_id ?? null)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const requestId = useRef(0)
  const timer = useRef(null)
  const controller = useRef(null)

  const incomingStopId = stop?.stop_id ?? null
  if (incomingStopId !== trackedStopId) {
    setTrackedStopId(incomingStopId)
    if (stop) {
      setQuery(stop.stop_name ?? '')
      setResults([])
      setOpen(false)
      setSearchError('')
      setSearching(false)
    }
  }

  useEffect(() => {
    if (!incomingStopId) return undefined
    clearTimeout(timer.current)
    controller.current?.abort()
    requestId.current += 1
    return undefined
  }, [incomingStopId])

  useEffect(() => () => {
    clearTimeout(timer.current)
    controller.current?.abort()
  }, [])

  function closeSearch() {
    clearTimeout(timer.current)
    controller.current?.abort()
    requestId.current += 1
    setResults([])
    setOpen(false)
    setSearching(false)
    setSearchError('')
  }

  function scheduleSearch(value) {
    clearTimeout(timer.current)
    controller.current?.abort()
    const trimmed = value.trim()
    if (!trimmed) {
      closeSearch()
      return
    }

    const currentId = ++requestId.current
    const abort = new AbortController()
    controller.current = abort
    timer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchStops(trimmed, 8, abort.signal)
        if (currentId !== requestId.current) return
        const stops = Array.isArray(data?.stops) ? data.stops : []
        setResults(stops)
        setActiveIndex(stops.length ? 0 : -1)
        setOpen(true)
        setSearchError('')
      } catch (error) {
        if (error?.name === 'AbortError' || currentId !== requestId.current) return
        setResults([])
        setActiveIndex(-1)
        setOpen(true)
        setSearchError(error.message || 'Stop search failed.')
      } finally {
        if (currentId === requestId.current) setSearching(false)
      }
    }, 300)
  }

  function choose(next) {
    closeSearch()
    onSelect(next)
    setQuery(next.stop_name)
  }

  function onChange(event) {
    const value = event.target.value
    setQuery(value)
    if (stop) onSelect(null)
    scheduleSearch(value)
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' && results.length) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => (index + 1) % results.length)
    } else if (event.key === 'ArrowUp' && results.length) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1))
    } else if (event.key === 'Enter' && open && results.length) {
      event.preventDefault()
      choose(results[Math.max(activeIndex, 0)])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const activeId = activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-200">
        {label}
      </label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-teal-400" aria-hidden="true" />
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? activeId : undefined}
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (results.length) setOpen(true)
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 120)
          }}
          className="w-full rounded-xl border border-slate-600/80 bg-[#0b1424] py-2.5 pr-3 pl-9 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>
      {stop ? (
        <p className="mt-1 text-xs text-slate-400">Selected stop ID {stop.stop_id}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">Choose a stop from the search results.</p>
      )}
      {searching ? <p className="mt-1 text-xs text-slate-400">Searching stops…</p> : null}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-600/80 bg-[#0d1728] py-1 shadow-xl"
        >
          {searchError ? (
            <li className="px-3 py-2 text-sm text-red-300">{searchError}</li>
          ) : null}
          {!searchError && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">No matching stops.</li>
          ) : null}
          {results.map((item, index) => (
            <li key={item.stop_id} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm ${
                  index === activeIndex ? 'bg-teal-400/15 text-teal-50' : 'text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                <span>{item.stop_name}</span>
                <span className="shrink-0 text-xs text-slate-400">ID {item.stop_id}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
