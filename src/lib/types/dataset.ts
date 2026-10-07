/**
 * Document / Dataset collection descriptor
 */
export interface DocumentDataset {
  id: string;
  name: string;
  description: string;
  category: "academic" | "technical" | "financial" | "general" | "custom";
  documentCount: number;
  totalChunks: number;
  avgChunkTokens?: number;
  tags: string[];
}
