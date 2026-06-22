'use client'

import { useState, useEffect, useCallback } from 'react'

interface GridDimensions {
  cols: number
  rows: number
}

/**
 * Calculate the braille character grid that fits the window at the given font size.
 * Debounced 150ms to avoid thrashing on resize.
 */
export function useBrailleResize(
  fontSize: number,
  headerRows: number = 2,
  footerRows: number = 2,
): GridDimensions {
  const calculate = useCallback((): GridDimensions => {
    // Monospace character dimensions at given font size (approximate)
    const charWidth = fontSize * 0.6
    const charHeight = fontSize * 1.2
    const cols = Math.max(20, Math.floor(window.innerWidth / charWidth))
    const rows = Math.max(5, Math.floor(window.innerHeight / charHeight) - headerRows - footerRows)
    return { cols, rows }
  }, [fontSize, headerRows, footerRows])

  // Start with zeros so server render and first client render agree (avoids hydration mismatch).
  // After mount, calculate real dimensions and subscribe to resize.
  const [dims, setDims] = useState<GridDimensions>({ cols: 0, rows: 0 })

  useEffect(() => {
    setDims(calculate())
    let timer: ReturnType<typeof setTimeout>
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setDims(calculate()), 150)
    }
    window.addEventListener('resize', handler)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handler)
    }
  }, [calculate])

  return dims
}
