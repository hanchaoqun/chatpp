import type {
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
} from "openai";

//export type ChatRequest = CreateChatCompletionRequest;
export type ChatResponse = CreateChatCompletionResponse;

export interface ChatRequest {
  role: string;
  content: string;
}

export type Updater<T> = (updater: (value: T) => void) => void;
