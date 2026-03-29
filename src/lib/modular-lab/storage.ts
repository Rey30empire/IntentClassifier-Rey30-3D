import { promises as fs } from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { MODULAR_LAB_STORAGE_ROOT, SUPPORTED_MODEL_EXTENSIONS } from '@/lib/modular-lab/constants'

export function sanitizePathSegment(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'asset'
}

export function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase()
}

export function isSupportedModelExtension(fileName: string) {
  return SUPPORTED_MODEL_EXTENSIONS.includes(
    getFileExtension(fileName) as (typeof SUPPORTED_MODEL_EXTENSIONS)[number]
  )
}

export function getModularLabRootPath() {
  return path.join(process.cwd(), MODULAR_LAB_STORAGE_ROOT)
}

export function getCharacterStoragePaths(characterId: string, slug: string) {
  const root = path.join(getModularLabRootPath(), `${slug}-${characterId}`)
  return {
    root,
    originalDir: path.join(root, 'full_model'),
    partsDir: path.join(root, 'parts'),
    exportsDir: path.join(root, 'exports'),
    metadataPath: path.join(root, 'metadata.json'),
  }
}

export async function ensureCharacterStorage(characterId: string, slug: string) {
  const paths = getCharacterStoragePaths(characterId, slug)
  await fs.mkdir(paths.originalDir, { recursive: true })
  await fs.mkdir(paths.partsDir, { recursive: true })
  await fs.mkdir(paths.exportsDir, { recursive: true })
  return paths
}

export async function saveUploadedFile(file: File, destinationPath: string) {
  const arrayBuffer = await file.arrayBuffer()
  await fs.writeFile(destinationPath, Buffer.from(arrayBuffer))
}

export async function saveBufferFile(buffer: Uint8Array, destinationPath: string) {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true })
  await fs.writeFile(destinationPath, buffer)
}

export async function readFileBuffer(filePath: string) {
  return fs.readFile(filePath)
}

export async function removeFileIfExists(filePath: string) {
  try {
    await fs.unlink(filePath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

export async function writeCharacterMetadataSnapshot(
  metadataPath: string,
  snapshot: unknown
) {
  await fs.writeFile(metadataPath, JSON.stringify(snapshot, null, 2), 'utf8')
}

export async function buildCharacterZipBundle(options: {
  rootFolderName: string
  characterMetadata: unknown
  originalFileName?: string | null
  originalFilePath?: string | null
  partFiles: Array<{
    folderName: string
    fileName: string
    filePath: string
    metadata: unknown
  }>
}) {
  const zip = new JSZip()
  const root = zip.folder(options.rootFolderName) ?? zip

  root.file('metadata.json', JSON.stringify(options.characterMetadata, null, 2))

  if (options.originalFileName && options.originalFilePath) {
    const originalBuffer = await readFileBuffer(options.originalFilePath)
    const fullModelFolder = root.folder('full_model')
    fullModelFolder?.file(options.originalFileName, originalBuffer)
  }

  const partsFolder = root.folder('parts')

  for (const part of options.partFiles) {
    const partFolder = partsFolder?.folder(part.folderName)
    const partBuffer = await readFileBuffer(part.filePath)
    partFolder?.file(part.fileName, partBuffer)
    partFolder?.file('metadata.json', JSON.stringify(part.metadata, null, 2))
  }

  return zip.generateAsync({ type: 'uint8array' })
}
