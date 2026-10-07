import { PromptPayload } from "./llm-provider";

/**
 * [BUILDER PATTERN CONTRACT]
 * Fluent builder for synthesizing system instructions, retrieved context,
 * and user queries into standardized PromptPayloads.
 */
export interface IPromptBuilder {
  /** Sets system persona and grounding instructions */
  setSystemInstruction(instruction: string): this;

  /** Sets the formatted retrieved context passages */
  setContext(context: string): this;

  /** Sets the user natural language query */
  setUserQuery(query: string): this;

  /** Adds few-shot examples or constraints */
  addConstraint(constraint: string): this;

  /** Resets builder state */
  reset(): this;

  /** Validates and synthesizes PromptPayload */
  build(): PromptPayload;
}
