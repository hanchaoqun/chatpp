import { useDebouncedCallback } from "use-debounce";
import { memo, useState, useRef, useMemo, useEffect, useLayoutEffect } from "react";
import SendWhiteIcon from "../icons/send-white.svg";
import BrainIcon from "../icons/brain.svg";
import ExportIcon from "../icons/share.svg";
import SettingsIcon from "../icons/settings.svg";
import LeftIcon from "../icons/left.svg";
import CopyIcon from "../icons/copy.svg";
import DownloadIcon from "../icons/download.svg";
import LoadingIcon from "../icons/three-dots.svg";
import PromptIcon from "../icons/prompt.svg";
import MaxIcon from "../icons/max.svg";
import MenuIcon from "../icons/menu.svg";
import MinIcon from "../icons/min.svg";
import ResetIcon from "../icons/reload.svg";
import LightIcon from "../icons/light.svg";
import DarkIcon from "../icons/dark.svg";
import BottomIcon from "../icons/bottom.svg";
import StopIcon from "../icons/pause.svg";
import PdfIcon from "../icons/pdf.svg";
import {
  ALL_MODELS,
  Message,
  ImageUrl,
  ImageContent,
  SubmitKey,
  useChatStore,
  BOT_HELLO,
  ROLES,
  createMessage,
  useAccessStore,
  Theme,
  useAppConfig,
  ModelConfig,
  ModelType,
  DEFAULT_TOPIC,
} from "../store";
import {
  copyToClipboard,
  downloadAs,
  selectOrCopy,
  autoGrowTextArea,
  useMobileScreen,
} from "../utils";
import dynamic from "next/dynamic";
import { ControllerPool } from "../requests";
import { Prompt, usePromptStore } from "../store/prompt";
import Locale from "../locales";
import { IconButton } from "./button";
import styles from "./home.module.scss";
import chatStyle from "./chat.module.scss";
import { ListItem, Modal, Selector, showModal } from "./ui-lib";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { Avatar } from "./emoji";
import { MaskAvatar, MaskConfig } from "./mask";
import {
  DEFAULT_MASK_AVATAR,
  DEFAULT_MASK_ID,
  useMaskStore,
} from "../store/mask";

const Markdown = dynamic(
  async () => memo((await import("./markdown")).Markdown),
  {
    loading: () => <LoadingIcon />,
  },
);

function exportMessages(messages: Message[], topic: string) {
  const mdText =
    `# ${topic}\n\n` +
    messages
      .map((m) => {
        return m?.role === "user"
          ? `## ${Locale.Export.MessageFromYou}:\n${m.content ?? ''}`
          : `## ${Locale.Export.MessageFromChatGPT}:\n${m.content ?? ''}`;
      })
      .join("\n\n");
  const filename = `${topic}.md`;

  showModal({
    title: Locale.Export.Title,
    children: (
      <div className="markdown-body">
        <pre className={styles["export-content"]}>{mdText}</pre>
      </div>
    ),
    actions: [
      <IconButton
        key="copy"
        icon={<CopyIcon />}
        bordered
        text={Locale.Export.Copy}
        onClick={() => copyToClipboard(mdText)}
      />,
      <IconButton
        key="download"
        icon={<DownloadIcon />}
        bordered
        text={Locale.Export.Download}
        onClick={() => downloadAs(mdText, filename)}
      />,
    ],
  });
}

export function SessionConfigModel(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Context.Edit}
        onClose={() => props.onClose()}
        actions={[

        ]}
      >
        <MaskConfig
          mask={session.mask}
          updateMask={(updater) => {
            const mask = { ...session.mask };
            updater(mask);
            chatStore.updateCurrentSession((session) => (session.mask = mask));
          }}
          extraListItems={
            session.mask.modelConfig.sendMemory ? (
              <ListItem
                title={`${Locale.Memory.Title} (${session.lastSummarizeIndex} of ${session.messages.length})`}
                subTitle={session.memoryPrompt || Locale.Memory.EmptyContent}
              ></ListItem>
            ) : (
              <></>
            )
          }
        ></MaskConfig>
      </Modal>
    </div>
  );
}

function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.mask.context;

  return (
    <div className={chatStyle["prompt-toast"]} key="prompt-toast">
      {props.showToast && (
        <div
          className={chatStyle["prompt-toast-inner"] + " clickable"}
          role="button"
          onClick={() => props.setShowModal(true)}
        >
          <BrainIcon />
          <span className={chatStyle["prompt-toast-content"]}>
            {Locale.Context.Toast(context.length)}
          </span>
        </div>
      )}
      {props.showModal && (
        <SessionConfigModel onClose={() => props.setShowModal(false)} />
      )}
    </div>
  );
}

