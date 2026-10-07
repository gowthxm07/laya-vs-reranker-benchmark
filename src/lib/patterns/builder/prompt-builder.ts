import { IPromptBuilder } from "../../interfaces/prompt-builder";
import { PromptPayload } from "../../interfaces/llm-provider";

/**
 * [BUILDER PATTERN IMPLEMENTATION]
 * Assembles and standardizes RAG prompt payloads for consistent LLM generation.
 */
export class PromptBuilder implements IPromptBuilder {
  private systemInstruction: string =
    "You are a concise, factual AI assistant. Answer the user query strictly using the provided context passages. If the answer cannot be found in the context, explicitly state that the information is not available.";
  private contextText: string = "";
  private userQuery: string = "";
  private constraints: string[] = [
    "Do not extrapolate beyond the retrieved facts.",
    "Be direct and cite passage numbers where applicable.",
  ];

  public setSystemInstruction(instruction: string): this {
    this.systemInstruction = instruction;
    return this;
  }

  public setContext(context: string): this {
    this.contextText = context;
    return this;
  }

  public setUserQuery(query: string): this {
    this.userQuery = query;
    return this;
  }

  public addConstraint(constraint: string): this {
    this.constraints.push(constraint);
    return this;
  }

  public reset(): this {
    this.systemInstruction = "";
    this.contextText = "";
    this.userQuery = "";
    this.constraints = [];
    return this;
  }

  public build(): PromptPayload {
    if (!this.userQuery.trim()) {
      throw new Error("PromptBuilder requires a non-empty userQuery before building.");
    }

    let instructionWithConstraints = this.systemInstruction;
    if (this.constraints.length > 0) {
      instructionWithConstraints += `\nGuidelines:\n${this.constraints
        .map((c) => `- ${c}`)
        .join("\n")}`;
    }

    return {
      systemInstruction: instructionWithConstraints,
      contextText: this.contextText,
      userQuery: this.userQuery,
    };
  }

  /**
   * Factory method to create an identical benchmark prompt payload for both Path A and Path B.
   * Enforces exact prompt parity between relevance strategies.
   */
  public static createBenchmarkPrompt(query: string, contextText: string): PromptPayload {
    const builder = new PromptBuilder();
    builder
      .setSystemInstruction(
        "You are a factual, concise question-answering assistant. " +
        "Answer the user query strictly using the provided context passages. " +
        "If the context does not contain enough information, explicitly state: \"The provided context does not contain sufficient information to answer this question.\" " +
        "Do not invent facts or extrapolate beyond what is directly stated."
      )
      .setUserQuery(query)
      .setContext(contextText);
    return builder.build();
  }
}

