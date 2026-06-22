'use client'

import { useEffect, useState } from 'react'
import { spinnerFrames } from '@/lib/braille-animations'

interface SetupScreenProps {
  missingVars: string[]
  fontSize: number
}

export function SetupScreen({ missingVars, fontSize }: SetupScreenProps) {
  const [spinnerChar, setSpinnerChar] = useState('⠋')

  useEffect(() => {
    const gen = spinnerFrames()
    const t = setInterval(() => {
      setSpinnerChar(gen.next().value)
    }, 100)
    return () => clearInterval(t)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#000000',
        color: '#ffffff',
        fontFamily: "'Courier New', monospace",
        gap: 24,
      }}
    >
      <div style={{ fontSize: fontSize * 3, lineHeight: 1, color: '#333333' }}>
        {spinnerChar}
      </div>
      <div style={{ fontSize: fontSize * 1.5, color: '#888888', letterSpacing: 4 }}>
        SETUP REQUIRED
      </div>
      <div style={{ fontSize: fontSize, color: '#555555', textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}>
          The following environment variables are missing in{' '}
          <span style={{ color: '#888888' }}>.env.local</span>:
        </div>
        {missingVars.map(v => (
          <div key={v} style={{ color: '#ff4444', marginBottom: 4 }}>
            ✕ {v}
          </div>
        ))}
        <div style={{ marginTop: 24, color: '#444444', fontSize: fontSize * 0.85 }}>
          Add them to .env.local and reload the page.
        </div>
      </div>
    </div>
  )
}
