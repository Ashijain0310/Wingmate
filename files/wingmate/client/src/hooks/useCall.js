// client/src/hooks/useCall.js
import { useEffect, useRef, useState, useCallback } from 'react';
import { WingmateCall } from '../lib/webrtc';
import { getSocket } from '../lib/socket';
import { calls } from '../lib/api';

export function useCall(sessionId) {
  const callRef  = useRef(null);
  const audioRef = useRef(null); // <audio> element for remote stream
  const socket   = getSocket();

  const [callStatus, setCallStatus]   = useState('idle');    // idle|connecting|active|ended
  const [isMuted, setIsMuted]         = useState(false);
  const [isSpeaker, setIsSpeaker]     = useState(true);
  const [duration, setDuration]       = useState(0);
  const [error, setError]             = useState(null);
  const timerRef = useRef(null);

  // Set up WebRTC signalling listeners
  useEffect(() => {
    if (!socket || !sessionId) return;

    async function handleOffer({ offer }) {
      if (!callRef.current) return;
      try {
        const answer = await callRef.current.handleOffer(offer);
        socket.emit('webrtc:answer', { sessionId, answer });
      } catch (err) {
        setError('Failed to answer call: ' + err.message);
      }
    }

    async function handleAnswer({ answer }) {
      if (!callRef.current) return;
      await callRef.current.handleAnswer(answer);
    }

    async function handleIce({ candidate }) {
      if (!callRef.current) return;
      await callRef.current.handleIceCandidate(candidate);
    }

    socket.on('webrtc:offer',  handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice',    handleIce);

    return () => {
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice', handleIce);
    };
  }, [socket, sessionId]);

  const startCall = useCallback(async () => {
    setError(null);
    setCallStatus('connecting');
    try {
      // Create WingmateCall instance
      const call = new WingmateCall({
        onRemoteStream: (stream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(console.error);
          }
        },
        onStateChange: (state) => {
          if (state === 'connected') {
            setCallStatus('active');
            startTimer();
          } else if (state === 'disconnected' || state === 'failed') {
            setCallStatus('ended');
            stopTimer();
          }
        },
        onError: (msg) => setError(msg),
      });

      callRef.current = call;

      // Get microphone
      await call.startLocalAudio();

      // Create peer connection
      call.createPeerConnection();

      // Relay ICE candidates via socket
      call.onIceCandidate((candidate) => {
        socket?.emit('webrtc:ice', { sessionId, candidate });
      });

      // Create and send offer (caller side)
      const offer = await call.createOffer();
      socket?.emit('webrtc:offer', { sessionId, offer });

      // Notify backend call started
      await calls.start(sessionId);
    } catch (err) {
      setError(err.message);
      setCallStatus('idle');
    }
  }, [socket, sessionId]);

  const answerCall = useCallback(async () => {
    setError(null);
    setCallStatus('connecting');
    try {
      const call = new WingmateCall({
        onRemoteStream: (stream) => {
          if (audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(console.error);
          }
        },
        onStateChange: (state) => {
          if (state === 'connected') {
            setCallStatus('active');
            startTimer();
          }
        },
        onError: (msg) => setError(msg),
      });

      callRef.current = call;
      await call.startLocalAudio();
      call.createPeerConnection();
      call.onIceCandidate((candidate) => {
        socket?.emit('webrtc:ice', { sessionId, candidate });
      });
      // Answer is created once offer arrives via handleOffer above
    } catch (err) {
      setError(err.message);
      setCallStatus('idle');
    }
  }, [socket, sessionId]);

  const endCall = useCallback(async () => {
    callRef.current?.end();
    callRef.current = null;
    setCallStatus('ended');
    setIsMuted(false);
    stopTimer();
    try { await calls.end(sessionId); } catch { /* non-fatal */ }
    socket?.emit('call:end', { sessionId });
  }, [socket, sessionId]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const muted = callRef.current.toggleMute();
    setIsMuted(muted);
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeaker(prev => {
      const next = !prev;
      if (audioRef.current) audioRef.current.volume = next ? 1.0 : 0.0;
      return next;
    });
  }, []);

  function startTimer() {
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }

  function stopTimer() {
    clearInterval(timerRef.current);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      callRef.current?.end();
      stopTimer();
    };
  }, []);

  const formatDuration = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  return {
    callStatus, isMuted, isSpeaker, error,
    duration: formatDuration(duration),
    audioRef,   // attach to a hidden <audio> element
    startCall, answerCall, endCall, toggleMute, toggleSpeaker,
  };
}
