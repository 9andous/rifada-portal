import "server-only";

// AI assistance interface (brief §7). The completeness check is rule-based and decides on its own;
// a future model may only add suggestions behind this interface. Phase 3 ships the MOCK below and
// makes no external calls of any kind.

export type AiReviewInput = { title: string; description: string | null; initiativeName: string };
export type AiReviewResult = { suggestions: string[] };

export interface AIService {
  /** True for the mock; a real implementation must be approved by the owner first. */
  readonly isMock: boolean;
  reviewRequest(input: AiReviewInput): Promise<AiReviewResult>;
}

/** MOCK: returns no suggestions and performs no network access. */
export class MockAIService implements AIService {
  readonly isMock = true;
  async reviewRequest(): Promise<AiReviewResult> {
    return { suggestions: [] };
  }
}

export const aiService: AIService = new MockAIService();
