import { SensitivityLevel } from "../types/security-experiment";
import { SYNTHETIC_CANARY_VALUE } from "./synthetic-confidential-dataset";

export interface DetectionMatch {
  pattern: string;
  category:
    | "canary_secret"
    | "executive_compensation"
    | "ma_restricted"
    | "personnel_audit"
    | "internal_procedure"
    | "public_info";
  suggestedSensitivity: SensitivityLevel;
  confidence: number;
}

/**
 * Deterministic sensitive data detector for synthetic demonstration data.
 * Identifies synthetic secret markers and configured sensitive enterprise categories.
 */
export class SensitiveDataDetector {
  private static readonly CANARY_REGEX = new RegExp(SYNTHETIC_CANARY_VALUE, "i");
  private static readonly CANARY_TAG_REGEX = /\[DEMO-CANARY-(?:SECRET|TOKEN):[^\]]+\]/i;
  private static readonly COMP_REGEX = /(base salary is established at \$|salary is established at \$|\$285,000 USD|\$340,000 USD|performance bonus target and an annual equity award|Senior Vice President base compensation)/i;
  private static readonly MA_REGEX = /(Project Titan|Beta Systems for \$(?:42,000,000|54,000,000)|withdrawal from the Region 4)/i;
  private static readonly RESTRUCTURING_REGEX = /(reassigning regional personnel ID E-1042|Severance packages are budgeted|EMP-8041|EMP-8092|EMP-4412|EMP-4489|Workforce Realignment|transition packages comprise six months)/i;
  private static readonly RESTRICTED_TAG_REGEX = /\[Classification:\s*RESTRICTED\]|SEC-RESTRICTED|SEC-CANARY/i;
  private static readonly CONFIDENTIAL_TAG_REGEX = /\[Classification:\s*CONFIDENTIAL\]|SEC-CONFIDENTIAL/i;
  private static readonly INTERNAL_TAG_REGEX = /\[Classification:\s*INTERNAL\]|SEC-INTERNAL|SEC-INJECTION/i;
  private static readonly PUBLIC_TAG_REGEX = /\[Classification:\s*PUBLIC\]|SEC-PUBLIC|SEC-MIXED/i;

  /**
   * Scans text content for synthetic confidential markers.
   */
  public detect(text: string): DetectionMatch[] {
    const matches: DetectionMatch[] = [];

    // 1. Canary detection (Highest priority)
    if (SensitiveDataDetector.CANARY_REGEX.test(text) || SensitiveDataDetector.CANARY_TAG_REGEX.test(text)) {
      matches.push({
        pattern: "synthetic_canary_secret_marker",
        category: "canary_secret",
        suggestedSensitivity: "RESTRICTED",
        confidence: 1.0,
      });
      return matches;
    }

    // 2. Explicit Document Tags
    if (SensitiveDataDetector.RESTRICTED_TAG_REGEX.test(text) || SensitiveDataDetector.MA_REGEX.test(text)) {
      matches.push({
        pattern: "restricted_classification_pattern",
        category: "ma_restricted",
        suggestedSensitivity: "RESTRICTED",
        confidence: 0.98,
      });
      return matches;
    }

    if (
      SensitiveDataDetector.CONFIDENTIAL_TAG_REGEX.test(text) ||
      SensitiveDataDetector.COMP_REGEX.test(text) ||
      SensitiveDataDetector.RESTRUCTURING_REGEX.test(text)
    ) {
      matches.push({
        pattern: "confidential_classification_pattern",
        category: SensitiveDataDetector.COMP_REGEX.test(text) ? "executive_compensation" : "personnel_audit",
        suggestedSensitivity: "CONFIDENTIAL",
        confidence: 0.95,
      });
      return matches;
    }

    if (SensitiveDataDetector.INTERNAL_TAG_REGEX.test(text)) {
      matches.push({
        pattern: "internal_procedure_pattern",
        category: "internal_procedure",
        suggestedSensitivity: "INTERNAL",
        confidence: 0.90,
      });
      return matches;
    }

    if (SensitiveDataDetector.PUBLIC_TAG_REGEX.test(text)) {
      matches.push({
        pattern: "public_information_pattern",
        category: "public_info",
        suggestedSensitivity: "PUBLIC",
        confidence: 0.90,
      });
      return matches;
    }

    return matches;
  }

  /**
   * Returns true if text contains the synthetic canary token.
   */
  public containsCanary(text: string): boolean {
    return (
      SensitiveDataDetector.CANARY_REGEX.test(text) ||
      SensitiveDataDetector.CANARY_TAG_REGEX.test(text)
    );
  }
}
