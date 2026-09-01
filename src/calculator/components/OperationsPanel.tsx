import { OPERATION_GROUPS } from '../operations'

export function OperationsPanel({
  onInsert,
}: {
  onInsert(template: string): void
}) {
  return (
    <section className="operations-section" aria-labelledby="operations-heading">
      <div className="section-heading-row operations-heading">
        <div>
          <p className="section-kicker">Insert</p>
          <h2 id="operations-heading">Operations</h2>
        </div>
        <p>Selection-aware</p>
      </div>
      <div className="operation-groups">
        {OPERATION_GROUPS.map((group) => (
          <section className="operation-group" key={group.name}>
            <h3>{group.name}</h3>
            <div className="operation-grid">
              {group.items.map((item) => (
                <button
                  type="button"
                  className="operation-button"
                  key={item.id}
                  onClick={() => onInsert(item.template)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
