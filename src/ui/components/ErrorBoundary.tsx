import { Component, type ReactNode } from 'react'
import { reportAppError } from '../model/errors.ts'

interface Props {
  readonly fallback: ReactNode
  /** When it changes after a failure, the children are tried again (without remounting them otherwise). */
  readonly resetKey: string | number
  readonly children: ReactNode
}

interface State {
  readonly failed: boolean
  readonly resetKey: string | number
}

/** Shows `fallback` instead of a blank page when rendering the children throws. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey }
  }

  override componentDidCatch(error: unknown): void {
    reportAppError('chyba při zobrazení výsledků', error)
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
