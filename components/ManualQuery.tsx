'use client'

import { useState, useEffect, useRef } from 'react'

interface ManualQueryProps {
  onSubmit: (query: string) => void
  onClose: () => void
  fontSize: number
}

export function ManualQuery({ onSubmit, onClose, fontSize, isInitial = false }: ManualQueryProps & { isInitial?: boolean }) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    if (q) {
      onSubmit(q)
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '60%',
          maxWidth: 800,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: `${fontSize * 0.8}px`,
            color: '#555555',
            letterSpacing: 2,
          }}
        >
          {isInitial ? '⠿ WHAT WOULD YOU LIKE TO KNOW?' : '⠿ MANUAL QUERY — ESC TO CANCEL'}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Ask a question about your documents..."
          style={{
            background: '#0a0a0a',
            border: '1px solid #444444',
            color: '#ffffff',
            fontFamily: "'Courier New', monospace",
            fontSize: `${fontSize}px`,
            padding: '12px 16px',
            outline: 'none',
            borderRadius: 2,
          }}
        />
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: `${fontSize * 0.75}px`,
            color: '#444444',
          }}
        >
          ENTER to submit
        </div>
      </form>
    </div>
  )
}
