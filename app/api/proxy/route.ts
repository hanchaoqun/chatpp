import { NextRequest, NextResponse } from "next/server";
import { UserCount, queryCountAndDays, decCount } from "../../account/server";

const OPENAI_API = 'https://api.openai.com';

async function makeRequest(req: NextRequest) {
  try {
    const pathname = req.headers.get("API-Name")??"";
    if (pathname === "") {
        return NextResponse.json(
            {
              error: true,
              msg: "API-Name not found!",
            },
            {
              status: 404,
            },
        );
    }
    const newheaders = new Headers(req.headers);
    newheaders.delete("ChatPP-PathName");
    const accessCode = newheaders.get("Authorization")?.replace(/^Bearer sk-/, '')??"";
    const usercnt = await queryCountAndDays(accessCode);
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

    newheaders.set("Authorization",`Bearer ${process.env.OPENAI_API_KEY}`);
    newheaders.set("OpenAI-Organization", `${process.env.OPENAI_ORG_ID}`);
  
    const response = fetch(`${OPENAI_API}${pathname}`, {
      headers: newheaders,
      method: req.method,
      body: req.body,
    });
  
    return response;
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