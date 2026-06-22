'use client'

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'billboard-music-enabled'

/**
 * Persistent music on/off toggle backed by localStorage.
 * Calls stopAudio() immediately when toggled off.
 *
 * Starts as `true` on both server and client to avoid hydration mismatch.
 * After mount, reads the persisted value from localStorage and updates.
 */
export function useMusicToggle(stopAudio: () => void) {
  // Always start true — same on server and client — to avoid hydration mismatch.
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true)

  // After mount: sync from localStorage, then persist on every change.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setMusicEnabled(stored === 'true')
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(musicEnabled))
  }, [musicEnabled])

  const toggle = useCallback(() => {
    setMusicEnabled(prev => {
      const next = !prev
      if (!next) stopAudio()
      return next
    })
  }, [stopAudio])

  return { musicEnabled, toggle }
}
