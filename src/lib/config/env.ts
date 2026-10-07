/**
 * Safe application configuration boundaries.
 * Sensitive API keys are strictly kept server-side and never exposed to the client bundle.
 */
export const APP_CONFIG = {
  name: "PatternRAG Lab",
  tagline: "Laya vs Advanced RAG Benchmark",
  version: "0.1.0-phase1",
  targetLLM: {
    primaryProvider: "ollama",
    defaultModel: process.env.OLLAMA_MODEL || "llama3.2:3b",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    secondaryProvider: "openrouter",
    secondaryModel: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.2-3b-instruct",
  },
  evaluatorModels: {
    reranker: process.env.RERANKER_MODEL || "cross-encoder/ms-marco-MiniLM-L-6-v2",
    layaEndpoint: process.env.LAYA_API_ENDPOINT || "http://localhost:8080/v1",
  },
} as const;
