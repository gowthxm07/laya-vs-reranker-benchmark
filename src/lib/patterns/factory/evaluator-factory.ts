import { RelevanceEvaluator } from "../../interfaces/relevance-evaluator";
import {
  EvaluatorStrategyType,
  CrossEncoderEvaluator,
  LayaEvaluator,
  SimilarityThresholdEvaluator,
  EVALUATOR_STRATEGIES,
  EvaluatorStrategyDescriptor,
} from "../strategy/relevance-strategy";

/**
 * [FACTORY PATTERN IMPLEMENTATION]
 * Instantiates and configures the appropriate RelevanceEvaluator strategy
 * dynamically based on runtime configuration without coupling callers to concrete classes.
 */
export class EvaluatorFactory {
  private static instanceCache: Map<EvaluatorStrategyType, RelevanceEvaluator> =
    new Map();

  /**
   * Retrieves or creates a concrete RelevanceEvaluator strategy instance
   */
  public static createEvaluator(
    strategyType: EvaluatorStrategyType
  ): RelevanceEvaluator {
    if (this.instanceCache.has(strategyType)) {
      return this.instanceCache.get(strategyType)!;
    }

    let evaluator: RelevanceEvaluator;

    switch (strategyType) {
      case "cross-encoder":
        evaluator = new CrossEncoderEvaluator();
        break;
      case "laya":
        evaluator = new LayaEvaluator();
        break;
      case "similarity-threshold":
        evaluator = new SimilarityThresholdEvaluator();
        break;
      default:
        throw new Error(`Unsupported evaluator strategy type: ${strategyType}`);
    }

    this.instanceCache.set(strategyType, evaluator);
    return evaluator;
  }

  /**
   * Returns metadata descriptors for all registered evaluator strategies
   */
  public static listAvailableStrategies(): EvaluatorStrategyDescriptor[] {
    return Object.values(EVALUATOR_STRATEGIES);
  }
}
