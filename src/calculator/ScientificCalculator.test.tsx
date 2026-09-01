import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { RelationAst } from './dsl/ast'
import { ScientificCalculator } from './ScientificCalculator'
import type {
  SolverClient,
  SolverEngineSnapshot,
} from './solver/client'
import type { SolverResult } from './solver/protocol'

class SystemSolverClient implements SolverClient {
  private snapshot: SolverEngineSnapshot = { phase: 'ready' }
  readonly retry = vi.fn()
  readonly dispose = vi.fn()

  async solve(relations: RelationAst[]): Promise<SolverResult> {
    const hasEquation = relations.some((row) => row.kind === 'equation')
    const hasQuery = relations.some((row) => row.kind === 'query')
    if (!hasEquation || !hasQuery || relations.length !== 2) {
      return { status: 'error', message: 'The shared system was incomplete.' }
    }
    return {
      status: 'solved',
      variables: ['x'],
      solutions: [
        {
          assignments: { x: { exact: '-1', mathml: '<mn>-1</mn>' } },
          queries: [{ exact: '-1', mathml: '<mn>-1</mn>' }],
        },
        {
          assignments: { x: { exact: '1', mathml: '<mn>1</mn>' } },
          queries: [{ exact: '1', mathml: '<mn>1</mn>' }],
        },
      ],
    }
  }

  getSnapshot(): SolverEngineSnapshot {
    return this.snapshot
  }

  subscribe(): () => void {
    return () => undefined
  }
}

async function replaceEditor(user: ReturnType<typeof userEvent.setup>, source: string) {
  const editor = screen.getByLabelText(/calculator expression/i)
  await user.clear(editor)
  if (source) await user.type(editor, source)
}

async function addRelation(user: ReturnType<typeof userEvent.setup>, source: string) {
  await replaceEditor(user, source)
  await user.click(screen.getByRole('button', { name: /add relation/i }))
}

describe('ScientificCalculator', () => {
  it('adds and edits a relation without duplicating or reordering it', async () => {
    const user = userEvent.setup()
    render(<ScientificCalculator solverClient={new SystemSolverClient()} />)

    await addRelation(user, '2x+3=7')
    expect(screen.getAllByTestId('relation-row')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /edit 2x\+3=7/i }))
    await replaceEditor(user, '2x=4')
    await user.click(screen.getByRole('button', { name: /save relation/i }))

    expect(screen.getAllByTestId('relation-row')).toHaveLength(1)
    expect(screen.getByText('2x=4')).toBeVisible()
  })

  it('deletes the edited row and clears the calculator editor', async () => {
    const user = userEvent.setup()
    render(<ScientificCalculator solverClient={new SystemSolverClient()} />)
    await addRelation(user, 'x=1')
    await user.click(screen.getByRole('button', { name: /edit x=1/i }))

    await user.click(screen.getByRole('button', { name: /delete x=1/i }))

    expect(screen.queryByTestId('relation-row')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/calculator expression/i)).toHaveValue('')
  })

  it('shows live math, parser feedback, operation insertion, and disabled plotting', async () => {
    const user = userEvent.setup()
    render(<ScientificCalculator solverClient={new SystemSolverClient()} />)

    expect(screen.getByRole('button', { name: /plot.*v2/i })).toBeDisabled()
    await replaceEditor(user, 'sin(pi/2)')
    expect(screen.getByLabelText(/rendered math preview/i)).toHaveTextContent('sin')

    await replaceEditor(user, '(')
    expect(screen.getByRole('alert')).toBeVisible()

    await replaceEditor(user, '')
    await user.click(screen.getByRole('button', { name: 'Derivative' }))
    expect(screen.getByLabelText(/calculator expression/i)).toHaveValue('diff(, x)')
  })

  it('calculates every saved row as one system and shows every discrete solution', async () => {
    const user = userEvent.setup()
    render(<ScientificCalculator solverClient={new SystemSolverClient()} />)
    await addRelation(user, 'x^2=1')
    await addRelation(user, 'x')

    await user.click(screen.getByRole('button', { name: /calculate result/i }))

    expect(await screen.findByRole('heading', { name: /2 solutions/i })).toBeVisible()
    const result = screen.getByLabelText(/calculation result/i)
    expect(within(result).getAllByText('-1').length).toBeGreaterThan(0)
    expect(within(result).getAllByText('1').length).toBeGreaterThan(0)
  })

  it('applies strict overdefined preflight before invoking the solver', async () => {
    const user = userEvent.setup()
    render(<ScientificCalculator solverClient={new SystemSolverClient()} />)
    await addRelation(user, 'x=1')
    await addRelation(user, 'x=1')

    await user.click(screen.getByRole('button', { name: /calculate result/i }))

    expect(
      await screen.findByRole('heading', { name: /system is overdefined/i }),
    ).toBeVisible()
  })

  it('opens notation help and keeps relation plot checkboxes disabled', async () => {
    const user = userEvent.setup()
    render(<ScientificCalculator solverClient={new SystemSolverClient()} />)
    await addRelation(user, 'x=1')

    expect(screen.getByRole('checkbox', { name: /plot x=1.*v2/i })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /help/i }))
    const dialog = screen.getByRole('dialog', { name: /calculator help/i })
    expect(dialog).toBeVisible()
    expect(within(dialog).getByText(/implicit multiplication/i)).toBeVisible()
  })
})
