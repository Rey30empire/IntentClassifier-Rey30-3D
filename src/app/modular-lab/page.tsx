'use client'

import dynamic from 'next/dynamic'

const ModularCharacterStudio = dynamic(
  () =>
    import('@/components/modular-lab/ModularCharacterStudio').then((module) => ({
      default: module.ModularCharacterStudio,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#13253b_0%,#07111d_42%,#04070e_100%)] text-white flex items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-black/20 px-8 py-6 text-center backdrop-blur">
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-holo-cyan to-holo-magenta animate-pulse" />
          <p className="text-lg font-medium">Inicializando Modular Character Lab</p>
          <p className="mt-1 text-sm text-slate-400">
            Cargando visor, editor y biblioteca de exportacion.
          </p>
        </div>
      </div>
    ),
  }
)

export default function ModularLabPage() {
  return <ModularCharacterStudio />
}
