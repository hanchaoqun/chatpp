import type {
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
  ChatCompletionResponseMessage,
} from "openai";

//export type ChatRequest = CreateChatCompletionRequest;
//export type ChatResponse = CreateChatCompletionResponse;
//export type ChatMessage = ChatCompletionResponseMessage;

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export type Updater<T> = (updater: (value: T) => void) => void;
