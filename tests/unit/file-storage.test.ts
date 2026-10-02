import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createFileStorage,
  InvalidStorageNameError,
  StorageNameCollisionError
} from '../../server/services/file-storage'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))
  )
})

async function createTemporaryStorage(
  options: Partial<Parameters<typeof createFileStorage>[0]> = {}
) {
  const rootDir = await mkdtemp(join(tmpdir(), 'qdc-storage-'))
  temporaryDirectories.push(rootDir)

  return createFileStorage({
    rootDir,
    clock: () => new Date('2026-10-03T12:00:00.000Z'),
    ...options
  })
}

describe('file storage service', () => {
  it('writes a file in a UTC date partition with a generated physical name', async () => {
    const storage = await createTemporaryStorage({
      idGenerator: () => 'generated-id'
    })

    const stored = await storage.write(new TextEncoder().encode('file contents'))

    expect(stored.storageName).toBe('2026/10/03/generated-id')
    expect(stored.fileUrl).toBe('/uploads/2026/10/03/generated-id')
    expect(stored.fileSize).toBe(13)
    expect(await readFile(stored.absolutePath, 'utf8')).toBe('file contents')
    expect(await stat(stored.absolutePath)).toBeTruthy()
  })

  it('uses the configured logical URL prefix', async () => {
    const storage = await createTemporaryStorage({
      publicPath: '/private-files',
      idGenerator: () => 'generated-id'
    })

    const stored = await storage.write(new TextEncoder().encode('file contents'))

    expect(stored.fileUrl).toBe('/private-files/2026/10/03/generated-id')
  })

  it('rejects path traversal and absolute storage names', async () => {
    const storage = await createTemporaryStorage()

    expect(() => storage.resolvePath('../outside')).toThrowError(InvalidStorageNameError)
    expect(() => storage.resolvePath('/outside')).toThrowError(InvalidStorageNameError)
    expect(() => storage.resolvePath('2026/10/03/../../outside'))
      .toThrowError(InvalidStorageNameError)
  })

  it('prevents overwrite when the generated name collides', async () => {
    const storage = await createTemporaryStorage({
      idGenerator: () => 'same-id',
      maxAttempts: 1
    })

    const first = await storage.write(new TextEncoder().encode('first'))

    await expect(storage.write(new TextEncoder().encode('second')))
      .rejects.toThrowError(StorageNameCollisionError)
    expect(await readFile(first.absolutePath, 'utf8')).toBe('first')
  })

  it('removes a stored file through its validated storage name', async () => {
    const storage = await createTemporaryStorage({
      idGenerator: () => 'generated-id'
    })
    const stored = await storage.write(new TextEncoder().encode('file contents'))

    await storage.remove(stored.storageName)

    await expect(stat(stored.absolutePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
