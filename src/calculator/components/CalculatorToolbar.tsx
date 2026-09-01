import {
  ChartLine,
  CircleHelp,
  Equal,
  Eraser,
  ListPlus,
  Save,
} from 'lucide-react'

type CalculatorToolbarProps = {
  editing: boolean
  canSave: boolean
  canClear: boolean
  calculating: boolean
  onClear(): void
  onSave(): void
  onCalculate(): void
  onHelp(): void
}

export function CalculatorToolbar({
  editing,
  canSave,
  canClear,
  calculating,
  onClear,
  onSave,
  onCalculate,
  onHelp,
}: CalculatorToolbarProps) {
  const SaveIcon = editing ? Save : ListPlus
  return (
    <div className="calculator-toolbar" aria-label="Calculator actions">
      <button
        type="button"
        className="tool-button tool-button-muted"
        onClick={onClear}
        disabled={!canClear}
      >
        <Eraser aria-hidden="true" />
        <span>Clear</span>
      </button>
      <button
        type="button"
        className="tool-button tool-button-primary"
        onClick={onSave}
        disabled={!canSave}
      >
        <SaveIcon aria-hidden="true" />
        <span>{editing ? 'Save relation' : 'Add relation'}</span>
      </button>
      <button
        type="button"
        className="tool-button"
        onClick={onCalculate}
        disabled={calculating}
      >
        <Equal aria-hidden="true" />
        <span>{calculating ? 'Calculating…' : 'Calculate result'}</span>
      </button>
      <button
        type="button"
        className="tool-button tool-button-v2"
        disabled
        aria-label="Plot — available in V2"
        title="Plotting arrives in V2"
      >
        <ChartLine aria-hidden="true" />
        <span>Plot</span>
        <small>V2</small>
      </button>
      <button
        type="button"
        className="icon-button toolbar-help"
        onClick={onHelp}
        aria-label="Calculator help"
      >
        <CircleHelp aria-hidden="true" />
      </button>
    </div>
  )
}