function useSubmitHandler() {
  const config = useAppConfig();
  const submitKey = config.submitKey;

  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter") return false;
    if (e.key === "Enter" && e.nativeEvent.isComposing) return false;
    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (config.submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (config.submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };

  return {
    submitKey,
    shouldSubmit,
  };
}

export function PromptHints(props: {
  prompts: Prompt[];
  onPromptSelect: (prompt: Prompt) => void;
}) {
  if (props.prompts.length === 0) return null;

  return (
    <div className={styles["prompt-hints"]}>
      {props.prompts.map((prompt, i) => (
        <div
          className={styles["prompt-hint"]}
          key={prompt.title + i.toString()}
          onClick={() => props.onPromptSelect(prompt)}
        >
          <div className={styles["hint-title"]}>{prompt.title}</div>
          <div className={styles["hint-content"]}>{prompt.content}</div>
        </div>
      ))}
    </div>
  );
}


function ChatAction(props: {
  text: string;
  icon: JSX.Element;
  nodark: boolean;
  onClick: () => void;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState({
    full: 16,
    icon: 16,
  });

  function updateWidth() {
    if (!iconRef.current || !textRef.current) return;
    const getWidth = (dom: HTMLDivElement) => dom.getBoundingClientRect().width;
    const textWidth = getWidth(textRef.current);
    const iconWidth = getWidth(iconRef.current);
    setWidth({
      full: textWidth + iconWidth,
      icon: iconWidth,
    });
  }

  return (
    <div
      className={`${chatStyle["chat-input-action"]} clickable`}
      onClick={() => {
        props.onClick();
        setTimeout(updateWidth, 1);
      }}
      onMouseEnter={updateWidth}
      onTouchStart={updateWidth}
      style={
        {
          "--icon-width": `${width.icon}px`,
          "--full-width": `${width.full}px`,
        } as React.CSSProperties
      }
    >
      { props.nodark ? 
          <div ref={iconRef} className={`${chatStyle["icon"]} no-dark`}>
            {props.icon}
          </div>
          :
          <div ref={iconRef} className={chatStyle["icon"]}>
          {props.icon}
          </div>
      }
      <div className={chatStyle["text"]} ref={textRef}>
        {props.text}
      </div>
    </div>
  );
}

function useScrollToBottom() {
  // for auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollToBottom = () => {
    const dom = scrollRef.current;
    if (dom) {
      setTimeout(() => (dom.scrollTop = dom.scrollHeight), 1);
    }
  };

  // auto scroll
  useLayoutEffect(() => {
    autoScroll && scrollToBottom();
  });

  return {
    scrollRef,
    autoScroll,
    setAutoScroll,
    scrollToBottom,
  };
}

const getParsedPdf = async(formData:FormData) => {
  const response = await fetch("/api/pdf",{
      method: "POST",
      body: formData
  })
  .then(res => res.status === 400 ? {text:'PDF read error!'} : res.json())
  .catch(err => console.log(err))

  return response
}

async function uploadPDF(onPDFsLoad: (value: string) => void, scrollToBottom:() => void) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt, .pdf';
  fileInput.multiple = true;
  fileInput.formEnctype = "multipart/form-data";
  fileInput.onchange = async _ => {
      onPDFsLoad('Reading...');
      scrollToBottom();

      if (fileInput.files == null) {
          onPDFsLoad('No file selected!');
          scrollToBottom();
          return;
      }

      const files = Array.from(fileInput.files);
      let prevValue:string = '';

      for (const [index, file] of files.entries()) {
          try {

              console.log(file);

              if (file.type === "application/pdf") {
                  if(file.size > 5242880) {
                      onPDFsLoad("PDF file size > 5M!");
                      scrollToBottom();
                      return;
                  }

                  const formData = new FormData();
                  formData.append("pdfFile", file);

                  const result = await getParsedPdf(formData).then(res => res.text);
                  const text = typeof result === "string" ? result.trim() : "";
                  if (text.length <= 0) {
                      onPDFsLoad("PDF file can't be read!");
                      scrollToBottom();
                      return;
                  }
                  prevValue = `${prevValue}${index > 0 && prevValue ? "\n" : ""}${text}`;
              } else {
                  const reader = new FileReader();

                  // 通过新的 Promise 来处理读取
                  const text = await new Promise<string>((resolve, reject) => {
                      reader.onerror = () => {
                          reject(new Error("Text file read error!"));
                      };
                      reader.onload = () => {
                          resolve(reader.result as string);
                      };
                      reader.readAsText(file);
                  });

                  const trimmedText = text.trim();
                  if (trimmedText.length <= 0) {
                      onPDFsLoad("Text file can't be read!");
                      scrollToBottom();
                      return; 
                  }
                  prevValue = `${prevValue}${index > 0 && prevValue ? "\n" : ""}${trimmedText}`;
              }

              // 更新状态和滚动位置
              onPDFsLoad(prevValue);
              scrollToBottom();
          } catch (error) {
              // 错误处理
              onPDFsLoad((error as Error).message);
              scrollToBottom();
          }
      }

      // 检查是否没有 PDF 被处理
      if (prevValue.length <= 0) {
          onPDFsLoad("No PDF or text file could be processed!");
          scrollToBottom();
      }
  }
  fileInput.click();
}

