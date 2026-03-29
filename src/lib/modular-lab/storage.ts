import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { MODULAR_LAB_STORAGE_ROOT, SUPPORTED_MODEL_EXTENSIONS } from '@/lib/modular-lab/constants'

const LOCAL_REF_PREFIX = 'local://'
const BLOB_REF_PREFIX = 'blob://'
const DEFAULT_BLOB_STORE = 'modular-character-lab'

type StorageMode = 'local' | 'blobs'

type ParsedStorageRef =
  | {
      kind: 'local'
      key: string
    }
  | {
      kind: 'blob'
      storeName: string
      key: string
    }
  | {
      kind: 'legacy-local'
      absolutePath: string
    }

type BlobStoreOptions = {
  siteID?: string
  token?: string
}

function normalizeStorageKey(...segments: string[]) {
  return segments
    .flatMap((segment) => segment.split('/'))
    .map((segment) => segment.replaceAll('\\', '/').trim())
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
}

function sanitizeBlobStoreName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || DEFAULT_BLOB_STORE
  )
}

function getStorageMode(): StorageMode {
  const configuredProvider = (process.env.MODULAR_LAB_STORAGE_PROVIDER ?? '')
    .trim()
    .toLowerCase()

  if (configuredProvider === 'local') {
    return 'local'
  }

  if (configuredProvider === 'blob' || configuredProvider === 'blobs') {
    return 'blobs'
  }

  return process.env.NETLIFY ? 'blobs' : 'local'
}

function getBlobStoreName() {
  return sanitizeBlobStoreName(process.env.MODULAR_LAB_BLOB_STORE ?? DEFAULT_BLOB_STORE)
}

function createLocalRef(key: string) {
  return `${LOCAL_REF_PREFIX}${normalizeStorageKey(key)}`
}

function createBlobRef(storeName: string, key: string) {
  return `${BLOB_REF_PREFIX}${storeName}/${normalizeStorageKey(key)}`
}

function parseStorageRef(reference: string): ParsedStorageRef {
  if (reference.startsWith(BLOB_REF_PREFIX)) {
    const normalized = reference.slice(BLOB_REF_PREFIX.length).replaceAll('\\', '/')
    const [storeName, ...keySegments] = normalized.split('/').filter(Boolean)

    if (!storeName) {
      throw new Error(`Referencia blob invalida: ${reference}`)
    }

    return {
      kind: 'blob',
      storeName,
      key: normalizeStorageKey(keySegments.join('/')),
    }
  }

  if (reference.startsWith(LOCAL_REF_PREFIX)) {
    return {
      kind: 'local',
      key: normalizeStorageKey(reference.slice(LOCAL_REF_PREFIX.length)),
    }
  }

  if (path.isAbsolute(reference)) {
    return {
      kind: 'legacy-local',
      absolutePath: reference,
    }
  }

  return {
    kind: 'local',
    key: normalizeStorageKey(reference),
  }
}

function getBlobStoreOptions(): BlobStoreOptions {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID?.trim()
  const token = process.env.NETLIFY_BLOBS_TOKEN?.trim()

  if (process.env.NETLIFY) {
    return {}
  }

  if (siteID && token) {
    return {
      siteID,
      token,
    }
  }

  return {}
}

async function getBlobStore(storeName: string) {
  const { getStore } = await import('@netlify/blobs')
  const options = getBlobStoreOptions()

  if (!process.env.NETLIFY && (!options.siteID || !options.token)) {
    throw new Error(
      'Netlify Blobs requiere NETLIFY_BLOBS_SITE_ID y NETLIFY_BLOBS_TOKEN cuando se usa fuera de Netlify.'
    )
  }

  return getStore(storeName, options)
}

function localAbsolutePathFromKey(key: string) {
  return path.join(getModularLabRootPath(), ...normalizeStorageKey(key).split('/'))
}

