import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { HELP_CONTENT_HTML } from '../generated/help-content'

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
        <div
          className="help-content"
          dangerouslySetInnerHTML={{ __html: HELP_CONTENT_HTML }}
        />
      </section>
    </div>
  )
}
