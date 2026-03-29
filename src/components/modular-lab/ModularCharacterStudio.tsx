'use client'

import Link from 'next/link'
import {
  type ComponentType,
  startTransition,
  type ChangeEvent,
  useDeferredValue,
  useEffect,
  useState,
} from 'react'
import type { Object3D } from 'three'
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowUpFromLine,
  Boxes,
  Brain,
  CheckCircle2,
  Download,
  FolderDown,
  Link2,
  Loader2,
  Package2,
  RefreshCcw,
  Save,
  ScanSearch,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { FragmentationPayload, ModelAnalysis } from '@/lib/modular-lab/contracts'
import {
  fetchModularCharacters,
  saveFragmentationSchema,
  type ModularCharacterSummary,
  uploadFragmentedParts,
  uploadModularCharacter,
} from '@/lib/modular-lab/client'
import {
  buildAutoAssignments,
  exportFragmentAssignmentsToGlb,
} from '@/lib/modular-lab/export-client'
import { STANDARD_PARTS, SUPPORTED_MODEL_ACCEPT } from '@/lib/modular-lab/constants'
import {
  buildAssignmentsFromCharacter,
  buildZipDownloadUrl,
  formatBytes,
  getCompatibilityFindings,
  getCoverageStats,
  getStageLabel,
  getStageProgress,
  type ModularStudioStage,
} from '@/lib/modular-lab/ui'
import { ModularModelViewer } from '@/components/modular-lab/ModularModelViewer'

type ExportMode = 'static_modular' | 'rigged_modular'
type ViewerBackground = 'studio' | 'sunset' | 'night'

const EMPTY_ASSIGNMENTS = buildAssignmentsFromCharacter()

function upsertCharacter(
  list: ModularCharacterSummary[],
  nextCharacter: ModularCharacterSummary
) {
  return [
    nextCharacter,
    ...list.filter((character) => character.id !== nextCharacter.id),
  ]
}

function inferStageFromCharacter(character: ModularCharacterSummary): ModularStudioStage {
  if (character.workflowStatus === 'READY') return 'ready'
  if (character.workflowStatus === 'FRAGMENTED') return 'saving'
  if (character.workflowStatus === 'ANALYZED') return 'review'
  return 'idle'
}