function toArrayBuffer(value: Uint8Array) {
  const arrayBuffer = new ArrayBuffer(value.byteLength)
  new Uint8Array(arrayBuffer).set(value)
  return arrayBuffer
}

function getAbsolutePathFromRef(reference: string) {
  const parsed = parseStorageRef(reference)

  if (parsed.kind === 'legacy-local') {
    return parsed.absolutePath
  }

  if (parsed.kind === 'local') {
    return localAbsolutePathFromKey(parsed.key)
  }

  return null
}

async function writeLocalFile(reference: string, contents: Uint8Array | string) {
  const absolutePath = getAbsolutePathFromRef(reference)
  if (!absolutePath) {
    throw new Error(`La referencia ${reference} no apunta a storage local.`)
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, contents)
}

export function sanitizePathSegment(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'asset'
  )
}

export function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase()
}

export function isSupportedModelExtension(fileName: string) {
  return SUPPORTED_MODEL_EXTENSIONS.includes(
    getFileExtension(fileName) as (typeof SUPPORTED_MODEL_EXTENSIONS)[number]
  )
}

export function getStoredFileName(reference: string) {
  const parsed = parseStorageRef(reference)

  if (parsed.kind === 'blob' || parsed.kind === 'local') {
    return path.posix.basename(parsed.key)
  }

  return path.basename(parsed.absolutePath)
}

export function getStoredContentType(value: string | null | undefined, fallback = 'application/octet-stream') {
  if (!value) {
    return fallback
  }

  const normalized = value.startsWith('.') ? value.toLowerCase() : getFileExtension(value) || `.${value.toLowerCase()}`

  switch (normalized) {
    case '.glb':
      return 'model/gltf-binary'
    case '.gltf':
      return 'model/gltf+json'
    case '.fbx':
      return 'application/octet-stream'
    case '.obj':
      return 'text/plain; charset=utf-8'
    case '.zip':
      return 'application/zip'
    case '.json':
      return 'application/json; charset=utf-8'
    default:
      return fallback
  }
}

export function getModularLabRootPath() {
  return path.join(process.cwd(), MODULAR_LAB_STORAGE_ROOT)
}

export function createStorageRootRef(rootKey: string) {
  return getStorageMode() === 'blobs'
    ? createBlobRef(getBlobStoreName(), rootKey)
    : createLocalRef(rootKey)
}

export function resolveStorageChildRef(rootOrReference: string, ...segments: string[]) {
  const parsed = parseStorageRef(rootOrReference)
  const childKey = normalizeStorageKey(...segments)

  if (parsed.kind === 'blob') {
    return createBlobRef(parsed.storeName, normalizeStorageKey(parsed.key, childKey))
  }

  if (parsed.kind === 'local') {
    return createLocalRef(normalizeStorageKey(parsed.key, childKey))
  }

  return path.join(parsed.absolutePath, ...segments)
}

export function getCharacterStoragePaths(characterId: string, slug: string) {
  const rootKey = normalizeStorageKey('characters', `${slug}-${characterId}`)
  const root = createStorageRootRef(rootKey)

  return {
    root,
    originalDir: resolveStorageChildRef(root, 'full_model'),
    partsDir: resolveStorageChildRef(root, 'parts'),
    exportsDir: resolveStorageChildRef(root, 'exports'),
    metadataPath: resolveStorageChildRef(root, 'metadata.json'),
  }
}

export async function ensureCharacterStorage(characterId: string, slug: string) {
  const paths = getCharacterStoragePaths(characterId, slug)

  const originalDir = getAbsolutePathFromRef(paths.originalDir)
  const partsDir = getAbsolutePathFromRef(paths.partsDir)
  const exportsDir = getAbsolutePathFromRef(paths.exportsDir)

  if (originalDir && partsDir && exportsDir) {
    await fs.mkdir(originalDir, { recursive: true })
    await fs.mkdir(partsDir, { recursive: true })
    await fs.mkdir(exportsDir, { recursive: true })
  }

  return paths
}

