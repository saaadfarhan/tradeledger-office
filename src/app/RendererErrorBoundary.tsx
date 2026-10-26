import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Props = { children: React.ReactNode }
type State = {
  error: Error | null
  componentStack: string
  copied: boolean
  copyFailed: boolean
}

export class RendererErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: '', copied: false, copyFailed: false }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack || '' })
    console.error('TradeLedger Office renderer error', error, info.componentStack)
  }

  private report() {
    const { error, componentStack } = this.state
    return [
      `Error: ${error?.message || 'Unknown renderer error'}`,
      error?.stack ? `\nJavaScript stack:\n${error.stack}` : '',
      componentStack ? `\nReact component stack:${componentStack}` : '',
    ].filter(Boolean).join('\n')
  }

  private copyReport = async () => {
    try {
      await navigator.clipboard.writeText(this.report())
      this.setState({ copied: true, copyFailed: false })
    } catch {
      this.setState({ copied: false, copyFailed: true })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="grid min-h-svh place-items-center overflow-auto bg-muted/50 p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle>TradeLedger Office encountered a display error</CardTitle>
            <CardDescription>
              The interface stopped rendering. Your database was not reset. Copy this report and send it to the developer so the cause can be identified.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <pre className="max-h-[55svh] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-xs select-text">{this.report()}</pre>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void this.copyReport()}>
                {this.state.copied ? 'Report copied' : 'Copy diagnostic report'}
              </Button>
              {this.state.copyFailed && <p role="status" className="text-sm text-muted-foreground">Clipboard access failed. Select and copy the report text above.</p>}
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }
}
