import { NextRequest } from "next/server";
import { createParser } from "eventsource-parser";
import { ChatResponse } from "../type/typing";

const OPENAI_URL = "api.openai.com";
const OPENAI_CHAT_PATH = "v1/chat/completions";
const OPENAI_CHAT_STREAM_PATH = "v1/chat/completions";
const DEFAULT_PROTOCOL = "https";
const PROTOCOL = process.env.PROTOCOL ?? DEFAULT_PROTOCOL;
const BASE_URL = process.env.BASE_URL ?? OPENAI_URL;

export async function requestOpenAi(req: NextRequest, stream: boolean) {
  const apiKey = req.headers.get("token");
  const model = req.headers.get("model");

  let baseUrl = BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `${PROTOCOL}://${baseUrl}`;
  }

  console.log("[OPENAI] Request:", baseUrl, openaiPath, model??"");

  if (process.env.OPENAI_ORG_ID) {
    console.log("[Org ID]", process.env.OPENAI_ORG_ID);
  }

  const openaiPath = (stream)? OPENAI_CHAT_STREAM_PATH : OPENAI_CHAT_PATH;
  const response = fetch(`${baseUrl}/${openaiPath}`, {
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
  return response.then(res => {
    const msg: ChatResponse = {
        role: res?.choices?.at(0)?.message?.role ?? "",
        content: res?.choices?.at(0)?.message?.content ?? "",
    };
    return new Response(msg, {
        status: 200, 
        headers: {'Content-Type': 'application/json',},
    });
  });
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
