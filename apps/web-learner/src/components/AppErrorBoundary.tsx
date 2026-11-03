import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Keeps a render crash on one screen instead of blanking the learner app. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="min-h-screen grid place-items-center p-6 bg-white text-[#101828]">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-[#4a5565]">The page hit an unexpected error. Your account is still signed in.</p>
          <button
            type="button"
            className="mt-4 h-11 px-4 rounded-xl bg-g-blue-700 text-white text-sm font-semibold"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
