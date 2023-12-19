import { NextRequest } from "next/server";
import { request, responseStream, checkResponseStream } from "../llm/sdk";
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
}

async function createStream(req: NextRequest) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const model = req.headers.get("model");
  const accessCode = req.headers.get("access-code");

  const res = await request(model??"", req, true);

  const errorMsg = await checkResponseStream(model??"", res, true);

  if (errorMsg) {
    return errorMsg;
  }

  await decAccountCount(model??"", accessCode??"");

  const stream = await responseStream(model??"", res, encoder, decoder);
  return stream;
}

export async function POST(req: NextRequest) {
  try {
    const stream = await createStream(req);
    return new Response(stream);
  } catch (error) {
    return new Response(
        ["```json\n ERROR: Fetch error!\n", JSON.stringify(error, null, "  "), "\n```"].join(""),
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


