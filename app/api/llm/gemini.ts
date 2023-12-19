import { NextRequest } from "next/server";
import { createParser } from "eventsource-parser";
import { ChatResponse, ChatRequest, ImageContent } from "../type/typing";

const GEMINI_URL = "generativelanguage.googleapis.com";
const GEMINI_CHAT_PATH = "v1beta/models/";
const GEMINI_CHAT_STREAM_PATH = "v1beta/models/";
const GEMINI_CHAT_OP = "generateContent";
const GEMINI_CHAT_STREAM_OP = "streamGenerateContent";
const DEFAULT_PROTOCOL = "https";
const PROTOCOL = process.env.GEMINI_PROTOCOL ?? DEFAULT_PROTOCOL;
const BASE_URL = process.env.GEMINI_BASE_URL ?? GEMINI_URL;
const API_KEY = process.env.GEMINI_API_KEY ?? "";

function isVisionModel(model:string) {
    /* gpt-4-vision && gemini-pro-vision */
    return model.includes("vision");
}

function convertRole(role: string) {
    if (role === "user" || role === "system") {
        return "user";
    }
    if (role === "assistant") {
        return "model";
    }
    return "";
}

function reverseRole(role: string) {
  if (role === "user") {
      return "user";
  }
  if (role === "model") {
      return "assistant";
  }
  return "";
}

function getMimeType(img: ImageContent) {
  return "image/jpeg";
}

function getMimeData(img: ImageContent) {
  return "";
}

function convertImage(content: ImageContent[]) {
    return content.map((v) => {
        (v.type === "image_url") 
        ? {
          inline_data: {
            mime_type: getMimeType(v),
            data: getMimeData(v),
          }
        }
        : {
          text: v.text,
        }
    });
}

export async function requestGemini(req: NextRequest, stream: boolean) {
  const chatPath = (stream)? GEMINI_CHAT_STREAM_PATH : GEMINI_CHAT_PATH;
  const chatOP = (stream)? GEMINI_CHAT_STREAM_OP : GEMINI_CHAT_OP;

  let apiKey = req.headers.get("token");
  if (!apiKey) {
    apiKey = API_KEY;
  }
  const model = req.headers.get("model") ?? "";
  const isImage = isVisionModel(model);

  let baseUrl = BASE_URL;
  if (!baseUrl.startsWith("http")) {
    baseUrl = `${PROTOCOL}://${baseUrl}`;
  }

  console.log("[GEMINI] Request:", baseUrl, chatPath, model, chatOP, stream);

  const chatReq = await req.json() as ChatRequest;
  const msgs = chatReq.messages.map((v) => {
    (isImage) 
    ? {
        role  : convertRole(v.role),
        parts : convertImage(v.content as ImageContent[]),
      }
    : {
        role  : convertRole(v.role),
        parts : [{
                    text: v.content as string,
                }], 
    }
  });
  const body = {
    contents: msgs,
    generationConfig: {
      temperature: chatReq.temperature,
      topP: chatReq.top_p,
      maxOutputTokens: chatReq.max_tokens,
    },
  };

  const response = fetch(`${baseUrl}/${chatPath}/${model}:${chatOP}?key=${apiKey}`, {
    headers: {
      "Content-Type": "application/json",
    },
    method: req.method,
    body: JSON.stringify(body),
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
        msg = {
            role: reverseRole(json?.candidates?.at(0)?.content?.role??""),
            content: json?.candidates?.at(0)?.content?.parts?.at(0)?.text ?? "",
        };
    } catch(e) {
        console.log("[ERROR]", e);
    }
    return new Response(JSON.stringify(msg), {
        status: 200, 
        headers: {'Content-Type': 'application/json',},
    });
  });
}

export async function checkResponseStreamGemini(res: Response, stream: boolean) {
  const contentType = res.headers.get("Content-Type") ?? "";
  /* text/html */
  if (stream && !contentType.includes("text/html")) {
    const content = await (
        await res.text()
    ).replace(/provided:.*. You/, "provided: ***. You");
    return "```json\n ERROR: Stream error!\n" + content + "```";
  }
}

/*
export async function responseStreamGemini(res: any, encoder: TextEncoder, decoder: TextDecoder) {
    const stream = new ReadableStream({
        async start(controller) {
          function onParse(event: any) {
            console.log("DEBUG: event ->", event);
            if (event.type === "event") {
              const data = event.data;
              try {
                console.log("DEBUG: data ->", data);
                const json = JSON.parse(data);
                console.log("DEBUG: json ->", json);
                const text = json?.candidates?.at(0)?.content?.parts?.at(0)?.text ?? "";
                const queue = encoder.encode(text);
                controller.enqueue(queue);
              } catch (e) {
                controller.error(e);
              }
            }
          }
    
          const parser = createParser(onParse);
          for await (const chunk of res.body as any) {
            console.log("DEBUG: chunk ->", chunk);
            parser.feed(decoder.decode(chunk, { stream: true }));
          }
          
          controller.close();
        },
      });
    return stream;
}*/

export async function responseStreamGemini(res: any, encoder: TextEncoder, decoder: TextDecoder) {
  // https://web.dev/articles/streams
  const readableStream = new ReadableStream({
      async start(controller) {
          if (res.status !== 200) {
              const data = {
                  status: res.status,
                  statusText: res.statusText,
                  body: await res.text(),
              }
              console.error(`ERROR: Recieved non-200 status code, ${JSON.stringify(data)}`);
              controller.close();
              return;
          }

          for await (const chunk of res.body as any) {
              controller.enqueue(chunk);
          }

          controller.close();
      },
  });

  const transformStream = new TransformStream({
    async transform(chunk, controller) {
        try {
          const data = decoder.decode(chunk, {stream: true});
          const json = JSON.parse(data);
          
          const text = json?.candidates?.at(0)?.content?.parts?.at(0)?.text ?? "";

          controller.enqueue(encoder.encode(text));
        } catch (e) {
          controller.error(e);
        }
    },
});

  return readableStream.pipeThrough(transformStream);
}

export const runtime = "edge";

/**
 * https://vercel.com/docs/concepts/edge-network/regions#region-list
 * disable hongkong : hkg1
 * only for vercel
 */
export const preferredRegion =
  [
      "arn1",
      "bom1",
      // "bru1",
      "cdg1",
      "cle1",
      "cpt1",
      "dub1",
      "fra1",
      "gru1",
      "hnd1",
      "iad1",
      "icn1",
      "kix1",
      "lhr1",
      "pdx1",
      "sfo1",
      "sin1",
      "syd1"
  ];
