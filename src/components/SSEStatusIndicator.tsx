import React, { useState, useEffect } from 'react';
import { sseClient, SSEStatus } from '../services/sseClient';

export const SSEStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<SSEStatus>(sseClient.status);

  useEffect(() => {
    sseClient.connect();
    const unsub = sseClient.onStatusChange(setStatus);
    return () => {
      unsub();
      sseClient.disconnect();
    };
  }, []);

  const config: Record<SSEStatus, { color: string; label: string; icon: string }> = {
    connected: { color: 'text-green-500', label: '실시간 연결', icon: 'wifi' },
    connecting: { color: 'text-yellow-500', label: '연결 중...', icon: 'wifi_find' },
    reconnecting: { color: 'text-orange-500', label: '재연결 중...', icon: 'sync' },
    disconnected: { color: 'text-gray-400', label: '연결 끊김', icon: 'wifi_off' },
  };

  const c = config[status];

  return (
    <div className={`flex items-center gap-1 text-xs ${c.color}`} title={`SSE: ${c.label}`}>
      <span className={`material-icons-outlined text-sm ${status === 'reconnecting' ? 'animate-spin' : ''}`}>
        {c.icon}
      </span>
      <span className="hidden sm:inline">{c.label}</span>
    </div>
  );
};
