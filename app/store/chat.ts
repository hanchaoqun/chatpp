import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Message, ImageUrl, ImageContent } from "../api/type/typing";
import {
  ControllerPool,
  requestChatStream,
  requestWithPrompt,
} from "../requests";
import { isMobileScreen, trimTopic } from "../utils";

import Locale from "../locales";
import { showToast } from "../components/ui-lib";
import { DEFAULT_CONFIG, ModelConfig, ModelType, useAppConfig } from "./config";
import { createEmptyMask, Mask } from "./mask";
import { StoreKey } from "../constant";
import { countTokens } from "../tokens";

import { useAccessStore, AccessType } from "./access";

export function createMessage(override: Partial<Message>): Message {
  return {
    date: new Date().toLocaleString(),
    tokens: 0,
    id: Date.now(),
    role: "user",
    content: "",
    ...override,
  };
}

export const ROLES: Message["role"][] = ["system", "user", "assistant"];

export interface ChatStat {
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChatSession {
  id: number;
  topic: string;
  memoryPrompt: string;
  messages: Message[];
  stat: ChatStat;
  lastUpdate: number;
  lastSummarizeIndex: number;
  mask: Mask;
}

export const DEFAULT_TOPIC = Locale.Store.DefaultTopic;
export const BOT_HELLO: Message = createMessage({
  role: "assistant",
  content: Locale.Store.BotHello,
});

export function getImagesInputMarkDown(imageInput: string | ImageContent[]) : string {
  const imgs = Array.isArray(imageInput) ? imageInput : [] as ImageContent[];
  
  if (imgs.length == 0) {
    return '';
  }

  const sumsize = imgs.filter((m) => m.type === "image_url")
                      .reduce((total, v) => total + (v.image_url?.file_size??0)/1024, 0);

  if (sumsize > 200) {
    const mdname = imgs.filter((m) => m.type === "image_url")
      .map((v) => `IMG:"${v.image_url?.file_name??''}" SIZE:(${((v.image_url?.file_size??0)/1024).toFixed(2)}k)`)
      .join('\n');
    return mdname;
  }
  const mdbase64 = imgs.filter((m) => m.type === "image_url")
    .map((v) => `![${v.image_url?.file_name??''}](${v.image_url?.url??''})`)
    .join('\n');
  return mdbase64;
}

function getSummaryModel(model: string): string {
  if (model.startsWith("gpt") || model.startsWith("o1")) {
    return "gpt-3.5-turbo";
  }
  if(model.startsWith("gemini")) {
    return "gemini-pro";
  }
  return "gpt-3.5-turbo";
}

function createEmptySession(): ChatSession {
  return {
    id: Date.now() + Math.random(),
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    messages: [],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: Date.now(),
    lastSummarizeIndex: 0,
    mask: createEmptyMask(),
  };
}

interface ChatStore {
  sessions: ChatSession[];
  currentSessionIndex: number;
  globalId: number;
  clearSessions: () => void;
  removeSession: (index: number) => void;
  moveSession: (from: number, to: number) => void;
  selectSession: (index: number) => void;
  newSession: (mask?: Mask) => void;
  deleteSession: (index?: number) => void;
  currentSession: () => ChatSession;
  onNewMessage: (message: Message) => void;
  onUserInput: (content: string, isImage: boolean) => Promise<void>;
  summarizeSession: () => void;
  updateStat: (message: Message) => void;
  updateCurrentSession: (updater: (session: ChatSession) => void) => void;
  updateMessage: (
    sessionIndex: number,
    messageIndex: number,
    updater: (message?: Message) => void,
  ) => void;
  resetSession: () => void;
  getMessagesTokens: (message: Message) => number;
  getMessagesByLimit: (messages: Message[], maxTokens: number) => Message[];
  getMessagesWithMemory: (usrMsgLength?: number) => Message[];
  getMemoryPrompt: () => Message;

