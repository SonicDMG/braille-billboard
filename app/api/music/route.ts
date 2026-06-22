import { NextRequest, NextResponse } from 'next/server'
import { generateMusicAudio } from '@/lib/elevenlabs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prompt?: unknown }
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''

    if (!prompt) {
      console.warn('[/api/music] missing prompt')
      return new NextResponse(null, { status: 400 })
    }

    console.log('[/api/music] prompt:', prompt)

    const audio = await generateMusicAudio(prompt)

    console.log('[/api/music] audio bytes returned:', audio.byteLength)

    return new NextResponse(audio, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (err) {
    // Music failures are always silent to the client — return 500 with no body
    console.error('[/api/music] error:', err instanceof Error ? err.message : String(err))
    return new NextResponse(null, { status: 500 })
  }
}
