import { NextRequest, NextResponse } from "next/server";
import { AccessType, getServerSideConfig } from "./app/config/server";
import { queryCount, decCount } from "./app/account/server";
import md5 from "spark-md5";

export const config = {
  matcher: ["/api/openai", "/api/chat-stream"],
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
  const { pathname } = req.nextUrl;
  let count = 0;
  if (pathname === "/api/chat-stream") {
    const model = req.headers.get("model");
    if (model && model.startsWith("gpt-4")) {
      count = await decCount(accessCode, serverConfig.decGpt4UserCount)??0;
    } else {
      count = await decCount(accessCode)??0;
    }
  } else {
    count = await queryCount(accessCode)??0;
  }
  console.log("[Auth] Count:", count);
  if (count > 0) {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const accessCode = req.headers.get("access-code");
  const token = req.headers.get("token");

  console.log("[Auth] AccessType:", serverConfig.accessType);
  console.log("[Auth] AccessCode:", accessCode);
  console.log("[Auth] UserIP:", getIP(req));
  console.log("[Auth] Time:", new Date().toLocaleString());

  let authSuccess = false;
  let needInjectKey = false;
  if (serverConfig.accessType == AccessType.WeChat && (accessCode && await wechatAuth(req, accessCode))) {
    authSuccess = true;
    needInjectKey = true;
  } else if (serverConfig.accessType == AccessType.Code && (accessCode && await codeAuth(req, accessCode))) {
    authSuccess = true;
    needInjectKey = true;
  } else if (serverConfig.accessType == AccessType.Account && (accessCode && await accountAuth(req, accessCode))) {
    authSuccess = true;
    needInjectKey = true;
  } else if (serverConfig.accessType == AccessType.Token && token) {
    authSuccess = true;
    needInjectKey = false;
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

  if (needInjectKey) {
    const apiKey = serverConfig.apiKey;
    if (apiKey) {
      console.log("[Auth] Set system token");
      req.headers.set("token", apiKey);
    } else {
      return NextResponse.json(
        {
          error: true,
          msg: "Empty Api Key",
        },
        {
          status: 401,
        },
      );
    }
  }

  return NextResponse.next({
    request: {
      headers: req.headers,
    },
  });
}
