/**
 * image-to-sprite.ts
 *
 * Browser-only utility.  Converts a raster image (PNG/JPEG) to a SpriteMap —
 * a sparse Map<"row,col", hexColor> that the dot-matrix renderer can merge
 * directly into its lit map.
 *
 * Do NOT import this module in any server-side code; it depends on
 * HTMLImageElement, HTMLCanvasElement, and URL.createObjectURL.
 */

import type { SpriteMap, SpriteData } from './types'

/**
 * Convert a raster image file (PNG or JPEG) to a SpriteMap at the target
 * dot-column width.  Aspect ratio is preserved.  Transparent pixels
 * (alpha < 128) produce no entry in the map.
 *
 * @param file     PNG or JPEG File from an <input type="file"> element
 * @param dotCols  Target sprite width in dot-columns
 * @returns        SpriteMap — entries only for non-transparent pixels
 */
export async function imageToSprite(file: File, dotCols: number): Promise<SpriteMap> {
  const url = URL.createObjectURL(file)
  try {
    return await _convertUrl(url, dotCols)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Convert a data-URL string (e.g. from FileReader.readAsDataURL) to a
 * SpriteMap.  Useful when the caller already has a data URL.
 */
export async function dataUrlToSprite(dataUrl: string, dotCols: number): Promise<SpriteMap> {
  return _convertUrl(dataUrl, dotCols)
}

/** Convert a SpriteMap to its JSON-serialisable plain-object form. */
export function spriteMapToData(map: SpriteMap): SpriteData {
  return Object.fromEntries(map)
}

/** Restore a SpriteMap from its JSON-serialisable plain-object form. */
export function spriteDataToMap(data: SpriteData): SpriteMap {
  return new Map(Object.entries(data))
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function _convertUrl(src: string, dotCols: number): Promise<SpriteMap> {
  const img = await _loadImage(src)

  const aspectRatio = img.naturalHeight / Math.max(1, img.naturalWidth)
  const dotRows = Math.max(1, Math.round(dotCols * aspectRatio))

  const canvas = document.createElement('canvas')
  canvas.width = dotCols
  canvas.height = dotRows

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('imageToSprite: could not get 2d canvas context')

  ctx.drawImage(img, 0, 0, dotCols, dotRows)
  const { data } = ctx.getImageData(0, 0, dotCols, dotRows)

  const map: SpriteMap = new Map()

  for (let y = 0; y < dotRows; y++) {
    for (let x = 0; x < dotCols; x++) {
      const i = (y * dotCols + x) * 4
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const a = data[i + 3]!

      if (a < 128) continue  // transparent — skip (dot stays unlit)

      map.set(`${y},${x}`, _toHex(r, g, b))
    }
  }

  return map
}

function _loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('imageToSprite: failed to load image'))
    img.src = src
  })
}

function _toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
