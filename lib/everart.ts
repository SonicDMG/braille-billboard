/**
 * everart.ts — server-side only
 *
 * Generates a portrait image for a billboard query using the EverArt API,
 * then converts the result to a SpriteData map that the dot-matrix renderer
 * can consume directly.
 *
 * Uses sharp for server-side pixel sampling — never import this in browser code.
 */

import EverArt from 'everart'
import sharp from 'sharp'
import type { SpriteData } from './types'

// EverArt's general-purpose base model ID for txt2img
const EVERART_MODEL_ID = '5000'

// Sprite source resolution. buildSpriteDots resamples this to fit the actual
// dot region at render time. The image region is now ~52% of total canvas
// columns, so a 256px source gives a healthy 2–3× oversampling ratio while
// keeping the JSON payload under ~500 KB after background masking.
const SPRITE_SOURCE_PX = 256

let _client: EverArt | null = null

function getClient(): EverArt {
  if (!_client) {
    const apiKey = process.env.EVERART_API_KEY
    if (!apiKey) throw new Error('EVERART_API_KEY is not set')
    _client = new EverArt(apiKey)
  }
  return _client
}

/**
 * Build an image-generation prompt from the LLM's visualDescription field.
 * Falls back to the billboard title when no description is available.
 */
function buildImagePrompt(title: string, visualDescription?: string): string {
  const subject = visualDescription?.trim() || title
  return `${subject} Plain black background. Vivid colors, high contrast, simple iconic flat illustration style. No text. No borders. No background scenery.`
}

// Pixels below this luminance are treated as near-black background — dropped.
const BG_DARK_THRESHOLD = 30   // 0–255
// Pixels above this luminance AND with low saturation are near-white background — dropped.
const BG_LIGHT_THRESHOLD = 220  // 0–255
const BG_SATURATION_MAX  = 30   // 0–255; grey/white pixels have saturation near zero

/**
 * Convert a PNG Buffer to a SpriteData at native image resolution.
 * Transparent pixels (alpha < 128) and near-black background pixels
 * (luminance < BG_LUMINANCE_THRESHOLD) are omitted so only the subject
 * fires dots on the display.
 * buildSpriteDots handles the final scale-down to fit the region.
 */
async function pngToSpriteData(pngBuffer: Buffer): Promise<SpriteData> {
  const { data, info } = await sharp(pngBuffer)
    .resize(SPRITE_SOURCE_PX, SPRITE_SOURCE_PX, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height } = info
  const sprite: SpriteData = {}

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const a = data[i + 3]!
      if (a < 128) continue
      // Perceived luminance (BT.601 coefficients)
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      if (luma < BG_DARK_THRESHOLD) continue
      // Near-white background: bright AND desaturated
      if (luma > BG_LIGHT_THRESHOLD) {
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const saturation = max - min   // 0 = grey, 255 = fully saturated
        if (saturation < BG_SATURATION_MAX) continue
      }
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
      sprite[`${y},${x}`] = hex
    }
  }

  return sprite
}

/**
 * Generate a portrait sprite for a billboard.
 *
 * Creates a txt2img generation, polls until complete, fetches the PNG, and
 * returns a SpriteData ready for storage and wire transfer.
 * Throws if the API key is missing, generation fails, or the image can't be fetched.
 */
export async function generatePortraitSprite(title: string, visualDescription?: string): Promise<SpriteData> {
  const client = getClient()
  const prompt = buildImagePrompt(title, visualDescription)
  console.log('[everart] generating portrait — prompt:', prompt)

  const [generation] = await client.v1.generations.create(
    EVERART_MODEL_ID,
    prompt,
    'txt2img',
    { imageCount: 1, width: 512, height: 512 },
  )
  if (!generation) throw new Error('EverArt returned no generation')

  const completed = await client.v1.generations.fetchWithPolling(generation.id)
  if (completed.status !== 'SUCCEEDED' || !completed.image_url) {
    throw new Error(`EverArt generation ${completed.status}: ${completed.id}`)
  }

  console.log('[everart] generation succeeded, fetching image:', completed.image_url)
  const res = await fetch(completed.image_url)
  if (!res.ok) throw new Error(`Failed to fetch EverArt image: ${res.status}`)
  const pngBuffer = Buffer.from(await res.arrayBuffer())

  return pngToSpriteData(pngBuffer)
}
