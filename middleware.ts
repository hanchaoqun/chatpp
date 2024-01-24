import { NextRequest, NextResponse } from "next/server";
import { AccessType, getServerSideConfig } from "./app/config/server";
import { UserCount, queryCountAndDays, decCount } from "./app/account/server";
import md5 from "spark-md5";

export const config = {
  matcher: ["/api/chat", "/api/chat-stream", "/api/proxy", "/v1/(.*)"],
};

const serverConfig = getServerSideConfig();

const OPENAI_API = 'https://api.openai.com';

async function direct(req: NextRequest) {
  try {
    let accessCode = req.headers.get("Authorization")?.trim().replace(/^Bearer sk-/, '')??"";
    if (accessCode === "") {
        return NextResponse.json(
            {
              error: true,
              msg: "Authorization not found!",
            },
            {
              status: 404,
            },
        );
    }
    const pathname   = req.nextUrl.pathname;
    const newheaders = new Headers(req.headers);
    const usercnt    = await queryCountAndDays(accessCode);

    console.log("[DIRECT-PROXY] Request:", OPENAI_API, pathname, accessCode, usercnt);

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
  
    const response = await fetch(`${OPENAI_API}${pathname}`, {
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

async function proxy(req: NextRequest) {
  const hostname = req.headers.get('host');
  const newheaders = new Headers(req.headers);

  newheaders.set("API-Path",`${req.nextUrl.pathname}`);

  const response = fetch(`https://${hostname}/api/proxy`, {
    headers: newheaders,
    method: req.method,
    body: req.body,
  });
  
  return response;
}


function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

async function wechatAuth(req: NextRequest, accessCode: string) {
  // todo: check wechat openid with kv database
  return true;
}

async function codeAuth(req: NextRequest, accessCode: string) {
  const hashedCode = md5.hash(accessCode ?? "").trim();
  return serverConfig.codes.has(hashedCode);
}

async function accountAuth(req: NextRequest, accessCode: string) {
  const model = req.headers.get("model") ?? "";
  let usercnt = await queryCountAndDays(accessCode);
  console.log("[Auth]:", getIP(req), accessCode, usercnt);
  if (model && model.startsWith("gpt-4")) {
    if (usercnt.daysplus > 0) {
      req.headers.set("calctype", "daysplus");
      return true;
    }
    if (usercnt.points > 0) {
      req.headers.set("calctype", "points");
      return true;
    }
    return false;
  }
  if (usercnt.daysplus > 0) {
    req.headers.set("calctype", "daysplus");
    return true;
  }
  if (usercnt.days > 0) {
    req.headers.set("calctype", "days");
    return true;
  }
  if (usercnt.points > 0) {
    req.headers.set("calctype", "points");
    return true;
  }
  return false;
}


export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host');
  const pathname = req.nextUrl.pathname;

  if (hostname === 'api.chatpp.org') {
    if (pathname.startsWith('/v1/')) {
      return direct(req);
    } else if (pathname.startsWith('/api/proxy')) {
      return NextResponse.next();
    } else {
      return NextResponse.json(
        {
          error: true,
          msg: "Page not found!",
        },
        {
          status: 404,
        },
      );
    }
  }

  const accessCode = req.headers.get("access-code");
  const token = req.headers.get("token");

  let authSuccess = false;
  if (serverConfig.accessType == AccessType.WeChat && (accessCode && await wechatAuth(req, accessCode))) {
    authSuccess = true;
  } else if (serverConfig.accessType == AccessType.Code && (accessCode && await codeAuth(req, accessCode))) {
    authSuccess = true;
  } else if (serverConfig.accessType == AccessType.Account && (accessCode && await accountAuth(req, accessCode))) {
    authSuccess = true;
  } else if (serverConfig.accessType == AccessType.Token && token) {
    authSuccess = true;
  } else {
    return NextResponse.json(
      {
        error: true,
        msg: "Auth failed",
      },
      {
        status: 401,
      },
    );
  }

  if (!authSuccess) {
    return NextResponse.json(
      {
        error: true,
        msg: "Auth is required.",
      },
      {
        status: 401,
      },
    );
  }


  return NextResponse.next({
    request: {
      headers: req.headers,
    },
  });
}

export const runtime = "experimental-edge";

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