export async function saveUploadedFile(file: File, destinationReference: string) {
  const parsed = parseStorageRef(destinationReference)

  if (parsed.kind === 'blob') {
    const store = await getBlobStore(parsed.storeName)
    await store.set(parsed.key, file, {
      metadata: {
        fileName: file.name,
        mimeType: file.type || null,
        uploadedAt: new Date().toISOString(),
      },
    })
    return destinationReference
  }

  const arrayBuffer = await file.arrayBuffer()
  await writeLocalFile(destinationReference, Buffer.from(arrayBuffer))
  return destinationReference
}

export async function saveBufferFile(buffer: Uint8Array, destinationReference: string) {
  const parsed = parseStorageRef(destinationReference)

  if (parsed.kind === 'blob') {
    const store = await getBlobStore(parsed.storeName)
    await store.set(parsed.key, toArrayBuffer(buffer), {
      metadata: {
        uploadedAt: new Date().toISOString(),
      },
    })
    return destinationReference
  }

  await writeLocalFile(destinationReference, buffer)
  return destinationReference
}

export async function readFileBuffer(reference: string) {
  const parsed = parseStorageRef(reference)

  if (parsed.kind === 'blob') {
    const store = await getBlobStore(parsed.storeName)
    const fileBuffer = await store.get(parsed.key, {
      type: 'arrayBuffer',
      consistency: 'strong',
    })

    if (!fileBuffer) {
      throw new Error(`Blob no encontrado: ${reference}`)
    }

    return Buffer.from(fileBuffer)
  }

  const absolutePath = getAbsolutePathFromRef(reference)
  if (!absolutePath) {
    throw new Error(`No se pudo resolver la ruta local para ${reference}`)
  }

  return fs.readFile(absolutePath)
}

export async function removeFileIfExists(reference: string) {
  const parsed = parseStorageRef(reference)

  if (parsed.kind === 'blob') {
    const store = await getBlobStore(parsed.storeName)
    await store.delete(parsed.key)
    return
  }

  const absolutePath = getAbsolutePathFromRef(reference)
  if (!absolutePath) {
    return
  }

  try {
    await fs.unlink(absolutePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

export async function writeCharacterMetadataSnapshot(
  metadataReference: string,
  snapshot: unknown
) {
  const parsed = parseStorageRef(metadataReference)

  if (parsed.kind === 'blob') {
    const store = await getBlobStore(parsed.storeName)
    await store.setJSON(parsed.key, snapshot, {
      metadata: {
        updatedAt: new Date().toISOString(),
      },
    })
    return metadataReference
  }

  await writeLocalFile(metadataReference, JSON.stringify(snapshot, null, 2))
  return metadataReference
}

export async function buildCharacterZipBundle(options: {
  rootFolderName: string
  characterMetadata: unknown
  originalFileName?: string | null
  originalFileRef?: string | null
  partFiles: Array<{
    folderName: string
    fileName: string
    fileRef: string
    metadata: unknown
  }>
}) {
  const zip = new JSZip()
  const root = zip.folder(options.rootFolderName) ?? zip

  root.file('metadata.json', JSON.stringify(options.characterMetadata, null, 2))

  if (options.originalFileName && options.originalFileRef) {
    const originalBuffer = await readFileBuffer(options.originalFileRef)
    const fullModelFolder = root.folder('full_model')
    fullModelFolder?.file(options.originalFileName, originalBuffer)
  }

  const partsFolder = root.folder('parts')

  for (const part of options.partFiles) {
    const partFolder = partsFolder?.folder(part.folderName)
    const partBuffer = await readFileBuffer(part.fileRef)
    partFolder?.file(part.fileName, partBuffer)
    partFolder?.file('metadata.json', JSON.stringify(part.metadata, null, 2))
  }

  return zip.generateAsync({ type: 'uint8array' })
}