function isVisionModel(model:string) {
  return model.startsWith("gpt-4-vision");
}

async function uploadImage(
  onImagesLoad: (images: string | ImageContent[]) => void,
  scrollToBottom:() => void
) {
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'image/jpeg,image/jpg,image/png'
  fileInput.multiple = true
  fileInput.onchange = async (_) => {
    onImagesLoad('Reading...')
    scrollToBottom()

    const files = fileInput.files ? Array.from(fileInput.files) : [];
    if (!files.length) {
      onImagesLoad('No file selected!')
      scrollToBottom()
    } else {
      let prevValue: ImageContent[] = [];
      for (const file of files) {

        console.log(file);

        if (file.size > 5242880) {
          onImagesLoad("Image file size > 5M!")
          scrollToBottom()
          return
        }
        if (["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
          const result = await readFileAsDataURL(file);
          if (result) {
            const imageContent = { type: "image_url", image_url: { url: result } };
            prevValue.push(imageContent);
          }
        }
      }
      if (!prevValue.length) {
        onImagesLoad("No valid images loaded!")
      } else {
        onImagesLoad(prevValue)
      }
      scrollToBottom()
    }
  }
  fileInput.click()
}

function readFileAsDataURL(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reader.abort();
      resolve(null);
    };
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
}

export function ChatActions(props: {
  showPromptModal: () => void;
  scrollToBottom: () => void;
  showPromptHints: () => void;
  onPDFsLoad: (text:string) => void;
  clearPDF: () => void;
  onImagesLoad: (images: string | ImageContent[]) => void;
  clearImage: () => void;
  hitBottom: boolean;
}) {
  const config = useAppConfig();
  const navigate = useNavigate();
  const chatStore = useChatStore();

  // switch themes
  const theme = config.theme;
  function nextTheme() {
    const themes = [Theme.Light, Theme.Dark];
    const themeIndex = themes.indexOf(theme);
    const nextIndex = (themeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    config.update((config) => (config.theme = nextTheme));
  }

  // stop all responses
  const couldStop = ControllerPool.hasPending();
  const stopAll = () => ControllerPool.stopAll();

  // switch model
  const currentModel = chatStore.currentSession().mask.modelConfig.model;
  const allModels = ALL_MODELS;
  const models = useMemo(
    () => allModels.filter((m) => m.available),
    [allModels],
  );
  const [showModelSelector, setShowModelSelector] = useState(false);

  useEffect(() => {
    // if current model is not available
    // switch to first available model
    const isUnavaliableModel = !models.some((m) => m.name === currentModel);
    if (isUnavaliableModel && models.length > 0) {
      const nextModel = models[0].name as ModelType;
      chatStore.updateCurrentSession(
        (session) => (session.mask.modelConfig.model = nextModel),
      );
      // showToast(nextModel);
    }
  }, [chatStore, currentModel, models]);
  
  return (
    <div className={chatStyle["chat-input-actions"]}>
      
      <div className={chatStyle["group-left"]}>
          {couldStop && (
            <ChatAction
              onClick={stopAll}
              text={"Stop"}
              icon={<StopIcon />}
              nodark={false}
            />
          )}
          {!props.hitBottom && (
            <ChatAction
              onClick={props.scrollToBottom}
              text={"ToBottom"}
              icon={<BottomIcon />}
              nodark={false}
            />
          )}
          {props.hitBottom && (
            <ChatAction
              onClick={props.showPromptModal}
              text={"Settings"}
              icon={<BrainIcon />}
              nodark={false}
            />
          )}
    
          <ChatAction
            onClick={nextTheme}
            text={"Theme"}
            icon={
              <>
                { theme === Theme.Light ? (
                  <LightIcon />
                ) : theme === Theme.Dark ? (
                  <DarkIcon />
                ) : null}
              </>
            }
            nodark={false}
          />

          <ChatAction
            onClick={props.showPromptHints}
            text={"Prompts"}
            icon={<PromptIcon />}
            nodark={false}
          />
    
          <ChatAction
            onClick={() => setShowModelSelector(true)}
            text={currentModel}
            icon={<MenuIcon />}
            nodark={false}
          />
      </div>
      
      <div className={chatStyle["group-right"]}>
        { !isVisionModel(currentModel) ?
            <ChatAction
              onClick={() => {props.clearImage();uploadPDF(props.onPDFsLoad,props.scrollToBottom)}}
              text={"LoadPDFs"}
              icon={<PdfIcon />}
              nodark={true}
            />
          :
            <ChatAction
              onClick={() => {props.clearPDF();uploadImage(props.onImagesLoad,props.scrollToBottom)}}
              text={"LoadImages"}
              icon={<MenuIcon />}
              nodark={true}
            />
        }
      </div>
      
      {showModelSelector && (
        <Selector
          defaultSelectedValue={currentModel}
          items={models.map((m) => ({
            title: m.name,
            value: m.name,
          }))}
          onClose={() => setShowModelSelector(false)}
          onSelection={(s) => {
            if (s.length === 0) return;
            chatStore.updateCurrentSession((session) => {
              session.mask.modelConfig.model = s[0] as ModelType;
            });
            // showToast(s[0]); m.displayName
          }}
        />
      )}
      
    </div>
  );
}

function getImagesInputAsText(imageInput: string | ImageContent[]) : string {
  const text = typeof imageInput === "string" ? imageInput : "";
  return text;
}

function getImagesInput(imageInput: string | ImageContent[]) : ImageContent[] {
  const imgs = Array.isArray(imageInput) ? imageInput : [] as ImageContent[];
  return imgs;
}

function getImagesAndUserInput(imageInput: string | ImageContent[], userInput: string) : ImageContent[] {
  let imgs = Array.isArray(imageInput) ? imageInput : [] as ImageContent[];
  imgs.push({
      type: "text",
      text: userInput,
    } as ImageContent);
  return imgs;
}

export function Chat() {
  type RenderMessage = Message & { preview?: boolean; isPDF?: boolean; isImage?: boolean; };

  const chatStore = useChatStore();
  const [session, sessionIndex] = useChatStore((state) => [
    state.currentSession(),
    state.currentSessionIndex,
  ]);
  const config = useAppConfig();
  const fontSize = config.fontSize;

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userInput, setUserInput] = useState("");
  const [beforeInput, setBeforeInput] = useState("");
  const [pdfInput, setPDFInput] = useState("");
  const [imageInput, setImageInput] = useState<string | ImageContent[]>("");
  const [isLoading, setIsLoading] = useState(false);
  const {submitKey, shouldSubmit } = useSubmitHandler();
  const {scrollRef, setAutoScroll, scrollToBottom } = useScrollToBottom();
  const [hitBottom, setHitBottom] = useState(true);
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();

  const onChatBodyScroll = (e: HTMLElement) => {
    const isTouchBottom = e.scrollTop + e.clientHeight >= e.scrollHeight - 20;
    setHitBottom(isTouchBottom);
  };

  // prompt hints
  const promptStore = usePromptStore();
  const [promptHints, setPromptHints] = useState<Prompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      setPromptHints(promptStore.search(text));
    },
    100,
    { leading: true, trailing: true },
  );

  const onPromptSelect = (prompt: Prompt) => {
    setPromptHints([]);
    inputRef.current?.focus();
    setUserInput(prompt.content??'');
  };

  // auto grow input
  const [inputRows, setInputRows] = useState(2);
  const measure = useDebouncedCallback(
    () => {
      const rows = inputRef.current ? autoGrowTextArea(inputRef.current) : 1;
      const inputRows = Math.min(
        5,
        Math.max(2 + Number(!isMobileScreen), rows),
      );
      setInputRows(inputRows);
    },
    100,
    {
      leading: true,
      trailing: true,
    },
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, [userInput]);

  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    setUserInput(text);
    const n = text.trim().length;

    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (!config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/")) {
        let searchText = text.slice(1);
        onSearch(searchText);
      }
    }
  };

  // submit user input
  const onUserSubmit = () => {
    let inputText:string = "";
    const currentModel = chatStore.currentSession().mask.modelConfig.model;
    if (isVisionModel(currentModel)) {
      const imgs:ImageContent[] = getImagesAndUserInput(imageInput, userInput);
      if (imgs.length <= 0) return;
      inputText = JSON.stringify(imgs);
      setImageInput("");
    } else {
      if (userInput.length <= 0 && pdfInput.length <= 0) return;
      inputText = userInput;
      if (pdfInput.length > 0) {
        inputText = "PDF\n---\n".concat(pdfInput).concat("\n---\n\n").concat(userInput);
      }
      setPDFInput("");
    }
    setIsLoading(true);
    chatStore.onUserInput(inputText??'', isVisionModel(currentModel)).then(() => setIsLoading(false));
    setBeforeInput(inputText);
    setUserInput("");
    setPromptHints([]);
    if (!isMobileScreen) inputRef.current?.focus();
    setAutoScroll(true);
  };

  // stop response
  const onUserStop = (messageId: number) => {
    ControllerPool.stop(sessionIndex, messageId);
  };

  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // if ArrowUp and no userInput
    if (e.key === "ArrowUp" && userInput.length <= 0) {
      setUserInput(beforeInput);
      e.preventDefault();
      return;
    }
    if (shouldSubmit(e)) {
      onUserSubmit();
      e.preventDefault();
    }
  };
  const onRightClick = (e: any, message: Message) => {
    // auto fill user input
    if (message.role === "user") {
      setUserInput(message.content??'');
    }

    // copy to clipboard
    if (selectOrCopy(e.currentTarget, message.content)) {
      e.preventDefault();
    }
  };

  const findLastUserIndex = (messageId: number) => {
    // find last user input message and resend
    let lastUserMessageIndex: number | null = null;
    for (let i = 0; i < session.messages.length; i += 1) {
      const message = session.messages[i];
      if (message.id === messageId) {
        break;
      }
      if (message.role === "user") {
        lastUserMessageIndex = i;
      }
    }

    return lastUserMessageIndex;
  };

  const deleteMessage = (userIndex: number) => {
    chatStore.updateCurrentSession((session) =>
      session.messages.splice(userIndex, 2),
    );
  };

  const onDelete = (botMessageId: number) => {
    const userIndex = findLastUserIndex(botMessageId);
    if (userIndex === null) return;
    deleteMessage(userIndex);
  };

  const onResend = (botMessageId: number) => {
    // find last user input message and resend
    const userIndex = findLastUserIndex(botMessageId);
    if (userIndex === null) return;
    const currentModel = chatStore.currentSession().mask.modelConfig.model;
    setIsLoading(true);
    const content = session.messages[userIndex].content;
    deleteMessage(userIndex);
    chatStore.onUserInput(content??'', isVisionModel(currentModel)).then(() => setIsLoading(false));
    inputRef.current?.focus();
  };

  const context: RenderMessage[] = session.mask.context.slice();

  const accessStore = useAccessStore();

  if (
    context.length === 0 &&
    session.messages.at(0)?.content !== BOT_HELLO.content
  ) {
    const copiedHello = Object.assign({}, BOT_HELLO);
    if (!accessStore.isAuthorized()) {
      copiedHello.content = Locale.Error.Unauthorized;
    }
    context.push(copiedHello);
  }

  const currentModel = chatStore.currentSession().mask.modelConfig.model;

  // preview messages
  const messages = context
    .concat(session.messages as RenderMessage[])
    .concat(
      isLoading
        ? [
            {
              ...createMessage({
                role: "assistant",
                content: "……",
              }),
              preview: true,
              isPDF: false,
              isImage: false,
            },
          ]
        : [],
    )
    .concat(
      pdfInput.length > 0 && !isVisionModel(currentModel)
        ? [
            {
              ...createMessage({
                role: "user",
                content: "PDF\n---\n".concat(pdfInput).concat("\n---\n\n").concat(userInput),
              }),
              preview: true,
              isPDF: true,
              isImage: false,
            },
          ]
        : [],
    )
    .concat(
      getImagesInput(imageInput).length > 0 && isVisionModel(currentModel)
        ? [
            {
              ...createMessage({
                role: "user",
                content: "Image\n---\n".concat(JSON.stringify(getImagesInput(imageInput))).concat("\n---\n\n").concat(userInput),
              }),
              preview: true,
              isPDF: false,
              isImage: true,
            },
          ]
        : [],
    )
    .concat(
      getImagesInputAsText(imageInput).length > 0 && isVisionModel(currentModel)
        ? [
            {
              ...createMessage({
                role: "user",
                content: "Image\n---\n".concat(getImagesInputAsText(imageInput)).concat("\n---\n\n").concat(userInput),
              }),
              preview: true,
              isPDF: false,
              isImage: false,
            },
          ]
        : [],
    )
    .concat(
      userInput.length > 0 && config.sendPreviewBubble
        ? [
            {
              ...createMessage({
                role: "user",
                content: userInput,
              }),
              preview: true,
              isPDF: false,
              isImage: false,
            },
          ]
        : [],
    );

  const [showPromptModal, setShowPromptModal] = useState(false);

  const renameSession = () => {
    const newTopic = prompt(Locale.Chat.Rename, session.topic);
    if (newTopic && newTopic !== session.topic) {
      chatStore.updateCurrentSession((session) => (session.topic = newTopic!));
    }
  };

  // Auto focus
  useEffect(() => {
    if (isMobileScreen) return;
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPDFsLoad = (text:string) => {
    let intext:string = text;
    if (intext.length <= 0) {
      intext = "Nothing read!";
    }
    setPDFInput(intext);
  }

  const clearPDF = () => {
    setPDFInput("");
  }

  const onImagesLoad = (images: string | ImageContent[]) => {
    const text = typeof images === "string" ? images : "";
    const imgs = Array.isArray(images) ? images : [] as ImageContent[];
    if (text.length > 0) {
      setImageInput(text);
      return;
    }
    if (imgs.length > 0) {
      setImageInput(imgs);
      return
    }
    setImageInput("Nothing read!");
  }

  const clearImage = () => {
    setImageInput("");
  }

  return (
    <div className={styles.chat} key={session.id}>
      <div className="window-header">
        <div className="window-header-title">
          <div
            className={`window-header-main-title " ${styles["chat-body-title"]}`}
            onClickCapture={renameSession}
          >
            {!session.topic ? DEFAULT_TOPIC : session.topic}
          </div>
          <div className="window-header-sub-title">
            {Locale.Chat.SubTitle(session.mask.modelConfig.model, session.messages.length)}
          </div>
        </div>
        <div className="window-actions">
          <div className={"window-action-button" + " " + styles.mobile}>
            <IconButton
              icon={<LeftIcon />}
              bordered
              title={Locale.Chat.Actions.ChatList}
              onClick={() => navigate(Path.Home)}
            />
          </div>
          <div className={"window-action-button" + " " + styles.mobile}>
            <IconButton
                icon={<SettingsIcon />}
                bordered
                title={Locale.Settings.Title}
                onClick={() => navigate(Path.Settings)}
            />
          </div>
          <div className="window-action-button">
            <IconButton
              icon={<ExportIcon />}
              bordered
              title={Locale.Chat.Actions.Export}
              onClick={() => {
                exportMessages(
                  session.messages.filter((msg) => !msg.isError),
                  session.topic,
                );
              }}
            />
          </div>
          {!isMobileScreen && (
            <div className="window-action-button">
              <IconButton
                icon={config.tightBorder ? <MinIcon /> : <MaxIcon />}
                bordered
                onClick={() => {
                  config.update(
                    (config) => (config.tightBorder = !config.tightBorder),
                  );
                }}
              />
            </div>
          )}
        </div>

        <PromptToast
          showToast={!hitBottom}
          showModal={showPromptModal}
          setShowModal={setShowPromptModal}
        />
      </div>

      <div
        className={styles["chat-body"]}
        ref={scrollRef}
        onScroll={(e) => onChatBodyScroll(e.currentTarget)}
        onMouseDown={() => inputRef.current?.blur()}
        onWheel={(e) => setAutoScroll(hitBottom && e.deltaY > 0)}
        onTouchStart={() => {
          inputRef.current?.blur();
          setAutoScroll(false);
        }}
      >
        {messages.map((message, i) => {
          const isUser = message.role === "user";
          const showActions =
            !isUser &&
            i > 0 &&
            !(message.preview || message.content?.length == undefined || message.content?.length === 0);
          const showActionsUsr =
              isUser &&
              i > 0 &&
              !(message.preview || message.content?.length == undefined || message.content?.length < 5);
          const showTyping = message.preview || message.streaming;

          return (
            <div
              key={i}
              className={
                isUser ? styles["chat-message-user"] : styles["chat-message"]
              }
            >
              <div className={styles["chat-message-container"]}>
                <div className={styles["chat-message-avatar"]}>
                  {message.role === "user" ? (
                    <Avatar avatar={config.avatar} />
                  ) : (
                    <MaskAvatar mask={session.mask} />
                  )}
                </div>
                {showTyping && (
                  <div className={styles["chat-message-status"]}>
                    {Locale.Chat.Typing}
                  </div>
                )}
                <div className={styles["chat-message-item"]}>
                  {showActionsUsr && (
                      <div className={styles["chat-message-top-actions-usr"]}>
                        <div
                            className={styles["chat-message-top-action-usr"]}
                            onClick={() => copyToClipboard(message.content)}
                        >
                          {Locale.Chat.Actions.Copy}
                        </div>
                      </div>
                  )}
                  {showActions && (
                    <div className={styles["chat-message-top-actions"]}>
                      {message.streaming ? (
                        <div
                          className={styles["chat-message-top-action"]}
                          onClick={() => onUserStop(message.id ?? i)}
                        >
                          {Locale.Chat.Actions.Stop}
                        </div>
                      ) : (
                        <>
                          <div
                            className={styles["chat-message-top-action"]}
                            onClick={() => onDelete(message.id ?? i)}
                          >
                            {Locale.Chat.Actions.Delete}
                          </div>
                          <div
                            className={styles["chat-message-top-action"]}
                            onClick={() => onResend(message.id ?? i)}
                          >
                            {Locale.Chat.Actions.Retry}
                          </div>
                        </>
                      )}

                      <div
                        className={styles["chat-message-top-action"]}
                        onClick={() => copyToClipboard(message.content)}
                      >
                        {Locale.Chat.Actions.Copy}
                      </div>
                    </div>
                  )}
                  <Markdown
                    content={message.content??''}
                    loading={
                      (message.preview || message.content?.length == undefined || message.content?.length === 0) &&
                      !isUser
                    }
                    onContextMenu={(e) => onRightClick(e, message)}
                    onDoubleClickCapture={() => {
                      if (!isMobileScreen) return;
                      setUserInput(message.content??'');
                    }}
                    fontSize={fontSize}
                    parentRef={scrollRef}
                  />
                </div>
                {!isUser && !message.preview && (
                  <div className={styles["chat-message-actions"]}>
                    <div className={styles["chat-message-action-date"]}>
                      {message.date.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles["chat-input-panel"]}>
        <PromptHints prompts={promptHints} onPromptSelect={onPromptSelect} />

        <ChatActions
          showPromptModal={() => setShowPromptModal(true)}
          scrollToBottom={scrollToBottom}
          hitBottom={hitBottom}
          onPDFsLoad={onPDFsLoad}
          clearPDF={clearPDF}
          onImagesLoad={onImagesLoad}
          clearImage={clearImage}
          showPromptHints={() => {
            // Click again to close
            if (promptHints.length > 0) {
              setPromptHints([]);
              return;
            }
            inputRef.current?.focus();
            setUserInput("/");
            onSearch("");
          }}
        />
        <div className={styles["chat-input-panel-inner"]}>
          <textarea
            ref={inputRef}
            className={styles["chat-input"]}
            placeholder={Locale.Chat.Input(submitKey)}
            onInput={(e) => onInput(e.currentTarget.value)}
            value={userInput}
            onKeyDown={onInputKeyDown}
            onFocus={() => setAutoScroll(true)}
            onBlur={() => {
              setTimeout(() => {
                if (document.activeElement !== inputRef.current) {
                  setAutoScroll(false);
                  setPromptHints([]);
                }
              }, 100);
            }}
            //autoFocus
            rows={inputRows}
          />
          <IconButton
            icon={<SendWhiteIcon />}
            text={Locale.Chat.Send}
            className={styles["chat-input-send"]}
            type="primary"
            onClick={onUserSubmit}
          />
        </div>
      </div>
    </div>
  );
}

