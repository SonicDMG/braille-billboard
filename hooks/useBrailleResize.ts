'use client'

import { useState, useEffect, useCallback, RefObject } from 'react'

interface GridDimensions {
  cols: number
  rows: number
}

/**
 * Calculate the braille character grid that fits the given container element
 * (or the window if no ref is provided) at the given font size.
 * Debounced 150ms to avoid thrashing on resize.
 */
export function useBrailleResize(
  fontSize: number,
  headerRows: number = 2,
  footerRows: number = 2,
  containerRef?: RefObject<HTMLElement | null>,
): GridDimensions {
  const calculate = useCallback((): GridDimensions => {
    const el = containerRef?.current
    const width = el ? el.clientWidth : window.innerWidth
    const height = el ? el.clientHeight : window.innerHeight
    const charWidth = fontSize * 0.6
    const charHeight = fontSize * 1.2
    const cols = Math.max(4, Math.floor(width / charWidth))
    const rows = Math.max(5, Math.floor(height / charHeight) - headerRows - footerRows)
    return { cols, rows }
  }, [fontSize, headerRows, footerRows, containerRef])

  // Start with zeros so server render and first client render agree (avoids hydration mismatch).
  const [dims, setDims] = useState<GridDimensions>({ cols: 0, rows: 0 })

  useEffect(() => {
    setDims(calculate())
    let timer: ReturnType<typeof setTimeout>

    // Use ResizeObserver on the container when available, else fall back to window resize
    const el = containerRef?.current
    let ro: ResizeObserver | null = null
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        clearTimeout(timer)
        timer = setTimeout(() => setDims(calculate()), 150)
      })
      ro.observe(el)
    } else {
      const handler = () => {
        clearTimeout(timer)
        timer = setTimeout(() => setDims(calculate()), 150)
      }
      window.addEventListener('resize', handler)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('resize', handler)
      }
    }

    return () => {
      clearTimeout(timer)
      ro?.disconnect()
    }
  }, [calculate, containerRef])

  return dims
}
