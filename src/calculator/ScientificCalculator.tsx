import { Sigma } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from 'react'
import { CalculatorToolbar } from './components/CalculatorToolbar'
import {
  DslEditor,
  type EditorParseState,
} from './components/DslEditor'
import { HelpDialog } from './components/HelpDialog'
import { MathPreview } from './components/MathPreview'
import { OperationsPanel } from './components/OperationsPanel'
import { RelationsPanel } from './components/RelationsPanel'
import { ResultPanel } from './components/ResultPanel'
import { relationToMathMl } from './dsl/mathml'
import { parseRelation } from './dsl/parser'
import { initialCalculatorState } from './model'
import { applyInsertion } from './operations'
import { calculatorReducer } from './reducer'
import {
  createSolverClient,
  type SolverClient,
  type SolverEngineSnapshot,
} from './solver/client'
import { preflight } from './solver/preflight'
import type { SolverResult } from './solver/protocol'

type ScientificCalculatorProps = {
  solverClient?: SolverClient
}

const IDLE_ENGINE: SolverEngineSnapshot = { phase: 'idle' }

function parseEditor(source: string): EditorParseState {
  if (!source.trim()) return { kind: 'empty' }
  try {
    const ast = parseRelation(source)
    return { kind: 'valid', ast, mathml: relationToMathMl(ast) }
  } catch (error) {
    return {
      kind: 'invalid',
      message:
        error instanceof Error ? error.message : 'This expression is not valid.',
    }
  }
}

export function ScientificCalculator({ solverClient }: ScientificCalculatorProps) {
  const client = useMemo(
    () => solverClient ?? createSolverClient(),
    [solverClient],
  )
  const [state, dispatch] = useReducer(
    calculatorReducer,
    initialCalculatorState,
  )
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const relationSequence = useRef(0)
  const requestSequence = useRef(0)
  const parsed = useMemo(() => parseEditor(state.source), [state.source])
  const engine = useSyncExternalStore(
    (listener) => client.subscribe(listener),
    () => client.getSnapshot(),
    () => IDLE_ENGINE,
  )

  useEffect(() => {
    if (solverClient) return
    return () => client.dispose()
  }, [client, solverClient])

  function saveRelation(): void {
    if (parsed.kind !== 'valid') return
    relationSequence.current += 1
    dispatch({
      type: 'save',
      id: `relation-${Date.now()}-${relationSequence.current}`,
      source: state.source.trim(),
      ast: parsed.ast,
      now: Date.now(),
    })
    queueMicrotask(() => editorRef.current?.focus())
  }

  function insertOperation(template: string): void {
    const editor = editorRef.current
    const insertion = applyInsertion(
      state.source,
      {
        start: editor?.selectionStart ?? state.source.length,
        end: editor?.selectionEnd ?? state.source.length,
      },
      template,
    )
    dispatch({ type: 'source-changed', source: insertion.source })
    queueMicrotask(() => {
      editorRef.current?.focus()
      editorRef.current?.setSelectionRange(
        insertion.selection.start,
        insertion.selection.end,
      )
    })
  }

  async function calculate(): Promise<void> {
    requestSequence.current += 1
    const requestId = `calculation-${Date.now()}-${requestSequence.current}`
    dispatch({ type: 'solve-started', requestId })

    let result: SolverResult
    if (state.relations.length === 0) {
      result = {
        status: 'error',
        message: 'Add at least one relation before calculating.',
      }
    } else {
      const asts = state.relations.map((relation) => relation.ast)
      const validation = preflight(asts)
      if (!validation.ok) {
        result = {
          status: validation.status,
          equationCount: validation.equationCount,
          variableCount: validation.variableCount,
          message: validation.message,
        }
      } else {
        try {
          result = await client.solve(asts)
        } catch (error) {
          result = {
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The solver stopped unexpectedly.',
          }
        }
      }
    }
    dispatch({ type: 'solve-finished', requestId, result })
  }

  return (
    <section
      className="scientific-calculator"
      aria-label="Scientific calculator workspace"
    >
      <header className="calculator-titlebar">
        <div className="calculator-mark" aria-hidden="true">
          <Sigma />
        </div>
        <div>
          <p className="eyebrow">Real-domain symbolic system</p>
          <h1>Scientific calculator</h1>
        </div>
        <div className="version-badge">
          <span>V1</span>
          <small>Calculator + relations</small>
        </div>
      </header>
      <div className="calculator-workspace">
        <div className="calculator-column">
          <CalculatorToolbar
            editing={state.editingId !== null}
            canSave={parsed.kind === 'valid'}
            canClear={state.source.length > 0 || state.editingId !== null}
            calculating={state.solver.phase === 'loading'}
            onClear={() => dispatch({ type: 'clear-editor' })}
            onSave={saveRelation}
            onCalculate={() => void calculate()}
            onHelp={() => dispatch({ type: 'help-changed', open: true })}
          />
          <DslEditor
            ref={editorRef}
            source={state.source}
            parsed={parsed}
            editing={state.editingId !== null}
            onChange={(source) => dispatch({ type: 'source-changed', source })}
          />
          <MathPreview parsed={parsed} />
          <OperationsPanel onInsert={insertOperation} />
        </div>
        <RelationsPanel
          relations={state.relations}
          editingId={state.editingId}
          onEdit={(id) => {
            dispatch({ type: 'edit', id })
            queueMicrotask(() => editorRef.current?.focus())
          }}
          onDelete={(id) => dispatch({ type: 'delete', id })}
        >
          <ResultPanel
            solver={state.solver}
            engine={engine}
            onRetry={() => client.retry()}
          />
        </RelationsPanel>
      </div>
      <HelpDialog
        open={state.helpOpen}
        onOpenChange={(open) => dispatch({ type: 'help-changed', open })}
      />
    </section>
  )
}
