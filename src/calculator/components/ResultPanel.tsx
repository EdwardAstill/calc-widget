import {
  AlertTriangle,
  CheckCircle2,
  Info,
  LoaderCircle,
} from 'lucide-react'
import type { SolverState } from '../model'
import type { SolverEngineSnapshot } from '../solver/client'
import type { DisplayValue, SolverResult } from '../solver/protocol'
import { MathMarkup } from './MathMarkup'

type ResultPanelProps = {
  solver: SolverState
  engine: SolverEngineSnapshot
  onRetry(): void
}

function Value({ value }: { value: DisplayValue }) {
  return (
    <span className="result-value">
      <span aria-hidden="true">
        <MathMarkup latex={value.latex} />
      </span>
      <code className="sr-only">{value.exact}</code>
      {value.approximate && <small>≈ {value.approximate}</small>}
    </span>
  )
}

const DIAGNOSTICS: Record<
  Exclude<SolverResult['status'], 'solved'>,
  { title: string; tone: string }
> = {
  'no-solution': { title: 'No real solution', tone: 'negative' },
  underdetermined: { title: 'System is underdetermined', tone: 'warning' },
  overdefined: { title: 'System is overdefined', tone: 'warning' },
  unresolved: { title: 'Could not resolve this system', tone: 'neutral' },
  unsupported: { title: 'Operation not supported', tone: 'neutral' },
  error: { title: 'Solver error', tone: 'negative' },
}

function Diagnostic({
  result,
  onRetry,
}: {
  result: Exclude<SolverResult, { status: 'solved' }>
  onRetry(): void
}) {
  const diagnostic = DIAGNOSTICS[result.status]
  return (
    <div className={`result-diagnostic result-${diagnostic.tone}`} role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <h3>{diagnostic.title}</h3>
        <p>{result.message}</p>
        {result.status === 'underdetermined' && result.symbols.length > 0 && (
          <p className="diagnostic-detail">Free: {result.symbols.join(', ')}</p>
        )}
        {result.status === 'error' && (
          <button type="button" className="text-button" onClick={onRetry}>
            Retry Python engine
          </button>
        )}
      </div>
    </div>
  )
}

function SolvedResult({ result }: { result: Extract<SolverResult, { status: 'solved' }> }) {
  const count = result.solutions.length
  return (
    <div className="solved-result">
      <div className="result-title-row">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <p className="result-eyebrow">Solved over the reals</p>
          <h3>{count} {count === 1 ? 'solution' : 'solutions'}</h3>
        </div>
      </div>
      <div className="solution-list">
        {result.solutions.map((solution, index) => (
          <article className="solution-card" key={`solution-${index + 1}`}>
            <h4>Solution {index + 1}</h4>
            {Object.entries(solution.assignments).map(([name, value]) => (
              <div className="result-line" key={name}>
                <span>{name}</span>
                <Value value={value} />
              </div>
            ))}
            {solution.queries.map((value, queryIndex) => (
              <div className="result-line result-query-line" key={`query-${queryIndex + 1}`}>
                <span>Query {queryIndex + 1}</span>
                <Value value={value} />
              </div>
            ))}
          </article>
        ))}
      </div>
    </div>
  )
}

export function ResultPanel({ solver, engine, onRetry }: ResultPanelProps) {
  let content
  if (solver.phase === 'loading') {
    content = (
      <div className="result-pending" role="status">
        <LoaderCircle className="spin" aria-hidden="true" />
        <div>
          <h3>{engine.phase === 'loading' ? 'Preparing Python engine' : 'Calculating system'}</h3>
          <p>The first calculation may take longer while SymPy starts.</p>
        </div>
      </div>
    )
  } else if (solver.phase === 'complete') {
    content =
      solver.result.status === 'solved' ? (
        <SolvedResult result={solver.result} />
      ) : (
        <Diagnostic result={solver.result} onRetry={onRetry} />
      )
  } else if (engine.phase === 'failed') {
    content = (
      <Diagnostic
        result={{ status: 'error', message: engine.message }}
        onRetry={onRetry}
      />
    )
  } else {
    content = (
      <div className="result-idle">
        <Info aria-hidden="true" />
        <div>
          <h3>Ready to calculate</h3>
          <p>Results and diagnostics for the shared system will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <section className="result-panel" aria-label="Calculation result" aria-live="polite">
      <div className="result-panel-label">
        <span>Result &amp; diagnostics</span>
        <span className={`engine-dot engine-${engine.phase}`}>{engine.phase}</span>
      </div>
      {content}
    </section>
  )
}
