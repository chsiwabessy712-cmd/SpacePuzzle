class AudioManager {
  constructor() {
    this.audioContext = null;
    this.bgm = new Audio('/background_music.mp3');
    this.bgm.loop = true;
    this.bgm.volume = 0.4;
    
    this.celebrationMusic = new Audio('/celebration.mp3');
    this.celebrationMusic.volume = 0.6;

    this.hasStarted = false;
    this.isMuted = false;
  }

  setMuted(muted) {
    this.isMuted = muted;
    this.bgm.muted = muted;
    this.celebrationMusic.muted = muted;
    if (muted) {
      this.bgm.pause();
      this.celebrationMusic.pause();
    } else {
      if (this.hasStarted) {
        this.bgm.play().catch(e => {});
      }
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  init() {
    if (!this.hasStarted) {
      this.hasStarted = true;
    if (!this.isMuted) {
      this.bgm.play().catch(err => console.warn('BGM play failed:', err));
    }
      
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  playCelebration() {
    this.bgm.pause();
    this.celebrationMusic.currentTime = 0;
    if (!this.isMuted) {
      this.celebrationMusic.play().catch(err => console.warn('Celebration play failed:', err));
    }
  }

  resumeBgm() {
    this.celebrationMusic.pause();
    if (this.hasStarted && !this.isMuted) {
      this.bgm.play().catch(err => console.warn('BGM resume failed:', err));
    }
  }

  playMoveSound() {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.1);
  }

  playStoneSound() {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.2);
  }

  playBridgeSound() {
    if (!this.audioContext) return;
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.audioContext.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, this.audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.5);
  }
}

export const audioManager = new AudioManager();
