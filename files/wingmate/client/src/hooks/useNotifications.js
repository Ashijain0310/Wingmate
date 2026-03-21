// client/src/hooks/useNotifications.js
// Browser push notifications for incoming calls and session requests

import { useEffect, useCallback } from 'react';
import { getSocket } from '../lib/socket';

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

  // Listen for socket events that should trigger notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onCallIncoming({ from }) {
      notify(
        '📞 Incoming Voice Call',
        `${from.alias} wants to switch to a voice call`,
        { tag: 'incoming-call', url: '/chat' }
      );
    }

    function onMessage(msg) {
      if (msg.senderRole === 'ai_note') return;
      notify(
        '💬 New Message',
        `${msg.senderAlias}: ${msg.content.slice(0, 80)}`,
        { tag: 'new-message', url: '/chat' }
      );
    }

    function onWingmateRequest({ category }) {
      notify(
        '🦋 Someone needs a Wingmate',
        `Category: ${category || 'General'} — tap to view`,
        { tag: 'session-request', url: '/wingmate' }
      );
    }

    socket.on('call:incoming',       onCallIncoming);
    socket.on('message:new',         onMessage);
    socket.on('wingmate:request',    onWingmateRequest);

    return () => {
      socket.off('call:incoming',    onCallIncoming);
      socket.off('message:new',      onMessage);
      socket.off('wingmate:request', onWingmateRequest);
    };
  }, [notify]);

  return { notify };
}
