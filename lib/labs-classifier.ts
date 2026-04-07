// ============================================
// MASTERY CLASSIFIER - Rule-based classification
// Classifies user mastery level based on neurophysiological features
// ============================================

import type { MasteryFeatures } from "./labs-feature-extractor";

export type MasteryLevel = "NOVICE" | "MID-TIER" | "MASTER";

export interface ClassificationResult {
  level: MasteryLevel;
  confidence: number; // 0-100
  explanation: string;
  contributingFactors: {
    metric: string;
    value: number;
    contribution: number; // -1 to 1, negative = novice, positive = master
  }[];
}

interface ClassifierThresholds {
  // EEG thresholds
  gammaAlphaMin: number;
  hrvMin: number;
  movementMax: number;
  alphaMin: number;
  
  // fNIRS thresholds
  cognitiveLoadMax: number;
  prefrontalMin: number;
}

const DEFAULT_THRESHOLDS: ClassifierThresholds = {
  gammaAlphaMin: 0.8,
  hrvMin: 20,
  movementMax: 2.0,
  alphaMin: 0.15,
  cognitiveLoadMax: 0.7,
  prefrontalMin: 0.4,
};

export class MasteryClassifier {
  private thresholds: ClassifierThresholds;
  private history: ClassificationResult[] = [];
  private historySize: number = 10;

