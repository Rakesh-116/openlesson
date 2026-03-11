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

/**
 * Play a celebratory reward sound for step completion
 * An elaborate arpeggio with shimmer effect - big reward for the user!
 */
export function playStepCompleteSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const startTime = audioContext.currentTime;
    
    // Major chord arpeggio: C5 -> E5 -> G5 -> C6 (ascending celebration)
    const notes = [523, 659, 784, 1047];
    
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + i * 0.1);
      
      // Quick attack, smooth decay
      gain.gain.setValueAtTime(0, startTime + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.25, startTime + i * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + i * 0.1 + 0.5);
      
      osc.start(startTime + i * 0.1);
      osc.stop(startTime + i * 0.1 + 0.5);
      
      // Add harmonic for richness
      const harmonic = audioContext.createOscillator();
      const harmonicGain = audioContext.createGain();
      harmonic.connect(harmonicGain);
      harmonicGain.connect(audioContext.destination);
      harmonic.type = "sine";
      harmonic.frequency.setValueAtTime(freq * 2, startTime + i * 0.1);
      harmonicGain.gain.setValueAtTime(0, startTime + i * 0.1);
      harmonicGain.gain.linearRampToValueAtTime(0.08, startTime + i * 0.1 + 0.03);
      harmonicGain.gain.exponentialRampToValueAtTime(0.01, startTime + i * 0.1 + 0.4);
      harmonic.start(startTime + i * 0.1);
      harmonic.stop(startTime + i * 0.1 + 0.4);
    });
    
    // Add final shimmer/sparkle effect (high frequency flourish)
    const shimmer = audioContext.createOscillator();
    const shimmerGain = audioContext.createGain();
    shimmer.connect(shimmerGain);
    shimmerGain.connect(audioContext.destination);
    shimmer.type = "triangle";
    shimmer.frequency.setValueAtTime(2093, startTime + 0.4); // C7
    shimmer.frequency.exponentialRampToValueAtTime(2637, startTime + 0.55); // E7
    shimmerGain.gain.setValueAtTime(0, startTime + 0.4);
    shimmerGain.gain.linearRampToValueAtTime(0.12, startTime + 0.43);
    shimmerGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.8);
    shimmer.start(startTime + 0.4);
    shimmer.stop(startTime + 0.8);
    
    // Second shimmer for sparkle
    const shimmer2 = audioContext.createOscillator();
    const shimmer2Gain = audioContext.createGain();
    shimmer2.connect(shimmer2Gain);
    shimmer2Gain.connect(audioContext.destination);
    shimmer2.type = "sine";
    shimmer2.frequency.setValueAtTime(3136, startTime + 0.5); // G7
    shimmer2Gain.gain.setValueAtTime(0, startTime + 0.5);
    shimmer2Gain.gain.linearRampToValueAtTime(0.08, startTime + 0.52);
    shimmer2Gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.9);
    shimmer2.start(startTime + 0.5);
    shimmer2.stop(startTime + 0.9);
  } catch (error) {
    console.warn("Could not play step complete sound:", error);
  }
}

/**
 * Play a grand celebratory sound for session/plan completion
 * A fuller, more elaborate fanfare to mark the achievement
 */
export function playSessionCompleteSound(): void {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const startTime = audioContext.currentTime;
    
    // Grand fanfare: C major chord then resolve to G major
    // First chord: C-E-G (C major)
    const chord1 = [523, 659, 784]; // C5, E5, G5
    // Second chord: G-B-D (G major) 
    const chord2 = [392, 494, 587]; // G4, B4, D5
    // Final resolution: C major octave higher
    const chord3 = [1047, 1319, 1568]; // C6, E6, G6
    
    // Play first chord
    chord1.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.1, startTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
    
    // Play second chord (after brief pause)
    chord2.forEach((freq) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + 0.35);
      gain.gain.setValueAtTime(0, startTime + 0.35);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.08, startTime + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.85);
      osc.start(startTime + 0.35);
      osc.stop(startTime + 0.85);
    });
    
    // Play final resolving chord
    chord3.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime + 0.7);
      gain.gain.setValueAtTime(0, startTime + 0.7);
      gain.gain.linearRampToValueAtTime(0.25 - i * 0.05, startTime + 0.75);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.5);
      osc.start(startTime + 0.7);
      osc.stop(startTime + 1.5);
      
      // Add harmonics for richness
      const harmonic = audioContext.createOscillator();
      const harmonicGain = audioContext.createGain();
      harmonic.connect(harmonicGain);
      harmonicGain.connect(audioContext.destination);
      harmonic.type = "sine";
      harmonic.frequency.setValueAtTime(freq * 2, startTime + 0.7);
      harmonicGain.gain.setValueAtTime(0, startTime + 0.7);
      harmonicGain.gain.linearRampToValueAtTime(0.06, startTime + 0.75);
      harmonicGain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.3);
      harmonic.start(startTime + 0.7);
      harmonic.stop(startTime + 1.3);
    });
    
    // Final sparkle/shimmer
    const shimmer = audioContext.createOscillator();
    const shimmerGain = audioContext.createGain();
    shimmer.connect(shimmerGain);
    shimmerGain.connect(audioContext.destination);
    shimmer.type = "triangle";
    shimmer.frequency.setValueAtTime(2093, startTime + 1.0);
    shimmer.frequency.exponentialRampToValueAtTime(3136, startTime + 1.3);
    shimmerGain.gain.setValueAtTime(0, startTime + 1.0);
    shimmerGain.gain.linearRampToValueAtTime(0.1, startTime + 1.05);
    shimmerGain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.6);
    shimmer.start(startTime + 1.0);
    shimmer.stop(startTime + 1.6);
  } catch (error) {
    console.warn("Could not play session complete sound:", error);
  }
}
