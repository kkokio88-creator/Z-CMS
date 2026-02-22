import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { Notification } from '../../types';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

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
    <Card className="absolute top-16 right-6 w-80 z-50 overflow-hidden shadow-xl">
      <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-gray-50 dark:bg-gray-800">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles size={14} className="text-primary dark:text-green-400" />
          AI 알림 센터
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={14} className="text-muted-foreground" />
        </Button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">알림이 없습니다.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map(note => (
              <li
                key={note.id}
                onClick={() => onNotificationClick(note)}
                className={cn(
                  'p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer',
                  !note.read && 'bg-blue-50/50 dark:bg-blue-900/10'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 w-2 h-2 rounded-full shrink-0',
                      note.type === 'alert'
                        ? 'bg-red-500'
                        : note.type === 'success'
                          ? 'bg-green-500'
                          : 'bg-blue-500'
                    )}
                  ></div>
                  <div>
                    <p className="text-xs font-bold text-foreground mb-0.5 flex justify-between">
                      {note.title}
                      {note.targetView && (
                        <span className="text-[10px] text-muted-foreground font-normal">이동 &gt;</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {note.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">{note.time}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="p-2 border-t border-border bg-gray-50 dark:bg-gray-800 text-center">
        <Button variant="link" size="sm" className="text-xs text-primary dark:text-green-400 font-medium">
          모두 읽음 처리
        </Button>
      </div>
    </Card>
  );
};
