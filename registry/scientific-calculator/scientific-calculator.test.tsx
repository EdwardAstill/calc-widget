import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import type { RelationAst } from './dsl/ast'
import { ScientificCalculator } from './scientific-calculator'
import type { SolverClient, SolverEngineSnapshot } from './solver/client'
import type { SolverResult } from './solver/protocol'

class TestSolverClient implements SolverClient {
  readonly start = vi.fn()
  readonly solve = vi.fn(async (
    _relations: RelationAst[],
    _mode?: 'system' | 'symbolic',
  ): Promise<SolverResult> => ({
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
  expect(screen.queryByRole('heading', { name: 'Result' })).not.toBeInTheDocument()
  expect(screen.queryByText('ready', { exact: true })).not.toBeInTheDocument()
  expect(screen.queryByText('Preview')).not.toBeInTheDocument()
  expect(screen.getByLabelText(/calculator expression/i)).toHaveAttribute('data-slot', 'input')
  const preview = screen.getByLabelText(/rendered math preview/i)
  expect(preview).toBeVisible()
  expect(preview.querySelector('[data-slot="alert-title"]')).toBeNull()
  expect(screen.queryByText('Enter an equation or a symbolic query.')).not.toBeInTheDocument()
})

it('starts the Python solver when the calculator mounts', () => {
  const client = new TestSolverClient()

  render(<ScientificCalculator solverClient={client} />)

  expect(client.start).toHaveBeenCalledOnce()
})

it('adds a relation and calculates it with shadcn controls', async () => {
  const user = userEvent.setup()
  const client = new TestSolverClient()
  render(<ScientificCalculator solverClient={client} />)

  expect(screen.getByRole('button', { name: /plot.*v2/i })).toBeDisabled()
  await user.type(screen.getByLabelText(/calculator expression/i), 'x=2')
  await user.click(screen.getByRole('button', { name: /add relation/i }))
  const row = screen.getByTestId('relation-row')
  expect(row.querySelector('math')).not.toBeNull()
  expect(row.querySelector('code')).not.toBeInTheDocument()

  for (const action of ['Solve', 'Edit', 'Delete']) {
    expect(screen.getByRole('button', { name: `${action} x=2` })).toHaveTextContent('')
  }
  await act(async () => screen.getByRole('button', { name: 'Solve x=2' }).focus())
  expect(await screen.findByText('Solve')).toBeVisible()

  await user.click(screen.getByRole('button', { name: /calculate/i }))
  expect(await screen.findByText(/solved over the reals/i)).toBeVisible()
  expect(client.solve).toHaveBeenCalledOnce()
})

it('uses the relation checkbox to enable or disable calculation', async () => {
  const user = userEvent.setup()
  render(<ScientificCalculator solverClient={new TestSolverClient()} />)

  await user.type(screen.getByLabelText(/calculator expression/i), 'x=2')
  await user.click(screen.getByRole('button', { name: /add relation/i }))

  const enabled = screen.getByRole('checkbox', { name: 'Enable x=2' })
  expect(enabled).toBeChecked()
  await user.click(enabled)
  expect(enabled).not.toBeChecked()
  expect(screen.getByRole('button', { name: 'Solve x=2' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Disable x=2' })).not.toBeInTheDocument()
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
  ], 'symbolic'))
})

it('excludes disabled relations from the shared calculation', async () => {
  const user = userEvent.setup()
  const client = new TestSolverClient()
  render(<ScientificCalculator solverClient={client} />)

  const editor = screen.getByLabelText(/calculator expression/i)
  await user.type(editor, 'x=2')
  await user.click(screen.getByRole('button', { name: /add relation/i }))
  await user.click(screen.getByRole('checkbox', { name: 'Enable x=2' }))

  expect(screen.getByRole('button', { name: 'Solve x=2' })).toBeDisabled()

  await user.type(editor, 'y=3')
  await user.click(screen.getByRole('button', { name: /add relation/i }))
  await user.click(screen.getByRole('button', { name: /calculate/i }))

  await waitFor(() => expect(client.solve).toHaveBeenCalledWith([
    {
      kind: 'equation',
      left: { kind: 'symbol', name: 'y' },
      right: { kind: 'number', value: '3' },
    },
  ], 'system'))
})
