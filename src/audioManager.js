class AudioManager {
  constructor() {
    this.audioContext = null;
    this.bgm = new Audio('/background_music.mp3');
    this.bgm.loop = true;
    
    this.celebrationMusic = new Audio('/celebration.mp3');

    this.masterVolume = parseFloat(localStorage.getItem('puzzleArena_masterVol') ?? '0.8');
    this.musicVolume = parseFloat(localStorage.getItem('puzzleArena_musicVol') ?? '0.8');
    this.sfxVolume = parseFloat(localStorage.getItem('puzzleArena_sfxVol') ?? '0.8');

    this.hasStarted = false;
    this.isMuted = false;
    
    this.updateAudioVolumes();
  }

  updateAudioVolumes() {
    const musicMultiplier = this.isMuted ? 0 : (this.masterVolume * this.musicVolume);
    this.bgm.volume = musicMultiplier * 0.4;
    this.celebrationMusic.volume = musicMultiplier * 0.6;
  }

  setVolumes(master, music, sfx) {
    this.masterVolume = master;
    this.musicVolume = music;
    this.sfxVolume = sfx;
    
    localStorage.setItem('puzzleArena_masterVol', master.toString());
    localStorage.setItem('puzzleArena_musicVol', music.toString());
    localStorage.setItem('puzzleArena_sfxVol', sfx.toString());
    
    this.updateAudioVolumes();
  }

  getSfxGain() {
    return this.isMuted ? 0 : (this.masterVolume * this.sfxVolume);
  }

  setMuted(muted) {
    this.isMuted = muted;
    this.updateAudioVolumes();
    if (muted) {
      this.bgm.pause();
      this.celebrationMusic.pause();
    } else {
      if (this.hasStarted && this.bgm.paused && this.celebrationMusic.paused) {
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
      if (!this.isMuted && this.masterVolume * this.musicVolume > 0) {
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
    if (!this.isMuted && this.masterVolume * this.musicVolume > 0) {
      this.celebrationMusic.play().catch(err => console.warn('Celebration play failed:', err));
    }
  }

  resumeBgm() {
    this.celebrationMusic.pause();
    if (this.hasStarted && !this.isMuted && this.masterVolume * this.musicVolume > 0) {
      this.bgm.play().catch(err => console.warn('BGM resume failed:', err));
    }
  }

  playMoveSound() {
    if (!this.audioContext) return;
    const sfxGain = this.getSfxGain();
    if (sfxGain <= 0.01) return; // avoid 0 for exponential ramp
    
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.1 * sfxGain, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01 * sfxGain, this.audioContext.currentTime + 0.1);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.1);
  }

  playStoneSound() {
    if (!this.audioContext) return;
    const sfxGain = this.getSfxGain();
    if (sfxGain <= 0.01) return;
    
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2 * sfxGain, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01 * sfxGain, this.audioContext.currentTime + 0.2);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.2);
  }

  playBridgeSound() {
    if (!this.audioContext) return;
    const sfxGain = this.getSfxGain();
    if (sfxGain <= 0.01) return;
    
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.audioContext.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2 * sfxGain, this.audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.5);
  }

  playHoverSound() {
    if (!this.audioContext) return;
    const sfxGain = this.getSfxGain();
    if (sfxGain <= 0.01) return;
    
    const osc = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0.1 * sfxGain, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01 * sfxGain, this.audioContext.currentTime + 0.05);
    
    osc.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + 0.05);
  }
}

export const audioManager = new AudioManager();
