export interface ImageUrl {
    url: string; 
    detail?: "low" | "high" | "auto";
    file_name?: string;
    file_size?: number;
}
  
export interface ImageContent {
    type: string;
    text?: string;
    image_url?: ImageUrl;
}

export interface ChatMessage {
    role: string;
    content: string | ImageContent[];
}

export interface ChatResponse {
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
    max_tokens?: number;
}

export type Message = ChatMessage & {
    date: string;
    tokens: number;
    id?: number;
    streaming?: boolean;
    isError?: boolean;
    model?: string;
    isImage?: boolean;
  };
