// ============================================
// SOUND EFFECTS FOR UI FEEDBACK
// ============================================

// Cache audio elements to avoid recreating them
const audioCache: Map<string, HTMLAudioElement> = new Map();

function getAudio(src: string): HTMLAudioElement {
  if (!audioCache.has(src)) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audioCache.set(src, audio);
  }
  return audioCache.get(src)!;
}

/**
 * Play the archive success sound - a subtle, satisfying chime
 */
export function playArchiveSound(): void {
  try {
    // Create a simple success sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    // Create oscillator for the main tone
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure the sound - a pleasant rising chime
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.1); // E6
    
    // Envelope - quick attack, medium decay
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Add a second harmonic for richness
    const oscillator2 = audioContext.createOscillator();
    const gainNode2 = audioContext.createGain();
    
    oscillator2.connect(gainNode2);
    gainNode2.connect(audioContext.destination);
    
    oscillator2.type = "sine";
    oscillator2.frequency.setValueAtTime(1320, audioContext.currentTime + 0.05);
    oscillator2.frequency.exponentialRampToValueAtTime(1760, audioContext.currentTime + 0.15);
    
    gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.05);
    gainNode2.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.07);
    gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.35);
    
    oscillator2.start(audioContext.currentTime + 0.05);
    oscillator2.stop(audioContext.currentTime + 0.35);
  } catch (error) {
    // Silently fail if audio isn't supported
    console.warn("Could not play sound:", error);
  }
}

/**
 * Play a notification sound for new probes
 */
export function playProbeSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // A soft notification tone
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
    oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.25);
  } catch (error) {
    console.warn("Could not play sound:", error);
  }
}

/**
 * Play a warning sound when at probe cap
 */
export function playWarningSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // A subtle warning tone
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(330, audioContext.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn("Could not play sound:", error);
  }
}
