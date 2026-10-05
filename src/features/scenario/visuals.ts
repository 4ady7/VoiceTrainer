import { COMPONENT_BY_ID, COMPONENTS } from './content'
import type { ComponentId, ScenarioState } from './types'

export type VisualPrimary = 'normal' | 'hovered' | 'selected' | 'highlighted' | 'warning' | 'fault' | 'checked'

export interface ComponentVisual {
  id: ComponentId
  checked: boolean
  highlighted: boolean
  hovered: boolean
  selected: boolean
  warning: boolean
  fault: boolean
  primary: VisualPrimary
}

export function deriveVisuals(
  state: ScenarioState,
  hovered: ComponentId | null,
  selected: ComponentId | null,
): Record<ComponentId, ComponentVisual> {
  const visuals = {} as Record<ComponentId, ComponentVisual>
  for (const spec of COMPONENTS) {
    const checked = Boolean(state.checked[spec.id])
    const fault = spec.id === 'filter_panel' && checked && spec.abnormal
    const warning = spec.abnormal && checked && !fault
    const highlighted = state.lastComponentId === spec.id
    const isHovered = hovered === spec.id
    const isSelected = selected === spec.id
    let primary: VisualPrimary = 'normal'
    if (fault) primary = 'fault'
    else if (warning) primary = 'warning'
    else if (highlighted) primary = 'highlighted'
    else if (isSelected) primary = 'selected'
    else if (isHovered) primary = 'hovered'
    else if (checked) primary = 'checked'
    visuals[spec.id] = {
      id: spec.id,
      checked,
      highlighted,
      hovered: isHovered,
      selected: isSelected,
      warning,
      fault,
      primary,
    }
  }
  return visuals
}

export function visualStatus(visual: ComponentVisual): string {
  const parts: string[] = []
  if (visual.fault) parts.push('Fault found')
  else if (visual.warning) parts.push('Attention')
  else if (visual.checked) parts.push('Checked')
  if (visual.highlighted) parts.push('In view')
  if (parts.length === 0) return 'Not checked'
  return parts.join(', ')
}

export function componentLabel(id: ComponentId): string {
  return COMPONENT_BY_ID[id].label
}
