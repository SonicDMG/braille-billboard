import { NextRequest, NextResponse } from 'next/server'
import { queryForVisualization } from '@/lib/openrag'
import { parseVisualizationData } from '@/lib/parse-viz'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query?: unknown }
    const query = typeof body.query === 'string' ? body.query.trim() : ''

    if (!query) {
      return NextResponse.json({ ok: false, error: 'query is required' }, { status: 400 })
    }

    console.log('[/api/query] query:', query)

    const raw = await queryForVisualization(query)

    console.log('[/api/query] raw response length:', raw.length)

    let data
    try {
      data = parseVisualizationData(raw)
      console.log('[/api/query] parsed ok — chartType:', data.chartType, 'points:', data.dataPoints.length)
    } catch (parseErr) {
      console.error('[/api/query] parse failed:', parseErr)
      console.error('[/api/query] raw was:\n', raw)
      throw parseErr
    }

    return NextResponse.json({ ok: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[/api/query] error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
