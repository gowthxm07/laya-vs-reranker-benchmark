import { NextRequest, NextResponse } from "next/server";
import { getGlobalVectorStore } from "@/lib/vector-store/local-vector-store";

export async function GET() {
  try {
    const vectorStore = getGlobalVectorStore();
    const docIds = await vectorStore.listDocuments();
    const totalEntries = await vectorStore.count();
    const documents = await vectorStore.getIndexedDocumentsSummary();

    return NextResponse.json({
      success: true,
      documentIds: docIds,
      totalChunksIndexed: totalEntries,
      documents,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list documents." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");
    const vectorStore = getGlobalVectorStore();

    if (documentId) {
      const deletedCount = await vectorStore.deleteDocument(documentId);
      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Deleted document ${documentId}`,
      });
    }

    // Clear entire store
    await vectorStore.clear();
    return NextResponse.json({
      success: true,
      message: "Vector store cleared.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clear documents." },
      { status: 500 }
    );
  }
}
