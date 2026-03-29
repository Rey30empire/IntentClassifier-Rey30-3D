'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  Bounds,
  Clone,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
} from '@react-three/drei'
import { Loader2, Package } from 'lucide-react'

function RuntimeModel({ url }: { url: string }) {
  const { scene } = useGLTF(url)

  return (
    <Bounds fit clip observe margin={1.15}>
      <Clone object={scene} />
    </Bounds>
  )
}

function PreviewFallback() {
  return (
    <Html center>
      <div className="text-center text-muted-foreground rounded-xl border border-border/40 bg-background/80 backdrop-blur px-4 py-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
        <p className="text-sm">Cargando preview 3D...</p>
      </div>
    </Html>
  )
}

export function RuntimeAssetPreview({
  runtimeUrl,
  title,
}: {
  runtimeUrl: string | null
  title: string
}) {
  if (!runtimeUrl) {
    return (
      <div className="h-[280px] rounded-xl border border-dashed border-border/50 bg-secondary/20 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-60" />
          <p className="font-medium">Preview no disponible</p>
          <p className="text-sm">Este asset todavia no tiene una entrada GLB runtime.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[280px] rounded-xl overflow-hidden border border-border/40 bg-gradient-to-b from-secondary/30 to-background relative">
      <Canvas camera={{ position: [0, 1.4, 3.4], fov: 40 }}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[4, 6, 5]} intensity={2.5} />
        <Suspense fallback={<PreviewFallback />}>
          <RuntimeModel url={runtimeUrl} />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.4} maxDistance={8} />
      </Canvas>
      <div className="absolute bottom-3 left-3 rounded-md bg-background/75 backdrop-blur px-2 py-1 text-xs text-foreground border border-border/40">
        {title}
      </div>
    </div>
  )
}

export default RuntimeAssetPreview
