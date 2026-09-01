import { forwardRef } from 'react'
import type { RelationAst } from '../dsl/ast'

export type EditorParseState =
  | { kind: 'empty' }
  | { kind: 'valid'; ast: RelationAst; mathml: string }
  | { kind: 'invalid'; message: string }

type DslEditorProps = {
  source: string
  parsed: EditorParseState
  editing: boolean
  onChange(source: string): void
}

export const DslEditor = forwardRef<HTMLTextAreaElement, DslEditorProps>(
  function DslEditor({ source, parsed, editing, onChange }, ref) {
    const diagnosticId = 'dsl-editor-diagnostic'
    return (
      <section className="editor-section" aria-labelledby="editor-heading">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Calculator</p>
            <h2 id="editor-heading">Expression editor</h2>
          </div>
          <span className={`editor-state editor-state-${parsed.kind}`}>
            {editing
              ? 'Editing saved row'
              : parsed.kind === 'valid'
                ? parsed.ast.kind === 'equation'
                  ? 'Equation'
                  : 'Query'
                : parsed.kind === 'invalid'
                  ? 'Check notation'
                  : 'Ready'}
          </span>
        </div>
        <label htmlFor="calculator-source" className="sr-only">
          Calculator expression
        </label>
        <textarea
          ref={ref}
          id="calculator-source"
          className="dsl-textarea"
          value={source}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Try 2x + 3 = 7 or factor(x^2 - 1)"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-invalid={parsed.kind === 'invalid'}
          aria-describedby={diagnosticId}
        />
        <div id={diagnosticId} className="editor-diagnostic">
          {parsed.kind === 'invalid' ? (
            <p role="alert">{parsed.message}</p>
          ) : (
            <p>
              Use familiar notation—implicit multiplication works, and braces are optional.
            </p>
          )}
          <span>{source.length} characters</span>
        </div>
      </section>
    )
  },
)
