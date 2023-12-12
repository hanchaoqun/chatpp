import { createParser } from "eventsource-parser";
import { NextRequest } from "next/server";
import { requestOpenai } from "../common";
import { decCount } from "../../account/server";
import { getServerSideConfig } from "../../config/server";

const serverConfig = getServerSideConfig();

async function decAccountCount(model: string, accessCode: string) {
  let count = 0;
  if (model && model.startsWith("gpt-4")) {
    count = await decCount(accessCode, serverConfig.decGpt4UserCount)??0;
  } else {
    count = await decCount(accessCode)??0;
  }
  console.log("[Auth] Count:", accessCode, count, model);
}

async function createStream(req: NextRequest) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const model = req.headers.get("model");
  const accessCode = req.headers.get("access-code");

  const res = await requestOpenai(req);

  const contentType = res.headers.get("Content-Type") ?? "";
  if (!contentType.includes("stream")) {
    const content = await (
        await res.text()
    ).replace(/provided:.*. You/, "provided: ***. You");
    console.log("[Stream] error ", content);
    return "```json\n" + content + "```";
  }

  await decAccountCount(model??"", accessCode??"");

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

export async function POST(req: NextRequest) {
  try {
    const stream = await createStream(req);
    return new Response(stream);
  } catch (error) {
    console.error("[Chat Stream]", error);
    return new Response(
        ["```json\n", JSON.stringify(error, null, "  "), "\n```"].join(""),
    );
  }
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


