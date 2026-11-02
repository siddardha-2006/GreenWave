import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in dashboard:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#11100e] bg-board-canvas flex flex-col items-center justify-center p-6 text-[#e8e1d5] text-center">
          <div className="w-14 h-14 rounded-sm bg-[#241312] border border-[#cf4338] flex items-center justify-center text-2xl mb-4 shadow-[0_0_20px_rgba(207,67,56,0.3)]">
            ⚠️
          </div>
          <h2 className="text-lg font-serif font-medium uppercase tracking-[0.2em] text-[#f5f2eb] mb-2 text-embossed">
            Rendering Interruption
          </h2>
          <p className="text-[#a39886] text-xs max-w-md mb-5 font-mono debossed-well p-3.5 rounded-sm">
            {this.state.error?.message || 'An unexpected rendering exception was caught by safety boundary.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="tactile-btn bg-[#22201c] border-[#38342e] text-[#f5f2eb] font-mono text-xs tracking-widest uppercase px-5 py-2.5 rounded-sm transition"
          >
            Reload Artifact
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

