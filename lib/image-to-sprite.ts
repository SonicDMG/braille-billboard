/**
 * image-to-sprite.ts
 *
 * Browser-only utility.  Converts a raster image (PNG/JPEG/SVG) to a SpriteMap —
 * a sparse Map<"row,col", hexColor> that the dot-matrix renderer can merge
 * directly into its lit map.
 *
 * SVG files are handled the same way as raster images: the browser renders the
 * SVG into an HTMLImageElement and the canvas 2D context rasterises it at the
 * target dot-column size.  Transparent pixels (alpha < 128) are skipped.
 *
 * Do NOT import this module in any server-side code; it depends on
 * HTMLImageElement, HTMLCanvasElement, and URL.createObjectURL.
 */

import type { SpriteMap, SpriteData } from './types'

export interface ImageToSpriteOptions {
  /**
   * When true, flood-fill from all four corners of the rasterised image to
   * identify the dominant background colour and drop those pixels from the
   * returned SpriteMap.  Any pixel whose colour is within `maskTolerance`
   * luminance units of the sampled background colours is treated as background
   * and omitted.  Defaults to false.
   */
  maskBackground?: boolean
  /**
   * Per-channel tolerance (0–255) used when `maskBackground` is true.
   * Two pixels are considered the "same colour" when every RGB channel
   * differs by at most this value.  Defaults to 30.
   */
  maskTolerance?: number
}

/**
 * Convert an image file (PNG, JPEG, or SVG) to a SpriteMap at the target
 * dot-column width.  Aspect ratio is preserved.  Transparent pixels
 * (alpha < 128) produce no entry in the map.
 *
 * @param file     PNG, JPEG, or SVG File from an <input type="file"> element
 * @param dotCols  Target sprite width in dot-columns
 * @param opts     Optional processing options (e.g. background masking)
 * @returns        SpriteMap — entries only for non-transparent pixels
 */
export async function imageToSprite(file: File, dotCols: number, opts?: ImageToSpriteOptions): Promise<SpriteMap> {
  const url = URL.createObjectURL(file)
  try {
    return await _convertUrl(url, dotCols, opts)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Convert a data-URL string (e.g. from FileReader.readAsDataURL) to a
 * SpriteMap.  Useful when the caller already has a data URL.
 */
export async function dataUrlToSprite(dataUrl: string, dotCols: number, opts?: ImageToSpriteOptions): Promise<SpriteMap> {
  return _convertUrl(dataUrl, dotCols, opts)
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

async function _convertUrl(src: string, dotCols: number, opts?: ImageToSpriteOptions): Promise<SpriteMap> {
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

  // Build a background mask via corner-seeded flood fill when requested.
  const bgMask = opts?.maskBackground
    ? _buildBackgroundMask(data, dotCols, dotRows, opts.maskTolerance ?? 30)
    : null

  const map: SpriteMap = new Map()

  for (let y = 0; y < dotRows; y++) {
    for (let x = 0; x < dotCols; x++) {
      const i = (y * dotCols + x) * 4
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const a = data[i + 3]!

      if (a < 128) continue  // transparent — skip (dot stays unlit)
      if (bgMask?.[y * dotCols + x]) continue  // background pixel — skip

      map.set(`${y},${x}`, _toHex(r, g, b))
    }
  }

  return map
}

/**
 * Flood-fill from all four corners to identify background pixels.
 *
 * Seeds: the four corner pixels.  From each seed the fill spreads to
 * 4-connected neighbours whose colour is within `tolerance` on every RGB
 * channel of the seed colour.  Returns a flat boolean array indexed by
 * `y * width + x`.
 */
function _buildBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number,
): Uint8Array {
  const mask = new Uint8Array(width * height)

  // Collect seed pixels from all four corners.
  const seeds: Array<[number, number]> = [
    [0, 0],
    [0, width - 1],
    [height - 1, 0],
    [height - 1, width - 1],
  ]

  for (const [sy, sx] of seeds) {
    const si = (sy * width + sx) * 4
    const sr = data[si]!
    const sg = data[si + 1]!
    const sb = data[si + 2]!

    // BFS flood fill
    const queue: number[] = [sy * width + sx]
    while (queue.length > 0) {
      const idx = queue.pop()!
      if (mask[idx]) continue  // already visited
      mask[idx] = 1

      const py = Math.floor(idx / width)
      const px = idx % width
      const pi = idx * 4
      const pr = data[pi]!
      const pg = data[pi + 1]!
      const pb = data[pi + 2]!

      // Check 4-connected neighbours
      const neighbours: Array<[number, number]> = [
        [py - 1, px],
        [py + 1, px],
        [py, px - 1],
        [py, px + 1],
      ]
      for (const [ny, nx] of neighbours) {
        if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue
        const ni = ny * width + nx
        if (mask[ni]) continue  // already visited
        const npi = ni * 4
        // Accept neighbour if its colour is within tolerance of the seed colour
        if (
          Math.abs(data[npi]! - sr) <= tolerance &&
          Math.abs(data[npi + 1]! - sg) <= tolerance &&
          Math.abs(data[npi + 2]! - sb) <= tolerance
        ) {
          queue.push(ni)
        }
      }
    }
  }

  return mask
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
