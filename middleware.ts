import { NextRequest, NextResponse } from "next/server";
import { AccessType, getServerSideConfig } from "./app/config/server";
import { UserCount, queryCountAndDays, decCount } from "./app/account/server";
import md5 from "spark-md5";

export const config = {
  matcher: ["/api/chat", "/api/chat-stream", "/v1/(.*)"],
};

const serverConfig = getServerSideConfig();

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

const OPENAI_API = 'https://api.openai.com';
const OPENAI_API_DEBUG = true;

async function proxy(req: NextRequest) {
  const hosturl = OPENAI_API;
  const pathname = req.nextUrl.pathname;
  const headers = new Headers(req.headers);
  const accessCode = headers.get("Authorization")?.replace(/^Bearer sk-/, '');
  const usercnt = await queryCountAndDays(accessCode);
  if (usercnt.userType < 3 && usercnt.points <= 0) {
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

  headers.set("Authorization",`Bearer ${process.env.OPENAI_API_KEY}`);
  headers.set("OpenAI-Organization", `${process.env.OPENAI_ORG_ID}`);

  const response = fetch(`${hosturl}${pathname}`, {
    headers: {
      ...headers,
    },
    method: req.method,
    body: req.body,
  });

  return response;
}

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get('host');
  const pathname = req.nextUrl.pathname;
  if (OPENAI_API_DEBUG || hostname === 'api.chatpp.org') {
    if (pathname.startsWith('/v1/')) {
      return proxy(req);
    }
    return NextResponse.json(
      {
        error: true,
        msg: "Error Request!",
      },
      {
        status: 404,
      },
    );
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
