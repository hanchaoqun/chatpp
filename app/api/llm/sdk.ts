import { NextRequest, NextResponse } from "next/server";
import { requestOpenAi, responseStreamOpenAi } from "./openai";
import { requestGemini, responseStreamGemini } from "./gemini";


export async function request(model: string, req: NextRequest, stream: boolean) {
    if (model.startsWith("gpt")) {
        return await requestOpenAi(req, stream);
    }
    if (model.startsWith("gemini")) {
        return await requestGemini(req, stream);
    }
    return await requestOpenAi(req, stream);
}

export async function responseStream(model: string, res: any, encoder: TextEncoder, decoder: TextDecoder) {
    if (model.startsWith("gpt")) {
        return await responseStreamOpenAi(res, encoder, decoder);
    }
    if (model.startsWith("gemini")) {
        return await responseStreamGemini(res, encoder, decoder);
    }
    return await responseStreamOpenAi(res, encoder, decoder);
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