  constructor(thresholds: Partial<ClassifierThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  classify(features: MasteryFeatures): ClassificationResult {
    const factors: ClassificationResult["contributingFactors"] = [];
    
    // ===== EEG FACTORS =====
    
    // Gamma/Alpha ratio - high indicates focused, mastery-level processing
    const gammaAlphaScore = this.scoreGammaAlpha(features.gammaAlphaRatio);
    factors.push({
      metric: "Gamma/Alpha Ratio",
      value: features.gammaAlphaRatio,
      contribution: gammaAlphaScore,
    });
    
    // Alpha power - associated with relaxed awareness
    const alphaScore = this.scoreAlpha(features.alphaPower);
    factors.push({
      metric: "Alpha Power",
      value: features.alphaPower,
      contribution: alphaScore,
    });
    
    // Engagement (beta / (theta + alpha)) - active cognitive processing
    const engagementScore = this.scoreEngagement(features.engagement);
    factors.push({
      metric: "Engagement",
      value: features.engagement,
      contribution: engagementScore,
    });
    
    // ===== HRV FACTORS =====
    
    // HRV RMSSD - high indicates good autonomic regulation, associated with mastery
    const hrvScore = this.scoreHRV(features.hrvRMSSD);
    factors.push({
      metric: "HRV (RMSSD)",
      value: features.hrvRMSSD,
      contribution: hrvScore,
    });
    
    // ===== MOVEMENT FACTORS =====
    
    // Movement variance - low indicates stability and focus
    const movementScore = this.scoreMovement(features.movementVariance);
    factors.push({
      metric: "Movement Variance",
      value: features.movementVariance,
      contribution: movementScore,
    });
    
    // Head stability
    const stabilityScore = this.scoreStability(features.headStability);
    factors.push({
      metric: "Head Stability",
      value: features.headStability,
      contribution: stabilityScore,
    });
    
    // ===== fNIRS FACTORS (if available) =====
    
    if (features.cognitiveLoad > 0) {
      const cognitiveScore = this.scoreCognitiveLoad(features.cognitiveLoad);
      factors.push({
        metric: "Cognitive Load (fNIRS)",
        value: features.cognitiveLoad,
        contribution: cognitiveScore,
      });
    }
    
    if (features.prefrontalEfficiency > 0) {
      const prefrontalScore = this.scorePrefrontal(features.prefrontalEfficiency);
      factors.push({
        metric: "Prefrontal Efficiency",
        value: features.prefrontalEfficiency,
        contribution: prefrontalScore,
      });
    }
    
    // ===== COMPUTE FINAL SCORE =====
    
    const totalContribution = factors.reduce((sum, f) => sum + f.contribution, 0);
    const avgScore = totalContribution / factors.length;
    
    // Determine level
    let level: MasteryLevel;
    if (avgScore >= 0.3) {
      level = "MASTER";
    } else if (avgScore >= -0.2) {
      level = "MID-TIER";
    } else {
      level = "NOVICE";
    }
    
    // Confidence: how far from decision boundary
    const confidence = this.computeConfidence(avgScore, level);
    
    // Generate explanation
    const explanation = this.generateExplanation(factors, level);
    
    // Store in history
    const result: ClassificationResult = { level, confidence, explanation, contributingFactors: factors };
    this.history.push(result);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
    
    return result;
  }

  private scoreGammaAlpha(ratio: number): number {
    // >1.5 = strong mastery, <0.8 = novice
    if (ratio >= 1.5) return 1;
    if (ratio <= 0.5) return -1;
    return (ratio - 0.5) / 1.0;
  }

  private scoreAlpha(power: number): number {
    // Higher alpha = more relaxed awareness (mastery)
    if (power >= 0.25) return 1;
    if (power <= 0.1) return -0.5;
    return (power - 0.1) / 0.15;
  }

  private scoreEngagement(engagement: number): number {
    // Balanced engagement is best
    if (engagement >= 0.8 && engagement <= 2.0) return 0.5;
    if (engagement > 3.0) return -0.5; // Too high = stress
    if (engagement < 0.3) return -0.3; // Too low = disengaged
    return 0;
  }

  private scoreHRV(rmssd: number): number {
    // Higher HRV = better autonomic regulation = mastery
    if (rmssd >= 50) return 1;
    if (rmssd <= 15) return -1;
    return (rmssd - 15) / 35;
  }

  private scoreMovement(variance: number): number {
    // Lower movement = better
    if (variance <= 0.5) return 1;
    if (variance >= 3.0) return -1;
    return 1 - (variance - 0.5) / 2.5;
  }

  private scoreStability(stability: number): number {
    // Higher stability = better (0-1)
    return stability * 2 - 1; // Map 0-1 to -1 to 1
  }

  private scoreCognitiveLoad(load: number): number {
    // Lower cognitive load during thinking = mastery (efficient processing)
    if (load <= 0.3) return 1;
    if (load >= 0.8) return -1;
    return 1 - load;
  }

  private scorePrefrontal(efficiency: number): number {
    // Higher prefrontal oxygenation efficiency = mastery
    if (efficiency >= 0.6) return 1;
    if (efficiency <= 0.3) return -1;
    return (efficiency - 0.3) / 0.3;
  }

  private computeConfidence(avgScore: number, level: MasteryLevel): number {
    // Map score to 50-100 range based on distance from boundaries
    const absScore = Math.abs(avgScore);
    let base = 50 + absScore * 50;
    
    // Boost if consistent with history
    if (this.history.length >= 3) {
      const recent = this.history.slice(-3);
      const allSame = recent.every(r => r.level === level);
      if (allSame) base += 10;
    }
    
    return Math.min(100, Math.round(base));
  }

  private generateExplanation(factors: ClassificationResult["contributingFactors"], level: MasteryLevel): string {
    const positive = factors.filter(f => f.contribution > 0.2).sort((a, b) => b.contribution - a.contribution);
    const negative = factors.filter(f => f.contribution < -0.2).sort((a, b) => a.contribution - b.contribution);
    
    if (level === "MASTER") {
      if (positive.length > 0) {
        const top = positive[0];
        return `Strong ${top.metric.toLowerCase()} indicates deep conceptual mastery.`;
      }
      return "Stable physiological markers suggest expert-level understanding.";
    }
    
    if (level === "MID-TIER") {
      if (positive.length > 0 && negative.length > 0) {
        return `Mixed signals: strong ${positive[0].metric.toLowerCase()} but ${negative[0].metric.toLowerCase()} needs work.`;
      }
      if (positive.length > 0) {
        return `Developing expertise - ${positive[0].metric.toLowerCase()} shows growing competence.`;
      }
      return "Learning in progress - keep practicing the concepts.";
    }
    
    // NOVICE
    if (negative.length > 0) {
      return `High ${negative[0].metric.toLowerCase()} suggests the material is still new. Focus on building foundational understanding.`;
    }
    return "Early learning stage - this topic requires more familiarity.";
  }

  getHistory(): ClassificationResult[] {
    return [...this.history];
  }

  getAverageLevel(): MasteryLevel | null {
    if (this.history.length === 0) return null;
    
    const counts = { NOVICE: 0, "MID-TIER": 0, MASTER: 0 };
    for (const r of this.history) counts[r.level]++;
    
    const max = Math.max(counts.NOVICE, counts["MID-TIER"], counts.MASTER);
    if (max === 0) return null;
    
    if (counts.MASTER === max) return "MASTER";
    if (counts["MID-TIER"] === max) return "MID-TIER";
    return "NOVICE";
  }
}

let classifierInstance: MasteryClassifier | null = null;

export function getMasteryClassifier(): MasteryClassifier {
  if (!classifierInstance) {
    classifierInstance = new MasteryClassifier();
  }
  return classifierInstance;
}

export function resetClassifier(): void {
  classifierInstance = null;
}