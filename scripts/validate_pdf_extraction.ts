import fs from "fs";
import path from "path";
import { PdfDocumentParser } from "../src/lib/parsers/pdf-parser";
import { DeterministicChunker } from "../src/lib/chunking/chunker";

async function main() {
  const filePath = path.join(process.cwd(), "demo_document.pdf");
  if (!fs.existsSync(filePath)) {
    console.error("File does not exist:", filePath);
    process.exit(1);
  }

  const stats = fs.statSync(filePath);
  console.log(`[PDF Check] File exists: ${filePath} (${stats.size} bytes)`);

  const buffer = fs.readFileSync(filePath);
  const parser = new PdfDocumentParser();
  const parsed = await parser.parse(buffer, "demo_document.pdf");

  console.log(`[PDF Check] Extracted Page Count: ${parsed.pageCount}`);
  console.log(`[PDF Check] Extracted Pages Array Length: ${parsed.pages.length}`);
  console.log(`[PDF Check] Total Extracted Characters: ${parsed.text.length}`);

  for (const page of parsed.pages) {
    console.log(`\n--- PAGE ${page.pageNumber} (${page.text.length} chars) ---`);
    console.log(page.text.split("\n").slice(0, 3).join("\n"));
  }

  // Verify chunking
  const chunker = new DeterministicChunker({ chunkSize: 500, chunkOverlap: 100 });
  const chunks = chunker.chunkDocument(parsed);
  console.log(`\n[Chunking Check] Generated ${chunks.length} chunks from demo_document.pdf`);
  for (let i = 0; i < Math.min(5, chunks.length); i++) {
    console.log(`Chunk ${i + 1} (${chunks[i].id}, Page ${chunks[i].pageNumber}, ${chunks[i].text.length} chars): ${chunks[i].text.slice(0, 80)}...`);
  }
}

main().catch((err) => {
  console.error("Error validating PDF:", err);
  process.exit(1);
});
