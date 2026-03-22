// client/src/hooks/useNotifications.js
// Browser push notifications for incoming calls and session requests

import { useEffect, useCallback } from 'react';
import { getPusherClient } from '../lib/pusher';

export function useNotifications() {

  // Request permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const notify = useCallback((title, body, options = {}) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus()) return; // don't notify if tab is focused

    const n = new Notification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      tag: options.tag || 'wingmate',
      ...options,
    });

    n.onclick = () => {
      window.focus();
      if (options.url) window.location.href = options.url;
      n.close();
    };

    setTimeout(() => n.close(), 8000);
    return n;
  }, []);

  // Pusher global notifications are bound per-session in useChat
  // This hook only handles permission request and programmatic notify()

  return { notify };
}
