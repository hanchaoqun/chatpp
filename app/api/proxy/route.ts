import { NextRequest, NextResponse } from "next/server";
import { UserCount, queryCountAndDays, decCount } from "../../account/server";

const OPENAI_API = 'https://api.openai.com';

async function makeRequest(req: NextRequest) {
  try {
    const pathname = req.headers.get("API-Path")??"";
    if (pathname === "") {
        return NextResponse.json(
            {
              error: true,
              msg: "API-Path not found!",
            },
            {
              status: 404,
            },
        );
    }
    let accessCode = req.headers.get("API-Token")?.trim().replace(/^Bearer sk-/, '')??"";
    if (accessCode === "") {
        accessCode = req.headers.get("Authorization")?.trim().replace(/^Bearer sk-/, '')??"";
    }
    if (accessCode === "") {
        return NextResponse.json(
            {
              error: true,
              msg: "API-Token not found!",
            },
            {
              status: 404,
            },
        );
    }

    const newheaders = new Headers(req.headers);
    const usercnt = await queryCountAndDays(accessCode);

    console.log("[PROXY] Request:", OPENAI_API, pathname, accessCode, usercnt);

    if (usercnt.usertype < 3 || usercnt.points <= 0) {
      return NextResponse.json(
        {
          error: true,
          msg: "Auth failed!",
        },
        {
          status: 401,
        },
      );
    }
    await decCount(accessCode, 20);

    newheaders.delete("API-Path");
    newheaders.delete("API-Token");
    newheaders.set("Authorization",`Bearer ${process.env.OPENAI_API_KEY}`);
    newheaders.set("OpenAI-Organization", `${process.env.OPENAI_ORG_ID}`);
  
    const response = await fetch(`${OPENAI_API}${pathname}`, {
      headers: newheaders,
      method: req.method,
      body: req.body,
    });

    const res = new NextResponse(response.body);
    res.headers.set("Content-Type", "application/json");
    res.headers.set("Cache-Control", "no-cache");
    return res;
  } catch (e) {
    return NextResponse.json(
      {
        error: true,
        msg: "ERROR: Fetch error!\n" + JSON.stringify(e),
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


export const runtime = "edge";

/**
 * https://vercel.com/docs/concepts/edge-network/regions#region-list
 * disable hongkong : hkg1
 * only for vercel
 */
export const preferredRegion =
  [
      //"arn1",
      "bom1",
      // "bru1",
      //"cdg1",
      "cle1",
      "cpt1",
      //"dub1",
      //"fra1",
      "gru1",
      "hnd1",
      "iad1",
      "icn1",
      "kix1",
      //"lhr1",
      "pdx1",
      "sfo1",
      "sin1",
      "syd1"
  ];
