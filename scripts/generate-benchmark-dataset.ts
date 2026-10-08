import * as fs from "fs";
import * as path from "path";
import { BenchmarkCase, BenchmarkCategory } from "../src/lib/types/benchmark";
import { Chunk } from "../src/lib/types/chunk";

function makeChunk(
  id: string,
  docId: string,
  source: string,
  page: number,
  section: string,
  text: string,
  rank: number,
  score: number
): Chunk {
  return {
    id,
    documentId: docId,
    source,
    pageNumber: page,
    section,
    text,
    retrievalScore: score,
    rank,
    decision: "pending",
  };
}

const cases: BenchmarkCase[] = [
  // =========================================================================
  // CATEGORY 1: NORMAL (4 cases)
  // =========================================================================
  {
    id: "bench-norm-01",
    category: "NORMAL",
    query: "What is the primary role of positional encoding in Transformer models?",
    description: "Standard retrieval with a clearly relevant chunk explaining positional encodings among general Transformer architectural text.",
    relevantChunkIds: ["norm-01-c1"],
    referenceAnswer: "Positional encodings provide sequence order and token position information to the model since Transformers lack recurrence and convolution.",
    answerable: true,
    requiredFacts: ["positional encoding", "recurrence", "order"],
    candidateChunks: [
      makeChunk(
        "norm-01-c1",
        "doc-transformer",
        "attention-is-all-you-need.pdf",
        3,
        "Positional Encoding",
        "Because the Transformer model contains no recurrence and no convolution, positional encodings are injected at the bottoms of the encoder and decoder stacks to provide token order information.",
        1,
        0.88
      ),
      makeChunk(
        "norm-01-c2",
        "doc-transformer",
        "attention-is-all-you-need.pdf",
        2,
        "Model Architecture",
        "The encoder is composed of a stack of N = 6 identical layers. Each layer has two sub-layers: a multi-head self-attention mechanism and a simple position-wise fully connected feed-forward network.",
        2,
        0.79
      ),
      makeChunk(
        "norm-01-c3",
        "doc-transformer",
        "attention-is-all-you-need.pdf",
        4,
        "Embeddings",
        "Similarly to other sequence transduction models, we use learned embeddings to convert the input tokens and output tokens to vectors of dimension d_model = 512.",
        3,
        0.73
      ),
      makeChunk(
        "norm-01-c4",
        "doc-transformer",
        "attention-is-all-you-need.pdf",
        5,
        "Training",
        "The models were trained on one machine with 8 NVIDIA P100 GPUs using the Adam optimizer with beta_1 = 0.9, beta_2 = 0.98 and epsilon = 10^-9.",
        4,
        0.65
      ),
    ],
  },
  {
    id: "bench-norm-02",
    category: "NORMAL",
    query: "How does Raft handle leader election when a follower node times out?",
    description: "Standard consensus protocol query with clearly relevant chunk among background consensus passages.",
    relevantChunkIds: ["norm-02-c1"],
    referenceAnswer: "When an election timeout elapses without receiving heartbeats, a follower increments its current term, transitions to candidate state, votes for itself, and broadcasts RequestVote RPCs.",
    answerable: true,
    requiredFacts: ["candidate", "requestvote", "term"],
    candidateChunks: [
      makeChunk(
        "norm-02-c1",
        "doc-raft",
        "in-search-of-raft-consensus.pdf",
        4,
        "Leader Election",
        "When an election timeout elapses without receiving heartbeats, a follower increments its current term, transitions to candidate state, votes for itself, and issues RequestVote RPCs in parallel to all other nodes.",
        1,
        0.89
      ),
      makeChunk(
        "norm-02-c2",
        "doc-raft",
        "in-search-of-raft-consensus.pdf",
        5,
        "Log Replication",
        "Once a leader has been elected, it begins servicing client requests. Each client request contains a command to be executed by the replicated state machines.",
        2,
        0.77
      ),
      makeChunk(
        "norm-02-c3",
        "doc-raft",
        "in-search-of-raft-consensus.pdf",
        2,
        "Raft Basics",
        "A Raft cluster consists of several servers; typical numbers are 5 to tolerate 2 failures. At any given time each server is in one of three states: leader, follower, or candidate.",
        3,
        0.74
      ),
      makeChunk(
        "norm-02-c4",
        "doc-raft",
        "in-search-of-raft-consensus.pdf",
        6,
        "Safety Invariant",
        "Raft guarantees that if a leader has committed a particular log entry for a given term, that entry will be present in the logs of all leaders for higher terms.",
        4,
        0.68
      ),
    ],
  },
  {
    id: "bench-norm-03",
    category: "NORMAL",
    query: "What mechanism does Redis use to achieve persistence without blocking the main execution thread?",
    description: "Standard database query with one direct answer chunk describing background snapshotting.",
    relevantChunkIds: ["norm-03-c1"],
    referenceAnswer: "Redis uses background saving (BGSAVE) which forks a child process using copy-on-write to write the RDB snapshot to disk without blocking the main execution thread.",
    answerable: true,
    requiredFacts: ["bgsave", "copy-on-write", "fork"],
    candidateChunks: [
      makeChunk(
        "norm-03-c1",
        "doc-redis",
        "redis-system-architecture.md",
        1,
        "RDB Persistence",
        "Redis achieves asynchronous persistence using the BGSAVE command, which forks a dedicated child process. Leveraging OS copy-on-write memory pages, the child process writes the RDB dataset snapshot to disk while the parent thread continues executing client commands.",
        1,
        0.91
      ),
      makeChunk(
        "norm-03-c2",
        "doc-redis",
        "redis-system-architecture.md",
        2,
        "AOF Logging",
        "The Append Only File (AOF) logs every write command received by the server. Redis can rewrite the AOF log in the background to rebuild an identical minimal state without blocking queries.",
        2,
        0.81
      ),
      makeChunk(
        "norm-03-c3",
        "doc-redis",
        "redis-system-architecture.md",
        3,
        "Event Loop",
        "Redis runs an event-driven multiplexed event loop based on epoll/kqueue. The single-threaded execution model processes incoming requests sequentially without locking overhead.",
        3,
        0.75
      ),
      makeChunk(
        "norm-03-c4",
        "doc-redis",
        "redis-system-architecture.md",
        4,
        "Replication",
        "Leader-follower replication in Redis allows replicas to be exact copies of master instances. Replication is asynchronous with low latency.",
        4,
        0.66
      ),
    ],
  },
  {
    id: "bench-norm-04",
    category: "NORMAL",
    query: "What is the function of the ribosome in protein synthesis?",
    description: "Biology benchmark question with a clear relevant chunk explaining translation.",
    relevantChunkIds: ["norm-04-c1"],
    referenceAnswer: "Ribosomes translate messenger RNA (mRNA) genetic sequences into polypeptide chains by recruiting corresponding tRNA amino acids during translation.",
    answerable: true,
    requiredFacts: ["translate", "mrna", "amino acid"],
    candidateChunks: [
      makeChunk(
        "norm-04-c1",
        "doc-bio",
        "cellular-molecular-biology.pdf",
        7,
        "Translation",
        "The ribosome is the primary molecular machine responsible for protein synthesis. It translates genetic codes transcribed in mRNA into specific peptide chains by recruiting corresponding tRNA amino acids during translation.",
        1,
        0.92
      ),
      makeChunk(
        "norm-04-c2",
        "doc-bio",
        "cellular-molecular-biology.pdf",
        6,
        "Transcription",
        "Transcription is carried out by RNA polymerase, which reads the template DNA strand to synthesize a complementary single-stranded pre-mRNA transcript in the cell nucleus.",
        2,
        0.78
      ),
      makeChunk(
        "norm-04-c3",
        "doc-bio",
        "cellular-molecular-biology.pdf",
        3,
        "Endoplasmic Reticulum",
        "The rough endoplasmic reticulum is studded with ribosomes and is primarily involved in the folding and post-translational modification of newly synthesized proteins.",
        3,
        0.74
      ),
      makeChunk(
        "norm-04-c4",
        "doc-bio",
        "cellular-molecular-biology.pdf",
        2,
        "Mitochondria",
        "Mitochondria generate cellular adenosine triphosphate (ATP) through oxidative phosphorylation and contain their own distinct circular genome.",
        4,
        0.62
      ),
    ],
  },

  // =========================================================================
  // CATEGORY 2: DISTRACTOR_HEAVY (4 cases)
  // =========================================================================
  {
    id: "bench-dist-01",
    category: "DISTRACTOR_HEAVY",
    query: "What temperature range is required for tempering dark chocolate?",
    description: "One specific passage on dark chocolate tempering surrounded by diverse distractors on other thermal processes.",
    relevantChunkIds: ["dist-01-c1"],
    referenceAnswer: "Tempering dark chocolate requires heating to 45°C, cooling to 27°C, and then reheating to the working range of 31°C to 32°C.",
    answerable: true,
    requiredFacts: ["31", "32", "temper"],
    candidateChunks: [
      makeChunk(
        "dist-01-c1",
        "doc-culinary",
        "confectionery-principles.pdf",
        12,
        "Chocolate Tempering",
        "Properly tempering dark chocolate requires melting to 45°C, cooling down to 27°C to form beta crystal seeds, and gently reheating to the final working temperature range of 31°C to 32°C.",
        1,
        0.87
      ),
      makeChunk(
        "dist-01-c2",
        "doc-culinary",
        "confectionery-principles.pdf",
        4,
        "Croissant Baking",
        "Croissant dough should be baked in a convection oven preheated to 190°C to 200°C for approximately 18 minutes to ensure rapid oven spring and flaky layering.",
        2,
        0.81
      ),
      makeChunk(
        "dist-01-c3",
        "doc-culinary",
        "confectionery-principles.pdf",
        8,
        "Caramelization",
        "Sugar begins caramelizing around 160°C to 180°C as sucrose decomposes into fructose and glucose, producing nutty diacetyl aroma compounds.",
        3,
        0.76
      ),
      makeChunk(
        "dist-01-c4",
        "doc-culinary",
        "metallurgy-basics.pdf",
        3,
        "Steel Heat Treatment",
        "Martensitic carbon steel is quenched from 850°C in oil, followed by tempering between 150°C and 250°C to relieve internal stresses and restore ductility.",
        4,
        0.71
      ),
      makeChunk(
        "dist-01-c5",
        "doc-culinary",
        "confectionery-principles.pdf",
        15,
        "Coffee Roasting",
        "First crack in coffee roasting occurs around 196°C, signaling the end of endothermic drying and the start of light roast development.",
        5,
        0.67
      ),
    ],
  },
  {
    id: "bench-dist-02",
    category: "DISTRACTOR_HEAVY",
    query: "Which CPU microarchitecture generation introduced AVX-512 vector extensions?",
    description: "One precise passage on Intel Skylake AVX-512 surrounded by distractors about other vector architectures.",
    relevantChunkIds: ["dist-02-c1"],
    referenceAnswer: "AVX-512 512-bit vector extensions were introduced with the Intel Skylake-SP server and Skylake-X client processor microarchitectures.",
    answerable: true,
    requiredFacts: ["skylake", "avx-512", "intel"],
    candidateChunks: [
      makeChunk(
        "dist-02-c1",
        "doc-hardware",
        "intel-microarchitecture-history.pdf",
        8,
        "AVX-512 Introduction",
        "Intel introduced the 512-bit AVX-512 instruction set extension with the Skylake microarchitecture generation (Skylake-SP and Skylake-X), doubling SIMD register width over AVX2.",
        1,
        0.90
      ),
      makeChunk(
        "dist-02-c2",
        "doc-hardware",
        "arm-architecture-manual.pdf",
        5,
        "ARM SVE",
        "ARM Scalable Vector Extension (SVE) introduces vector-length agnostic SIMD operations supporting 128-bit up to 2048-bit execution on modern Neoverse cores.",
        2,
        0.83
      ),
      makeChunk(
        "dist-02-c3",
        "doc-hardware",
        "gpu-tensor-cores.pdf",
        3,
        "Tensor Cores",
        "NVIDIA Volta microarchitecture introduced Tensor Cores, executing 4x4 matrix multiply-accumulate operations in FP16 with mixed-precision FP32 accumulation.",
        3,
        0.79
      ),
      makeChunk(
        "dist-02-c4",
        "doc-hardware",
        "x86-simd-evolution.pdf",
        2,
        "SSE2 History",
        "Intel SSE2 was introduced with the Pentium 4 processor in 2000, adding 128-bit double-precision floating-point SIMD math to the x86 instruction set.",
        4,
        0.74
      ),
      makeChunk(
        "dist-02-c5",
        "doc-hardware",
        "riscv-vector-spec.pdf",
        4,
        "RISC-V Vector",
        "The RISC-V Vector Extension (RVV) defines dynamic vector configuration through vsetvli, decoupling instruction encoding from physical register length.",
        5,
        0.69
      ),
    ],
  },
  {
    id: "bench-dist-03",
    category: "DISTRACTOR_HEAVY",
    query: "What consensus protocol does Apache Kafka use for metadata management in KRaft mode?",
    description: "One target chunk on KRaft (Kafka Raft) surrounded by distractors about ZooKeeper, Paxos, etcd, and Gossip.",
    relevantChunkIds: ["dist-03-c1"],
    referenceAnswer: "Apache Kafka uses KRaft, an event-driven Raft consensus variant with an event-driven metadata quorum, replacing ZooKeeper.",
    answerable: true,
    requiredFacts: ["kraft", "quorum", "raft"],
    candidateChunks: [
      makeChunk(
        "dist-03-c1",
        "doc-kafka",
        "kafka-kraft-architecture.md",
        2,
        "KRaft Protocol",
        "In KRaft mode, Apache Kafka manages cluster metadata using a specialized Raft quorum. Metadata is stored in a replicated internal topic (@metadata) and managed directly by controller brokers.",
        1,
        0.88
      ),
      makeChunk(
        "dist-03-c2",
        "doc-kafka",
        "kafka-kraft-architecture.md",
        1,
        "Legacy ZooKeeper",
        "Historically, Kafka clusters relied on Apache ZooKeeper to maintain broker registrations, dynamic topic configurations, and partition leader elections via atomic znode trees.",
        2,
        0.84
      ),
      makeChunk(
        "dist-03-c3",
        "doc-distributed",
        "distributed-systems-overview.md",
        6,
        "Paxos Consensus",
        "Leslie Lamport introduced Multi-Paxos, where a distinguished proposer coordinates synod rounds with acceptors using prepare and accept phases to achieve consensus.",
        3,
        0.78
      ),
      makeChunk(
        "dist-03-c4",
        "doc-distributed",
        "distributed-systems-overview.md",
        8,
        "etcd Raft",
        "etcd uses a pure Go implementation of the Raft consensus algorithm to provide strongly consistent distributed key-value storage for Kubernetes control planes.",
        4,
        0.72
      ),
      makeChunk(
        "dist-03-c5",
        "doc-distributed",
        "distributed-systems-overview.md",
        9,
        "Cassandra Gossip",
        "Apache Cassandra relies on a decentralized peer-to-peer Gossip communication protocol, exchanging node state information every second via Scuttlebutt algorithms.",
        5,
        0.66
      ),
    ],
  },
  {
    id: "bench-dist-04",
    category: "DISTRACTOR_HEAVY",
    query: "What is the primary role of reverse transcriptase in retroviruses?",
    description: "One passage on retroviral reverse transcriptase surrounded by distractors on other polymerases and enzymes.",
    relevantChunkIds: ["dist-04-c1"],
    referenceAnswer: "Reverse transcriptase transcribes single-stranded viral RNA genomes into double-stranded complementary DNA (cDNA) for host integration.",
    answerable: true,
    requiredFacts: ["cdna", "rna", "transcribe"],
    candidateChunks: [
      makeChunk(
        "dist-04-c1",
        "doc-virology",
        "retrovirus-replication.pdf",
        3,
        "Reverse Transcription",
        "In retroviruses such as HIV, reverse transcriptase synthesizes a complementary DNA (cDNA) strand from the single-stranded viral RNA template before integrating into the host genome.",
        1,
        0.91
      ),
      makeChunk(
        "dist-04-c2",
        "doc-virology",
        "dna-replication-enzymes.pdf",
        2,
        "DNA Polymerase",
        "DNA Polymerase III replicates DNA bidirectionally from replication forks, synthesizing the leading strand continuously and the lagging strand via Okazaki fragments.",
        2,
        0.82
      ),
      makeChunk(
        "dist-04-c3",
        "doc-virology",
        "dna-replication-enzymes.pdf",
        4,
        "DNA Ligase",
        "DNA Ligase catalyzes phosphodiester bond formation between adjacent 3'-hydroxyl and 5'-phosphate termini to seal nicks in the sugar-phosphate backbone.",
        3,
        0.77
      ),
      makeChunk(
        "dist-04-c4",
        "doc-virology",
        "crispr-mechanisms.pdf",
        1,
        "CRISPR Cas9",
        "Cas9 endonuclease forms a ribonucleoprotein complex with guide RNA to introduce double-strand breaks at complementary protospacer adjacent motif (PAM) sites.",
        4,
        0.70
      ),
      makeChunk(
        "dist-04-c5",
        "doc-virology",
        "dna-replication-enzymes.pdf",
        5,
        "Helicase",
        "Helicase unwinds double-stranded DNA by breaking hydrogen bonds between nucleotide bases using energy derived from ATP hydrolysis.",
        5,
        0.65
      ),
    ],
  },

  // =========================================================================
  // CATEGORY 3: MULTI_CHUNK (4 cases)
  // =========================================================================
  {
    id: "bench-multi-01",
    category: "MULTI_CHUNK",
    query: "What are the two distinct pre-training objectives used to train the BERT language model?",
    description: "Requires synthesizing information from two distinct passages: Masked Language Model (MLM) and Next Sentence Prediction (NSP).",
    relevantChunkIds: ["multi-01-c1", "multi-01-c2"],
    referenceAnswer: "BERT is pre-trained using two objectives: Masked Language Modeling (MLM), where 15% of input tokens are masked and predicted, and Next Sentence Prediction (NSP), which predicts whether sentence B follows sentence A.",
    answerable: true,
    requiredFacts: ["masked language model", "next sentence prediction"],
    candidateChunks: [
      makeChunk(
        "multi-01-c1",
        "doc-bert",
        "bert-paper.pdf",
        3,
        "Task #1: MLM",
        "The first pre-training objective of BERT is Masked Language Model (MLM). We mask 15% of all WordPiece tokens at random and train the deep bidirectional Transformer to predict the masked vocabulary IDs.",
        1,
        0.90
      ),
      makeChunk(
        "multi-01-c2",
        "doc-bert",
        "bert-paper.pdf",
        4,
        "Task #2: NSP",
        "The second pre-training objective of BERT is Next Sentence Prediction (NSP). For each training pair, 50% of the time B is the actual next sentence that follows A, and 50% of the time B is a random sentence from the corpus.",
        2,
        0.88
      ),
      makeChunk(
        "multi-01-c3",
        "doc-bert",
        "bert-paper.pdf",
        2,
        "Architecture",
        "BERT's model architecture is a multi-layer bidirectional Transformer encoder based on the original Transformer implementation. BERT_BASE has L=12, H=768, A=12, total parameters=110M.",
        3,
        0.75
      ),
      makeChunk(
        "multi-01-c4",
        "doc-bert",
        "bert-paper.pdf",
        6,
        "Fine-tuning",
        "Fine-tuning BERT is straightforward because the self-attention mechanism in the Transformer allows BERT to model many downstream tasks by swapping out appropriate inputs and outputs.",
        4,
        0.69
      ),
      makeChunk(
        "multi-01-c5",
        "doc-bert",
        "bert-paper.pdf",
        8,
        "Ablations",
        "Our ablation studies demonstrate that bidirectional pre-training is crucial: removing NSP causes significant drops on QNLI and MNLI benchmarks.",
        5,
        0.62
      ),
    ],
  },
  {
    id: "bench-multi-02",
    category: "MULTI_CHUNK",
    query: "What are the two phases of Two-Phase Locking (2PL) and what restriction governs each phase?",
    description: "Requires combining the Growing Phase (acquiring locks) and Shrinking Phase (releasing locks) passages.",
    relevantChunkIds: ["multi-02-c1", "multi-02-c2"],
    referenceAnswer: "The two phases of 2PL are the Growing Phase, where a transaction may acquire locks but cannot release any, and the Shrinking Phase, where a transaction may release locks but cannot acquire new ones.",
    answerable: true,
    requiredFacts: ["growing", "shrinking", "locks"],
    candidateChunks: [
      makeChunk(
        "multi-02-c1",
        "doc-database",
        "concurrency-control-principles.pdf",
        4,
        "2PL Growing Phase",
        "In the Growing Phase of Two-Phase Locking (2PL), a transaction may acquire shared or exclusive locks on data items as needed, but it is strictly forbidden from releasing any lock it already holds.",
        1,
        0.89
      ),
      makeChunk(
        "multi-02-c2",
        "doc-database",
        "concurrency-control-principles.pdf",
        5,
        "2PL Shrinking Phase",
        "In the Shrinking Phase of Two-Phase Locking (2PL), a transaction may release previously acquired locks, but it is strictly prohibited from acquiring any new locks until commit or abort.",
        2,
        0.87
      ),
      makeChunk(
        "multi-02-c3",
        "doc-database",
        "concurrency-control-principles.pdf",
        2,
        "ACID Properties",
        "Isolation guarantees that concurrent execution of transactions leaves the database in the same state that would have been obtained if transactions had executed serially.",
        3,
        0.74
      ),
      makeChunk(
        "multi-02-c4",
        "doc-database",
        "concurrency-control-principles.pdf",
        7,
        "Deadlock Detection",
        "Deadlocks in lock-based systems can be resolved using wait-for graphs to detect cycles, aborting the victim transaction with minimum rollback cost.",
        4,
        0.68
      ),
    ],
  },
  {
    id: "bench-multi-03",
    category: "MULTI_CHUNK",
    query: "How do the light-dependent reactions and Calvin cycle collaborate in plant photosynthesis?",
    description: "Requires synthesizing light reactions (generating ATP and NADPH in thylakoids) and Calvin cycle (consuming them in stroma to fix carbon).",
    relevantChunkIds: ["multi-03-c1", "multi-03-c2"],
    referenceAnswer: "Light-dependent reactions in thylakoid membranes produce ATP and NADPH using solar energy, which the Calvin cycle in the stroma consumes to fix carbon dioxide into sugar molecules.",
    answerable: true,
    requiredFacts: ["atp", "nadph", "calvin", "light"],
    candidateChunks: [
      makeChunk(
        "multi-03-c1",
        "doc-botany",
        "plant-physiology.pdf",
        8,
        "Light Reactions",
        "The light-dependent reactions occur in chloroplast thylakoid membranes. Photons split water molecules (photolysis), generating oxygen while synthesizing high-energy ATP and NADPH via electron transport chains.",
        1,
        0.90
      ),
      makeChunk(
        "multi-03-c2",
        "doc-botany",
        "plant-physiology.pdf",
        9,
        "Calvin Cycle",
        "The light-independent Calvin cycle occurs in the chloroplast stroma. It utilizes the ATP and NADPH generated by light reactions to fix atmospheric carbon dioxide into glyceraldehyde-3-phosphate (G3P) via RuBisCO.",
        2,
        0.88
      ),
      makeChunk(
        "multi-03-c3",
        "doc-botany",
        "plant-physiology.pdf",
        3,
        "Chlorophyll Pigments",
        "Chlorophyll a and b absorb light predominantly in blue (430 nm) and red (660 nm) wavelengths while reflecting green light.",
        3,
        0.73
      ),
      makeChunk(
        "multi-03-c4",
        "doc-botany",
        "plant-physiology.pdf",
        12,
        "Cellular Respiration",
        "Glycolysis in the cytoplasm breaks glucose down into pyruvate, releasing a net yield of two ATP molecules through substrate-level phosphorylation.",
        4,
        0.61
      ),
    ],
  },
  {
    id: "bench-multi-04",
    category: "MULTI_CHUNK",
    query: "What are the three pillars of the RAG Triad used to evaluate retrieval-augmented generation systems?",
    description: "Requires three distinct chunks: Context Relevance, Groundedness/Faithfulness, and Answer Relevance.",
    relevantChunkIds: ["multi-04-c1", "multi-04-c2", "multi-04-c3"],
    referenceAnswer: "The RAG Triad comprises: 1) Context Relevance (retrieved context matches query), 2) Groundedness/Faithfulness (response supported by context), and 3) Answer Relevance (response answers user query).",
    answerable: true,
    requiredFacts: ["context relevance", "groundedness", "answer relevance"],
    candidateChunks: [
      makeChunk(
        "multi-04-c1",
        "doc-rag-eval",
        "rag-triad-evaluation-guide.md",
        1,
        "Context Relevance",
        "The first pillar of the RAG Triad is Context Relevance: assessing whether the retrieved context chunks contain relevant information needed to answer the query while filtering noise.",
        1,
        0.91
      ),
      makeChunk(
        "multi-04-c2",
        "doc-rag-eval",
        "rag-triad-evaluation-guide.md",
        2,
        "Groundedness",
        "The second pillar of the RAG Triad is Groundedness (or Faithfulness): verifying whether every factual claim in the generated answer is directly grounded and supported by the retrieved context without hallucinations.",
        2,
        0.89
      ),
      makeChunk(
        "multi-04-c3",
        "doc-rag-eval",
        "rag-triad-evaluation-guide.md",
        3,
        "Answer Relevance",
        "The third pillar of the RAG Triad is Answer Relevance: verifying whether the LLM's final response directly answers the user's intended question without drifting off-topic.",
        3,
        0.87
      ),
      makeChunk(
        "multi-04-c4",
        "doc-rag-eval",
        "rag-triad-evaluation-guide.md",
        5,
        "Semantic Search Baseline",
        "Dense vector retrieval calculates inner products between dense query embeddings and document chunk embeddings to select top-K candidates.",
        4,
        0.71
      ),
      makeChunk(
        "multi-04-c5",
        "doc-rag-eval",
        "rag-triad-evaluation-guide.md",
        6,
        "Cross-Encoder Reranking",
        "Cross-encoders pass query and passage concatenated into a single transformer to output a joint relevance logit score.",
        5,
        0.66
      ),
    ],
  },

  // =========================================================================
  // CATEGORY 4: AMBIGUOUS (4 cases)
  // =========================================================================
  {
    id: "bench-ambig-01",
    category: "AMBIGUOUS",
    query: "What is the purpose of masking in neural networks?",
    description: "Ambiguous query where masking could refer to attention causal masking or masked language modeling; both are valid.",
    relevantChunkIds: ["ambig-01-c1", "ambig-01-c2"],
    referenceAnswer: "Masking serves two primary purposes: in autoregressive decoders, causal masking prevents positions from attending to subsequent tokens; in encoder pre-training (like BERT), token masking forces the model to predict hidden words.",
    answerable: true,
    requiredFacts: ["causal", "future tokens", "masked"],
    candidateChunks: [
      makeChunk(
        "ambig-01-c1",
        "doc-nn",
        "attention-mechanisms.pdf",
        4,
        "Causal Masking",
        "In decoder self-attention, causal masking sets future token attention weights to -infinity before softmax, ensuring predictions for position i can depend only on known outputs at positions less than i.",
        1,
        0.86
      ),
      makeChunk(
        "ambig-01-c2",
        "doc-nn",
        "bert-architectures.pdf",
        3,
        "BERT Token Masking",
        "In masked language modeling, 15% of input tokens are masked with a special [MASK] symbol so that bidirectional context can be used to predict the masked vocabulary targets.",
        2,
        0.84
      ),
      makeChunk(
        "ambig-01-c3",
        "doc-nn",
        "regularization-methods.pdf",
        2,
        "Dropout Regularization",
        "Dropout randomly deactivates neurons during forward passes with probability p, preventing co-adaptation of feature detectors.",
        3,
        0.75
      ),
      makeChunk(
        "ambig-01-c4",
        "doc-nn",
        "computer-vision.pdf",
        5,
        "Semantic Segmentation",
        "Binary mask prediction classifies every image pixel into foreground or background classes for instance segmentation.",
        4,
        0.68
      ),
    ],
  },
  {
    id: "bench-ambig-02",
    category: "AMBIGUOUS",
    query: "How does transaction isolation affect database concurrency?",
    description: "Ambiguous query touching on dirty reads, non-repeatable reads, and serializable isolation trade-offs.",
    relevantChunkIds: ["ambig-02-c1", "ambig-02-c2"],
    referenceAnswer: "Higher isolation levels prevent concurrency anomalies like dirty reads and phantom rows by taking stricter locks, but reduce throughput; lower levels increase concurrency at the cost of consistency anomalies.",
    answerable: true,
    requiredFacts: ["dirty read", "serializable", "transaction"],
    candidateChunks: [
      makeChunk(
        "ambig-02-c1",
        "doc-db",
        "ansi-sql-isolation.pdf",
        2,
        "Read Committed Isolation",
        "Read Committed prevents dirty reads by allowing transactions to read only committed data. However, non-repeatable reads and phantom reads remain possible.",
        1,
        0.87
      ),
      makeChunk(
        "ambig-02-c2",
        "doc-db",
        "ansi-sql-isolation.pdf",
        4,
        "Serializable Isolation",
        "Serializable isolation provides the highest safety by eliminating all concurrency anomalies, but enforces strict serialized execution order which reduces transaction throughput under contention.",
        2,
        0.85
      ),
      makeChunk(
        "ambig-02-c3",
        "doc-hardware",
        "cpu-memory-barriers.pdf",
        3,
        "Hardware Memory Barriers",
        "Memory fence instructions enforce ordering constraints on CPU memory operations, preventing compiler and hardware out-of-order execution.",
        3,
        0.72
      ),
      makeChunk(
        "ambig-02-c4",
        "doc-db",
        "ansi-sql-isolation.pdf",
        6,
        "Database Indexing",
        "B-tree index lookups require traversing root and internal nodes with O(log N) page reads to locate target leaf keys.",
        4,
        0.64
      ),
    ],
  },
  {
    id: "bench-ambig-03",
    category: "AMBIGUOUS",
    query: "What is the significance of the event horizon in physics?",
    description: "Ambiguous between black hole gravitational event horizon and cosmological event horizon.",
    relevantChunkIds: ["ambig-03-c1"],
    referenceAnswer: "In general relativity, the event horizon is the boundary around a black hole beyond which gravitational pull is so strong that neither matter nor light can escape.",
    answerable: true,
    requiredFacts: ["black hole", "escape", "light"],
    candidateChunks: [
      makeChunk(
        "ambig-03-c1",
        "doc-relativity",
        "general-relativity-astrophysics.pdf",
        5,
        "Black Hole Event Horizon",
        "The Schwarzschild event horizon marks the boundary of spacetime around a black hole where the escape velocity equals the speed of light, preventing any signals or particles from escaping.",
        1,
        0.91
      ),
      makeChunk(
        "ambig-03-c2",
        "doc-relativity",
        "cosmology-expansion.pdf",
        3,
        "Cosmological Horizon",
        "The cosmological particle horizon represents the maximum distance from which particles could have traveled to the observer in the age of the universe.",
        2,
        0.79
      ),
      makeChunk(
        "ambig-03-c3",
        "doc-relativity",
        "general-relativity-astrophysics.pdf",
        7,
        "Accretion Disks",
        "Gas in the accretion disk around a compact object heats to millions of Kelvin due to frictional forces, emitting copious X-ray radiation.",
        3,
        0.71
      ),
      makeChunk(
        "ambig-03-c4",
        "doc-relativity",
        "general-relativity-astrophysics.pdf",
        2,
        "Gravitational Lensing",
        "Massive galaxies bend spacetime around them, acting as gravitational lenses that distort and magnify background galaxy images.",
        4,
        0.65
      ),
    ],
  },
  {
    id: "bench-ambig-04",
    category: "AMBIGUOUS",
    query: "What does batch normalization do during training?",
    description: "Differentiates mini-batch normalization operations from batch gradient descent.",
    relevantChunkIds: ["ambig-04-c1"],
    referenceAnswer: "Batch normalization calculates the mean and variance across each mini-batch during training to standardize layer activations, followed by learnable scaling and shifting.",
    answerable: true,
    requiredFacts: ["mean", "variance", "mini-batch"],
    candidateChunks: [
      makeChunk(
        "ambig-04-c1",
        "doc-deep-learning",
        "batch-norm-paper.pdf",
        3,
        "Batch Normalization",
        "Batch normalization standardizes activations across each mini-batch to zero mean and unit variance, followed by affine transformation using learnable gamma and beta parameters.",
        1,
        0.90
      ),
      makeChunk(
        "ambig-04-c2",
        "doc-deep-learning",
        "optimization-methods.pdf",
        2,
        "Mini-batch Gradient Descent",
        "Mini-batch gradient descent computes parameter updates over small batches of training examples (e.g., 32 or 64) rather than the entire dataset.",
        2,
        0.83
      ),
      makeChunk(
        "ambig-04-c3",
        "doc-deep-learning",
        "batch-norm-paper.pdf",
        5,
        "Layer Normalization",
        "Layer normalization computes statistics across all hidden units within the same layer for an individual training case, making it suitable for recurrent networks.",
        3,
        0.77
      ),
      makeChunk(
        "ambig-04-c4",
        "doc-deep-learning",
        "optimization-methods.pdf",
        6,
        "Weight Decay",
        "L2 weight decay penalizes the squared magnitude of weights in the loss function, encouraging smaller parameter norms.",
        4,
        0.63
      ),
    ],
  },

  // =========================================================================
  // CATEGORY 5: PARTIAL_CONTEXT (4 cases)
  // =========================================================================
  {
    id: "bench-part-01",
    category: "PARTIAL_CONTEXT",
    query: "What were the birth years and discoveries of both James Watson and Francis Crick?",
    description: "Passage contains Watson's birth year and their joint 1953 DNA discovery, but Francis Crick's birth year is missing.",
    relevantChunkIds: ["part-01-c1"],
    referenceAnswer: "James Watson (born 1928) and Francis Crick discovered the double-helix structure of DNA in 1953, but Francis Crick's birth year is not mentioned in the context.",
    answerable: true,
    requiredFacts: ["1953", "dna", "not mentioned"],
    candidateChunks: [
      makeChunk(
        "part-01-c1",
        "doc-dna",
        "molecular-structure-of-nucleic-acids.pdf",
        1,
        "Discovery of DNA Structure",
        "In April 1953, James Watson (born 1928) and Francis Crick published the double-helix structure of DNA at the Cavendish Laboratory in Cambridge based on Rosalind Franklin's X-ray diffraction Photo 51.",
        1,
        0.89
      ),
      makeChunk(
        "part-01-c2",
        "doc-dna",
        "molecular-structure-of-nucleic-acids.pdf",
        2,
        "Franklin Contributions",
        "Rosalind Franklin was born in 1920 in London and produced crucial high-resolution X-ray crystallographic images of DNA fibers in the B-conformation.",
        2,
        0.78
      ),
      makeChunk(
        "part-01-c3",
        "doc-dna",
        "molecular-structure-of-nucleic-acids.pdf",
        4,
        "Base Pairing",
        "Specific base pairing between adenine-thymine and guanine-cytosine accounted for Chargaff's rules of 1:1 purine-to-pyrimidine stoichiometric ratios.",
        3,
        0.72
      ),
      makeChunk(
        "part-01-c4",
        "doc-dna",
        "molecular-structure-of-nucleic-acids.pdf",
        5,
        "Nobel Prize",
        "The Nobel Prize in Physiology or Medicine was awarded in 1962 to Watson, Crick, and Maurice Wilkins for their discoveries concerning the molecular structure of nucleic acids.",
        4,
        0.65
      ),
    ],
  },
  {
    id: "bench-part-02",
    category: "PARTIAL_CONTEXT",
    query: "What were the launch date, payload mass, and destination coordinates of the Voyager 1 mission?",
    description: "Launch date and scientific instruments are described, but exact payload mass and destination coordinates are missing.",
    relevantChunkIds: ["part-02-c1"],
    referenceAnswer: "Voyager 1 was launched on September 5, 1977, but its exact payload mass and destination coordinates are not provided in the context.",
    answerable: true,
    requiredFacts: ["september 5", "1977", "not provided"],
    candidateChunks: [
      makeChunk(
        "part-02-c1",
        "doc-space",
        "voyager-mission-profile.pdf",
        2,
        "Voyager 1 Launch",
        "Voyager 1 was launched by NASA on September 5, 1977 from Cape Canaveral aboard a Titan IIIE-Centaur rocket to explore Jupiter and Saturn before traveling into interstellar space.",
        1,
        0.91
      ),
      makeChunk(
        "part-02-c2",
        "doc-space",
        "voyager-mission-profile.pdf",
        3,
        "Voyager 2",
        "Voyager 2 was launched slightly earlier on August 20, 1977, following a trajectory that allowed flybys of Uranus and Neptune in addition to Jupiter and Saturn.",
        2,
        0.81
      ),
      makeChunk(
        "part-02-c3",
        "doc-space",
        "voyager-mission-profile.pdf",
        5,
        "Golden Record",
        "Each Voyager spacecraft carries a gold-plated copper phonograph record containing sounds and images selected to portray the diversity of life on Earth.",
        3,
        0.74
      ),
      makeChunk(
        "part-02-c4",
        "doc-space",
        "voyager-mission-profile.pdf",
        7,
        "Interstellar Boundary",
        "In August 2012, Voyager 1 crossed the heliopause into interstellar space at approximately 121 astronomical units from the Sun.",
        4,
        0.67
      ),
    ],
  },
  {
    id: "bench-part-03",
    category: "PARTIAL_CONTEXT",
    query: "What are the maximum cruise speeds of both the Boeing 747 and Airbus A380?",
    description: "Contains Boeing 747 cruise speed (Mach 0.855), but only mentions Airbus A380 passenger capacity without its speed.",
    relevantChunkIds: ["part-03-c1", "part-03-c2"],
    referenceAnswer: "The Boeing 747 has a maximum cruise speed of Mach 0.855, but the maximum cruise speed of the Airbus A380 is not mentioned in the context.",
    answerable: true,
    requiredFacts: ["boeing", "0.85", "not mentioned"],
    candidateChunks: [
      makeChunk(
        "part-03-c1",
        "doc-aviation",
        "commercial-jet-specifications.pdf",
        3,
        "Boeing 747 Specs",
        "The Boeing 747-400 widebody aircraft has a maximum cruise speed of Mach 0.855 (approx 912 km/h) and a range of 13,450 kilometers.",
        1,
        0.88
      ),
      makeChunk(
        "part-03-c2",
        "doc-aviation",
        "commercial-jet-specifications.pdf",
        5,
        "Airbus A380 Overview",
        "The Airbus A380 is a double-deck widebody airliner capable of carrying 525 to 853 passengers across its full-length upper and lower decks.",
        2,
        0.85
      ),
      makeChunk(
        "part-03-c3",
        "doc-aviation",
        "commercial-jet-specifications.pdf",
        1,
        "Concorde History",
        "The Concorde supersonic transport cruised at Mach 2.04 with a maximum takeoff weight of 185 tonnes.",
        3,
        0.73
      ),
      makeChunk(
        "part-03-c4",
        "doc-aviation",
        "commercial-jet-specifications.pdf",
        7,
        "Boeing 777 Range",
        "The Boeing 777-200LR set a world record for the longest non-stop commercial airliner flight, covering 21,601 km in 22 hours and 42 minutes.",
        4,
        0.66
      ),
    ],
  },
  {
    id: "bench-part-04",
    category: "PARTIAL_CONTEXT",
    query: "What are the boiling point and freezing point of ethanol at 1 atmosphere?",
    description: "Contains boiling point (78.37°C), but freezing point is omitted.",
    relevantChunkIds: ["part-04-c1"],
    referenceAnswer: "Ethanol has a boiling point of 78.37°C at 1 atmosphere, but its freezing point is not mentioned in the provided context.",
    answerable: true,
    requiredFacts: ["78", "boiling", "freezing"],
    candidateChunks: [
      makeChunk(
        "part-04-c1",
        "doc-chem",
        "organic-solvents-handbook.pdf",
        2,
        "Ethanol Physical Properties",
        "Ethanol (C2H5OH) is a volatile, colorless liquid with a pleasant odor. At standard atmospheric pressure (1 atm), its boiling point is 78.37°C and its density is 0.789 g/cm3.",
        1,
        0.90
      ),
      makeChunk(
        "part-04-c2",
        "doc-chem",
        "organic-solvents-handbook.pdf",
        4,
        "Methanol Properties",
        "Methanol has a boiling point of 64.7°C and freezes at -97.6°C. It is highly toxic when ingested or inhaled.",
        2,
        0.79
      ),
      makeChunk(
        "part-04-c3",
        "doc-chem",
        "organic-solvents-handbook.pdf",
        1,
        "Water Solvent",
        "Water has a boiling point of 100°C and a freezing point of 0°C under 1 atmosphere.",
        3,
        0.71
      ),
      makeChunk(
        "part-04-c4",
        "doc-chem",
        "organic-solvents-handbook.pdf",
        6,
        "Acetone Properties",
        "Acetone boils at 56.05°C and is widely miscible with water, ethanol, and diethyl ether.",
        4,
        0.63
      ),
    ],
  },

  // =========================================================================
  // CATEGORY 6: NO_ANSWER (4 cases) — answerable = false
  // =========================================================================
  {
    id: "bench-noans-01",
    category: "NO_ANSWER",
    query: "What was the name of the first cat in space and when did she return to Earth?",
    description: "Context contains passages about space missions with dogs, chimps, and humans, but zero information about Felicette the cat.",
    relevantChunkIds: [],
    referenceAnswer: "The provided context does not contain information about the first cat in space or its mission.",
    answerable: false,
    requiredFacts: [],
    candidateChunks: [
      makeChunk(
        "noans-01-c1",
        "doc-space-animals",
        "animals-in-space-history.pdf",
        1,
        "Laika on Sputnik 2",
        "Laika, a Soviet stray dog, became the first animal to orbit the Earth aboard Sputnik 2 on November 3, 1957. The mission proved that a living organism could survive the launch into orbit.",
        1,
        0.79
      ),
      makeChunk(
        "noans-01-c2",
        "doc-space-animals",
        "animals-in-space-history.pdf",
        3,
        "Ham the Chimp",
        "Ham the Chimp was launched aboard Mercury-Redstone 2 on January 31, 1961. He successfully performed cognitive tasks during his 16-minute sub-orbital flight.",
        2,
        0.75
      ),
      makeChunk(
        "noans-01-c3",
        "doc-space-animals",
        "animals-in-space-history.pdf",
        5,
        "Apollo 11 Crew",
        "The Apollo 11 mission crew consisted of commander Neil Armstrong, command module pilot Michael Collins, and lunar module pilot Edwin Buzz Aldrin.",
        3,
        0.70
      ),
      makeChunk(
        "noans-01-c4",
        "doc-space-animals",
        "animals-in-space-history.pdf",
        7,
        "ISS Rodent Research",
        "Modern research on the International Space Station includes Rodent Research investigations studying muscle atrophy and bone density loss in microgravity.",
        4,
        0.64
      ),
    ],
  },
  {
    id: "bench-noans-02",
    category: "NO_ANSWER",
    query: "What was the capital city of Atlantis according to Plato's Dialogues?",
    description: "Context contains passages on Athens, Sparta, Rome, and Alexandria, with zero mention of Atlantis.",
    relevantChunkIds: [],
    referenceAnswer: "The provided context does not contain information regarding Atlantis or Plato's description of its capital.",
    answerable: false,
    requiredFacts: [],
    candidateChunks: [
      makeChunk(
        "noans-02-c1",
        "doc-ancient-history",
        "classical-mediterranean-cities.pdf",
        2,
        "Ancient Athens",
        "Classical Athens was the dominant city-state of Attica, renowned for developing democratic governance, tragic theatre, and the Parthenon temple under Pericles.",
        1,
        0.78
      ),
      makeChunk(
        "noans-02-c2",
        "doc-ancient-history",
        "classical-mediterranean-cities.pdf",
        4,
        "Spartan Hegemony",
        "Sparta was the principal military power on the Peloponnesian peninsula, governed by a dual monarchy and the Gerousia council of elders.",
        2,
        0.74
      ),
      makeChunk(
        "noans-02-c3",
        "doc-ancient-history",
        "classical-mediterranean-cities.pdf",
        6,
        "Roman Senate",
        "The Roman Senate was a political institution in ancient Rome that functioned as an advisory council for consuls and later the emperor.",
        3,
        0.69
      ),
      makeChunk(
        "noans-02-c4",
        "doc-ancient-history",
        "classical-mediterranean-cities.pdf",
        8,
        "Library of Alexandria",
        "The Great Library of Alexandria in Ptolemaic Egypt was part of a larger research institution called the Mouseion dedicated to the Muses.",
        4,
        0.62
      ),
    ],
  },
  {
    id: "bench-noans-03",
    category: "NO_ANSWER",
    query: "What is the secret chemical formula and preservative recipe of Coca-Cola?",
    description: "Context discusses carbonation physics, coffee extraction, and tea tannins, with zero mention of Coca-Cola's recipe.",
    relevantChunkIds: [],
    referenceAnswer: "The provided context contains no information about Coca-Cola's chemical formula or recipe preservatives.",
    answerable: false,
    requiredFacts: [],
    candidateChunks: [
      makeChunk(
        "noans-03-c1",
        "doc-beverages",
        "carbonation-physics.pdf",
        1,
        "Henry's Law",
        "Carbonation in soft drinks relies on Henry's law: at constant temperature, the amount of dissolved CO2 gas in liquid is proportional to its partial pressure.",
        1,
        0.76
      ),
      makeChunk(
        "noans-03-c2",
        "doc-beverages",
        "coffee-science.pdf",
        3,
        "Espresso Extraction",
        "Espresso brewing forces 9 bars of heated water through finely ground coffee cake in 25 to 30 seconds to emulsify aromatic oils into crema.",
        2,
        0.72
      ),
      makeChunk(
        "noans-03-c3",
        "doc-beverages",
        "tea-processing.pdf",
        2,
        "Black Tea Oxidation",
        "Camellia sinensis leaves undergo enzymatic oxidation where polyphenol oxidase converts catechins into theaflavins and thearubigins.",
        3,
        0.68
      ),
      makeChunk(
        "noans-03-c4",
        "doc-beverages",
        "carbonation-physics.pdf",
        4,
        "Sugar Crystallization",
        "Supersaturated sucrose solutions undergo spontaneous crystal nucleation when agitated or cooled below critical solubility limits.",
        4,
        0.63
      ),
    ],
  },
  {
    id: "bench-noans-04",
    category: "NO_ANSWER",
    query: "How many natural moons does exoplanet Proxima Centauri b possess?",
    description: "Context discusses Solar System moons (Jupiter, Saturn, Mars), with no data on exoplanetary moons of Proxima b.",
    relevantChunkIds: [],
    referenceAnswer: "The provided context contains no information regarding exoplanet Proxima Centauri b or any moons it may possess.",
    answerable: false,
    requiredFacts: [],
    candidateChunks: [
      makeChunk(
        "noans-04-c1",
        "doc-planetary",
        "solar-system-satellites.pdf",
        3,
        "Galilean Moons",
        "Jupiter possesses four large Galilean moons discovered in 1610: Io, Europa, Ganymede, and Callisto. Ganymede is the largest moon in the Solar System.",
        1,
        0.78
      ),
      makeChunk(
        "noans-04-c2",
        "doc-planetary",
        "solar-system-satellites.pdf",
        5,
        "Titan and Enceladus",
        "Saturn's moon Titan has a dense nitrogen atmosphere and liquid hydrocarbon lakes, while Enceladus erupts cryovolcanic water vapor geysers.",
        2,
        0.73
      ),
      makeChunk(
        "noans-04-c3",
        "doc-planetary",
        "solar-system-satellites.pdf",
        2,
        "Mars Moons",
        "Mars is orbited by two small irregularly shaped natural satellites, Phobos and Deimos, which are thought to be captured asteroids.",
        3,
        0.69
      ),
      makeChunk(
        "noans-04-c4",
        "doc-planetary",
        "solar-system-satellites.pdf",
        1,
        "Earth Moon",
        "Earth's Moon is in synchronous tidal rotation, always presenting the same face toward Earth with an orbital period of 27.3 days.",
        4,
        0.61
      ),
    ],
  },

  // =========================================================================
  // CATEGORY 7: SINGLE_RELEVANT (4 cases)
  // =========================================================================
  {
    id: "bench-single-01",
    category: "SINGLE_RELEVANT",
    query: "What algorithm replaces standard matrix materialization in FlashAttention to achieve IO-awareness?",
    description: "Exactly one highly technical chunk detailing SRAM tiling and online softmax recomputation.",
    relevantChunkIds: ["single-01-c1"],
    referenceAnswer: "FlashAttention uses tiling to load blocks from slow HBM into fast SRAM, computing softmax incrementally with online softmax recomputation without materializing the N x N attention matrix.",
    answerable: true,
    requiredFacts: ["tiling", "sram", "online softmax"],
    candidateChunks: [
      makeChunk(
        "single-01-c1",
        "doc-flash-attn",
        "flashattention-paper.pdf",
        3,
        "Algorithm 1: FlashAttention",
        "FlashAttention uses tiling to load blocks of keys, queries, and values from GPU High Bandwidth Memory (HBM) into on-chip SRAM, computing scaled dot-product attention with online softmax recomputation without materializing the full N x N matrix.",
        1,
        0.93
      ),
      makeChunk(
        "single-01-c2",
        "doc-flash-attn",
        "flashattention-paper.pdf",
        1,
        "Introduction",
        "Transformers have become the ubiquitous architecture for natural language processing, but their quadratic time and memory complexity in sequence length presents a computational bottleneck.",
        2,
        0.81
      ),
      makeChunk(
        "single-01-c3",
        "doc-flash-attn",
        "sparse-transformers.pdf",
        2,
        "Sparse Attention",
        "Sparse Transformer approximations restrict token attention to fixed stride patterns, lowering computational complexity to O(N sqrt(N)).",
        3,
        0.74
      ),
      makeChunk(
        "single-01-c4",
        "doc-flash-attn",
        "kernel-fusion.pdf",
        4,
        "CUDA Kernel Fusion",
        "Kernel fusion combines pointwise activation operations into a single GPU invocation to eliminate intermediate global memory round-trips.",
        4,
        0.68
      ),
      makeChunk(
        "single-01-c5",
        "doc-flash-attn",
        "transformer-benchmarks.pdf",
        6,
        "BERT Benchmarking",
        "Benchmarking BERT-Large training speedups demonstrates an 8x reduction in wall-clock time when utilizing mixed-precision FP16 Tensor Cores.",
        5,
        0.60
      ),
    ],
  },
  {
    id: "bench-single-02",
    category: "SINGLE_RELEVANT",
    query: "What is the critical temperature below which mercury exhibits superconductivity?",
    description: "One historical physics passage on Heike Kamerlingh Onnes finding mercury superconductivity at 4.2 K.",
    relevantChunkIds: ["single-02-c1"],
    referenceAnswer: "Mercury becomes superconducting at a critical transition temperature of 4.2 Kelvin, discovered by Heike Kamerlingh Onnes in 1911.",
    answerable: true,
    requiredFacts: ["4.2", "kelvin", "onnes"],
    candidateChunks: [
      makeChunk(
        "single-02-c1",
        "doc-physics",
        "superconductivity-history.pdf",
        2,
        "Discovery of Superconductivity",
        "In 1911, Dutch physicist Heike Kamerlingh Onnes discovered that the electrical resistance of solid mercury abruptly dropped to zero when cooled with liquid helium below a critical temperature of 4.2 Kelvin.",
        1,
        0.92
      ),
      makeChunk(
        "single-02-c2",
        "doc-physics",
        "semiconductor-physics.pdf",
        4,
        "Silicon Bandgap",
        "Silicon is an indirect bandgap semiconductor with a fundamental bandgap of approximately 1.12 electron-volts at room temperature (300 K).",
        2,
        0.78
      ),
      makeChunk(
        "single-02-c3",
        "doc-physics",
        "electrical-conductors.pdf",
        1,
        "Ohm's Law",
        "Ohm's law states that current through a conductor between two points is directly proportional to voltage across the points, with proportionality constant resistance R.",
        3,
        0.72
      ),
      makeChunk(
        "single-02-c4",
        "doc-physics",
        "superconductivity-history.pdf",
        6,
        "BCS Theory",
        "Bardeen, Cooper, and Schrieffer proposed in 1957 that superconductivity arises from Cooper pairs of electrons bound together by electron-phonon interactions.",
        4,
        0.69
      ),
      makeChunk(
        "single-02-c5",
        "doc-physics",
        "electrical-conductors.pdf",
        5,
        "Copper Resistivity",
        "Copper exhibits electrical resistivity of 1.68 x 10^-8 ohm-meters at 20°C, making it the standard material for electrical wiring.",
        5,
        0.61
      ),
    ],
  },
  {
    id: "bench-single-03",
    category: "SINGLE_RELEVANT",
    query: "What chemical ester compound gives ripe bananas their characteristic aroma?",
    description: "One precise chemistry chunk mentioning isoamyl acetate surrounded by general fruit/botany passages.",
    relevantChunkIds: ["single-03-c1"],
    referenceAnswer: "Isoamyl acetate (isopentyl acetate) is the chemical ester responsible for the distinctive aroma and flavor of ripe bananas.",
    answerable: true,
    requiredFacts: ["isoamyl acetate"],
    candidateChunks: [
      makeChunk(
        "single-03-c1",
        "doc-flavor",
        "organic-flavor-chemistry.pdf",
        4,
        "Fruit Esters",
        "Isoamyl acetate (also known as isopentyl acetate) is a carboxylic ester formed from isoamyl alcohol and acetic acid that imparts the strong, characteristic aroma of ripe bananas.",
        1,
        0.91
      ),
      makeChunk(
        "single-03-c2",
        "doc-flavor",
        "fruit-ripening-biology.pdf",
        2,
        "Ethylene Gas",
        "Ethylene gas (C2H4) is a natural plant hormone that triggers climacteric ripening, stimulating pectinase enzymes that soften cellular wall structures.",
        2,
        0.82
      ),
      makeChunk(
        "single-03-c3",
        "doc-flavor",
        "banana-nutrition.pdf",
        1,
        "Banana Nutrition",
        "A medium banana contains approximately 400 mg of potassium, 3 grams of dietary fiber, and significant levels of vitamin B6 and vitamin C.",
        3,
        0.75
      ),
      makeChunk(
        "single-03-c4",
        "doc-flavor",
        "organic-flavor-chemistry.pdf",
        7,
        "Ethyl Butyrate",
        "Ethyl butyrate is an ester with an odor resembling pineapple, commonly added to processed fruit juices to restore fresh top-notes.",
        4,
        0.69
      ),
      makeChunk(
        "single-03-c5",
        "doc-flavor",
        "fruit-ripening-biology.pdf",
        5,
        "Starch Conversion",
        "During ripening, amylase enzymes break complex starch macromolecules into sucrose, glucose, and fructose sugars, increasing sweetness.",
        5,
        0.63
      ),
    ],
  },
  {
    id: "bench-single-04",
    category: "SINGLE_RELEVANT",
    query: "Which cryptographic hash function was traditionally used to identify Git objects?",
    description: "One targeted chunk on Git using 160-bit SHA-1 hashes.",
    relevantChunkIds: ["single-04-c1"],
    referenceAnswer: "Git traditionally identifies objects (blobs, trees, commits, tags) using 160-bit SHA-1 cryptographic checksum hashes.",
    answerable: true,
    requiredFacts: ["sha-1", "160"],
    candidateChunks: [
      makeChunk(
        "single-04-c1",
        "doc-vcs",
        "git-internals-handbook.pdf",
        2,
        "Git Object Model",
        "Git is a content-addressable database. Every object (blob, tree, commit, or tag) is addressed by its 40-character hexadecimal string representing a 160-bit SHA-1 cryptographic hash of its payload.",
        1,
        0.92
      ),
      makeChunk(
        "single-04-c2",
        "doc-vcs",
        "git-internals-handbook.pdf",
        4,
        "Packfiles",
        "To save disk space, Git compresses loose objects into packfiles (.pack) using delta compression, paired with index files (.idx) for rapid offsets.",
        2,
        0.80
      ),
      makeChunk(
        "single-04-c3",
        "doc-vcs",
        "git-internals-handbook.pdf",
        6,
        "References",
        "Git references are simple pointers stored in .git/refs that contain 40-byte commit hashes pointing to the tip of branches or tags.",
        3,
        0.74
      ),
      makeChunk(
        "single-04-c4",
        "doc-vcs",
        "hash-functions.pdf",
        3,
        "MD5 Security",
        "MD5 produces a 128-bit hash value, but is no longer cryptographically collision-resistant following practical collision demonstrations in 2004.",
        4,
        0.68
      ),
      makeChunk(
        "single-04-c5",
        "doc-vcs",
        "git-internals-handbook.pdf",
        8,
        "Working Tree",
        "The staging area (index) is a binary file (.git/index) holding tracked file path entries, permissions, and SHA-1 hashes prior to committing.",
        5,
        0.61
      ),
    ],
  },

  // =========================================================================
  // CATEGORY 8: CONFLICTING_CONTEXT (4 cases)
  // =========================================================================
  {
    id: "bench-conf-01",
    category: "CONFLICTING_CONTEXT",
    query: "What was the estimated peak population of ancient Rome during the Pax Romana?",
    description: "Contains two conflicting historical passages: one citing 1 million residents, another citing a conservative 450,000 residents.",
    relevantChunkIds: ["conf-01-c1", "conf-01-c2"],
    referenceAnswer: "Estimates for ancient Rome's peak population conflict: standard demographic estimates propose approximately 1 million inhabitants based on grain distributions, while revisionist scholars estimate a lower peak of around 450,000 residents.",
    answerable: true,
    requiredFacts: ["1 million", "450 000", "estimate"],
    candidateChunks: [
      makeChunk(
        "conf-01-c1",
        "doc-rome",
        "roman-demography-study.pdf",
        3,
        "High Population Hypothesis",
        "Based on records of Augustus's grain distributions (annona) to adult male citizens, traditional historians calculate that Rome reached an estimated peak population of 1 million inhabitants during the second century CE.",
        1,
        0.89
      ),
      makeChunk(
        "conf-01-c2",
        "doc-rome",
        "urban-archaeology-rome.pdf",
        7,
        "Low Population Hypothesis",
        "Recent spatial archaeological excavations of housing density within the Servian walls suggest residential capacity was severely constrained, pointing to a conservative peak population of around 450,000 residents.",
        2,
        0.87
      ),
      makeChunk(
        "conf-01-c3",
        "doc-rome",
        "roman-demography-study.pdf",
        5,
        "Aqueduct Systems",
        "Eleven aqueducts supplied Rome with water, delivering an estimated 1 million cubic meters of fresh mountain spring water daily to public baths and fountains.",
        3,
        0.72
      ),
      makeChunk(
        "conf-01-c4",
        "doc-rome",
        "urban-archaeology-rome.pdf",
        2,
        "Ostia Harbor",
        "The port city of Ostia Antica served as Rome's maritime commercial gateway, receiving grain fleets from Sicily and Alexandria.",
        4,
        0.65
      ),
    ],
  },
  {
    id: "bench-conf-02",
    category: "CONFLICTING_CONTEXT",
    query: "Is dietary saturated fat directly causal to coronary heart disease according to clinical studies?",
    description: "Contains conflicting medical evidence: traditional AHA dietary hypothesis vs recent meta-analyses showing no direct mortality link.",
    relevantChunkIds: ["conf-02-c1", "conf-02-c2"],
    referenceAnswer: "Clinical evidence is conflicting: traditional cardiological guidelines state saturated fat causes coronary heart disease by raising LDL cholesterol, whereas comprehensive meta-analyses found no statistically significant association between saturated fat intake and cardiovascular mortality.",
    answerable: true,
    requiredFacts: ["meta-analysis", "ldl", "conflicting"],
    candidateChunks: [
      makeChunk(
        "conf-02-c1",
        "doc-nutrition",
        "diet-heart-guidelines.pdf",
        3,
        "Diet-Heart Hypothesis",
        "The American Heart Association guidelines state that dietary saturated fat intake elevates low-density lipoprotein (LDL) cholesterol, acting as a primary causal driver of atherosclerosis and coronary heart disease.",
        1,
        0.88
      ),
      makeChunk(
        "conf-02-c2",
        "doc-nutrition",
        "annals-internal-medicine-review.pdf",
        6,
        "Systematic Meta-Analysis",
        "A large systematic review and meta-analysis published in Annals of Internal Medicine found no significant evidence that saturated fat consumption increases cardiovascular disease risk or all-cause mortality.",
        2,
        0.86
      ),
      makeChunk(
        "conf-02-c3",
        "doc-nutrition",
        "diet-heart-guidelines.pdf",
        1,
        "Trans Fats",
        "Artificial trans-fatty acids produced by industrial hydrogenation significantly increase LDL while reducing protective HDL, and are universally recognized as hazardous.",
        3,
        0.73
      ),
      makeChunk(
        "conf-02-c4",
        "doc-nutrition",
        "annals-internal-medicine-review.pdf",
        2,
        "Triglycerides",
        "Elevated fasting serum triglycerides above 150 mg/dL indicate metabolic dysregulation and are frequently correlated with insulin resistance.",
        4,
        0.64
      ),
    ],
  },
  {
    id: "bench-conf-03",
    category: "CONFLICTING_CONTEXT",
    query: "What year was the transistor invented at Bell Labs?",
    description: "One source dates the operational point-contact invention to December 1947; another cites the public announcement and patent filing in 1948.",
    relevantChunkIds: ["conf-03-c1", "conf-03-c2"],
    referenceAnswer: "The point-contact transistor was first constructed in December 1947 by Bardeen and Brattain, but was publicly announced and patent-filed in June 1948 by Bell Labs.",
    answerable: true,
    requiredFacts: ["1947", "1948", "bell labs"],
    candidateChunks: [
      makeChunk(
        "conf-03-c1",
        "doc-electronics",
        "semiconductor-revolution.pdf",
        2,
        "Lab Prototype 1947",
        "John Bardeen and Walter Brattain successfully operated the world's first working point-contact transistor on December 16, 1947, achieving signal amplification in their Bell Labs workbench experiment.",
        1,
        0.90
      ),
      makeChunk(
        "conf-03-c2",
        "doc-electronics",
        "bell-labs-official-history.pdf",
        5,
        "Public Announcement 1948",
        "Bell Telephone Laboratories kept the invention confidential until filing foundational patent applications and hosting their first official public press conference on June 30, 1948.",
        2,
        0.88
      ),
      makeChunk(
        "conf-03-c3",
        "doc-electronics",
        "semiconductor-revolution.pdf",
        6,
        "Bipolar Junction Transistor",
        "William Shockley developed the theory of the bipolar junction transistor (BJT) utilizing p-n-p layers in early 1948, replacing fragile surface point contacts.",
        3,
        0.74
      ),
      makeChunk(
        "conf-03-c4",
        "doc-electronics",
        "vacuum-tube-history.pdf",
        1,
        "Vacuum Tube Triode",
        "Lee de Forest patented the Audion vacuum tube triode in 1906, introducing a control grid to modulate thermionic electron current between cathode and anode.",
        4,
        0.66
      ),
    ],
  },
  {
    id: "bench-conf-04",
    category: "CONFLICTING_CONTEXT",
    query: "What is the measured expansion rate (Hubble constant) of the universe?",
    description: "Hubble tension: CMB Planck satellite measurement of 67.4 km/s/Mpc vs local distance ladder measurement of 73.0 km/s/Mpc.",
    relevantChunkIds: ["conf-04-c1", "conf-04-c2"],
    referenceAnswer: "Cosmological measurements report conflicting values for the Hubble constant (Hubble tension): the Planck satellite measured 67.4 km/s/Mpc using the cosmic microwave background, whereas local Type Ia supernovae measurements yield 73.0 km/s/Mpc.",
    answerable: true,
    requiredFacts: ["67", "73", "hubble tension"],
    candidateChunks: [
      makeChunk(
        "conf-04-c1",
        "doc-cosmology",
        "planck-cmb-results.pdf",
        4,
        "Planck Satellite CMB",
        "The Planck collaboration measured the Hubble constant to be 67.4 +/- 0.5 km/s/Mpc by fitting temperature and polarization anisotropies of the early universe Cosmic Microwave Background to Lambda-CDM.",
        1,
        0.91
      ),
      makeChunk(
        "conf-04-c2",
        "doc-cosmology",
        "shoes-distance-ladder.pdf",
        3,
        "SH0ES Cepheids Supernovae",
        "The SH0ES project determined the Hubble constant to be 73.04 +/- 1.04 km/s/Mpc using the cosmic distance ladder calibrated by Cepheid variable stars in galaxies hosting Type Ia supernovae.",
        2,
        0.89
      ),
      makeChunk(
        "conf-04-c3",
        "doc-cosmology",
        "shoes-distance-ladder.pdf",
        1,
        "Hubble-Lemaitre Law",
        "The Hubble-Lemaitre law states that the recessional velocity of distant galaxies is directly proportional to their proper distance from Earth: v = H_0 * d.",
        3,
        0.75
      ),
      makeChunk(
        "conf-04-c4",
        "doc-cosmology",
        "planck-cmb-results.pdf",
        8,
        "Dark Energy Density",
        "The cosmological constant Lambda accounts for approximately 68.3% of the total energy density of the universe, causing accelerated expansion.",
        4,
        0.68
      ),
    ],
  },

  // =========================================================================
  // CATEGORY 9: LONG_CONTEXT (4 cases) — 8 candidate chunks
  // =========================================================================
  {
    id: "bench-long-01",
    category: "LONG_CONTEXT",
    query: "What are the four primary control plane components of a Kubernetes cluster?",
    description: "8 candidates: 4 control plane components (kube-apiserver, etcd, kube-scheduler, kube-controller-manager) and 4 node/distractor components.",
    relevantChunkIds: ["long-01-c1", "long-01-c2", "long-01-c3", "long-01-c4"],
    referenceAnswer: "The four primary Kubernetes control plane components are: 1) kube-apiserver (REST gateway), 2) etcd (consistent key-value store), 3) kube-scheduler (assigns pods to nodes), and 4) kube-controller-manager (runs reconciliation loops).",
    answerable: true,
    requiredFacts: ["kube-apiserver", "etcd", "kube-scheduler", "controller-manager"],
    candidateChunks: [
      makeChunk(
        "long-01-c1",
        "doc-k8s",
        "kubernetes-internals.pdf",
        1,
        "kube-apiserver",
        "The kube-apiserver is the front-end REST gateway for the Kubernetes control plane. It validates and configures data for API objects including pods, services, and replication controllers.",
        1,
        0.92
      ),
      makeChunk(
        "long-01-c2",
        "doc-k8s",
        "kubernetes-internals.pdf",
        2,
        "etcd Data Store",
        "etcd is a consistent and highly-available key-value backing store used as Kubernetes' backing store for all cluster data and state snapshots.",
        2,
        0.88
      ),
      makeChunk(
        "long-01-c3",
        "doc-k8s",
        "kubernetes-internals.pdf",
        3,
        "kube-scheduler",
        "The kube-scheduler control plane component watches for newly created pods that have no assigned node, selecting an optimal node for them based on resource requests and constraints.",
        3,
        0.85
      ),
      makeChunk(
        "long-01-c4",
        "doc-k8s",
        "kubernetes-internals.pdf",
        4,
        "kube-controller-manager",
        "The kube-controller-manager runs controller processes in a single binary, including node controllers, job controllers, endpoint controllers, and service account controllers.",
        4,
        0.82
      ),
      makeChunk(
        "long-01-c5",
        "doc-k8s",
        "kubernetes-internals.pdf",
        6,
        "kubelet Worker",
        "The kubelet is an agent running on each worker node in the cluster, ensuring that containers described in PodSpecs are running and healthy.",
        5,
        0.75
      ),
      makeChunk(
        "long-01-c6",
        "doc-k8s",
        "kubernetes-internals.pdf",
        7,
        "kube-proxy Networking",
        "kube-proxy is a network proxy that runs on each node, maintaining network rules on nodes using iptables or IPVS to allow network communication to pods.",
        6,
        0.70
      ),
      makeChunk(
        "long-01-c7",
        "doc-k8s",
        "kubernetes-internals.pdf",
        8,
        "containerd Runtime",
        "containerd is an industry-standard container runtime managing complete container lifecycles including image transfer and execution.",
        7,
        0.65
      ),
      makeChunk(
        "long-01-c8",
        "doc-k8s",
        "kubernetes-internals.pdf",
        9,
        "Ingress Controllers",
        "An Ingress controller is a specialized load balancer for cloud environments that accepts external HTTP/HTTPS traffic and routes it to backend services.",
        8,
        0.58
      ),
    ],
  },
  {
    id: "bench-long-02",
    category: "LONG_CONTEXT",
    query: "What distinct phases compose the standard front-end and back-end compiler pipeline?",
    description: "8 candidates: 4 core phases (lexical analysis, syntax parsing, semantic analysis, code generation) and 4 system utilities/tools.",
    relevantChunkIds: ["long-02-c1", "long-02-c2", "long-02-c3", "long-02-c4"],
    referenceAnswer: "The compiler pipeline comprises: 1) Lexical analysis (token scanning), 2) Syntax parsing (AST generation), 3) Semantic analysis (type checking), and 4) Optimization and target code generation.",
    answerable: true,
    requiredFacts: ["lexical", "parsing", "semantic", "code generation"],
    candidateChunks: [
      makeChunk(
        "long-02-c1",
        "doc-compiler",
        "dragon-book-compilers.pdf",
        2,
        "Lexical Analysis",
        "The lexical analyzer (scanner) reads source code characters and groups them into meaningful token sequences such as identifiers, keywords, and operators.",
        1,
        0.91
      ),
      makeChunk(
        "long-02-c2",
        "doc-compiler",
        "dragon-book-compilers.pdf",
        3,
        "Syntax Analysis",
        "Syntax analysis (parsing) uses context-free grammars to convert tokens into a hierarchical parse tree or Abstract Syntax Tree (AST) representing grammatical structure.",
        2,
        0.87
      ),
      makeChunk(
        "long-02-c3",
        "doc-compiler",
        "dragon-book-compilers.pdf",
        4,
        "Semantic Analysis",
        "The semantic analyzer checks the syntax tree for semantic consistency against language definitions, performing static type checking and symbol table lookups.",
        3,
        0.84
      ),
      makeChunk(
        "long-02-c4",
        "doc-compiler",
        "dragon-book-compilers.pdf",
        7,
        "Code Generation",
        "The code generator maps intermediate representations into target machine code, performing register allocation and instruction scheduling.",
        4,
        0.81
      ),
      makeChunk(
        "long-02-c5",
        "doc-compiler",
        "dragon-book-compilers.pdf",
        10,
        "Linker Utilities",
        "The system linker resolves symbolic external references across multiple compiled object files, combining code and data sections into an executable binary.",
        5,
        0.72
      ),
      makeChunk(
        "long-02-c6",
        "doc-compiler",
        "dragon-book-compilers.pdf",
        11,
        "Program Loader",
        "The operating system loader copies executable instructions from storage into virtual memory pages, initializing registers and stack pointers.",
        6,
        0.66
      ),
      makeChunk(
        "long-02-c7",
        "doc-compiler",
        "dragon-book-compilers.pdf",
        12,
        "Profiling Tools",
        "Sampling profilers interrupt CPU execution periodically to gather call stack histograms, locating execution hotspots for manual optimization.",
        7,
        0.61
      ),
      makeChunk(
        "long-02-c8",
        "doc-compiler",
        "dragon-book-compilers.pdf",
        14,
        "JIT Interpretation",
        "A Just-In-Time (JIT) interpreter executes bytecode directly while dynamically compiling frequently executed hot loops into native assembly.",
        8,
        0.55
      ),
    ],
  },
  {
    id: "bench-long-03",
    category: "LONG_CONTEXT",
    query: "What are the four fundamental principles of Object-Oriented Programming (OOP)?",
    description: "8 candidates: 4 OOP principles (Encapsulation, Abstraction, Inheritance, Polymorphism) and 4 functional programming concepts.",
    relevantChunkIds: ["long-03-c1", "long-03-c2", "long-03-c3", "long-03-c4"],
    referenceAnswer: "The four fundamental principles of OOP are: 1) Encapsulation (bundling data and restricting direct access), 2) Abstraction (hiding internal implementation details), 3) Inheritance (deriving new classes from existing classes), and 4) Polymorphism (allowing entities to take on multiple forms).",
    answerable: true,
    requiredFacts: ["encapsulation", "abstraction", "inheritance", "polymorphism"],
    candidateChunks: [
      makeChunk(
        "long-03-c1",
        "doc-oop",
        "object-oriented-design.pdf",
        2,
        "Encapsulation",
        "Encapsulation bundles fields and methods into an object while restricting direct outside access to internal state through access modifiers (private, protected, public).",
        1,
        0.93
      ),
      makeChunk(
        "long-03-c2",
        "doc-oop",
        "object-oriented-design.pdf",
        3,
        "Abstraction",
        "Abstraction hides internal implementation complexities, exposing only clean, high-level interfaces through abstract classes and interface contracts.",
        2,
        0.89
      ),
      makeChunk(
        "long-03-c3",
        "doc-oop",
        "object-oriented-design.pdf",
        4,
        "Inheritance",
        "Inheritance allows a subclass to inherit attributes and methods from a superclass, fostering code reuse and hierarchical class taxonomies.",
        3,
        0.86
      ),
      makeChunk(
        "long-03-c4",
        "doc-oop",
        "object-oriented-design.pdf",
        5,
        "Polymorphism",
        "Polymorphism enables objects of different classes to respond to the same method invocation via method overriding and virtual function tables.",
        4,
        0.83
      ),
      makeChunk(
        "long-03-c5",
        "doc-oop",
        "functional-programming.pdf",
        1,
        "Pure Functions",
        "Pure functions in functional programming produce outputs based solely on inputs without causing observable side effects or mutating external state.",
        5,
        0.71
      ),
      makeChunk(
        "long-03-c6",
        "doc-oop",
        "functional-programming.pdf",
        3,
        "Tail Recursion",
        "Tail recursion optimizes recursive function calls where the recursive step is the final action, allowing compilers to reuse the current stack frame.",
        6,
        0.65
      ),
      makeChunk(
        "long-03-c7",
        "doc-oop",
        "functional-programming.pdf",
        5,
        "Closures",
        "A closure is a first-class function that retains access to variables from its surrounding lexical scope even after that scope has exited.",
        7,
        0.60
      ),
      makeChunk(
        "long-03-c8",
        "doc-oop",
        "functional-programming.pdf",
        7,
        "Monads",
        "Monads encapsulate computational pipelines with bind (flatMap) and unit functions to handle side effects in purely functional languages.",
        8,
        0.54
      ),
    ],
  },
  {
    id: "bench-long-04",
    category: "LONG_CONTEXT",
    query: "What geological epochs comprise the Quaternary period and what events define them?",
    description: "8 candidates: 3 Quaternary epochs (Pleistocene, Holocene, Anthropocene) and 5 distant geological periods (Jurassic, Cretaceous, etc.).",
    relevantChunkIds: ["long-04-c1", "long-04-c2", "long-04-c3"],
    referenceAnswer: "The Quaternary period comprises: 1) the Pleistocene epoch (defined by repeated glacial cycles and megafauna), 2) the Holocene epoch (current post-glacial era spanning modern civilization), and 3) the proposed Anthropocene epoch (defined by overwhelming human impact on Earth systems).",
    answerable: true,
    requiredFacts: ["pleistocene", "holocene", "glacial"],
    candidateChunks: [
      makeChunk(
        "long-04-c1",
        "doc-geology",
        "quaternary-chronology.pdf",
        2,
        "Pleistocene Epoch",
        "The Pleistocene epoch spanned from 2.58 million to 11,700 years ago, characterized by repeated continental glaciation cycles and the evolution of hominids and megafauna.",
        1,
        0.91
      ),
      makeChunk(
        "long-04-c2",
        "doc-geology",
        "quaternary-chronology.pdf",
        4,
        "Holocene Epoch",
        "The Holocene epoch began approximately 11,700 years ago following the Last Glacial Maximum, encompassing the entire history of human agriculture and recorded civilization.",
        2,
        0.88
      ),
      makeChunk(
        "long-04-c3",
        "doc-geology",
        "quaternary-chronology.pdf",
        6,
        "Anthropocene Proposal",
        "The proposed Anthropocene epoch begins in the mid-20th century, defined by distinct radionuclide deposits and widespread human geological disruption.",
        3,
        0.83
      ),
      makeChunk(
        "long-04-c4",
        "doc-geology",
        "mesozoic-era.pdf",
        3,
        "Jurassic Period",
        "The Jurassic period occurred 201 to 145 million years ago, marked by the breakup of Pangaea and the diversification of sauropod dinosaurs.",
        4,
        0.72
      ),
      makeChunk(
        "long-04-c5",
        "doc-geology",
        "mesozoic-era.pdf",
        7,
        "Cretaceous Extinction",
        "The Cretaceous period concluded 66 million years ago with the Chicxulub asteroid impact triggering the Cretaceous-Paleogene extinction event.",
        5,
        0.66
      ),
      makeChunk(
        "long-04-c6",
        "doc-geology",
        "paleozoic-era.pdf",
        2,
        "Cambrian Explosion",
        "The Cambrian explosion 541 million years ago saw the rapid appearance of major animal phyla in the fossil record.",
        6,
        0.61
      ),
      makeChunk(
        "long-04-c7",
        "doc-geology",
        "paleozoic-era.pdf",
        5,
        "Permian Extinction",
        "The Permian-Triassic extinction event wiped out an estimated 96% of all marine species due to massive Siberian Traps volcanism.",
        7,
        0.57
      ),
      makeChunk(
        "long-04-c8",
        "doc-geology",
        "mesozoic-era.pdf",
        1,
        "Triassic Recovery",
        "The Triassic period initiated the Mesozoic era, witnessing the initial evolution of early dinosaurs in an arid climate.",
        8,
        0.51
      ),
    ],
  },
];

const targetDir = path.resolve(__dirname, "../data/benchmark");
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const targetPath = path.join(targetDir, "benchmark-dataset.json");
fs.writeFileSync(targetPath, JSON.stringify(cases, null, 2), "utf-8");

console.log(`Successfully generated ${cases.length} benchmark cases into ${targetPath}`);
