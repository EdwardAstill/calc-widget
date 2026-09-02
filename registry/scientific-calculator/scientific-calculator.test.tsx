import { render, screen, waitFor } from '@testing-library/react'
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

it('renders a compact editor with a persistent preview inside one card', () => {
  const { container } = render(<ScientificCalculator solverClient={new TestSolverClient()} />)

  expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(1)
  expect(screen.queryByRole('heading', { name: /scientific calculator/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Calculation' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Relations' })).not.toBeInTheDocument()
  expect(screen.queryByText('Preview')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/calculator expression/i)).toHaveAttribute('data-slot', 'input')
  expect(screen.getByLabelText(/rendered math preview/i)).toBeVisible()
  expect(screen.queryByText('Enter an equation or a symbolic query.')).not.toBeInTheDocument()
})

it('adds a relation and calculates it with shadcn controls', async () => {
  const user = userEvent.setup()
  const client = new TestSolverClient()
  render(<ScientificCalculator solverClient={client} />)

  expect(screen.getByRole('button', { name: /plot.*v2/i })).toBeDisabled()
  await user.type(screen.getByLabelText(/calculator expression/i), 'x=2')
  await user.click(screen.getByRole('button', { name: /add relation/i }))
  expect(screen.getByTestId('relation-row')).toHaveTextContent('x=2')
  expect(screen.getByRole('button', { name: 'Edit x=2' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Delete x=2' })).toBeVisible()

  await user.click(screen.getByRole('button', { name: /calculate/i }))
  expect(await screen.findByText(/solved over the reals/i)).toBeVisible()
  expect(client.solve).toHaveBeenCalledOnce()
})

it('lets a relation be selected for plotting', async () => {
  const user = userEvent.setup()
  render(<ScientificCalculator solverClient={new TestSolverClient()} />)

  await user.type(screen.getByLabelText(/calculator expression/i), 'x=2')
  await user.click(screen.getByRole('button', { name: /add relation/i }))

  const plot = screen.getByRole('checkbox', { name: 'Plot x=2' })
  expect(plot).not.toBeChecked()
  await user.click(plot)
  expect(plot).toBeChecked()
})

it('solves one relation from its row', async () => {
  const user = userEvent.setup()
  const client = new TestSolverClient()
  render(<ScientificCalculator solverClient={client} />)

  await user.type(screen.getByLabelText(/calculator expression/i), 'x=2')
  await user.click(screen.getByRole('button', { name: /add relation/i }))
  await user.click(screen.getByRole('button', { name: 'Solve x=2' }))

  await waitFor(() => expect(client.solve).toHaveBeenCalledWith([
    {
      kind: 'equation',
      left: { kind: 'symbol', name: 'x' },
      right: { kind: 'number', value: '2' },
    },
  ]))
})

it('excludes disabled relations from the shared calculation', async () => {
  const user = userEvent.setup()
  const client = new TestSolverClient()
  render(<ScientificCalculator solverClient={client} />)

  const editor = screen.getByLabelText(/calculator expression/i)
  await user.type(editor, 'x=2')
  await user.click(screen.getByRole('button', { name: /add relation/i }))
  await user.click(screen.getByRole('button', { name: 'Disable x=2' }))

  expect(screen.getByRole('button', { name: 'Solve x=2' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Enable x=2' })).toBeVisible()

  await user.type(editor, 'y=3')
  await user.click(screen.getByRole('button', { name: /add relation/i }))
  await user.click(screen.getByRole('button', { name: /calculate/i }))

  await waitFor(() => expect(client.solve).toHaveBeenCalledWith([
    {
      kind: 'equation',
      left: { kind: 'symbol', name: 'y' },
      right: { kind: 'number', value: '3' },
    },
  ]))
})
