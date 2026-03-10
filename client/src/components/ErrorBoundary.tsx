import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string | null }) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-screen cosmic-bg text-center space-y-4 p-8" data-testid="error-boundary">
          <AlertTriangle className="w-10 h-10 text-neon-orange" />
          <h2 className="font-heading text-lg font-bold text-foreground">Something went wrong</h2>
          <p className="font-mono text-xs text-muted-foreground max-w-md">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button
            onClick={this.handleReset}
            variant="outline"
            className="gap-2"
            data-testid="button-error-retry"
          >
            <RefreshCw className="w-4 h-4" />
            Reload App
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
