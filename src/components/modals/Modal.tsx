import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Panel */}
      <div className="relative w-full max-w-lg transform rounded-xl bg-white dark:bg-surface-dark p-6 shadow-2xl transition-all border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-5">
          <h3 id="modal-title" className="text-lg font-bold leading-6 text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-700 focus:outline-none"
            aria-label="닫기"
          >
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        <div className="mt-2">{children}</div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={onClose}
          >
            닫기
          </button>
          <button
            type="button"
            className="inline-flex justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            onClick={onClose}
          >
            상세 리포트 이동
          </button>
        </div>
      </div>
    </div>
  );
};
