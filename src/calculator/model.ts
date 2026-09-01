import type { RelationAst } from './dsl/ast'
import type { SolverResult } from './solver/protocol'

export type Relation = {
  id: string
  source: string
  ast: RelationAst
  createdAt: number
}

export type SolverState =
  | { phase: 'idle' }
  | { phase: 'loading'; requestId: string }
  | { phase: 'complete'; requestId: string; result: SolverResult }

export type CalculatorState = {
  source: string
  relations: Relation[]
  editingId: string | null
  solver: SolverState
  helpOpen: boolean
}

export const initialCalculatorState: CalculatorState = {
  source: '',
  relations: [],
  editingId: null,
  solver: { phase: 'idle' },
  helpOpen: false,
}

export type CalculatorAction =
  | { type: 'source-changed'; source: string }
  | {
      type: 'save'
      id: string
      source: string
      ast: RelationAst
      now: number
    }
  | { type: 'edit'; id: string }
  | { type: 'delete'; id: string }
  | { type: 'clear-editor' }
  | { type: 'clear-all' }
  | { type: 'help-changed'; open: boolean }
  | { type: 'solve-started'; requestId: string }
  | {
      type: 'solve-finished'
      requestId: string
      result: SolverResult
    }
