'use client'

import {
  Calculator,
  ChartNoAxesColumn,
  CircleHelp,
  Eraser,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { ResultCard } from './components/result-card'
import type { RelationAst } from './dsl/ast'
import { relationToMathMl } from './dsl/mathml'
import { parseRelation } from './dsl/parser'
import { HELP_CONTENT_HTML } from './generated/help-content'
import { initialCalculatorState } from './model'
import { applyInsertion, OPERATION_GROUPS } from './operations'
import { calculatorReducer } from './reducer'
import {
  createSolverClient,
  type SolverClient,
  type SolverEngineSnapshot,
} from './solver/client'
import { preflight } from './solver/preflight'
import type { SolverResult } from './solver/protocol'

type ScientificCalculatorProps = { solverClient?: SolverClient }

type EditorParseState =
  | { kind: 'empty' }
  | { kind: 'valid'; ast: RelationAst; mathml: string }
  | { kind: 'invalid'; message: string }

const IDLE_ENGINE: SolverEngineSnapshot = { phase: 'idle' }

function parseEditor(source: string): EditorParseState {
  if (!source.trim()) return { kind: 'empty' }
  try {
    const ast = parseRelation(source)
    return { kind: 'valid', ast, mathml: relationToMathMl(ast) }
  } catch (error) {
    return {
      kind: 'invalid',
      message: error instanceof Error ? error.message : 'This expression is not valid.',
    }
  }
}

export function ScientificCalculator({ solverClient }: ScientificCalculatorProps) {
  const client = useMemo(() => solverClient ?? createSolverClient(), [solverClient])
  const [state, dispatch] = useReducer(calculatorReducer, initialCalculatorState)
  const editorRef = useRef<HTMLInputElement>(null)
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

  function saveRelation() {
    if (parsed.kind !== 'valid') return
    relationSequence.current += 1
    dispatch({
      type: 'save',
      id: `relation-${relationSequence.current}`,
      source: state.source.trim(),
      ast: parsed.ast,
      now: relationSequence.current,
    })
    queueMicrotask(() => editorRef.current?.focus())
  }

  function insertOperation(template: string) {
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
      editorRef.current?.setSelectionRange(insertion.selection.start, insertion.selection.end)
    })
  }

  async function solveRelations(relations: RelationAst[]) {
    if (relations.length === 0) {
      dispatch({
        type: 'local-diagnostic',
        code: 'no-relations',
        message: state.relations.length === 0
          ? 'Add an expression to the shared system first.'
          : 'Enable at least one relation first.',
      })
      return
    }

    requestSequence.current += 1
    const requestId = `calculation-${requestSequence.current}`
    dispatch({ type: 'solve-started', requestId })

    let result: SolverResult
    const validation = preflight(relations)
    if (!validation.ok) {
      result = {
        status: validation.status,
        equationCount: validation.equationCount,
        variableCount: validation.variableCount,
        message: validation.message,
      }
    } else {
      try {
        result = await client.solve(relations)
      } catch (error) {
        result = {
          status: 'error',
          message: error instanceof Error ? error.message : 'The solver stopped unexpectedly.',
        }
      }
    }
    dispatch({ type: 'solve-finished', requestId, result })
  }

  function calculate() {
    return solveRelations(
      state.relations
        .filter((relation) => relation.enabled)
        .map((relation) => relation.ast),
    )
  }

  return (
    <section
      className="mx-auto w-full max-w-6xl p-4 md:p-8"
      aria-label="Scientific calculator workspace"
    >
      <Card>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <section className="grid content-start gap-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => dispatch({ type: 'clear-editor' })}
                  disabled={!state.source && !state.editingId}
                >
                  <Eraser /> Clear
                </Button>
                <Button onClick={saveRelation} disabled={parsed.kind !== 'valid'}>
                  <Plus /> {state.editingId ? 'Save relation' : 'Add relation'}
                </Button>
                <Button variant="outline" disabled aria-label="Plot — V2">
                  <ChartNoAxesColumn /> Plot <Badge variant="secondary">V2</Badge>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Calculator help"
                  onClick={() => dispatch({ type: 'help-changed', open: true })}
                >
                  <CircleHelp />
                </Button>
                {state.editingId ? <Badge>Editing</Badge> : null}
              </div>

              <Field data-invalid={parsed.kind === 'invalid'}>
                <FieldLabel htmlFor="calculator-expression">Calculator expression</FieldLabel>
                <Input
                  ref={editorRef}
                  id="calculator-expression"
                  value={state.source}
                  aria-invalid={parsed.kind === 'invalid'}
                  placeholder="2x + 3 = 7"
                  onChange={(event) => dispatch({ type: 'source-changed', source: event.target.value })}
                />
                {parsed.kind === 'invalid' ? <FieldError>{parsed.message}</FieldError> : null}
              </Field>

              <Alert aria-label="Rendered math preview">
                <AlertTitle aria-hidden="true">&nbsp;</AlertTitle>
                <AlertDescription>
                  {parsed.kind === 'valid' ? (
                    <span dangerouslySetInnerHTML={{ __html: parsed.mathml }} />
                  ) : (
                    <span aria-hidden="true">&nbsp;</span>
                  )}
                </AlertDescription>
              </Alert>

              <Separator />

              <Tabs defaultValue={OPERATION_GROUPS[0].name}>
                <TabsList>
                  {OPERATION_GROUPS.map((group) => (
                    <TabsTrigger key={group.name} value={group.name}>{group.name}</TabsTrigger>
                  ))}
                </TabsList>
                {OPERATION_GROUPS.map((group) => (
                  <TabsContent key={group.name} value={group.name}>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <Button
                          key={item.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => insertOperation(item.template)}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            <Separator className="hidden lg:block" orientation="vertical" />
            <Separator className="lg:hidden" />

            <section className="flex min-h-[32rem] flex-col gap-4">
              <div className="grid gap-3">
                {state.relations.length === 0 ? (
                  <Alert>
                    <AlertTitle>No relations yet</AlertTitle>
                    <AlertDescription>Add an expression from the editor.</AlertDescription>
                  </Alert>
                ) : state.relations.map((relation, index) => (
                  <div className="grid gap-3" key={relation.id}>
                    <div className="flex items-center gap-3" data-testid="relation-row">
                      <Checkbox
                        checked={relation.plotted}
                        aria-label={`Plot ${relation.source}`}
                        onCheckedChange={(plotted) => {
                          dispatch({ type: 'plot-changed', id: relation.id, plotted })
                        }}
                      />
                      <code className="min-w-0 flex-1 break-all">{relation.source}</code>
                      <Button
                        size="sm"
                        aria-label={`Solve ${relation.source}`}
                        disabled={!relation.enabled || state.solver.phase === 'loading'}
                        onClick={() => void solveRelations([relation.ast])}
                      >
                        <Calculator /> Solve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${relation.source}`}
                        onClick={() => {
                          dispatch({ type: 'edit', id: relation.id })
                          queueMicrotask(() => editorRef.current?.focus())
                        }}
                      >
                        <Pencil /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`${relation.enabled ? 'Disable' : 'Enable'} ${relation.source}`}
                        onClick={() => dispatch({
                          type: 'enabled-changed',
                          id: relation.id,
                          enabled: !relation.enabled,
                        })}
                      >
                        {relation.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        aria-label={`Delete ${relation.source}`}
                        onClick={() => dispatch({ type: 'delete', id: relation.id })}
                      >
                        <Trash2 /> Delete
                      </Button>
                    </div>
                    {index < state.relations.length - 1 ? <Separator /> : null}
                  </div>
                ))}
              </div>
              <div>
                <Button onClick={() => void calculate()} disabled={state.solver.phase === 'loading'}>
                  <Calculator /> Calculate
                </Button>
              </div>
              <div className="mt-auto grid gap-4">
                <Separator />
                <ResultCard solver={state.solver} engine={engine} onRetry={() => client.retry()} />
              </div>
            </section>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={state.helpOpen}
        onOpenChange={(open) => dispatch({ type: 'help-changed', open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calculator help</DialogTitle>
            <DialogDescription>Notation and V1 result states.</DialogDescription>
          </DialogHeader>
          <div dangerouslySetInnerHTML={{ __html: HELP_CONTENT_HTML }} />
        </DialogContent>
      </Dialog>
    </section>
  )
}
