import type { RelationAst } from '../dsl/ast'
import type {
  SolverRequest,
  SolverResult,
  SolverWorkerMessage,
} from './protocol'

export type SolverEngineSnapshot =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'failed'; message: string }

export interface WorkerLike {
  onmessage: ((event: MessageEvent<SolverWorkerMessage>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(message: SolverRequest): void
  terminate(): void
}

export interface SolverClient {
  solve(relations: RelationAst[]): Promise<SolverResult>
  getSnapshot(): SolverEngineSnapshot
  subscribe(listener: () => void): () => void
  retry(): void
  dispose(): void
}

type WorkerFactory = () => WorkerLike

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./solver.worker.ts', import.meta.url), {
    type: 'module',
  })

export function createSolverClient(
  workerFactory: WorkerFactory = defaultWorkerFactory,
): SolverClient {
  let worker: WorkerLike | null = null
  let snapshot: SolverEngineSnapshot = { phase: 'idle' }
  let sequence = 0
  const listeners = new Set<() => void>()
  const queued: SolverRequest[] = []
  const pending = new Map<string, (result: SolverResult) => void>()

  function publish(next: SolverEngineSnapshot): void {
    snapshot = next
    for (const listener of listeners) listener()
  }

  function settleAll(message: string): void {
    for (const resolve of pending.values()) {
      resolve({ status: 'error', message })
    }
    pending.clear()
    queued.length = 0
  }

  function handleMessage(
    source: WorkerLike,
    message: SolverWorkerMessage,
  ): void {
    if (source !== worker) return
    if (message.type === 'ready') {
      publish({ phase: 'ready' })
      for (const request of queued.splice(0)) source.postMessage(request)
      return
    }
    if (message.type === 'init-error') {
      publish({ phase: 'failed', message: message.message })
      settleAll(message.message)
      return
    }
    const resolve = pending.get(message.id)
    if (!resolve) return
    pending.delete(message.id)
    resolve(message.result)
  }

  function startWorker(): void {
    publish({ phase: 'loading' })
    try {
      const nextWorker = workerFactory()
      worker = nextWorker
      nextWorker.onmessage = (event) => handleMessage(nextWorker, event.data)
      nextWorker.onerror = (event) => {
        if (nextWorker !== worker) return
        const message = event.message || 'The solver worker stopped unexpectedly.'
        publish({ phase: 'failed', message })
        settleAll(message)
      }
    } catch (error) {
      worker = null
      const message =
        error instanceof Error ? error.message : 'The solver worker could not start.'
      publish({ phase: 'failed', message })
      settleAll(message)
    }
  }

  return {
    solve(relations) {
      if (!worker || snapshot.phase === 'failed') startWorker()
      const request: SolverRequest = {
        type: 'solve',
        id: `solve-${Date.now()}-${++sequence}`,
        relations,
      }
      const promise = new Promise<SolverResult>((resolve) => {
        pending.set(request.id, resolve)
      })
      if (worker && snapshot.phase === 'ready') worker.postMessage(request)
      else queued.push(request)
      return promise
    },
    getSnapshot() {
      return snapshot
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    retry() {
      worker?.terminate()
      worker = null
      settleAll('The solver restarted before the calculation finished.')
      startWorker()
    },
    dispose() {
      worker?.terminate()
      worker = null
      settleAll('The solver was closed before the calculation finished.')
      publish({ phase: 'idle' })
      listeners.clear()
    },
  }
}
