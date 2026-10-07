import { DocumentDataset } from "../types/dataset";

export const SAMPLE_DATASETS: DocumentDataset[] = [
  {
    id: "arxiv-cs-ai-2024",
    name: "ArXiv AI/ML Papers (2024 Benchmark)",
    description:
      "Curated corpus of recent computer science preprints covering retrieval-augmented generation, transformer architectures, and attention mechanisms.",
    category: "academic",
    documentCount: 48,
    totalChunks: 1420,
    avgChunkTokens: 380,
    tags: ["Academic", "Transformers", "RAG", "Benchmarking"],
  },
  {
    id: "sec-edgar-financial-10k",
    name: "SEC EDGAR Financial 10-K Filings",
    description:
      "Annual 10-K regulatory filings with dense tabular disclosures, financial risk factors, and forward-looking statements.",
    category: "financial",
    documentCount: 24,
    totalChunks: 2150,
    avgChunkTokens: 420,
    tags: ["Finance", "Regulatory", "Tabular", "Risk"],
  },
  {
    id: "software-architecture-specs",
    name: "Distributed Systems Architecture Specs",
    description:
      "Technical RFCs, design docs, consensus protocol specifications (Raft, Paxos), and system architecture whitepapers.",
    category: "technical",
    documentCount: 32,
    totalChunks: 980,
    avgChunkTokens: 340,
    tags: ["Systems", "Architecture", "Distributed", "RFCs"],
  },
];
