import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[PageErrorBoundary] ${this.props.pageName ?? "Page"} crashed:`,
      error.message,
      info.componentStack?.slice(0, 400)
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 p-8"
          data-testid="page-error-boundary"
        >
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="font-heading text-xl font-bold text-foreground">Something went wrong</h2>
          <p className="font-mono text-xs text-muted-foreground max-w-sm break-words">
            {this.state.error.message}
          </p>
          <button
            data-testid="button-error-retry"
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 rounded-sm bg-primary/20 text-primary text-xs font-heading uppercase tracking-wider border border-primary/40 hover:bg-primary/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
