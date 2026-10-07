/**
 * Prompt format submitted to the generation provider
 */
export interface PromptPayload {
  systemInstruction?: string;
  contextText: string;
  userQuery: string;
}

/**
 * Model inference configuration parameters
 */
export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  seed?: number;
}

/**
 * Structured generation output from an LLM provider
 */
export interface GenerationResult {
  providerId: string;
  model: string;
  answerText: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  finishReason?: string;
}

/**
 * [INTERCHANGEABLE LLM PROVIDER CONTRACT]
 * Abstraction decoupling downstream generation from any single model host.
 * Primary local candidate: Ollama (llama3.2:3b)
 * Secondary remote fallback: OpenRouter
 */
export interface LLMProvider {
  /** Provider identifier (e.g. 'ollama' | 'openrouter') */
  readonly id: string;

  /** Human-readable provider label */
  readonly name: string;

  /** Active model identifier (e.g. 'llama3.2:3b') */
  readonly model: string;

  /**
   * Generates answer text from prompt payload
   */
  generateAnswer(
    prompt: PromptPayload,
    options?: GenerationOptions
  ): Promise<GenerationResult>;

  /**
   * Estimates token consumption for given text
   */
  estimateTokenCount(text: string): Promise<number>;

  /**
   * Verifies health / accessibility of the provider
   */
  checkHealth(): Promise<{ isAvailable: boolean; message?: string }>;
}
