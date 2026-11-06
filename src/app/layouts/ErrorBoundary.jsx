import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.title || '', error, info?.componentStack);
  }

  render() {
    const { title, children } = this.props;
    if (this.state.error) {
      return (
        <div className="p-4">
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600">error</span>
              <div className="min-w-0">
                <h2 className="font-headline-sm text-[15px] font-semibold text-red-700 dark:text-red-300">
                  Không thể hiển thị{title ? ` ${title}` : ' trang này'}
                </h2>
                <p className="font-body-sm text-[12px] text-red-600/80 dark:text-red-300/80 break-words mt-1">
                  {String(this.state.error?.message || this.state.error)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white font-label-md text-[12px] font-semibold hover:bg-red-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return children;
  }
}
