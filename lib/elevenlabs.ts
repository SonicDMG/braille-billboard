const ELEVENLABS_API = 'https://api.elevenlabs.io/v1/music'

/**
 * Generate ambient music audio from a natural-language prompt via ElevenLabs.
 * Returns an ArrayBuffer of mp3 audio data.
 * Throws on non-200 responses.
 */
export async function generateMusicAudio(prompt: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set')

  const body = {
    prompt,
    music_length_ms: 30000,
    force_instrumental: true,
  }

  console.log('[elevenlabs] → prompt:', prompt)
  console.log('[elevenlabs] → body:', JSON.stringify(body))

  const res = await fetch(ELEVENLABS_API, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  console.log('[elevenlabs] ← status:', res.status, res.statusText)

  if (!res.ok) {
    const errText = await res.text().catch(() => '(no body)')
    console.error('[elevenlabs] ← error body:', errText)
    throw new Error(`ElevenLabs API error: ${res.status} ${res.statusText} — ${errText}`)
  }

  const buffer = await res.arrayBuffer()
  console.log('[elevenlabs] ← audio bytes:', buffer.byteLength)
  return buffer
}
