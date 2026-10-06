import { Component, type ReactNode } from 'react'

interface SceneBoundaryProps {
  children: ReactNode
}

interface SceneBoundaryState {
  failed: boolean
}

export class SceneBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false }

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="stage-fallback">
          The 3D view is unavailable. The equipment list and the text box still run this exercise.
        </p>
      )
    }
    return this.props.children
  }
}
