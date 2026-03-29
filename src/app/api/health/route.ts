import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const checks = {
    app: 'ok',
    database: 'not_configured' as 'ok' | 'error' | 'not_configured',
    ai: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY),
  }

  if (process.env.DATABASE_URL) {
    try {
      await getDb().$queryRaw`SELECT 1`
      checks.database = 'ok'
    } catch (error) {
      console.error('Health check database error:', error)
      checks.database = 'error'
    }
  }

  const healthy = checks.database !== 'error'

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  )
}
