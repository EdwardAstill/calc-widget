import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SolverState } from '../model'
import type { SolverResult } from '../solver/protocol'
import { ResultPanel } from './ResultPanel'

const cases: Array<
  [Exclude<SolverResult, { status: 'solved' }>, RegExp]
> = [
  [{ status: 'no-solution', message: 'Empty real set.' }, /no real solution/i],
  [
    { status: 'underdetermined', symbols: ['x'], message: 'x is free.' },
    /system is underdetermined/i,
  ],
  [
    {
      status: 'overdefined',
      equationCount: 2,
      variableCount: 1,
      message: 'Too many equations.',
    },
    /system is overdefined/i,
  ],
  [
    { status: 'unresolved', message: 'SymPy returned a condition set.' },
    /could not resolve this system/i,
  ],
  [
    { status: 'unsupported', message: 'Matrices are outside V1.' },
    /operation not supported/i,
  ],
  [{ status: 'error', message: 'Runtime unavailable.' }, /solver error/i],
]

describe('ResultPanel', () => {
  it.each(cases)('renders a distinct %s diagnostic', (result, title) => {
    const solver: SolverState = {
      phase: 'complete',
      requestId: 'request-1',
      result,
    }
    render(
      <ResultPanel
        solver={solver}
        engine={{ phase: 'ready' }}
        onRetry={() => undefined}
      />,
    )

    expect(screen.getByRole('heading', { name: title })).toBeVisible()
    expect(screen.getByText(result.message)).toBeVisible()
  })
})
