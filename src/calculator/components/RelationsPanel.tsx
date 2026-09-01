import type { ReactNode } from 'react'
import type { Relation } from '../model'
import { RelationRow } from './RelationRow'

type RelationsPanelProps = {
  relations: Relation[]
  editingId: string | null
  onEdit(id: string): void
  onDelete(id: string): void
  children: ReactNode
}

export function RelationsPanel({
  relations,
  editingId,
  onEdit,
  onDelete,
  children,
}: RelationsPanelProps) {
  return (
    <aside className="relations-column" aria-labelledby="relations-heading">
      <header className="relations-header">
        <div>
          <p className="section-kicker">One system</p>
          <h2 id="relations-heading">Shared relations</h2>
        </div>
        <span className="relation-count" aria-label={`${relations.length} saved relations`}>
          {relations.length.toString().padStart(2, '0')}
        </span>
      </header>
      <p className="relations-explainer">
        Equations constrain the system. Bare expressions become queries across every solution.
      </p>
      <div className="relations-scroll">
        {relations.length === 0 ? (
          <div className="relations-empty">
            <span aria-hidden="true">∅</span>
            <h3>No relations yet</h3>
            <p>Build an expression on the left, then add it to the shared system.</p>
          </div>
        ) : (
          <ol className="relations-list">
            {relations.map((relation) => (
              <RelationRow
                key={relation.id}
                relation={relation}
                editing={editingId === relation.id}
                onEdit={() => onEdit(relation.id)}
                onDelete={() => onDelete(relation.id)}
              />
            ))}
          </ol>
        )}
      </div>
      {children}
    </aside>
  )
}
