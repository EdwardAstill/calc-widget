import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import type { RelationAst } from './dsl/ast'
import { ScientificCalculator } from './scientific-calculator'
import type { SolverClient, SolverEngineSnapshot } from './solver/client'
import type { SolverResult } from './solver/protocol'

class TestSolverClient implements SolverClient {
  readonly solve = vi.fn(async (_relations: RelationAst[]): Promise<SolverResult> => ({
    status: 'solved',
    variables: ['x'],
    solutions: [{ assignments: { x: { exact: '2', mathml: '<mn>2</mn>' } }, queries: [] }],
  }))
  readonly retry = vi.fn()
  readonly dispose = vi.fn()
  private readonly snapshot: SolverEngineSnapshot = { phase: 'ready' }

  getSnapshot() { return this.snapshot }
  subscribe() { return () => undefined }
}

it('adds a relation and calculates it with shadcn controls', async () => {
  const user = userEvent.setup()
  const client = new TestSolverClient()
  render(<ScientificCalculator solverClient={client} />)

  expect(screen.getByRole('button', { name: /plot.*v2/i })).toBeDisabled()
  await user.type(screen.getByLabelText(/calculator expression/i), 'x=2')
  await user.click(screen.getByRole('button', { name: /add relation/i }))
  expect(screen.getByTestId('relation-row')).toHaveTextContent('x=2')

  await user.click(screen.getByRole('button', { name: /calculate/i }))
  expect(await screen.findByText(/solved over the reals/i)).toBeVisible()
  expect(client.solve).toHaveBeenCalledOnce()
})
