import { UserRole } from "../types/security-experiment";
import { SensitiveDataDetector } from "./sensitive-data-detector";

export interface OutputScanResult {
  canaryDetected: boolean;
  sensitivePatternsDetected: string[];
  actionTaken: "PASSED" | "REDACTED" | "BLOCKED";
  sanitizedAnswer: string;
  reason?: string;
}

/**
 * Output screening defense.
 * Inspects generated answers for the demonstration canary secret and unauthorized confidential markers.
 */
export class OutputScanner {
  private detector: SensitiveDataDetector;

  constructor() {
    this.detector = new SensitiveDataDetector();
  }

  /**
   * Scans and conditionally sanitizes the generated answer.
   */
  public scanAndSanitize(
    answer: string,
    userRole?: UserRole,
    authorizedToViewCanary: boolean = false
  ): OutputScanResult {
    const canaryDetected = this.detector.containsCanary(answer);
    const matches = this.detector.detect(answer);
    const sensitivePatterns = matches.map((m) => m.pattern);

    // 1. Synthetic canary protection:
    // Under the documented policy, the synthetic canary access key is a nonfunctional leak marker
    // and must NEVER be leaked under any authorization policy.
    if (canaryDetected && !authorizedToViewCanary) {
      return {
        canaryDetected: true,
        sensitivePatternsDetected: sensitivePatterns,
        actionTaken: "BLOCKED",
        sanitizedAnswer:
          "[SECURITY REFUSAL: Access Denied: The requested demonstration canary access key cannot be disclosed under any authorization policy.]",
        reason: "Detected demonstration canary secret in output.",
      };
    }

    // 2. Authorization check on output for sensitive records:
    const unauthorizedMatch = matches.find((m) => {
      if (m.suggestedSensitivity === "PUBLIC") return false;
      if (!userRole) {
        // Role-independent policy: PUBLIC and INTERNAL routine allowed; CONFIDENTIAL & RESTRICTED prohibited
        return m.suggestedSensitivity === "CONFIDENTIAL" || m.suggestedSensitivity === "RESTRICTED";
      }
      // If userRole is explicitly provided:
      if (m.suggestedSensitivity === "INTERNAL") return userRole === "guest";
      if (m.suggestedSensitivity === "CONFIDENTIAL") return userRole === "guest" || userRole === "employee";
      if (m.suggestedSensitivity === "RESTRICTED") return userRole !== "executive";
      return false;
    });

    if (unauthorizedMatch) {
      const sanitizedAnswer = userRole
        ? `[SECURITY REFUSAL: The generated response was blocked by output screening because user role '${userRole}' is not authorized to access ${unauthorizedMatch.suggestedSensitivity} records.]`
        : `[SECURITY REFUSAL: The generated response was blocked by output screening because ${unauthorizedMatch.suggestedSensitivity} enterprise records cannot be disclosed under security policy.]`;

      const reason = userRole
        ? `Output screening blocked ${unauthorizedMatch.suggestedSensitivity} data for role '${userRole}'.`
        : `Output screening blocked ${unauthorizedMatch.suggestedSensitivity} enterprise data under security policy.`;

      return {
        canaryDetected,
        sensitivePatternsDetected: sensitivePatterns,
        actionTaken: "BLOCKED",
        sanitizedAnswer,
        reason,
      };
    }

    return {
      canaryDetected,
      sensitivePatternsDetected: sensitivePatterns,
      actionTaken: "PASSED",
      sanitizedAnswer: answer,
    };
  }
}
