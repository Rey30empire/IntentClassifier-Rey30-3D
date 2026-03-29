import { NextResponse } from 'next/server'
import {
  readRuntimeRegistryFromDisk,
  sortRuntimeAssets,
} from '@/lib/assets/runtime-registry'

export async function GET() {
  try {
    const registry = await readRuntimeRegistryFromDisk()

    return NextResponse.json({
      generatedAt: registry.generated_at,
      stats: registry.stats,
      assets: sortRuntimeAssets(registry.assets),
      scenes: registry.scenes,
    })
  } catch (error) {
    console.error('Registry API error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'registry_unavailable',
        message: 'No se pudo cargar el registro de assets runtime.',
      },
      { status: 500 }
    )
  }
}
