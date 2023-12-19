import { NextRequest } from "next/server";
import { createParser } from "eventsource-parser";
import { ChatResponse } from "../type/typing";

const OPENAI_URL = "api.openai.com";
const OPENAI_CHAT_PATH = "v1/chat/completions";
const OPENAI_CHAT_STREAM_PATH = "v1/chat/completions";
const DEFAULT_PROTOCOL = "https";
const PROTOCOL = process.env.OPENAI_PROTOCOL ?? DEFAULT_PROTOCOL;
const BASE_URL = process.env.OPENAI_BASE_URL ?? OPENAI_URL;
const API_KEY = process.env.OPENAI_API_KEY ?? "";

export async function requestOpenAi(req: NextRequest, stream: boolean) {
  const chatPath = (stream)? OPENAI_CHAT_STREAM_PATH : OPENAI_CHAT_PATH;

  let apiKey = req.headers.get("token");
  if (!apiKey) {
    apiKey = API_KEY;
  }
  const model = req.headers.get("model")??"";

  let baseUrl = BASE_URL;
  if (!baseUrl.startsWith("http")) {
    baseUrl = `${PROTOCOL}://${baseUrl}`;
  }

  console.log("[OPENAI] Request:", baseUrl, chatPath, model, stream);

  const response = fetch(`${baseUrl}/${chatPath}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(process.env.OPENAI_ORG_ID && { "OpenAI-Organization": process.env.OPENAI_ORG_ID }),
    },
    method: req.method,
    body: req.body,
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
            role: json?.choices?.at(0)?.message?.role ?? "",
            content: json?.choices?.at(0)?.message?.content ?? "",
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

export async function checkResponseStreamOpenAi(res: Response, stream: boolean) {
  const contentType = res.headers.get("Content-Type") ?? "";
  /* text/event-stream */
  if (stream && !contentType.includes("stream")) {
    const content = await (
        await res.text()
    ).replace(/provided:.*. You/, "provided: ***. You");
    return "```json\n ERROR: Stream error!\n" + content + "```";
  }
}

export async function responseStreamOpenAi(res: any, encoder: TextEncoder, decoder: TextDecoder) {
    const stream = new ReadableStream({
        async start(controller) {
          function onParse(event: any) {
            if (event.type === "event") {
              const data = event.data;
              // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
              if (data === "[DONE]") {
                controller.close();
                return;
              }
              try {
                const json = JSON.parse(data);
                if ((json.choices[0].finish_reason??"") === "stop") {
                  controller.close();
                  return;
                }
                if ((json.choices[0].finish_details??"") === "stop") {
                  controller.close();
                  return;
                }
                const text = json.choices[0].delta.content;
                const queue = encoder.encode(text);
                controller.enqueue(queue);
              } catch (e) {
                controller.error(e);
              }
            }
          }
    
          const parser = createParser(onParse);
          for await (const chunk of res.body as any) {
            parser.feed(decoder.decode(chunk, { stream: true }));
          }
        },
      });
    return stream;
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

