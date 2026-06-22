'use client'

import { useRef, useCallback } from 'react'

/**
 * Manages a single HTMLAudioElement with fade-in/out support.
 * All operations are silent on error.
 */
export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearFade = useCallback(() => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }, [])

  const play = useCallback((url: string) => {
    try {
      clearFade()

      // Revoke previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }

      const audio = new Audio(url)
      audio.loop = true
      audio.volume = 0
      audioRef.current = audio
      blobUrlRef.current = url

      void audio.play().then(() => {
        // Fade in over 1s
        const step = 0.05
        fadeTimerRef.current = setInterval(() => {
          if (!audioRef.current) return clearFade()
          audioRef.current.volume = Math.min(0.6, audioRef.current.volume + step)
          if (audioRef.current.volume >= 0.6) clearFade()
        }, 50)
      })
    } catch {
      // silent
    }
  }, [clearFade])

  const stop = useCallback(() => {
    try {
      clearFade()
      const audio = audioRef.current
      if (!audio) return

      // Fade out over 1s then pause
      const step = 0.05
      fadeTimerRef.current = setInterval(() => {
        if (!audio) return clearFade()
        audio.volume = Math.max(0, audio.volume - step)
        if (audio.volume <= 0) {
          clearFade()
          audio.pause()
          if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current)
            blobUrlRef.current = null
          }
          audioRef.current = null
        }
      }, 50)
    } catch {
      // silent
    }
  }, [clearFade])

  return { play, stop }
}
