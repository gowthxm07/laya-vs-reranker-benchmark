import { SecurityAnnotatedChunk, UserRole } from "../types/security-experiment";

export interface AuthorizationDecision {
  chunkId: string;
  isAuthorized: boolean;
  reason: string;
}

/**
 * Role-Based Access Control (RBAC) Engine.
 * Enforces retrieval-time authorization independently of relevance scores.
 * Adheres strictly to FAIL-CLOSED (deny-by-default) policy.
 */
export class AuthorizationEnforcer {
  /**
   * Evaluates whether a chunk is authorized under the enterprise disclosure policy
   * or a specific simulated user role.
   */
  public evaluateChunk(chunk: SecurityAnnotatedChunk, userRole?: UserRole): AuthorizationDecision {
    const meta = chunk.securityMetadata;

    // Fail-Closed Rule 1: Missing security metadata is strictly denied
    if (!meta) {
      return {
        chunkId: chunk.id,
        isAuthorized: false,
        reason: "Access denied (fail-closed): Missing security classification metadata.",
      };
    }

    // Fail-Closed Rule 2: Explicit ambiguous/missing metadata flag
    if (meta.isAmbiguousOrMissing) {
      return {
        chunkId: chunk.id,
        isAuthorized: false,
        reason: "Access denied (fail-closed): Passage metadata is marked ambiguous or incomplete.",
      };
    }

    // Fail-Closed Rule 3: Direct synthetic canary protection
    if (meta.containsSyntheticSecret || chunk.text.includes("CANARY_ACCESS_KEY")) {
      return {
        chunkId: chunk.id,
        isAuthorized: false,
        reason: "Access denied: Passage contains synthetic demonstration canary secret.",
      };
    }

    // Role-Independent Common Policy (when no userRole is specified)
    if (!userRole) {
      // Ordinary company information (PUBLIC or INTERNAL) is permitted
      if (meta.sensitivity === "PUBLIC" || meta.sensitivity === "INTERNAL") {
        return {
          chunkId: chunk.id,
          isAuthorized: true,
          reason: `Authorized: Routine company information is permitted under enterprise security policy (tier: '${meta.sensitivity}').`,
        };
      }

      // Confidential and restricted records are strictly prohibited
      return {
        chunkId: chunk.id,
        isAuthorized: false,
        reason: `Access denied: Confidential and restricted records (${meta.sensitivity || "UNSPECIFIED"}) are prohibited under enterprise security policy.`,
      };
    }

    // Role-Based Authorization Check (when userRole is explicitly provided)
    if (!meta.authorizedRoles || !Array.isArray(meta.authorizedRoles) || meta.authorizedRoles.length === 0) {
      return {
        chunkId: chunk.id,
        isAuthorized: false,
        reason: "Access denied (fail-closed): No authorized roles defined for this passage.",
      };
    }

    if (meta.authorizedRoles.includes(userRole)) {
      return {
        chunkId: chunk.id,
        isAuthorized: true,
        reason: `Authorized: User role '${userRole}' is permitted for sensitivity tier '${meta.sensitivity || "UNSPECIFIED"}'.`,
      };
    }

    return {
      chunkId: chunk.id,
      isAuthorized: false,
      reason: `Access denied: User role '${userRole}' is not permitted for sensitivity tier '${meta.sensitivity || "UNSPECIFIED"}'. Requires: [${meta.authorizedRoles.join(", ")}].`,
    };
  }

  /**
   * Filters an array of candidate chunks, partitioning into authorized and unauthorized sets.
   */
  public filterAuthorizedCandidates(
    chunks: SecurityAnnotatedChunk[],
    userRole?: UserRole
  ): {
    authorized: SecurityAnnotatedChunk[];
    unauthorized: SecurityAnnotatedChunk[];
    decisions: AuthorizationDecision[];
  } {
    const authorized: SecurityAnnotatedChunk[] = [];
    const unauthorized: SecurityAnnotatedChunk[] = [];
    const decisions: AuthorizationDecision[] = [];

    for (const chunk of chunks) {
      const decision = this.evaluateChunk(chunk, userRole);
      decisions.push(decision);

      if (decision.isAuthorized) {
        authorized.push(chunk);
      } else {
        unauthorized.push(chunk);
      }
    }

    return { authorized, unauthorized, decisions };
  }
}
