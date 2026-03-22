// client/src/hooks/useCall.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { WingmateCall } from '../lib/webrtc';
import { subscribeToSession } from '../lib/pusher';

const token = () => localStorage.getItem('wm_token') || '';

function apiPost(path, body) {
  return fetch(`/api${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
    body:    JSON.stringify(body),
  }).catch(console.error);
}

export function useCall(sessionId) {
  const callRef  = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const [callStatus, setCallStatus] = useState('idle');
  const [isMuted,    setIsMuted]    = useState(false);
  const [isSpeaker,  setIsSpeaker]  = useState(true);
  const [duration,   setDuration]   = useState(0);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    const channel = subscribeToSession(sessionId);

    channel.bind('webrtc:offer', async ({ offer }) => {
      if (!callRef.current) return;
      try {
        const answer = await callRef.current.handleOffer(offer);
        apiPost('/calls/answer', { sessionId, answer });
      } catch (err) { setError('Failed to answer call: ' + err.message); }
    });
    channel.bind('webrtc:answer', async ({ answer }) => {
      if (callRef.current) await callRef.current.handleAnswer(answer);
    });
    channel.bind('webrtc:ice', async ({ candidate }) => {
      if (callRef.current) await callRef.current.handleIceCandidate(candidate);
    });

    return () => {
      channel.unbind('webrtc:offer');
      channel.unbind('webrtc:answer');
      channel.unbind('webrtc:ice');
    };
  }, [sessionId]);

  function makeCall() {
    return new WingmateCall({
      onRemoteStream: (stream) => {
        if (audioRef.current) { audioRef.current.srcObject = stream; audioRef.current.play().catch(console.error); }
      },
      onStateChange: (state) => {
        if (state === 'connected') { setCallStatus('active'); startTimer(); }
        else if (state === 'disconnected' || state === 'failed') { setCallStatus('ended'); stopTimer(); }
      },
      onError: (msg) => setError(msg),
    });
  }

  const startCall = useCallback(async () => {
    setError(null); setCallStatus('connecting');
    try {
      const call = makeCall();
      callRef.current = call;
      await call.startLocalAudio();
      call.createPeerConnection();
      call.onIceCandidate((c) => apiPost('/calls/ice', { sessionId, candidate: c }));
      const offer = await call.createOffer();
      await apiPost('/calls/offer', { sessionId, offer });
      await apiPost('/calls/start', { sessionId });
    } catch (err) {
      setError(err.message); setCallStatus('idle');
      callRef.current?.end(); callRef.current = null;
    }
  }, [sessionId]);

  const answerCall = useCallback(async () => {
    setError(null); setCallStatus('connecting');
    try {
      const call = makeCall();
      callRef.current = call;
      await call.startLocalAudio();
      call.createPeerConnection();
      call.onIceCandidate((c) => apiPost('/calls/ice', { sessionId, candidate: c }));
    } catch (err) {
      setError(err.message); setCallStatus('idle');
      callRef.current?.end(); callRef.current = null;
    }
  }, [sessionId]);

  const endCall = useCallback(async () => {
    callRef.current?.end(); callRef.current = null;
    setCallStatus('ended'); setIsMuted(false); stopTimer();
    await apiPost('/calls/end', { sessionId });
  }, [sessionId]);

  const toggleMute    = useCallback(() => { if (callRef.current) setIsMuted(callRef.current.toggleMute()); }, []);
  const toggleSpeaker = useCallback(() => {
    setIsSpeaker(prev => { const next = !prev; if (audioRef.current) audioRef.current.volume = next ? 1 : 0; return next; });
  }, []);

  function startTimer() { setDuration(0); timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); }
  function stopTimer()  { clearInterval(timerRef.current); timerRef.current = null; }

  useEffect(() => () => { callRef.current?.end(); stopTimer(); }, []);

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return { callStatus, isMuted, isSpeaker, error, duration: fmt(duration), audioRef, startCall, answerCall, endCall, toggleMute, toggleSpeaker };
}
