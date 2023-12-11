import type {
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
  ChatCompletionResponseMessage,
} from "openai";

export type ChatRequest = CreateChatCompletionRequest;
export type ChatResponse = CreateChatCompletionResponse;
export type ChatMessage = ChatCompletionResponseMessage;

export type Updater<T> = (updater: (value: T) => void) => void;
