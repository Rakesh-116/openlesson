// ============================================
// SIGNAL QUALITY SYSTEM - Pre-session calibration & validation
// ============================================

export interface ChannelQuality {
  channel: string;
  quality: number;
  status: "good" | "fair" | "poor";
  variance: number;
  noiseFloor: number;
  railHits: number;      // Count of samples hitting ADC rails (-250 or >240)
  dcOffset: number;      // Mean DC offset (should be near zero for good contact)
}

export interface CalibrationResult {
  passed: boolean;
  channels: ChannelQuality[];
  overallQuality: number;
  warnings: string[];
}

export interface NoiseThresholds {
  maxVariance: number;
  maxNoiseFloor: number;
}

const DEFAULT_THRESHOLDS: NoiseThresholds = {
  maxVariance: 100000,
  maxNoiseFloor: 500,
};

const CHANNEL_NAMES = ["TP9", "AF7", "AF8", "TP10", "FPz", "AUX_R", "AUX_L"];

export class SignalQualityChecker {
  private sampleBuffers: Map<string, number[]> = new Map();
  private calibrationDuration: number = 20000;
  private thresholds: NoiseThresholds;
  private isCalibrating: boolean = false;
  private calibrationStart: number = 0;

  constructor(thresholds: NoiseThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  startCalibration(): void {
    this.sampleBuffers.clear();
    this.isCalibrating = true;
    this.calibrationStart = Date.now();
  }

  addSample(channel: string, samples: number[]): void {
    if (!this.sampleBuffers.has(channel)) {
      this.sampleBuffers.set(channel, []);
    }
    const buffer = this.sampleBuffers.get(channel)!;
    buffer.push(...samples);
    
    if (buffer.length > 2560) {
      buffer.splice(0, buffer.length - 2560);
    }
  }

  getElapsed(): number {
    return Date.now() - this.calibrationStart;
  }

  isDone(): boolean {
    return this.isCalibrating && this.getElapsed() >= this.calibrationDuration;
  }

  finishCalibration(): CalibrationResult {
    this.isCalibrating = false;
    return this.computeCalibrationResult();
  }

  private computeCalibrationResult(): CalibrationResult {
    const channels: ChannelQuality[] = [];
    const warnings: string[] = [];
    let totalQuality = 0;
    let goodChannels = 0;

    for (const ch of CHANNEL_NAMES) {
      const samples = this.sampleBuffers.get(ch) || [];
      
      if (samples.length < 128) {
        channels.push({
          channel: ch,
          quality: 0,
          status: "poor",
          variance: 0,
          noiseFloor: 0,
          railHits: 0,
          dcOffset: 0,
        });
        warnings.push(`${ch}: No data received`);
        continue;
      }

      const variance = computeVariance(samples);
      const noiseFloor = computeNoiseFloor(samples);
      const { railHits, dcOffset } = analyzeClipping(samples);
      
      // Check for ADC clipping (floating electrodes / no contact)
      const hasClipping = railHits > 3;
      const hasHighOffset = dcOffset < -75;
      
      // Real EEG on head: 15000-30000 | In air: 8000-15000 (ambient noise)
      let quality: number;
      let status: "good" | "fair" | "poor";
      
      if (hasClipping || hasHighOffset) {
        // Definitely poor contact - floating or off head
        quality = 0.1;
        status = "poor";
        warnings.push(`${ch}: Poor contact - rail hits: ${railHits}, DC offset: ${dcOffset.toFixed(1)}`);
      } else if (variance > 18000) {
        quality = 0.8;
        status = "good";
      } else if (variance > 10000) {
        quality = 0.5;
        status = "fair";
      } else {
        quality = 0.2;
        status = "poor";
      }

      if (status === "good") goodChannels++;

      totalQuality += quality;
      channels.push({ channel: ch, quality, status, variance, noiseFloor, railHits, dcOffset });
    }

    const avgQuality = totalQuality / CHANNEL_NAMES.length;
    const passed = goodChannels >= 2 && avgQuality > 0.2;

    return { passed, channels, overallQuality: avgQuality, warnings };
  }

  checkNoiseThreshold(samples: number[]): { passed: boolean; message?: string } {
    const variance = computeVariance(samples);
    const noiseFloor = computeNoiseFloor(samples);

    if (variance > this.thresholds.maxVariance * 2) {
      return { passed: false, message: "Signal too noisy. Movement detected or poor contact." };
    }

    if (noiseFloor > this.thresholds.maxNoiseFloor * 1.5) {
      return { passed: false, message: "High noise floor detected. Check electrode contact." };
    }

    return { passed: true };
  }

  getCurrentQuality(): ChannelQuality[] {
    const channels: ChannelQuality[] = [];
    
    for (const ch of CHANNEL_NAMES) {
      const samples = this.sampleBuffers.get(ch) || [];
      if (samples.length < 64) {
        channels.push({
          channel: ch,
          quality: 0,
          status: "poor",
          variance: 0,
          noiseFloor: 0,
          railHits: 0,
          dcOffset: 0,
        });
        continue;
      }

      const variance = computeVariance(samples);
      const noiseFloor = computeNoiseFloor(samples);
      const { railHits, dcOffset } = analyzeClipping(samples);
      
      // Check for ADC clipping (floating electrodes / no contact)
      const hasClipping = railHits > 3;
      const hasHighOffset = dcOffset < -75;
      
      // Real EEG on head: 15000-30000 | In air: 8000-15000 (ambient noise)
      let quality: number;
      let status: "good" | "fair" | "poor";
      
      if (hasClipping || hasHighOffset) {
        quality = 0.1;
        status = "poor";
      } else if (variance > 18000) {
        quality = 0.8;
        status = "good";
      } else if (variance > 10000) {
        quality = 0.5;
        status = "fair";
      } else {
        quality = 0.2;
        status = "poor";
      }

      channels.push({ channel: ch, quality, status, variance, noiseFloor, railHits, dcOffset });
    }

    return channels;
  }
}

function analyzeClipping(samples: number[]): { railHits: number; dcOffset: number } {
  // Count samples hitting ADC rails (-250 or >240) - indicates floating/poor contact
  const railHits = samples.filter(v => v <= -248 || v >= 240).length;
  // DC offset - mean should be near zero for good contact, negative for floating
  const dcOffset = samples.reduce((a, b) => a + b, 0) / samples.length;
  return { railHits, dcOffset };
}

function computeVariance(samples: number[]): number {
  if (samples.length < 2) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / samples.length;
}

function computeNoiseFloor(samples: number[]): number {
  if (samples.length < 2) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const deviations = samples.map(x => Math.abs(x - median));
  deviations.sort((a, b) => a - b);
  return deviations[Math.floor(deviations.length / 2)] * 1.4826;
}

export function getQualityColor(quality: number): string {
  if (quality > 0.7) return "#22c55e";
  if (quality > 0.4) return "#eab308";
  return "#ef4444";
}

export function getQualityLabel(quality: number): string {
  if (quality > 0.7) return "Good";
  if (quality > 0.4) return "Fair";
  return "Poor";
}