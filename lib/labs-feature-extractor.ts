// ============================================
// FEATURE EXTRACTOR - Rolling window feature extraction
// Extracts meaningful features every 2-5 seconds from all sensor streams
// ============================================

import type { BandPowers, PPGMetrics, IMUMetrics, FNIRSMetrics } from "./labs-muse-manager";

export interface MasteryFeatures {
  timestamp: number;
  
  // EEG features
  gammaAlphaRatio: number;
  alphaPower: number;
  betaPower: number;
  thetaPower: number;
  engagement: number;
  asymmetry: number;
  
  // HRV features
  hrvRMSSD: number;
  heartRate: number;
  
  // Movement features
  movementVariance: number;
  headStability: number;
  
  // fNIRS features (if available)
  cognitiveLoad: number;
  prefrontalEfficiency: number;
  hbo: number;
  hbr: number;
}

export class FeatureExtractor {
  private windowSize: number; // number of samples to aggregate
  private updateInterval: number; // ms between updates
  
  private bandPowerHistory: BandPowers[] = [];
  private ppgHistory: PPGMetrics[] = [];
  private imuHistory: IMUMetrics[] = [];
  private fnirsHistory: FNIRSMetrics[] = [];
  
  private onFeaturesCallback: ((features: MasteryFeatures) => void) | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(windowSize: number = 3, updateInterval: number = 2000) {
    this.windowSize = windowSize;
    this.updateInterval = updateInterval;
  }

  start(onFeatures: (features: MasteryFeatures) => void): void {
    this.onFeaturesCallback = onFeatures;
    this.intervalId = setInterval(() => this.computeFeatures(), this.updateInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onFeaturesCallback = null;
  }

  addBandPowers(powers: BandPowers): void {
    this.bandPowerHistory.push(powers);
    this.pruneHistory(this.bandPowerHistory);
  }

  addPPGMetrics(metrics: PPGMetrics): void {
    this.ppgHistory.push(metrics);
    this.pruneHistory(this.ppgHistory);
  }

  addIMUMetrics(metrics: IMUMetrics): void {
    this.imuHistory.push(metrics);
    this.pruneHistory(this.imuHistory);
  }

  addFNIRSMetrics(metrics: FNIRSMetrics): void {
    this.fnirsHistory.push(metrics);
    this.pruneHistory(this.fnirsHistory);
  }

  private pruneHistory<T extends { timestamp: number }>(history: T[]): void {
    const cutoff = Date.now() - (this.windowSize * 1000);
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }
    
    // Keep max 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private computeFeatures(): void {
    if (!this.onFeaturesCallback) return;
    
    const now = Date.now();
    const features: MasteryFeatures = {
      timestamp: now,
      
      // Defaults
      gammaAlphaRatio: 0,
      alphaPower: 0,
      betaPower: 0,
      thetaPower: 0,
      engagement: 0,
      asymmetry: 0,
      
      hrvRMSSD: 0,
      heartRate: 0,
      
      movementVariance: 0,
      headStability: 1,
      
      cognitiveLoad: 0,
      prefrontalEfficiency: 0,
      hbo: 0,
      hbr: 0,
    };
    
    // EEG features from band powers
    if (this.bandPowerHistory.length > 0) {
      const recent = this.bandPowerHistory.slice(-5); // Last 5 readings
      
      const avgAlpha = recent.reduce((s, p) => s + p.alpha, 0) / recent.length;
      const avgGamma = recent.reduce((s, p) => s + p.gamma, 0) / recent.length;
      const avgBeta = recent.reduce((s, p) => s + p.beta, 0) / recent.length;
      const avgTheta = recent.reduce((s, p) => s + p.theta, 0) / recent.length;
      const avgEngagement = recent.reduce((s, p) => s + p.engagement, 0) / recent.length;
      const avgAsymmetry = recent.reduce((s, p) => s + p.asymmetry, 0) / recent.length;
      
      features.alphaPower = avgAlpha;
      features.betaPower = avgBeta;
      features.thetaPower = avgTheta;
      features.engagement = avgEngagement;
      features.asymmetry = avgAsymmetry;
      features.gammaAlphaRatio = avgAlpha > 0 ? avgGamma / avgAlpha : 0;
    }
    
    // HRV features
    if (this.ppgHistory.length > 0) {
      const recent = this.ppgHistory.slice(-5);
      const validHRV = recent.filter(p => p.hrvRMSSD > 0);
      
      if (validHRV.length > 0) {
        features.hrvRMSSD = validHRV.reduce((s, p) => s + p.hrvRMSSD, 0) / validHRV.length;
        features.heartRate = recent.reduce((s, p) => s + p.heartRate, 0) / recent.length;
      }
    }
    
    // Movement features
    if (this.imuHistory.length > 0) {
      const recent = this.imuHistory.slice(-10);
      features.movementVariance = recent.reduce((s, p) => s + p.movementVariance, 0) / recent.length;
      features.headStability = recent.reduce((s, p) => s + p.headStability, 0) / recent.length;
    }
    
    // fNIRS features
    if (this.fnirsHistory.length > 0) {
      const recent = this.fnirsHistory.slice(-5);
      features.hbo = recent.reduce((s, p) => s + p.hbo, 0) / recent.length;
      features.hbr = recent.reduce((s, p) => s + p.hbr, 0) / recent.length;
      
      // Cognitive load: higher HbO2 = more mental effort
      // Normalize to 0-1 range
      features.cognitiveLoad = Math.min(1, Math.max(0, (features.hbo + 50) / 100));
      
      // Prefrontal efficiency: balance of oxygenation
      const totalHb = features.hbo + features.hbr;
      features.prefrontalEfficiency = totalHb > 0 ? features.hbo / (totalHb + 0.001) : 0.5;
    }
    
    this.onFeaturesCallback(features);
  }

  getLatestFeatures(): MasteryFeatures | null {
    if (this.bandPowerHistory.length === 0) return null;
    
    const now = Date.now();
    return {
      timestamp: now,
      gammaAlphaRatio: 0,
      alphaPower: 0,
      betaPower: 0,
      thetaPower: 0,
      engagement: 0,
      asymmetry: 0,
      hrvRMSSD: 0,
      heartRate: 0,
      movementVariance: 0,
      headStability: 1,
      cognitiveLoad: 0,
      prefrontalEfficiency: 0,
      hbo: 0,
      hbr: 0,
    };
  }
}