import { mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

const DEFAULT_PUBLIC_PATH = '/uploads'
const DEFAULT_MAX_ATTEMPTS = 3

export interface FileStorageConfig {
  rootDir: string
  publicPath?: string
  clock?: () => Date
  idGenerator?: () => string
  maxAttempts?: number
}

export interface StoredFile {
  storageName: string
  fileUrl: string
  absolutePath: string
  fileSize: number
}

export interface FileStorage {
  rootDir: string
  publicPath: string
  resolvePath: (storageName: string) => string
  write: (data: Uint8Array) => Promise<StoredFile>
  remove: (storageName: string) => Promise<void>
}

export class InvalidStorageNameError extends Error {
  constructor() {
    super('Nama storage tidak valid.')
    this.name = 'InvalidStorageNameError'
  }
}

export class StorageNameCollisionError extends Error {
  constructor() {
    super('Nama storage unik tidak dapat dibuat.')
    this.name = 'StorageNameCollisionError'
  }
}

interface FileSystemError extends Error {
  code?: string
}

function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof Error
}

function normalizePublicPath(publicPath: string): string {
  const normalized = publicPath.trim().replace(/^\/+|\/+$/g, '')

  if (!normalized || normalized.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new Error('Public path storage tidak valid.')
  }

  return `/${normalized}`
}

function getDateDirectory(date: Date): string {
  const [year, month, day] = date.toISOString().slice(0, 10).split('-')
  return `${year}/${month}/${day}`
}

function assertSafeStorageName(storageName: string): void {
  if (
    !storageName
    || isAbsolute(storageName)
    || storageName.includes('\\')
    || storageName.split('/').some(segment => !segment || segment === '.' || segment === '..')
  ) {
    throw new InvalidStorageNameError()
  }
}

function assertInsideRoot(rootDir: string, candidatePath: string): void {
  const pathFromRoot = relative(rootDir, candidatePath)

  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    throw new InvalidStorageNameError()
  }
}

export function createFileStorage(config: FileStorageConfig): FileStorage {
  const rootDir = resolve(config.rootDir)
  const publicPath = normalizePublicPath(config.publicPath ?? DEFAULT_PUBLIC_PATH)
  const clock = config.clock ?? (() => new Date())
  const idGenerator = config.idGenerator ?? randomUUID
  const maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('Jumlah percobaan storage harus berupa bilangan positif.')
  }

  function resolvePath(storageName: string): string {
    assertSafeStorageName(storageName)

    const absolutePath = resolve(rootDir, storageName)
    assertInsideRoot(rootDir, absolutePath)

    return absolutePath
  }

  async function write(data: Uint8Array): Promise<StoredFile> {
    const dateDirectory = getDateDirectory(clock())

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const storageName = `${dateDirectory}/${idGenerator()}`
      const absolutePath = resolvePath(storageName)
      const directory = dirname(absolutePath)

      await mkdir(directory, { recursive: true })

      try {
        await writeFile(absolutePath, data, { flag: 'wx' })

        return {
          storageName,
          fileUrl: `${publicPath}/${storageName}`,
          absolutePath,
          fileSize: data.byteLength
        }
      } catch (error) {
        if (isFileSystemError(error) && error.code === 'EEXIST') {
          continue
        }

        await rm(absolutePath, { force: true })
        throw error
      }
    }

    throw new StorageNameCollisionError()
  }

  async function remove(storageName: string): Promise<void> {
    await rm(resolvePath(storageName), { force: true })
  }

  return {
    rootDir,
    publicPath,
    resolvePath,
    write,
    remove
  }
}
