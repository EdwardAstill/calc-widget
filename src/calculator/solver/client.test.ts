import { describe, expect, it, vi } from 'vitest'
import { parseRelation } from '../dsl/parser'
import type {
  SolverRequest,
  SolverResult,
  SolverWorkerMessage,
} from './protocol'
import { createSolverClient, type WorkerLike } from './client'

const solved: SolverResult = {
  status: 'solved',
  variables: ['x'],
  solutions: [
    {
      assignments: { x: { exact: '1', latex: '1' } },
      queries: [],
    },
  ],
}

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<SolverWorkerMessage>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  readonly posted: SolverRequest[] = []
  readonly terminate = vi.fn()

  postMessage(message: SolverRequest): void {
    this.posted.push(message)
  }

  emit(message: SolverWorkerMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<SolverWorkerMessage>)
  }
}

describe('createSolverClient', () => {
  it('queues while loading, correlates responses, and ignores unknown ids', async () => {
    const worker = new FakeWorker()
    const client = createSolverClient(() => worker)
    const pending = client.solve([parseRelation('x=1')])

    expect(client.getSnapshot()).toEqual({ phase: 'loading' })
    expect(worker.posted).toHaveLength(0)

    worker.emit({ type: 'ready' })
    expect(worker.posted).toHaveLength(1)
    expect(worker.posted[0].relations[0].kind).toBe('equation')

    worker.emit({
      type: 'result',
      id: 'stale',
      result: { status: 'no-solution', message: 'Wrong request.' },
    })
    worker.emit({ type: 'result', id: worker.posted[0].id, result: solved })

    await expect(pending).resolves.toEqual(solved)
  })

  it('exposes initialization failure and creates a fresh worker on retry', async () => {
    const failingWorker = new FakeWorker()
    const healthyWorker = new FakeWorker()
    const workers = [failingWorker, healthyWorker]
    const client = createSolverClient(() => {
      const worker = workers.shift()
      if (!worker) throw new Error('No worker available')
      return worker
    })
    const pending = client.solve([parseRelation('x=1')])

    failingWorker.emit({ type: 'init-error', message: 'Runtime unavailable.' })
    await expect(pending).resolves.toEqual({
      status: 'error',
      message: 'Runtime unavailable.',
    })
    expect(client.getSnapshot()).toEqual({
      phase: 'failed',
      message: 'Runtime unavailable.',
    })

    client.retry()

    expect(failingWorker.terminate).toHaveBeenCalledOnce()
    expect(client.getSnapshot()).toEqual({ phase: 'loading' })
    healthyWorker.emit({ type: 'ready' })
    expect(client.getSnapshot()).toEqual({ phase: 'ready' })
  })

  it('terminates the worker and settles pending work on disposal', async () => {
    const worker = new FakeWorker()
    const client = createSolverClient(() => worker)
    const pending = client.solve([parseRelation('x=1')])

    client.dispose()

    expect(worker.terminate).toHaveBeenCalledOnce()
    await expect(pending).resolves.toEqual({
      status: 'error',
      message: 'The solver was closed before the calculation finished.',
    })
    expect(client.getSnapshot()).toEqual({ phase: 'idle' })
  })
})
