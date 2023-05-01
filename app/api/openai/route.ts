import { NextRequest, NextResponse } from "next/server";
import { requestOpenai } from "../common";

async function makeRequest(req: NextRequest) {
  try {
    const api = await requestOpenai(req);
    const res = new NextResponse(api.body);
    res.headers.set("Content-Type", "application/json");
    res.headers.set("Cache-Control", "no-cache");
    return res;
  } catch (e) {
    console.error("[OpenAI] ", req.body, e);
    return NextResponse.json(
      {
        error: true,
        msg: JSON.stringify(e),
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(req: NextRequest) {
  return makeRequest(req);
}

export async function GET(req: NextRequest) {
  return makeRequest(req);
}

// export const runtime = "edge";

export const config = {
  runtime: "edge",
  /**
   * https://vercel.com/docs/concepts/edge-network/regions#region-list
   * disable hongkong : hkg1
   * only for vercel
   */
  regions: [
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
  ]
}

