'use client'

import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  Bounds,
  Environment,
  Grid,
  Html,
  OrbitControls,
} from '@react-three/drei'
import { Loader2, Move3D, Package, ScanSearch } from 'lucide-react'
import {
  AxesHelper,
  Box3,
  Color,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SkeletonHelper,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { ModelAnalysis } from '@/lib/modular-lab/contracts'

function inferModelExtension(fileName: string | null, modelUrl: string | null) {
  const source = (fileName ?? modelUrl ?? '').toLowerCase()
  if (source.endsWith('.glb')) return '.glb'
  if (source.endsWith('.gltf')) return '.gltf'
  if (source.endsWith('.fbx')) return '.fbx'
  if (source.endsWith('.obj')) return '.obj'
  return '.glb'
}

async function loadModel(url: string, extension: string) {
  if (extension === '.fbx') {
    const loader = new FBXLoader()
    const root = await loader.loadAsync(url)
    return { root, animations: root.animations ?? [] }
  }

  if (extension === '.obj') {
    const loader = new OBJLoader()
    const root = await loader.loadAsync(url)
    return { root, animations: [] }
  }

  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(url)
  return { root: gltf.scene, animations: gltf.animations ?? [] }
}

function buildAnalysis(root: Object3D, fileName: string, extension: string, fileSize?: number, animationCount = 0): ModelAnalysis {
  const meshDescriptors: ModelAnalysis['meshes'] = []
  const materials = new Set<string>()
  const uniqueBones = new Set<string>()
  let boneCount = 0
  let hasRig = false

  root.traverse((node) => {
    if ((node as Mesh).isMesh) {
      const mesh = node as Mesh & {
        material: unknown
        skeleton?: { bones: Array<{ name: string }> }
      }
      const selectionId = mesh.name || mesh.uuid
      mesh.userData.meshSelectionId = selectionId

      const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const materialNames: string[] = []

      for (const material of meshMaterials) {
        if (!material || typeof material !== 'object') continue
        const materialName = 'name' in material && typeof material.name === 'string'
          ? material.name || 'material'
          : 'material'
        materials.add(materialName)
        materialNames.push(materialName)
      }

      const bones = 'skeleton' in mesh && mesh.skeleton
        ? mesh.skeleton.bones.map((bone) => bone.name).filter(Boolean)
        : []

      if (bones.length > 0) {
        hasRig = true
        for (const boneName of bones) {
          uniqueBones.add(boneName)
        }
      }

      const bounds = new Vector3()
      const center = new Vector3()
      const bbox = new Box3().setFromObject(mesh)
      bbox.getCenter(center)
      bbox.getSize(bounds)

      meshDescriptors.push({
        id: selectionId,
        name: selectionId,
        materialNames,
        hasSkinning: bones.length > 0,
        boneNames: bones,
        pivot: [mesh.position.x, mesh.position.y, mesh.position.z],
        scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
        boundingBox: {
          min: [bbox.min.x, bbox.min.y, bbox.min.z],
          max: [bbox.max.x, bbox.max.y, bbox.max.z],
        },
      })
    }
  })

  boneCount = uniqueBones.size

  return {
    name: fileName.replace(/\.[^/.]+$/, ''),
    format: extension.replace('.', ''),
    size: fileSize ?? 0,
    meshCount: meshDescriptors.length,
    materialCount: materials.size,
    hasRig,
    boneCount,
    animationCount,
    hasAnimations: animationCount > 0,
    meshes: meshDescriptors,
  }
}

function applyDisplayState(root: Object3D, selectedMeshIds: Set<string>, wireframe: boolean) {
  root.traverse((node) => {
    if (!(node as Mesh).isMesh) return

    const mesh = node as Mesh & { material: unknown }
    const selectionId = (mesh.userData.meshSelectionId as string | undefined) ?? mesh.name ?? mesh.uuid
    const isSelected = selectedMeshIds.has(selectionId)
    const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

    for (const material of materialList) {
      if (!(material instanceof MeshStandardMaterial)) {
        continue
      }

      if (!('baseColor' in material.userData)) {
        material.userData.baseColor = material.color.clone()
      }

      const baseColor = material.userData.baseColor as Color
      material.color.copy(baseColor)
      material.emissive = material.emissive ?? new Color('#000000')
      material.emissive.set(isSelected ? '#00d4ff' : '#000000')
      material.wireframe = wireframe
      material.needsUpdate = true
    }
  })
}

function ViewerState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Html center>
      <div className="rounded-xl border border-border/40 bg-background/90 backdrop-blur px-4 py-3 text-center">
        <div className="mx-auto mb-2 w-10 h-10 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Html>
  )
}

