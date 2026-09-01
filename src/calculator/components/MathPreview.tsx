import type { EditorParseState } from './DslEditor'
import { MathMarkup } from './MathMarkup'

export function MathPreview({ parsed }: { parsed: EditorParseState }) {
  return (
    <section className="preview-section" aria-labelledby="preview-heading">
      <div className="preview-label-row">
        <h2 id="preview-heading">Rendered mathematics</h2>
        <span>Live preview</span>
      </div>
      <div
        className={`math-preview math-preview-${parsed.kind}`}
        aria-label="Rendered math preview"
      >
        {parsed.kind === 'valid' ? (
          <MathMarkup mathml={parsed.mathml} />
        ) : (
          <p>
            {parsed.kind === 'invalid'
              ? 'Finish or correct the expression to restore the preview.'
              : 'Your expression will appear here as you type.'}
          </p>
        )}
      </div>
    </section>
  )
}
