import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

type HelpDialogProps = {
  open: boolean
  onOpenChange(open: boolean): void
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onOpenChange])

  if (!open) return null
  return (
    <div className="dialog-layer">
      <button
        type="button"
        className="dialog-scrim"
        aria-label="Close calculator help"
        onClick={() => onOpenChange(false)}
      />
      <section
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <header>
          <div>
            <p className="section-kicker">Notation guide</p>
            <h2 id="help-title">Calculator help</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            aria-label="Close help"
            onClick={() => onOpenChange(false)}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="help-content">
          <section>
            <h3>Natural input</h3>
            <p>
              Implicit multiplication works: <code>2x</code>, <code>2(x+1)</code>, and <code>(x+1)(x-1)</code>.
              Functions accept ordinary parentheses; curly braces are optional.
            </p>
          </section>
          <section>
            <h3>Shared system</h3>
            <p>
              Save equations as constraints and bare expressions as queries. Calculate uses every saved row together and returns all discrete real solutions.
            </p>
          </section>
          <section>
            <h3>Symbolic work</h3>
            <p>
              Try <code>factor(x^2-1)</code>, <code>diff(x^3, x)</code>, or <code>integrate(sin(x), x)</code>.
              Underdetermined systems are reported directly rather than shown with generated parameters.
            </p>
          </section>
          <section>
            <h3>V1 result states</h3>
            <p>
              No solution means the real set is proven empty. Unresolved means the request is valid but SymPy could not produce a decisive finite result. Unsupported identifies a feature outside V1.
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}
