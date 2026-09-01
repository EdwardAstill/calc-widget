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
      assignments: { x: { exact: '1', mathml: '<mn>1</mn>' } },
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

  it('keeps only the newest request queued while the worker loads', async () => {
    const worker = new FakeWorker()
    const client = createSolverClient(() => worker)
    const first = client.solve([parseRelation('x=1')])
    const second = client.solve([parseRelation('x=2')])

    await expect(first).resolves.toEqual({
      status: 'error',
      message: 'This calculation was superseded by a newer request.',
    })
    expect(worker.terminate).not.toHaveBeenCalled()

    worker.emit({ type: 'ready' })
    expect(worker.posted).toHaveLength(1)
    expect(worker.posted[0].relations).toEqual([parseRelation('x=2')])
    worker.emit({ type: 'result', id: worker.posted[0].id, result: solved })
    await expect(second).resolves.toEqual(solved)
  })

  it('restarts the worker when a new request supersedes active work', async () => {
    const firstWorker = new FakeWorker()
    const secondWorker = new FakeWorker()
    const workers = [firstWorker, secondWorker]
    const client = createSolverClient(() => {
      const worker = workers.shift()
      if (!worker) throw new Error('No worker available')
      return worker
    })

    const first = client.solve([parseRelation('x=1')])
    firstWorker.emit({ type: 'ready' })
    expect(firstWorker.posted).toHaveLength(1)

    const second = client.solve([parseRelation('x=2')])
    await expect(first).resolves.toEqual({
      status: 'error',
      message: 'This calculation was superseded by a newer request.',
    })
    expect(firstWorker.terminate).toHaveBeenCalledOnce()
    expect(client.getSnapshot()).toEqual({ phase: 'loading' })

    secondWorker.emit({ type: 'ready' })
    expect(secondWorker.posted).toHaveLength(1)
    expect(secondWorker.posted[0].relations).toEqual([parseRelation('x=2')])
    secondWorker.emit({
      type: 'result',
      id: secondWorker.posted[0].id,
      result: solved,
    })
    await expect(second).resolves.toEqual(solved)
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
