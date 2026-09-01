import { Pencil, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { relationToMathMl } from '../dsl/mathml'
import type { Relation } from '../model'
import { MathMarkup } from './MathMarkup'

type RelationRowProps = {
  relation: Relation
  editing: boolean
  onEdit(): void
  onDelete(): void
}

export function RelationRow({
  relation,
  editing,
  onEdit,
  onDelete,
}: RelationRowProps) {
  const mathml = useMemo(() => relationToMathMl(relation.ast), [relation.ast])
  return (
    <li
      className={`relation-row${editing ? ' relation-row-editing' : ''}`}
      data-testid="relation-row"
    >
      <label className="plot-checkbox" title="Plotting arrives in V2">
        <input
          type="checkbox"
          disabled
          aria-label={`Plot ${relation.source} — available in V2`}
        />
        <span aria-hidden="true" />
      </label>
      <div className="relation-content">
        <div className="relation-meta">
          <span className={`relation-kind relation-kind-${relation.ast.kind}`}>
            {relation.ast.kind === 'equation' ? 'Equation' : 'Query'}
          </span>
          {editing && <span className="editing-pill">Editing</span>}
        </div>
        <MathMarkup className="relation-math" mathml={mathml} />
        <code className="relation-source">{relation.source}</code>
      </div>
      <div className="relation-actions">
        <button
          type="button"
          className="icon-button"
          onClick={onEdit}
          aria-label={`Edit ${relation.source}`}
        >
          <Pencil aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button icon-button-danger"
          onClick={onDelete}
          aria-label={`Delete ${relation.source}`}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}
