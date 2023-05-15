import { NextRequest, NextResponse } from "next/server";
import { AccessType, getServerSideConfig } from "../../config/server";
import {authAccount, checkVerifyCode, queryCount, registerAccount, sendValidCode} from "../../account/server";

const serverConfig = getServerSideConfig();

interface AccountRequest {
  action: string
  accessCode?: string
  username?: string
  password?: string
  verify?: number
}

async function error(msg: string, status: number) {
  return NextResponse.json(
      {
        error: true,
        msg,
      },
      {
        status,
      },
  );
}

async function success(accessCode: string, status: number, count: number) {
  return NextResponse.json(
      {
        error: false,
        accessCode,
        count,
      },
      {
        status,
      },
  );
}

async function query(ar: AccountRequest) {
  if (!ar.accessCode) {
    return error("用户未登录", 403);
  }
  return success(ar.accessCode, 200, await queryCount(ar.accessCode));
}

async function login(ar: AccountRequest) {
  if (!ar.username || !ar.password) {
    return error("用户名和密码不能为空", 403);
  }
  const accessCode = await authAccount(ar.username, ar.password);
  if (!accessCode) {
    return error("登录失败，用户名或密码不正确", 403);
  }
  return success(accessCode, 200, await queryCount(accessCode));
}

async function register(ar: AccountRequest) {
  if (!ar.verify) {
    return error("验证码不能为空", 403);
  }
  if (!ar.username || !ar.password) {
    return error("用户名和密码不能为空", 403);
  }
  const codeOk = await checkVerifyCode(ar.username, ar.verify);
  if (!codeOk) {
    return error("验证码校验失败", 403);
  }
  const accessCode = await registerAccount(ar.username, ar.password, serverConfig.initUserCount);
  if (!accessCode) {
    return error("用户名已被占用", 403);
  }
  return success(accessCode, 200, await queryCount(accessCode));
}

async function verify(ar: AccountRequest) {
  if (!ar.username) {
    return error("用户名不能为空", 403);
  }
  const rep = await sendValidCode(ar.username);
  return NextResponse.json(rep);
}

async function processAccount(req: NextRequest) {
  try {
    if (serverConfig.accessType != AccessType.Account) {
      return error("access type not support", 403);
    }
    const ar = await req.json() as AccountRequest;
    if (ar.action == "register") {
      return register(ar);
    } else if (ar.action == "verify") {
      return verify(ar);
    } else if (ar.action == "login") {
      return login(ar);
    } else if (ar.action == "query") {
      return query(ar);
    } else {
      return error("unknown action", 403);
    }
  } catch (e) {
    console.error("[Account] ", req.body, e);
    return error(JSON.stringify(e), 500);
  }
}

export async function POST(req: NextRequest) {
  return processAccount(req);
}

export async function GET(req: NextRequest) {
  return processAccount(req);
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
