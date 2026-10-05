import type { ComponentId } from '../features/scenario/types'
import type { ComponentVisual } from '../features/scenario/visuals'
import { componentLabel, visualStatus } from '../features/scenario/visuals'

interface EquipmentIndexProps {
  visuals: Record<ComponentId, ComponentVisual>
  disabled: boolean
  onInspect: (id: ComponentId) => void
  onHover: (id: ComponentId | null) => void
}

export function EquipmentIndex({ visuals, disabled, onInspect, onHover }: EquipmentIndexProps) {
  return (
    <nav className="equipment" aria-label="Equipment">
      <p className="eyebrow">Equipment</p>
      <ul>
        {Object.values(visuals).map((visual) => {
          const status = visualStatus(visual)
          return (
            <li key={visual.id}>
              <button
                type="button"
                disabled={disabled}
                data-active={visual.highlighted ? 'true' : 'false'}
                data-state={visual.primary}
                aria-current={visual.highlighted ? 'true' : undefined}
                onMouseEnter={() => onHover(visual.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(visual.id)}
                onBlur={() => onHover(null)}
                onClick={() => onInspect(visual.id)}
              >
                <span>{componentLabel(visual.id)}</span>
                <span className="meta">{status}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
