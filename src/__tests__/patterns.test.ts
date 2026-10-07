import { describe, it, expect } from "vitest";
import { EvaluatorFactory } from "../lib/patterns/factory/evaluator-factory";
import { LLMProviderFactory } from "../lib/patterns/factory/llm-provider-factory";
import { ContextBuilder } from "../lib/patterns/builder/context-builder";
import { PromptBuilder } from "../lib/patterns/builder/prompt-builder";
import {
  ObservablePipelineSubject,
  TraceRecorderObserver,
} from "../lib/patterns/observer/pipeline-observer";
import { LayaAdapter } from "../lib/patterns/adapter/laya-adapter";
import { Chunk } from "../lib/types/chunk";

describe("Software Design Patterns — Phase 1 Architecture Verification", () => {
  describe("Strategy & Factory Patterns", () => {
    it("creates CrossEncoderEvaluator through EvaluatorFactory", () => {
      const evaluator = EvaluatorFactory.createEvaluator("cross-encoder");
      expect(evaluator).toBeDefined();
      expect(evaluator.id).toBe("cross-encoder");
      expect(evaluator.name).toBe("Cross-Encoder Reranker");
    });

    it("creates LayaEvaluator through EvaluatorFactory", () => {
      const evaluator = EvaluatorFactory.createEvaluator("laya");
      expect(evaluator).toBeDefined();
      expect(evaluator.id).toBe("laya");
      expect(evaluator.name).toBe("Laya Relevance Filter");
    });

    it("lists all registered evaluator strategies", () => {
      const strategies = EvaluatorFactory.listAvailableStrategies();
      expect(strategies.length).toBeGreaterThanOrEqual(2);
      const types = strategies.map((s) => s.type);
      expect(types).toContain("cross-encoder");
      expect(types).toContain("laya");
    });

    it("instantiates default Ollama LLMProvider with llama3.2:3b", () => {
      const provider = LLMProviderFactory.getDefaultProvider();
      expect(provider.id).toBe("ollama");
      expect(provider.model).toBe("llama3.2:3b");
    });

    it("instantiates OpenRouter provider fallback", () => {
      const provider = LLMProviderFactory.createProvider("openrouter");
      expect(provider.id).toBe("openrouter");
    });
  });

  describe("Builder Pattern", () => {
    it("builds formatted context with token budget limit", () => {
      const chunks: Chunk[] = [
        {
          id: "c1",
          documentId: "doc-1",
          text: "Passage one about transformer attention mechanisms.",
          source: "attention-paper.pdf",
          relevanceScore: 0.92,
        },
        {
          id: "c2",
          documentId: "doc-1",
          text: "Passage two about feed-forward layers.",
          source: "attention-paper.pdf",
          relevanceScore: 0.85,
        },
      ];

      const builder = new ContextBuilder();
      builder.addChunks(chunks).sortByRelevance();
      const output = builder.build();

      expect(output).toContain("[Passage 1] | Source: attention-paper.pdf | Score: 0.920");
      expect(output).toContain("Passage one about transformer attention mechanisms.");
      expect(output).toContain("[Passage 2]");
    });

    it("builds prompt payload with system instruction, context, and query", () => {
      const promptBuilder = new PromptBuilder();
      promptBuilder
        .setSystemInstruction("Be factual and concise.")
        .setContext("Retrieved facts here.")
        .setUserQuery("What is RAG?")
        .addConstraint("Cite passage numbers.");

      const payload = promptBuilder.build();
      expect(payload.userQuery).toBe("What is RAG?");
      expect(payload.contextText).toBe("Retrieved facts here.");
      expect(payload.systemInstruction).toContain("Be factual and concise.");
      expect(payload.systemInstruction).toContain("- Cite passage numbers.");
    });

    it("throws error if userQuery is missing in PromptBuilder", () => {
      const promptBuilder = new PromptBuilder();
      expect(() => promptBuilder.build()).toThrow();
    });
  });

  describe("Adapter Pattern", () => {
    it("adapts candidate chunks into external Laya payload structure", () => {
      const adapter = new LayaAdapter();
      const chunks: Chunk[] = [
        {
          id: "chunk-101",
          documentId: "doc-42",
          text: "Sample text for Laya evaluation",
          source: "specs.md",
        },
      ];

      const payload = adapter.adaptToLayaPayload("Test query", chunks, {
        topK: 5,
        threshold: 0.7,
      });

      expect(payload.query).toBe("Test query");
      expect(payload.items.length).toBe(1);
      expect(payload.items[0].id).toBe("chunk-101");
      expect(payload.parameters?.max_results).toBe(5);
    });

    it("adapts raw Laya response into retained and discarded chunks", () => {
      const adapter = new LayaAdapter();
      const candidateChunks: Chunk[] = [
        { id: "c1", documentId: "d1", text: "Chunk 1" },
        { id: "c2", documentId: "d1", text: "Chunk 2" },
      ];

      const rawLayaResponse = {
        results: [
          { id: "c1", score: 0.95, accepted: true, reason: "Highly relevant" },
          { id: "c2", score: 0.32, accepted: false, reason: "Off-topic" },
        ],
        processing_time_ms: 18,
      };

      const result = adapter.adaptFromLayaResponse(
        candidateChunks,
        rawLayaResponse
      );

      expect(result.retainedChunks.length).toBe(1);
      expect(result.retainedChunks[0].id).toBe("c1");
      expect(result.retainedChunks[0].decision).toBe("retained");
      expect(result.retainedChunks[0].relevanceScore).toBe(0.95);

      expect(result.discardedChunks.length).toBe(1);
      expect(result.discardedChunks[0].id).toBe("c2");
      expect(result.discardedChunks[0].decision).toBe("discarded");
      expect(result.discardedChunks[0].relevanceScore).toBe(0.32);
    });
  });

  describe("Observer Pattern", () => {
    it("notifies registered observers of pipeline events", () => {
      const subject = new ObservablePipelineSubject();
      const recorder = new TraceRecorderObserver();

      subject.addObserver(recorder);
      expect(subject.getObserverCount()).toBe(1);

      subject.notifyObservers({
        type: "phase:started",
        event: {
          id: "evt-1",
          timestamp: Date.now(),
          pipelineId: "advanced-rag",
          phase: "retrieval_started",
          label: "Retrieval started",
          status: "running",
        },
      });

      const events = recorder.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].id).toBe("evt-1");
      expect(events[0].phase).toBe("retrieval_started");
    });
  });
});