  clearAllData: () => void;
}


function countMessages(msgs: Message[]) {
  return msgs.reduce((pre, cur) => pre + ((cur.content?.length != undefined)? cur.content?.length : 0), 0);
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [createEmptySession()],
      currentSessionIndex: 0,
      globalId: 0,

      clearSessions() {
        set(() => ({
          sessions: [createEmptySession()],
          currentSessionIndex: 0,
        }));
      },

      selectSession(index: number) {
        set({
          currentSessionIndex: index,
        });
      },

      removeSession(index: number) {
        set((state) => {
          let nextIndex = state.currentSessionIndex;
          const sessions = state.sessions;

          if (sessions.length === 1) {
            return {
              currentSessionIndex: 0,
              sessions: [createEmptySession()],
            };
          }

          sessions.splice(index, 1);

          if (nextIndex === index) {
            nextIndex -= 1;
          }

          return {
            currentSessionIndex: nextIndex,
            sessions,
          };
        });
      },

      moveSession(from: number, to: number) {
        set((state) => {
          const { sessions, currentSessionIndex: oldIndex } = state;

          // move the session
          const newSessions = [...sessions];
          const session = newSessions[from];
          newSessions.splice(from, 1);
          newSessions.splice(to, 0, session);

          // modify current session id
          let newIndex = oldIndex === from ? to : oldIndex;
          if (oldIndex > from && oldIndex <= to) {
            newIndex -= 1;
          } else if (oldIndex < from && oldIndex >= to) {
            newIndex += 1;
          }

          return {
            currentSessionIndex: newIndex,
            sessions: newSessions,
          };
        });
      },

      newSession(mask) {
        const session = createEmptySession();

        set(() => ({ globalId: get().globalId + 1 }));
        session.id = get().globalId;

        if (mask) {
          session.mask = { ...mask };
          session.topic = mask.name;
        }

        set((state) => ({
          currentSessionIndex: 0,
          sessions: [session].concat(state.sessions),
        }));
      },

      deleteSession(i?: number) {
        const deletedSession = get().currentSession();
        const index = i ?? get().currentSessionIndex;
        const isLastSession = get().sessions.length === 1;
        if (!isMobileScreen() || true) {
          get().removeSession(index);

          showToast(
            Locale.Home.DeleteToast,
            {
              text: "",
              onClick() { },
            },
            5000,
          );
        }
      },

      currentSession() {
        let index = get().currentSessionIndex;
        const sessions = get().sessions;

        if (index < 0 || index >= sessions.length) {
          index = Math.min(sessions.length - 1, Math.max(0, index));
          set(() => ({ currentSessionIndex: index }));
        }

        const session = sessions[index];

        return session;
      },

      onNewMessage(message) {
        get().updateCurrentSession((session) => {
          session.lastUpdate = Date.now();
        });
        get().updateStat(message);
        get().summarizeSession();
      },

      async onUserInput(content, isImage) {
        const userMessage: Message = createMessage({
          role: "user",
          content,
          isImage,
        });

        const botMessage: Message = createMessage({
          role: "assistant",
          streaming: true,
          id: userMessage.id! + 1,
          model: useAppConfig.getState().modelConfig.model,
        });

        // if image then clear history message
        if (isImage) {
          get().resetSession();
        }

        // get history messages
        const usrMsgLength = content.length;
        const historyMessages = get().getMessagesWithMemory(usrMsgLength);
        const sessionIndex = get().currentSessionIndex;
        const messageIndex = get().currentSession().messages.length + 1;

        // save user's and bot's message
        let saveUserMessage: Message = createMessage({
              ...userMessage,
            });
        if (isImage) {
          try {
            const userimgs = JSON.parse(userMessage.content) as ImageContent[];
            let imgs  = getImagesInputMarkDown(userimgs.filter((m) => m.type === "image_url"));
            let texts = userimgs.filter((m) => m.type === "text")
                                .map((v) => v.text??'')
                                .join('\n');
            let saveimgs = '';
            if (imgs.length > 0) {
              saveimgs = `Images:\n---\n${imgs}\n---\n\n`;
            }
            saveUserMessage.contentImages = userMessage.content;
            saveUserMessage.content = `${saveimgs}${texts}`;
          } catch (e) {
            saveUserMessage.content = `ERROR: Images is missing!`;
          }
        }
        get().updateCurrentSession((session) => {
          session.messages.push(saveUserMessage);
          session.messages.push(botMessage);
        });

        if (get().currentSession().mask.modelConfig.model.startsWith("o1")) {
          const accessStore = useAccessStore.getState();
          const userType = accessStore.userCount.usertype;
          if (userType < 1) {
            botMessage.streaming = false;
            botMessage.content = "Pemium User Only! Send an email to hanssccv@gmail.com to apply for permission, please include your account number.\n"
                               + "仅供高级用户使用!";
            get().onNewMessage(botMessage);
          } else {
            requestWithPrompt(historyMessages, userMessage.content, {
              model: get().currentSession().mask.modelConfig.model as ModelType,
            }).then((res) => {
              botMessage.streaming = false;
              botMessage.content = (res.length > 0)? res : Locale.Store.Error;
              get().onNewMessage(botMessage);
            });
          }
        } else {
          // make request
          requestChatStream(historyMessages, userMessage, {
            onMessage(content, done) {
              // stream response
              if (done) {
                botMessage.streaming = false;
                botMessage.content = (content.length > 0)? content : Locale.Store.Error;
                get().onNewMessage(botMessage);
                ControllerPool.remove(
                  sessionIndex,
                  botMessage.id ?? messageIndex,
                );
              } else {
                botMessage.content = content;
                set(() => ({}));
              }
            },
            async onError(error, statusCode) {
              if (statusCode === 401) {
                const accessStore = useAccessStore.getState();
                await accessStore.fetchUserCount();
                if (accessStore.isAuthorized() && accessStore.isNoFee()) {
                  botMessage.content = Locale.Error.NoFee;
                } else {
                  botMessage.content = Locale.Error.Unauthorized;
                }
              } else if (statusCode === 403) {
                botMessage.content += "\n\n" + '请勿在公司内网上传敏感信息!!!\nPlease do not upload sensitive information on the company intranet!\n';
              } else if (!error.message.includes("aborted")) {
                botMessage.content += "\n\n" + Locale.Store.Error;
              }
              botMessage.streaming = false;
              userMessage.isError = true;
              botMessage.isError = true;
              set(() => ({}));
              ControllerPool.remove(sessionIndex, botMessage.id ?? messageIndex);
            },
            onController(controller) {
              // collect controller for stop/retry
              ControllerPool.addController(
                sessionIndex,
                botMessage.id ?? messageIndex,
                controller,
              );
            },
            filterBot: !useAppConfig.getState().sendBotMessages,
            modelConfig: useAppConfig.getState().modelConfig,
          });
        }
      },

      getMessagesTokens(message: Message) {
        if (message.tokens === 0 && message.content?.length != undefined && message.content?.length > 0) {
          message.tokens = countTokens(message.content??'');
        }
        return message.tokens;
      },

      getMessagesByLimit(messages: Message[], maxTokens: number) {
        let cleanMessages: Message[] = [];
        let sumTokens = 0;
        // HARD LIMIT !!!!
        const accessStore = useAccessStore.getState();
        const userType = accessStore.userCount.usertype;
        let hardMaxTokens = maxTokens;
        if (userType <= 1) {
          hardMaxTokens = (maxTokens > 0) ? Math.floor(maxTokens * 0.25) : 0;
          hardMaxTokens = (hardMaxTokens > 2000) ? 2000: hardMaxTokens;
        }
        // HARD LIMIT !!!!
        for (let i = messages.length - 1; i >= 0; i--) {
          const tks = get().getMessagesTokens(messages[i]);
          if (sumTokens + tks > hardMaxTokens) {
            break;
          }
          cleanMessages.unshift(messages[i]);
          sumTokens = sumTokens + tks;
        }
        return cleanMessages;
      },

      getMemoryPrompt() {
        const session = get().currentSession();

        return {
          role: "system",
          content:
            session.memoryPrompt.length > 0
              ? Locale.Store.Prompt.History(session.memoryPrompt)
              : "",
          date: "",
        } as Message;
      },

      getMessagesWithMemory(usrMsgLength?: number) {
        const session = get().currentSession();
        // Or use useAppConfig.getState(); ??
        const config = session.mask;
        const messages = session.messages.filter((msg) => !msg.isError);
        const n = messages.length;

        const context = session.mask.context.slice();

        let maxTokens = config.modelConfig.max_tokens - (usrMsgLength ? usrMsgLength : 0);

        const needMemory = session.mask.modelConfig.sendMemory &&
          session.memoryPrompt &&
          session.memoryPrompt.length > 0;

        // long term memory
        if (needMemory) {
          maxTokens = maxTokens - session.memoryPrompt.length;
        }

        // get short term and unmemoried long term memory
        const shortTermMemoryMessageIndex = Math.max(
          0,
          n - config.modelConfig.historyMessageCount,
        );
        const longTermMemoryMessageIndex = session.lastSummarizeIndex;

        // need some overlap for taking memory as much as possible
        let oldestIndex = shortTermMemoryMessageIndex;

        if (needMemory) {
          oldestIndex = Math.min(
            shortTermMemoryMessageIndex,
            longTermMemoryMessageIndex,
          );
        }

        let recentMessages = messages.slice(oldestIndex,);

        // get history as much as possible
        recentMessages = get().getMessagesByLimit(recentMessages, maxTokens);

        if (needMemory) {
          const memoryPrompt = get().getMemoryPrompt();
          context.push(memoryPrompt);
        }

        // concat
        recentMessages = context.concat(recentMessages);

        return recentMessages;
      },

      updateMessage(
        sessionIndex: number,
        messageIndex: number,
        updater: (message?: Message) => void,
      ) {
        const sessions = get().sessions;
        const session = sessions.at(sessionIndex);
        const messages = session?.messages;
        updater(messages?.at(messageIndex));
        set(() => ({ sessions }));
      },

      resetSession() {
        get().updateCurrentSession((session) => {
          session.messages = [];
          session.memoryPrompt = "";
        });
      },

      summarizeSession() {
        const session = get().currentSession();

        // should summarize topic after chating more than 50 words
        const SUMMARIZE_MIN_LEN = 50;
        if (
          session.topic === DEFAULT_TOPIC &&
          countMessages(session.messages) >= SUMMARIZE_MIN_LEN
        ) {
          requestWithPrompt(session.messages, Locale.Store.Prompt.Topic, {
            model: getSummaryModel(session.mask.modelConfig.model) as ModelType,
          }).then((res) => {
            get().updateCurrentSession(
              (session) =>
                (session.topic = res ? trimTopic(res) : DEFAULT_TOPIC),
            );
          });
        }

        // Or use useAppConfig.getState() ??
        const config = session.mask;
        let toBeSummarizedMsgs = session.messages.slice(
          session.lastSummarizeIndex,
        );

        let historyMsgLength = countMessages(toBeSummarizedMsgs);
        const maxTokens = config?.modelConfig?.max_tokens ?? 4000;
        if (historyMsgLength > maxTokens) {
          const n = toBeSummarizedMsgs.length;
          toBeSummarizedMsgs = toBeSummarizedMsgs.slice(
            Math.max(0, n - config.modelConfig.historyMessageCount),
          );
          historyMsgLength = countMessages(toBeSummarizedMsgs);
          if (historyMsgLength > maxTokens) {
            toBeSummarizedMsgs = get().getMessagesByLimit(toBeSummarizedMsgs, maxTokens);
          }
        }

        // add memory prompt
        const memoryPrompt = get().getMemoryPrompt();
        if (memoryPrompt.content?.length != undefined && memoryPrompt.content?.length > 0) {
          toBeSummarizedMsgs.unshift(memoryPrompt);
        }

        const lastSummarizeIndex = session.messages.length;

        if (
          historyMsgLength >
          config.modelConfig.compressMessageLengthThreshold &&
          session.mask.modelConfig.sendMemory
        ) {
          requestWithPrompt(toBeSummarizedMsgs, Locale.Store.Prompt.Summarize, {
            model: getSummaryModel(session.mask.modelConfig.model) as ModelType,
          }).then((res) => {
            if (res && trimTopic(res).length > 0) {
              session.memoryPrompt = trimTopic(res);
              session.lastSummarizeIndex = lastSummarizeIndex;
            }
          });
        }
      },

      updateStat(message) {
        get().updateCurrentSession((session) => {
          let len = 0;
          if (message.content?.length != undefined) {
            len = message.content?.length;
          }
          session.stat.charCount += len;
          // TODO: should update chat count and word count
        });
      },

      updateCurrentSession(updater) {
        const sessions = get().sessions;
        const index = get().currentSessionIndex;
        updater(sessions[index]);
        set(() => ({ sessions }));
      },

      clearAllData() {
        localStorage.clear();
        location.reload();
      },
    }),
    {
      name: StoreKey.Chat,
      version: 2,
      migrate(persistedState, version) {
        const state = persistedState as any;
        const newState = JSON.parse(JSON.stringify(state)) as ChatStore;

        if (version < 2) {
          newState.globalId = 0;
          newState.sessions = [];

          const oldSessions = state.sessions;
          for (const oldSession of oldSessions) {
            const newSession = createEmptySession();
            newSession.topic = oldSession.topic;
            newSession.messages = [...oldSession.messages];
            newSession.mask.modelConfig.sendMemory = true;
            newSession.mask.modelConfig.historyMessageCount = 10;
            newSession.mask.modelConfig.compressMessageLengthThreshold = 2000;
            newState.sessions.push(newSession);
          }
        }

        return newState;
      },
    },
  ),
);
