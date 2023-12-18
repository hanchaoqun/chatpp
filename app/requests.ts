import {
  ModelConfig,
  ModelType,
  useAccessStore,
  useAppConfig,
  useChatStore,
} from "./store";
import {
  Message,
  ImageUrl,
  ImageContent,
  ChatRequest,
  ChatResponse,
} from "./api/type/typing";
import { showToast } from "./components/ui-lib";

const TIME_OUT_MS = 60000;

const makeRequestParam = (
  historyMessages: Message[],
  userMessage: Message,
  options?: {
    filterBot?: boolean;
    stream?: boolean;
    model?: ModelType;
  },
) => {
  let sendMessages = historyMessages.map((v) => ({
    role: v.role,
    content: v.content,
  }));

  if (options?.filterBot) {
    sendMessages = sendMessages.filter((m) => m.role !== "assistant");
  }

  const modelConfig = {
    ...useAppConfig.getState().modelConfig,
    ...useChatStore.getState().currentSession().mask.modelConfig,
  };

  // override model config
  if (options?.model) {
    modelConfig.model = options.model;
  }

  if ((userMessage.isImage??false) === true) {
      const userimgs = JSON.parse(userMessage.content) as ImageContent[];
      let imgs = userimgs.filter((m) => m.type === "image_url").map((v) => ({
        type: v.type,
        image_url: {
          url: v.image_url?.url,
          detail: v.image_url?.detail,
        },
      }));
      let texts = userimgs.filter((m) => m.type === "text").map((v) => ({
        type: v.type,
        text: v.text,
      }));
      return {
        messages: [{
          role: userMessage.role,
          content: [...imgs, ...texts],
        }],
        stream: options?.stream,
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        presence_penalty: modelConfig.presence_penalty,
        max_tokens: 1024,
      } as ChatRequest;
  }
  return {
    messages: [...sendMessages, {
      role: userMessage.role,
      content: userMessage.content,
    }],
    stream: options?.stream,
    model: modelConfig.model,
    temperature: modelConfig.temperature,
    presence_penalty: modelConfig.presence_penalty,
  } as ChatRequest;
};

function getHeaders() {
  const accessStore = useAccessStore.getState();

  let headers: Record<string, string> = {};

  if (accessStore.isNeedAccessCode()) {
    headers["access-code"] = accessStore.accessCode;
  }

  if (accessStore.token && accessStore.token.length > 0) {
    headers["token"] = accessStore.token;
  }

  return headers;
}

export async function requestChat(
  historyMessages: Message[],
  userMessage: Message,
  options?: {
    model?: ModelType;
  },
) {
  const req = makeRequestParam(historyMessages, userMessage, {
    filterBot: true,
    model: options?.model,
  });

  try {
    const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "model": (!req?.model)? "" : req.model,
          ...getHeaders(),
        },
        body: JSON.stringify(req),
      });
    const response = await res.json();
    return response;
  } catch (error) {
    console.error("[ERROR] ", error);
  }
}

export async function requestChatStream(
  historyMessages: Message[],
  userMessage: Message,
  options?: {
    filterBot?: boolean;
    modelConfig?: ModelConfig;
    model?: ModelType;
    onMessage: (message: string, done: boolean) => void;
    onError: (error: Error, statusCode?: number) => void;
    onController?: (controller: AbortController) => void;
  },
) {
  const accessStore = useAccessStore.getState();

  const req = makeRequestParam(historyMessages, userMessage, {
    stream: true,
    filterBot: options?.filterBot,
    model: options?.model,
  });

  const controller = new AbortController();
  const reqTimeoutId = setTimeout(() => controller.abort(), TIME_OUT_MS);

  try {
    const res = await fetch("/api/chat-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "model": (!req?.model)? "" : req.model,
        ...getHeaders(),
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    clearTimeout(reqTimeoutId);

    let responseText = "";

    const finish = () => {
      options?.onMessage(responseText, true);
      controller.abort();
      accessStore.fetchUserCount();
    };

    if (res.ok) {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      options?.onController?.(controller);

      while (true) {
        const resTimeoutId = setTimeout(() => finish(), TIME_OUT_MS);
        const content = await reader?.read();
        clearTimeout(resTimeoutId);

        if (!content || !content.value) {
          break;
        }

        const text = decoder.decode(content.value, { stream: true });
        responseText += text;

        const done = content.done;
        options?.onMessage(responseText, false);

        if (done) {
          break;
        }
      }

      finish();
    } else if (res.status === 401) {
      console.error("Unauthorized");
      options?.onError(new Error("Unauthorized"), res.status);
    } else {
      console.error("Stream Error", res.body);
      options?.onError(new Error("Stream Error"), res.status);
    }
  } catch (err) {
    console.error("NetWork Error", err);
    options?.onError(err as Error);
  }
}

export async function requestWithPrompt(
  historyMessages: Message[],
  prompt: string,
  options?: {
    model?: ModelType;
  },
) {
  const userMessage = {
      role: "user",
      content: prompt,
      date: new Date().toLocaleString(),
      tokens: 0,
  };

  const res = await requestChat(historyMessages, userMessage, options) as ChatResponse;
  return res?.content??"";
}

// To store message streaming controller
export const ControllerPool = {
  controllers: {} as Record<string, AbortController>,

  addController(
    sessionIndex: number,
    messageId: number,
    controller: AbortController,
  ) {
    const key = this.key(sessionIndex, messageId);
    this.controllers[key] = controller;
    return key;
  },

  stop(sessionIndex: number, messageId: number) {
    const key = this.key(sessionIndex, messageId);
    const controller = this.controllers[key];
    controller?.abort();
  },

  stopAll() {
    Object.values(this.controllers).forEach((v) => v.abort());
  },

  hasPending() {
    return Object.values(this.controllers).length > 0;
  },

  remove(sessionIndex: number, messageId: number) {
    const key = this.key(sessionIndex, messageId);
    delete this.controllers[key];
  },

  key(sessionIndex: number, messageIndex: number) {
    return `${sessionIndex},${messageIndex}`;
  },
};
