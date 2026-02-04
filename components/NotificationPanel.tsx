import React from 'react';
import { Notification } from '../types';

interface Props {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick: (notification: Notification) => void;
}

export const NotificationPanel: React.FC<Props> = ({
  notifications,
  isOpen,
  onClose,
  onNotificationClick,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-6 w-80 bg-white dark:bg-surface-dark shadow-xl rounded-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="material-icons-outlined text-primary dark:text-green-400 text-sm">
            auto_awesome
          </span>
          AI 알림 센터
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <span className="material-icons-outlined text-sm">close</span>
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">알림이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map(note => (
              <li
                key={note.id}
                onClick={() => onNotificationClick(note)}
                className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${!note.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                      note.type === 'alert'
                        ? 'bg-red-500'
                        : note.type === 'success'
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                    }`}
                  ></div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white mb-0.5 flex justify-between">
                      {note.title}
                      {note.targetView && (
                        <span className="text-[10px] text-gray-400 font-normal">이동 &gt;</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-snug">
                      {note.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{note.time}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center">
        <button className="text-xs text-primary dark:text-green-400 font-medium hover:underline">
          모두 읽음 처리
        </button>
      </div>
    </div>
  );
};
