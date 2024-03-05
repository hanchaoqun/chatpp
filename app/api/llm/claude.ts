import { NextRequest } from "next/server";
import { createParser } from "eventsource-parser";
import { ChatResponse, ChatRequest, ImageContent } from "../type/typing";

const CLAUDE_URL = "api.anthropic.com";
const CLAUDE_CHAT_PATH = "v1/messages";
const CLAUDE_CHAT_STREAM_PATH = "v1/messages";
const CLAUDE_VERSION = "2023-06-01";
const DEFAULT_PROTOCOL = "https";
const PROTOCOL = process.env.CLAUDE_PROTOCOL ?? DEFAULT_PROTOCOL;
const BASE_URL = process.env.CLAUDE_BASE_URL ?? CLAUDE_URL;
const VERSION  = process.env.CLAUDE_VERSION ?? CLAUDE_VERSION;
const API_KEY  = process.env.CLAUDE_API_KEY ?? "";

function isVisionModel(model:string) {
    /* claude-3 */
    return model.includes("claude-3");
}

function convertRole(role: string) {
    if (role === "user" || role === "system") {
        return "user";
    }
    if (role === "assistant") {
        return "assistant";
    }
    return "";
}

function reverseRole(role: string) {
  if (role === "user") {
      return "user";
  }
  if (role === "assistant") {
      return "assistant";
  }
  return "";
}


function getInlineData(img: ImageContent) {
    const regExp = /^data:(.+?);base64,(.+)$/;
  
    const match = img.image_url?.url.match(regExp);
  
    if (match && match.length === 3) {
      const mimeType = match[1];
      const base64Data = match[2];
      return {
        type: "base64",
        mime_type: mimeType,
        data: `${base64Data}`,
      };
    } else {
      return {
        type: "base64",
        mime_type: 'image/png',
        data: `EMPTY`,
      };
    }
  }
  
  function convertImage(content: ImageContent[]) {
      return content.map((v) => {
          return (v.type === "image_url") 
            ? {
              type: "image",
              source: getInlineData(v),
            }
            : {
              type: "text",
              text: v.text,
            }
      });
  }

export async function requestClaude(req: NextRequest, stream: boolean) {
  const chatPath = (stream)? CLAUDE_CHAT_STREAM_PATH : CLAUDE_CHAT_PATH;

  let apiKey = req.headers.get("token");
  if (!apiKey) {
    apiKey = API_KEY;
  }
  const model = req.headers.get("model")??"";
  const isImage = isVisionModel(model);

  let baseUrl = BASE_URL;
  if (!baseUrl.startsWith("http")) {
    baseUrl = `${PROTOCOL}://${baseUrl}`;
  }

  console.log("[Claude] Request:", baseUrl, chatPath, model, stream);

  const chatReq = await req.json() as ChatRequest;

  const msgs = chatReq.messages.map((v) => {
    return (isImage) 
            ? {
                role  : convertRole(v.role),
                content : convertImage(v.content as ImageContent[]),
              }
            : {
                role  : convertRole(v.role),
                content : v.content as string,
            };
  });

  // TODO: support system message
  const body = {
    model,
    stream,
    max_tokens: chatReq.max_tokens,
    temperature: chatReq.temperature,
    top_p: chatReq.top_p,
    messages : [...msgs],
  };

  const response = fetch(`${baseUrl}/${chatPath}`, {
    headers: {
      "content-type": "application/json",
      "x-api-key": `${apiKey}`,
      "anthropic-version": `${VERSION}`,
      ...(stream && { "anthropic-beta": "messages-2023-12-15" }),
    },
    method: req.method,
    body : JSON.stringify(body),
  });

  if (stream) {
    return response;
  }

  return response.then( async(res) => {
    let msg: ChatResponse = {
        role: "",
        content: "",
    };
    try {
        const json = await res.json();
        const role = "assistant";
        const content = (json?.content?.at(0)?.text ?? "") as string;
        msg = {
            role,
            content,
        };
        if (role.length <= 0 && content.length <= 0) {
          console.log("[ERROR] Response", json);
        }
    } catch(e) {
        console.log("[ERROR]", e);
    }
    return new Response(JSON.stringify(msg), {
        status: 200, 
        headers: {'Content-Type': 'application/json',},
    });
  });
}

export async function checkResponseStreamClaude(res: Response, stream: boolean) {
  const contentType = res.headers.get("Content-Type") ?? (res.headers.get("content-type") ?? "");
  /* text/event-stream */
  if (stream && !contentType.includes("stream")) {
    const content = await (
        await res.text()
    ).replace(/provided:.*. You/, "provided: ***. You");
    return "```json\nERROR: Stream error!\n" + content + "\n```";
  }

}

export async function responseStreamClaude(res: any, encoder: TextEncoder, decoder: TextDecoder) {
  const stream = new ReadableStream({
    async start(controller) {
      if (res.status !== 200) {
        const data = {
            status: res.status,
            statusText: res.statusText,
            body: await res.text(),
        };
        const errorMsg = `ERROR: Recieved non-200 status code, ${JSON.stringify(data)}`;
        const queue = encoder.encode(errorMsg);
        controller.enqueue(queue);
        controller.close();
        return;
      }

      // Chunks might get fragmented so we use eventsource-parse to ensure the chunks are complete
      // See: https://vercel.com/docs/concepts/functions/edge-functions/streaming#caveats
      function onParse(event: any) {

        if (event.type !== "event") return;
        const dataString = event.data;
        // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
        if (dataString === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const msg = JSON.parse(dataString);

          if ((msg?.type??"") === "message_stop") {
            controller.close();
            return;
          }

          if ((msg?.type??"") === "error") {
            const text = msg?.error?.message??" ";
            const errorMsg = `ERROR: ${text}`;
            controller.enqueue(errorMsg);
            controller.close();
            return;
          }

          if ((msg?.type??"") === "content_block_start") {
            const text = msg?.content_block?.text??" ";
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } else if ((msg?.type??"") === "content_block_delta") {
            const text = msg?.delta?.text??" ";
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          }
        } catch (e) {
          const errorMsg = `ERROR: Failed to parse stream data, ${JSON.stringify(e)}`;
          controller.enqueue(errorMsg);
          controller.close();
        }
      }

      const parser = createParser(onParse);
      for await (const chunk of res.body as any) {
        const dataString = decoder.decode(chunk, { stream: true });
        parser.feed(dataString);
      }

      controller.close();
    },
  });
  
  return stream;
}
