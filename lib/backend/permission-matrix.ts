import { setRuntimePermissionMatrix, type Permission, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

type PermissionMatrixEntry = {
  permission: string
  roles: Role[]
}

const matrixReloadIntervalMs = 30 * 1000
const globalForPermissionMatrix = globalThis as typeof globalThis & {
  kidSeedsPermissionMatrixLoadedAt?: number
  kidSeedsPermissionMatrixLoadPromise?: Promise<PermissionMatrixEntry[]>
}

export function applyRuntimePermissionMatrix(entries: PermissionMatrixEntry[]) {
  setRuntimePermissionMatrix(
    Object.fromEntries(entries.map((entry) => [entry.permission, entry.roles])) as Partial<Record<Permission, Role[]>>
  )
}

export async function loadPersistedPermissionMatrix() {
  const entries = await prisma.permissionMatrixEntry.findMany()
  applyRuntimePermissionMatrix(entries)
  globalForPermissionMatrix.kidSeedsPermissionMatrixLoadedAt = Date.now()
  return entries
}

export async function ensureRuntimePermissionMatrixLoaded() {
  const loadedAt = globalForPermissionMatrix.kidSeedsPermissionMatrixLoadedAt

  if (loadedAt && Date.now() - loadedAt < matrixReloadIntervalMs) {
    return
  }

  if (!globalForPermissionMatrix.kidSeedsPermissionMatrixLoadPromise) {
    globalForPermissionMatrix.kidSeedsPermissionMatrixLoadPromise = loadPersistedPermissionMatrix().finally(() => {
      globalForPermissionMatrix.kidSeedsPermissionMatrixLoadPromise = undefined
    })
  }

  await globalForPermissionMatrix.kidSeedsPermissionMatrixLoadPromise
}
