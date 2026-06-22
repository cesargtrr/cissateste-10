import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class GlobalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  private handleWindowError = (event: ErrorEvent) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message || "Erro inesperado");
    this.setState({ error });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Promessa rejeitada"));
    this.setState({ error });
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro fatal capturado pelo ErrorBoundary global:", error, info);
    reportLovableError(error, {
      boundary: "global_error_boundary",
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6">
          <h1>Erro ao carregar o painel</h1>
          <pre>{String(this.state.error)}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}