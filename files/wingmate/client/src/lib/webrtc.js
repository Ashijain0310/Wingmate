// client/src/lib/webrtc.js
// Manages a real WebRTC audio call between seeker and Wingmate
// Uses the Socket.io signalling channel already established

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // For production, add TURN servers:
  // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
];

export class WingmateCall {
  constructor({ onRemoteStream, onStateChange, onError }) {
    this.pc = null;
    this.localStream = null;
    this.onRemoteStream = onRemoteStream || (() => {});
    this.onStateChange = onStateChange || (() => {});
    this.onError = onError || console.error;
    this.isMuted = false;
  }

  async startLocalAudio() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,   // basic noise reduction
          sampleRate: 48000,
        },
        video: false,
      });
      return this.localStream;
    } catch (err) {
      this.onError('Microphone access denied: ' + err.message);
      throw err;
    }
  }

  createPeerConnection() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.pc.addTrack(track, this.localStream);
      });
    }

    // Receive remote audio
    this.pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.onRemoteStream(remoteStream);
    };

    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      this.onStateChange(this.pc.connectionState);
    };

    return this.pc;
  }

  async createOffer() {
    const offer = await this.pc.createOffer({ offerToReceiveAudio: true });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  async handleOffer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  async handleAnswer(answer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async handleIceCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Non-fatal — ICE candidate races are normal
    }
  }

  // ICE candidates collected locally — must be sent to remote via signalling
  onIceCandidate(callback) {
    if (this.pc) {
      this.pc.onicecandidate = (event) => {
        if (event.candidate) callback(event.candidate);
      };
    }
  }

  toggleMute() {
    if (!this.localStream) return this.isMuted;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
    return this.isMuted;
  }

  end() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.isMuted = false;
  }
}