function LoadedViewerModel({
  modelUrl,
  fileName,
  fileSize,
  selectedMeshIds,
  onToggleMesh,
  onAnalysis,
  onSourceReady,
  wireframe,
  showBones,
  showPivots,
}: {
  modelUrl: string
  fileName: string | null
  fileSize?: number
  selectedMeshIds: Set<string>
  onToggleMesh: (meshId: string) => void
  onAnalysis: (analysis: ModelAnalysis) => void
  onSourceReady: (root: Object3D | null) => void
  wireframe: boolean
  showBones: boolean
  showPivots: boolean
}) {
  const [displayRoot, setDisplayRoot] = useState<Object3D | null>(null)
  const [skeletonHelpers, setSkeletonHelpers] = useState<SkeletonHelper[]>([])
  const [pivotHelpers, setPivotHelpers] = useState<AxesHelper[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const extension = useMemo(
    () => inferModelExtension(fileName, modelUrl),
    [fileName, modelUrl]
  )

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError(null)

        const { root, animations } = await loadModel(modelUrl, extension)
        if (!active) return

        const sourceRoot = SkeletonUtils.clone(root)
        sourceRoot.name = 'modular-source-root'
        onSourceReady(sourceRoot)

        const nextDisplayRoot = SkeletonUtils.clone(sourceRoot)
        nextDisplayRoot.name = 'modular-display-root'

        const nextSkeletonHelpers: SkeletonHelper[] = []
        const nextPivotHelpers: AxesHelper[] = []

        nextDisplayRoot.traverse((node) => {
          if ((node as Mesh).isMesh) {
            const mesh = node as Mesh
            const selectionId = (mesh.userData.meshSelectionId as string | undefined) ?? mesh.name ?? mesh.uuid
            mesh.userData.meshSelectionId = selectionId

            if (showPivots) {
              const helper = new AxesHelper(0.08)
              helper.position.copy(mesh.position)
              nextPivotHelpers.push(helper)
            }
          }

          if (showBones && node.type === 'SkinnedMesh') {
            nextSkeletonHelpers.push(new SkeletonHelper(node))
          }
        })

        setDisplayRoot(nextDisplayRoot)
        setSkeletonHelpers(nextSkeletonHelpers)
        setPivotHelpers(nextPivotHelpers)
        onAnalysis(buildAnalysis(sourceRoot, fileName ?? 'model', extension, fileSize, animations.length))
      } catch (caughtError) {
        console.error('Modular model load error:', caughtError)
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'No se pudo cargar el modelo 3D.'
          )
          onSourceReady(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [extension, fileName, fileSize, modelUrl, onAnalysis, onSourceReady, showBones, showPivots])

  useEffect(() => {
    if (!displayRoot) return
    applyDisplayState(displayRoot, selectedMeshIds, wireframe)
  }, [displayRoot, selectedMeshIds, wireframe])

  if (loading) {
    return (
      <ViewerState
        icon={<Loader2 className="w-8 h-8 animate-spin" />}
        title="Cargando modelo"
        description="Preparando visor 3D y analisis de meshes."
      />
    )
  }

  if (error || !displayRoot) {
    return (
      <ViewerState
        icon={<Package className="w-8 h-8" />}
        title="Preview no disponible"
        description={error ?? 'No se pudo inicializar el modelo 3D.'}
      />
    )
  }

  return (
    <>
      <Bounds fit clip observe margin={1.15}>
        <primitive
          object={displayRoot}
          onClick={(event) => {
            event.stopPropagation()
            const meshObject = event.object as Mesh
            const selectionId =
              (meshObject.userData.meshSelectionId as string | undefined) ??
              meshObject.name ??
              meshObject.uuid
            onToggleMesh(selectionId)
          }}
        />
      </Bounds>
      {showBones &&
        skeletonHelpers.map((helper) => (
          <primitive key={helper.uuid} object={helper} />
        ))}
      {showPivots &&
        pivotHelpers.map((helper) => (
          <primitive key={helper.uuid} object={helper} />
        ))}
    </>
  )
}

export function ModularModelViewer({
  modelUrl,
  fileName,
  fileSize,
  selectedMeshIds,
  onToggleMesh,
  onAnalysis,
  onSourceReady,
  wireframe,
  showBones,
  showPivots,
  background,
}: {
  modelUrl: string | null
  fileName: string | null
  fileSize?: number
  selectedMeshIds: Set<string>
  onToggleMesh: (meshId: string) => void
  onAnalysis: (analysis: ModelAnalysis) => void
  onSourceReady: (root: Object3D | null) => void
  wireframe: boolean
  showBones: boolean
  showPivots: boolean
  background: 'studio' | 'sunset' | 'night'
}) {
  if (!modelUrl) {
    return (
      <div className="h-[520px] rounded-2xl border border-dashed border-border/40 bg-secondary/10 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ScanSearch className="w-12 h-12 mx-auto mb-3 opacity-60" />
          <p className="font-medium">Sube un modelo para comenzar</p>
          <p className="text-sm">El visor mostrara meshes, huesos y pivotes automaticamente.</p>
        </div>
      </div>
    )
  }

  const environmentPreset = background === 'night' ? 'night' : background === 'sunset' ? 'sunset' : 'studio'

  return (
    <div className="relative h-[520px] rounded-2xl overflow-hidden border border-border/40 bg-background">
      <Canvas camera={{ position: [1.8, 1.4, 3.8], fov: 42 }}>
        <color attach="background" args={[background === 'night' ? '#050816' : background === 'sunset' ? '#1a0f12' : '#09131f']} />
        <ambientLight intensity={1.3} />
        <directionalLight position={[5, 6, 5]} intensity={2.4} />
        <Grid
          args={[8, 8]}
          cellSize={0.4}
          cellThickness={0.5}
          sectionSize={2}
          sectionThickness={1}
          fadeDistance={18}
        />
        <LoadedViewerModel
          modelUrl={modelUrl}
          fileName={fileName}
          fileSize={fileSize}
          selectedMeshIds={selectedMeshIds}
          onToggleMesh={onToggleMesh}
          onAnalysis={onAnalysis}
          onSourceReady={onSourceReady}
          wireframe={wireframe}
          showBones={showBones}
          showPivots={showPivots}
        />
        <Environment preset={environmentPreset} />
        <OrbitControls enablePan minDistance={1.2} maxDistance={12} />
      </Canvas>
      <div className="absolute bottom-4 left-4 rounded-md border border-border/40 bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
        <Move3D className="inline-block w-3 h-3 mr-1" />
        Click mesh para asignar a la parte activa
      </div>
    </div>
  )
}

export default ModularModelViewer
