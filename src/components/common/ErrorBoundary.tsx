/**
 * ErrorBoundary — 화면별 오류 격리
 * 한 화면에서 오류가 발생해도 다른 화면에 영향을 주지 않습니다.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] 오류 발생:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-10 text-center min-h-[300px]">
          <span className="material-icons-outlined text-5xl text-red-400 mb-4">error_outline</span>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
            {this.props.fallbackTitle || '화면 로드 중 오류가 발생했습니다'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 max-w-md">
            {this.state.error?.message || '알 수 없는 오류'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            이 오류는 이 화면에만 영향을 줍니다. 다른 메뉴는 정상 사용 가능합니다.
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover text-sm"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