export function ModularCharacterStudio() {
  const [characters, setCharacters] = useState<ModularCharacterSummary[]>([])
  const [isLibraryLoading, setIsLibraryLoading] = useState(true)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [localFile, setLocalFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewFileName, setPreviewFileName] = useState<string | null>(null)
  const [previewFileSize, setPreviewFileSize] = useState<number | undefined>(undefined)
  const [analysis, setAnalysis] = useState<ModelAnalysis | null>(null)
  const [sourceRoot, setSourceRoot] = useState<Object3D | null>(null)
  const [selectedMeshIds, setSelectedMeshIds] = useState<string[]>([])
  const [assignments, setAssignments] =
    useState<FragmentationPayload['assignments']>(EMPTY_ASSIGNMENTS)
  const [activePartKey, setActivePartKey] = useState<string>('head')
  const [fragmentationMode, setFragmentationMode] =
    useState<FragmentationPayload['mode']>('manual')
  const [exportMode, setExportMode] = useState<ExportMode>('static_modular')
  const [stage, setStage] = useState<ModularStudioStage>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [background, setBackground] = useState<ViewerBackground>('studio')
  const [wireframe, setWireframe] = useState(false)
  const [showBones, setShowBones] = useState(false)
  const [showPivots, setShowPivots] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const deferredLibrarySearch = useDeferredValue(librarySearch)
  const [selectedPartKeys, setSelectedPartKeys] = useState<string[]>([])

  const activeCharacter =
    characters.find((character) => character.id === activeCharacterId) ?? null
  const activeAssignment =
    assignments.find((assignment) => assignment.partKey === activePartKey) ?? null
  const filteredCharacters = characters.filter((character) => {
    const query = deferredLibrarySearch.trim().toLowerCase()
    if (!query) return true
    return (
      character.name.toLowerCase().includes(query) ||
      character.slug.toLowerCase().includes(query) ||
      character.sourceFormat.toLowerCase().includes(query)
    )
  })
  const coverage = getCoverageStats(analysis, assignments)
  const compatibilityFindings = getCompatibilityFindings(
    analysis,
    assignments,
    activeCharacter?.parts
  )

  useEffect(() => {
    setAssignments((currentAssignments) =>
      currentAssignments.map((assignment) =>
        assignment.exportMode === exportMode
          ? assignment
          : { ...assignment, exportMode }
      )
    )
  }, [exportMode])

  useEffect(() => {
    if (!localFile) {
      return undefined
    }

    const objectUrl = URL.createObjectURL(localFile)
    setPreviewUrl(objectUrl)
    setPreviewFileName(localFile.name)
    setPreviewFileSize(localFile.size)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [localFile])

  useEffect(() => {
    async function loadCharacters() {
      try {
        setIsLibraryLoading(true)
        setLibraryError(null)
        const loadedCharacters = await fetchModularCharacters()
        setCharacters(loadedCharacters)

        if (!activeCharacterId && !localFile && loadedCharacters[0]) {
          const nextCharacter = loadedCharacters[0]
          startTransition(() => {
            setActiveCharacterId(nextCharacter.id)
            setPreviewUrl(nextCharacter.sourceDownloadUrl)
            setPreviewFileName(nextCharacter.sourceFileName)
            setPreviewFileSize(nextCharacter.fileSize)
            setAnalysis(nextCharacter.analysis ?? null)
            setAssignments(buildAssignmentsFromCharacter(nextCharacter))
            setFragmentationMode(
              nextCharacter.fragmentationSchema?.mode ?? 'manual'
            )
            setExportMode(nextCharacter.hasRig ? 'rigged_modular' : 'static_modular')
            setSelectedPartKeys(nextCharacter.parts.map((part) => part.partKey))
            setStage(inferStageFromCharacter(nextCharacter))
          })
        }
      } catch (caughtError) {
        setLibraryError(
          caughtError instanceof Error
            ? caughtError.message
            : 'No se pudo cargar la biblioteca modular.'
        )
      } finally {
        setIsLibraryLoading(false)
      }
    }

    void loadCharacters()
  }, [])

  function hydrateCharacter(character: ModularCharacterSummary) {
    startTransition(() => {
      setActiveCharacterId(character.id)
      setLocalFile(null)
      setPreviewUrl(character.sourceDownloadUrl)
      setPreviewFileName(character.sourceFileName)
      setPreviewFileSize(character.fileSize)
      setAnalysis(character.analysis ?? null)
      setAssignments(buildAssignmentsFromCharacter(character))
      setSelectedMeshIds([])
      setSelectedPartKeys(character.parts.map((part) => part.partKey))
      setFragmentationMode(character.fragmentationSchema?.mode ?? 'manual')
      setExportMode(character.hasRig ? 'rigged_modular' : 'static_modular')
      setStage(inferStageFromCharacter(character))
      setError(null)
      setNotice(`Biblioteca modular cargada para ${character.name}.`)
    })
  }

  function hydrateLocalFile(file: File) {
    startTransition(() => {
      setLocalFile(file)
      setActiveCharacterId(null)
      setAnalysis(null)
      setSourceRoot(null)
      setAssignments(buildAssignmentsFromCharacter())
      setSelectedMeshIds([])
      setSelectedPartKeys([])
      setFragmentationMode('manual')
      setExportMode('static_modular')
      setStage('review')
      setError(null)
      setNotice(`Archivo listo para inspeccion: ${file.name}.`)
    })
  }

  function updateCharacter(nextCharacter: ModularCharacterSummary) {
    setCharacters((currentCharacters) =>
      upsertCharacter(currentCharacters, nextCharacter)
    )
    hydrateCharacter(nextCharacter)
  }

  function toggleMeshSelection(meshId: string) {
    setSelectedMeshIds((currentMeshIds) =>
      currentMeshIds.includes(meshId)
        ? currentMeshIds.filter((currentId) => currentId !== meshId)
        : [...currentMeshIds, meshId]
    )
  }

  function focusPart(partKey: string) {
    setActivePartKey(partKey)
    const partAssignment = assignments.find((assignment) => assignment.partKey === partKey)
    setSelectedMeshIds(partAssignment?.meshNames ?? [])
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setPendingFiles(files)
    hydrateLocalFile(files[0])
  }

  function assignSelectedMeshesToActivePart() {
    if (!activeAssignment || selectedMeshIds.length === 0) {
      setError('Selecciona una o varias meshes antes de asignarlas a una parte.')
      return
    }

    const selectedSet = new Set(selectedMeshIds)
    setAssignments((currentAssignments) =>
      currentAssignments.map((assignment) => {
        const nextMeshNames = assignment.meshNames.filter(
          (meshId) => !selectedSet.has(meshId)
        )

        if (assignment.partKey !== activeAssignment.partKey) {
          return {
            ...assignment,
            meshNames: nextMeshNames,
          }
        }

        return {
          ...assignment,
          meshNames: Array.from(new Set([...nextMeshNames, ...selectedMeshIds])),
          assignmentMode: 'manual',
          exportMode,
        }
      })
    )
    setFragmentationMode('manual')
    setNotice(`Meshes asignadas a ${activeAssignment.displayName}.`)
    setError(null)
  }

  function clearActivePartAssignment() {
    if (!activeAssignment) {
      return
    }

    setAssignments((currentAssignments) =>
      currentAssignments.map((assignment) =>
        assignment.partKey === activeAssignment.partKey
          ? { ...assignment, meshNames: [], assignmentMode: 'manual' }
          : assignment
      )
    )
    setSelectedMeshIds([])
  }

  function renameActivePart(displayName: string) {
    if (!activeAssignment) {
      return
    }

    setAssignments((currentAssignments) =>
      currentAssignments.map((assignment) =>
        assignment.partKey === activeAssignment.partKey
          ? { ...assignment, displayName }
          : assignment
      )
    )
  }

  async function handleUploadCharacter() {
    if (!localFile || !analysis) {
      setError('Necesito un modelo cargado y analizado antes de registrarlo.')
      return
    }

    try {
      setStage('uploading')
      setError(null)
      setNotice(null)
      const createdCharacter = await uploadModularCharacter(localFile, analysis)
      setPendingFiles((currentFiles) =>
        currentFiles.filter(
          (file) =>
            file.name !== localFile.name || file.lastModified !== localFile.lastModified
        )
      )
      updateCharacter(createdCharacter)
      setStage('review')
      setNotice(`Modelo ${createdCharacter.name} registrado en la biblioteca.`)
    } catch (caughtError) {
      setStage('error')
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo subir el personaje modular.'
      )
    }
  }

  async function handleSaveFragmentation() {
    if (!activeCharacter || !analysis) {
      setError('Registra o selecciona un personaje antes de guardar la fragmentacion.')
      return
    }

    try {
      setStage('saving')
      setError(null)
      const payload: FragmentationPayload = {
        mode: fragmentationMode,
        assignments,
        analysis,
      }
      const updatedCharacter = await saveFragmentationSchema(activeCharacter.id, payload)
      updateCharacter(updatedCharacter)
      setNotice('Esquema de fragmentacion guardado en PostgreSQL.')
    } catch (caughtError) {
      setStage('error')
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo guardar la fragmentacion.'
      )
    }
  }

  async function handleGenerateParts() {
    if (!activeCharacter || !analysis || !sourceRoot) {
      setError(
        'Necesitas un personaje registrado, analisis del modelo y el visor cargado antes de exportar partes.'
      )
      return
    }

    const populatedAssignments = assignments.filter(
      (assignment) => assignment.meshNames.length > 0
    )
    if (populatedAssignments.length === 0) {
      setError('Todavia no hay partes con meshes asignadas para exportar.')
      return
    }

    try {
      setStage('fragmenting')
      setError(null)
      setNotice(null)

      const fragmentationPayload: FragmentationPayload = {
        mode: fragmentationMode,
        assignments,
        analysis,
      }

      await saveFragmentationSchema(activeCharacter.id, fragmentationPayload)

      const bundle = await exportFragmentAssignmentsToGlb({
        sourceRoot,
        characterName: activeCharacter.name,
        analysis,
        assignments,
      })

      const updatedCharacter = await uploadFragmentedParts({
        characterId: activeCharacter.id,
        manifest: bundle.manifest,
        files: bundle.files,
      })

      updateCharacter(updatedCharacter)
      setSelectedPartKeys(updatedCharacter.parts.map((part) => part.partKey))
      setStage('ready')
      setNotice(
        `${updatedCharacter.parts.length} partes modulares publicadas y listas para descarga.`
      )
    } catch (caughtError) {
      setStage('error')
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudieron generar las partes modulares.'
      )
    }
  }

  function handleAutoFragment() {
    if (!analysis) {
      setError('Sube o selecciona un modelo antes de ejecutar la fragmentacion automatica.')
      return
    }

    const suggestedAssignments = buildAutoAssignments(analysis).map((assignment) => ({
      ...assignment,
      exportMode,
    }))
    setAssignments(suggestedAssignments)
    setFragmentationMode('auto')
    setSelectedMeshIds([])
    setStage('review')
    setNotice('Sugerencias automaticas aplicadas a partir de nombres de mesh y skinning.')
    setError(null)
  }

  function openDownload(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function toggleSelectedPartKey(partKey: string, checked: boolean) {
    setSelectedPartKeys((currentKeys) =>
      checked
        ? Array.from(new Set([...currentKeys, partKey]))
        : currentKeys.filter((currentKey) => currentKey !== partKey)
    )
  }

  function handleDownloadSelectedBundle() {
    if (!activeCharacter) {
      setError('Selecciona un personaje con partes exportadas para descargar un bundle.')
      return
    }

    openDownload(buildZipDownloadUrl(activeCharacter, exportMode, selectedPartKeys))
  }

  function handleDownloadFullBundle() {
    if (!activeCharacter) {
      setError('Selecciona un personaje antes de descargar el ZIP completo.')
      return
    }

    openDownload(buildZipDownloadUrl(activeCharacter, exportMode))
  }

  const currentMetadataPreview = JSON.stringify(
    {
      character: activeCharacter
        ? {
            id: activeCharacter.id,
            name: activeCharacter.name,
            workflowStatus: activeCharacter.workflowStatus,
            sourceFormat: activeCharacter.sourceFormat,
            meshCount: activeCharacter.meshCount,
            materialCount: activeCharacter.materialCount,
            hasRig: activeCharacter.hasRig,
            hasAnimations: activeCharacter.hasAnimations,
          }
        : null,
      analysis,
      assignments,
    },
    null,
    2
  )

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#13253b_0%,#07111d_42%,#04070e_100%)] text-foreground">
      <div className="mx-auto max-w-[1880px] p-4 md:p-6">
        <div className="mb-4 flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(0,212,255,0.06),0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-holo-cyan/30 bg-holo-cyan/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-holo-cyan">
                <Sparkles className="h-3.5 w-3.5" />
                Modular Character Lab
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-white">
                  Gestion y fragmentacion profesional de personajes 3D modulares
                </h1>
                <p className="mt-1 max-w-4xl text-sm text-slate-300">
                  Sube modelos en formatos FBX, OBJ, GLB o GLTF, inspecciona meshes y rigging,
                  fragmenta en piezas reutilizables y exporta paquetes Unity Ready sin romper el flujo actual del motor.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="border-holo-cyan/30 bg-holo-cyan/10 text-holo-cyan hover:bg-holo-cyan/20"
                onClick={() => {
                  setActiveCharacterId(null)
                  setLocalFile(null)
                  setPreviewUrl(null)
                  setPreviewFileName(null)
                  setPreviewFileSize(undefined)
                  setAnalysis(null)
                  setAssignments(buildAssignmentsFromCharacter())
                  setSelectedMeshIds([])
                  setSelectedPartKeys([])
                  setSourceRoot(null)
                  setStage('idle')
                  setNotice('Estudio reiniciado. Puedes empezar con un nuevo upload.')
                  setError(null)
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Nuevo flujo
              </Button>
              <Button
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={async () => {
                  try {
                    setIsLibraryLoading(true)
                    const loadedCharacters = await fetchModularCharacters()
                    setCharacters(loadedCharacters)
                    setLibraryError(null)
                  } catch (caughtError) {
                    setLibraryError(
                      caughtError instanceof Error
                        ? caughtError.message
                        : 'No se pudo recargar la biblioteca.'
                    )
                  } finally {
                    setIsLibraryLoading(false)
                  }
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Recargar biblioteca
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver a Nexus
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard
              label="Personajes registrados"
              value={characters.length.toString()}
              tone="cyan"
            />
            <MetricCard
              label="Partes creadas"
              value={characters.reduce((total, character) => total + character.parts.length, 0).toString()}
              tone="magenta"
            />
            <MetricCard
              label="Meshes asignadas"
              value={`${coverage.assignedMeshes}/${coverage.totalMeshes}`}
              tone="green"
            />
            <MetricCard
              label="Partes core completas"
              value={`${coverage.completedRequiredParts}/${coverage.requiredParts}`}
              tone="orange"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">{getStageLabel(stage)}</p>
                <p className="text-xs text-slate-400">
                  Estado actual del upload, guardado y exportacion modular.
                </p>
              </div>
              <Badge
                className={cn(
                  'border px-2 py-1 text-[11px] uppercase tracking-[0.18em]',
                  stage === 'error'
                    ? 'border-red-400/30 bg-red-500/10 text-red-200'
                    : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                )}
              >
                {stage}
              </Badge>
            </div>
            <Progress
              value={getStageProgress(stage)}
              className="h-2 bg-white/10 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-holo-cyan [&_[data-slot=progress-indicator]]:to-holo-magenta"
            />
          </div>

          {error ? (
            <Alert variant="destructive" className="border-red-500/30 bg-red-500/10">
              <AlertCircle />
              <AlertTitle>Error de flujo</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {notice ? (
            <Alert className="border-emerald-400/30 bg-emerald-500/10 text-emerald-50">
              <CheckCircle2 />
              <AlertTitle>Estado</AlertTitle>
              <AlertDescription className="text-emerald-100/90">
                {notice}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <Tabs defaultValue="dashboard" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 bg-white/5">
                  <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  <TabsTrigger value="upload">Subida</TabsTrigger>
                  <TabsTrigger value="library">Biblioteca</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-4">
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader>
                      <CardTitle className="text-white">Checklist MVP</CardTitle>
                      <CardDescription>
                        Estado del flujo minimo para produccion del modulo.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <ChecklistItem
                        label="1. Subir modelo"
                        done={Boolean(localFile || activeCharacter)}
                      />
                      <ChecklistItem
                        label="2. Visualizar en 3D"
                        done={Boolean(previewUrl)}
                      />
                      <ChecklistItem
                        label="3. Dividir en partes"
                        done={coverage.createdParts > 0}
                      />
                      <ChecklistItem
                        label="4. Guardar partes"
                        done={Boolean(activeCharacter?.parts.length)}
                      />
                      <ChecklistItem
                        label="5. Descargar individual"
                        done={Boolean(activeCharacter?.parts.length)}
                      />
                      <ChecklistItem
                        label="6. Descargar ZIP"
                        done={Boolean(activeCharacter)}
                      />
                      <ChecklistItem
                        label="7. Exportar Unity Ready"
                        done={Boolean(activeCharacter?.parts.length)}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-black/20">
                    <CardHeader>
                      <CardTitle className="text-white">Cobertura</CardTitle>
                      <CardDescription>
                        Control rapido de meshes, partes y compatibilidad.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm text-slate-200">
                      <InfoRow label="Meshes detectadas" value={coverage.totalMeshes.toString()} />
                      <InfoRow label="Meshes asignadas" value={coverage.assignedMeshes.toString()} />
                      <InfoRow label="Meshes pendientes" value={coverage.unassignedMeshes.toString()} />
                      <InfoRow label="Partes creadas" value={coverage.createdParts.toString()} />
                      <InfoRow
                        label="Rig detectado"
                        value={analysis?.hasRig ? 'Si' : 'No'}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-white/10 bg-black/20">
                    <CardHeader>
                      <CardTitle className="text-white">Compatibilidad modular</CardTitle>
                      <CardDescription>
                        Validaciones base para snap points, rig y coherencia de piezas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {compatibilityFindings.length === 0 ? (
                        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                          No se detectaron riesgos base de compatibilidad.
                        </div>
                      ) : (
                        compatibilityFindings.map((finding) => (
                          <div
                            key={finding}
                            className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100"
                          >
                            {finding}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="upload" className="space-y-4">
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader>
                      <CardTitle className="text-white">Subir modelo</CardTitle>
                      <CardDescription>
                        Acepta {SUPPORTED_MODEL_ACCEPT} y prepara metadatos para persistencia.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-holo-cyan/30 bg-holo-cyan/5 px-4 py-6 text-center">
                        <UploadCloud className="mb-3 h-8 w-8 text-holo-cyan" />
                        <p className="text-sm font-medium text-white">Subir modelo</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Personaje completo, piezas sueltas o paquetes de partes compatibles.
                        </p>
                        <input
                          className="hidden"
                          type="file"
                          accept={SUPPORTED_MODEL_ACCEPT}
                          multiple
                          onChange={handleFilesSelected}
                        />
                      </label>

                      {pendingFiles.length > 0 ? (
                        <div className="space-y-2">
                          {pendingFiles.map((file) => (
                            <button
                              key={`${file.name}-${file.lastModified}`}
                              className={cn(
                                'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition',
                                localFile?.name === file.name && localFile.lastModified === file.lastModified
                                  ? 'border-holo-cyan/40 bg-holo-cyan/10 text-white'
                                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                              )}
                              onClick={() => hydrateLocalFile(file)}
                              type="button"
                            >
                              <span className="truncate">{file.name}</span>
                              <span className="ml-3 text-xs text-slate-400">{formatBytes(file.size)}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm">
                        <InfoRow label="Archivo activo" value={previewFileName ?? 'Sin archivo'} />
                        <InfoRow label="Tamano" value={formatBytes(previewFileSize ?? 0)} />
                        <InfoRow label="Meshes" value={analysis ? analysis.meshCount.toString() : 'Pendiente'} />
                        <InfoRow label="Materiales" value={analysis ? analysis.materialCount.toString() : 'Pendiente'} />
                      </div>

                      <Button
                        className="w-full bg-holo-cyan/20 text-holo-cyan hover:bg-holo-cyan/30"
                        disabled={!localFile || !analysis || stage === 'uploading'}
                        onClick={handleUploadCharacter}
                      >
                        {stage === 'uploading' ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowUpFromLine className="mr-2 h-4 w-4" />
                        )}
                        Procesar y registrar
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="library" className="space-y-4">
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader>
                      <CardTitle className="text-white">Biblioteca de personajes</CardTitle>
                      <CardDescription>
                        Busca personajes ya analizados y continua su fragmentacion.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input
                          value={librarySearch}
                          onChange={(event) => setLibrarySearch(event.target.value)}
                          placeholder="Buscar por nombre, slug o formato..."
                          className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                        />
                      </div>

                      <ScrollArea className="h-[420px] rounded-2xl border border-white/10">
                        <div className="space-y-2 p-2">
                          {isLibraryLoading ? (
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Cargando biblioteca modular...
                            </div>
                          ) : null}

                          {libraryError ? (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                              {libraryError}
                            </div>
                          ) : null}

                          {!isLibraryLoading && !libraryError && filteredCharacters.length === 0 ? (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                              No hay personajes que coincidan con tu busqueda.
                            </div>
                          ) : null}

                          {filteredCharacters.map((character) => (
                            <button
                              key={character.id}
                              className={cn(
                                'w-full rounded-2xl border p-3 text-left transition',
                                activeCharacterId === character.id
                                  ? 'border-holo-magenta/40 bg-holo-magenta/10'
                                  : 'border-white/10 bg-white/5 hover:bg-white/10'
                              )}
                              onClick={() => hydrateCharacter(character)}
                              type="button"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-white">{character.name}</p>
                                  <p className="text-xs text-slate-400">
                                    {character.sourceFormat.toUpperCase()} · {formatBytes(character.fileSize)}
                                  </p>
                                </div>
                                <Badge className="border-white/10 bg-white/5 text-slate-200">
                                  {character.parts.length} partes
                                </Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-4">
              <Card className="border-white/10 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-white">Visor 3D modular</CardTitle>
                  <CardDescription>
                    Rotar, hacer zoom, inspeccionar meshes, huesos y pivotes del modelo activo.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {(['studio', 'sunset', 'night'] as ViewerBackground[]).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        variant="outline"
                        className={cn(
                          'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
                          background === mode && 'border-holo-cyan/40 bg-holo-cyan/10 text-holo-cyan'
                        )}
                        onClick={() => setBackground(mode)}
                      >
                        {mode}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
                        wireframe && 'border-holo-magenta/40 bg-holo-magenta/10 text-holo-magenta'
                      )}
                      onClick={() => setWireframe((current) => !current)}
                    >
                      Wireframe
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
                        showBones && 'border-holo-cyan/40 bg-holo-cyan/10 text-holo-cyan'
                      )}
                      onClick={() => setShowBones((current) => !current)}
                    >
                      Huesos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
                        showPivots && 'border-holo-orange/40 bg-holo-orange/10 text-holo-orange'
                      )}
                      onClick={() => setShowPivots((current) => !current)}
                    >
                      Pivotes
                    </Button>
                  </div>

                  <ModularModelViewer
                    modelUrl={previewUrl}
                    fileName={previewFileName}
                    fileSize={previewFileSize}
                    selectedMeshIds={new Set(selectedMeshIds)}
                    onToggleMesh={toggleMeshSelection}
                    onAnalysis={(nextAnalysis) => {
                      setAnalysis(nextAnalysis)
                      if (nextAnalysis.hasRig) {
                        setExportMode('rigged_modular')
                      }
                    }}
                    onSourceReady={setSourceRoot}
                    wireframe={wireframe}
                    showBones={showBones}
                    showPivots={showPivots}
                    background={background}
                  />

                  <div className="grid gap-3 lg:grid-cols-3">
                    <StatBadge icon={Package2} label="Modelo" value={previewFileName ?? 'Sin archivo'} />
                    <StatBadge icon={Brain} label="Rig" value={analysis?.hasRig ? 'Detectado' : 'Estatico'} />
                    <StatBadge icon={ScanSearch} label="Seleccion" value={`${selectedMeshIds.length} meshes`} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-white">Meshes detectadas</CardTitle>
                  <CardDescription>
                    Selecciona visualmente o desde esta lista para asignar a la pieza activa.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[260px] rounded-2xl border border-white/10">
                    <div className="space-y-2 p-2">
                      {analysis?.meshes.map((mesh) => {
                        const isSelected = selectedMeshIds.includes(mesh.id)
                        return (
                          <button
                            key={mesh.id}
                            className={cn(
                              'w-full rounded-xl border p-3 text-left transition',
                              isSelected
                                ? 'border-holo-cyan/40 bg-holo-cyan/10'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                            )}
                            onClick={() => toggleMeshSelection(mesh.id)}
                            type="button"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-white">{mesh.name}</p>
                                <p className="text-xs text-slate-400">
                                  {mesh.materialNames.join(', ') || 'Sin materiales'}
                                </p>
                              </div>
                              {mesh.hasSkinning ? (
                                <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                                  Rig
                                </Badge>
                              ) : null}
                            </div>
                          </button>
                        )
                      })}
                      {!analysis?.meshes.length ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                          El analisis de meshes aparecera en cuanto cargues un archivo valido.
                        </div>
                      ) : null}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Tabs defaultValue="fragmentation" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 bg-white/5">
                  <TabsTrigger value="fragmentation">Fragmentacion</TabsTrigger>
                  <TabsTrigger value="exports">Descargas</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                </TabsList>

                <TabsContent value="fragmentation" className="space-y-4">
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader>
                      <CardTitle className="text-white">Editor de fragmentacion</CardTitle>
                      <CardDescription>
                        Modo manual o automatico, nombres estandarizados y puntos de conexion base.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          className="bg-holo-cyan/20 text-holo-cyan hover:bg-holo-cyan/30"
                          onClick={handleAutoFragment}
                        >
                          <Brain className="mr-2 h-4 w-4" />
                          Fragmentar automaticamente
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                          onClick={() => {
                            setFragmentationMode('manual')
                            setNotice('Modo manual activo para reasignar meshes.')
                          }}
                        >
                          <Scissors className="mr-2 h-4 w-4" />
                          Fragmentar manualmente
                        </Button>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            'border-white/10 bg-white/5 text-white hover:bg-white/10',
                            exportMode === 'static_modular' && 'border-holo-orange/40 bg-holo-orange/10 text-holo-orange'
                          )}
                          onClick={() => setExportMode('static_modular')}
                        >
                          Static modular
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            'border-white/10 bg-white/5 text-white hover:bg-white/10',
                            exportMode === 'rigged_modular' && 'border-holo-cyan/40 bg-holo-cyan/10 text-holo-cyan'
                          )}
                          onClick={() => setExportMode('rigged_modular')}
                        >
                          Rigged modular
                        </Button>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                          Parte activa
                        </p>
                        <Input
                          value={activeAssignment?.displayName ?? ''}
                          onChange={(event) => renameActivePart(event.target.value)}
                          placeholder="Nombre visible de la parte"
                          className="border-white/10 bg-black/20 text-white"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-holo-magenta/20 text-holo-magenta hover:bg-holo-magenta/30"
                            onClick={assignSelectedMeshesToActivePart}
                          >
                            <Link2 className="mr-2 h-4 w-4" />
                            Asignar seleccion
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                            onClick={clearActivePartAssignment}
                          >
                            Limpiar parte
                          </Button>
                        </div>
                      </div>

                      <ScrollArea className="h-[320px] rounded-2xl border border-white/10">
                        <div className="space-y-2 p-2">
                          {STANDARD_PARTS.map((part) => {
                            const assignment = assignments.find(
                              (item) => item.partKey === part.key
                            )
                            return (
                              <button
                                key={part.key}
                                className={cn(
                                  'w-full rounded-2xl border p-3 text-left transition',
                                  activePartKey === part.key
                                    ? 'border-holo-cyan/40 bg-holo-cyan/10'
                                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                                )}
                                onClick={() => focusPart(part.key)}
                                type="button"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-medium text-white">
                                      {assignment?.displayName ?? part.label}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {part.category === 'core' ? 'Core' : 'Extra'} · snap con {part.connectionTarget}
                                    </p>
                                  </div>
                                  <Badge className="border-white/10 bg-white/5 text-slate-200">
                                    {assignment?.meshNames.length ?? 0} meshes
                                  </Badge>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </ScrollArea>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                          onClick={handleSaveFragmentation}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Guardar configuracion
                        </Button>
                        <Button
                          type="button"
                          className="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                          onClick={handleGenerateParts}
                        >
                          <FolderDown className="mr-2 h-4 w-4" />
                          Guardar partes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="exports" className="space-y-4">
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader>
                      <CardTitle className="text-white">Exportacion y descargas</CardTitle>
                      <CardDescription>
                        Descarga individual, selecciones parciales o ZIP completo Unity Ready.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                          disabled={!activeCharacter}
                          onClick={() => activeCharacter && openDownload(activeCharacter.sourceDownloadUrl)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Descargar original
                        </Button>
                        <Button
                          type="button"
                          className="bg-holo-cyan/20 text-holo-cyan hover:bg-holo-cyan/30"
                          disabled={!activeCharacter}
                          onClick={handleDownloadFullBundle}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Descargar ZIP completo
                        </Button>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                        disabled={!activeCharacter || selectedPartKeys.length === 0}
                        onClick={handleDownloadSelectedBundle}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Exportar para Unity
                      </Button>

                      <ScrollArea className="h-[360px] rounded-2xl border border-white/10">
                        <div className="space-y-2 p-2">
                          {activeCharacter?.parts.map((part) => (
                            <div
                              key={part.id}
                              className="rounded-2xl border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-white">{part.name}</p>
                                  <p className="text-xs text-slate-400">
                                    {part.partKey} · {part.fileFormat.toUpperCase()} · {part.hasRig ? 'rigged' : 'static'}
                                  </p>
                                </div>
                                <Checkbox
                                  checked={selectedPartKeys.includes(part.partKey)}
                                  onCheckedChange={(checked) =>
                                    toggleSelectedPartKey(part.partKey, Boolean(checked))
                                  }
                                />
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-3 border-white/10 bg-white/5 text-white hover:bg-white/10"
                                onClick={() => openDownload(part.downloadUrl)}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Descargar parte
                              </Button>
                            </div>
                          ))}

                          {!activeCharacter?.parts.length ? (
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-400">
                              Aun no hay partes publicadas. Guarda la fragmentacion y exporta para habilitar descargas.
                            </div>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="metadata" className="space-y-4">
                  <Card className="border-white/10 bg-black/20">
                    <CardHeader>
                      <CardTitle className="text-white">Metadata y trazabilidad</CardTitle>
                      <CardDescription>
                        Snapshot JSON de personaje, analisis y esquema de fragmentacion actual.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 text-sm text-slate-200">
                        <InfoRow label="Nombre" value={activeCharacter?.name ?? previewFileName ?? 'Sin seleccion'} />
                        <InfoRow label="Formato" value={activeCharacter?.sourceFormat ?? analysis?.format ?? 'N/D'} />
                        <InfoRow label="Animaciones" value={analysis?.hasAnimations ? 'Si' : 'No'} />
                        <InfoRow label="Modo de fragmentacion" value={fragmentationMode} />
                        <InfoRow label="Export mode" value={exportMode} />
                      </div>
                      <ScrollArea className="h-[420px] rounded-2xl border border-white/10 bg-black/30">
                        <pre className="p-4 text-xs leading-6 text-slate-300">
                          {currentMetadataPreview}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'cyan' | 'magenta' | 'green' | 'orange'
}) {
  const toneClassName =
    tone === 'magenta'
      ? 'from-holo-magenta/25 to-holo-magenta/5 text-holo-magenta'
      : tone === 'green'
        ? 'from-emerald-500/25 to-emerald-500/5 text-emerald-300'
        : tone === 'orange'
          ? 'from-holo-orange/25 to-holo-orange/5 text-holo-orange'
          : 'from-holo-cyan/25 to-holo-cyan/5 text-holo-cyan'

  return (
    <div className={cn('rounded-2xl border border-white/10 bg-gradient-to-br p-4', toneClassName)}>
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-slate-200">{label}</span>
      <Badge
        className={cn(
          'border px-2 py-1 text-[11px] uppercase tracking-[0.18em]',
          done
            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
            : 'border-white/10 bg-white/5 text-slate-400'
        )}
      >
        {done ? 'ok' : 'pendiente'}
      </Badge>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-mono text-xs text-white">{value}</span>
    </div>
  )
}

function StatBadge({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-medium text-white">{value}</p>
    </div>
  )
}
