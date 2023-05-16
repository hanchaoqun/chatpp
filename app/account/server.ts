import md5 from "spark-md5";
import kv from "@vercel/kv";

const USER_ACCOUNT = "USER_ACCOUNT";
const USER_COUNT = "USER_COUNT";
const USER_VALID = "USER_VALID";
const USER_VALID_TIMEOUT = 60 * 7;

const EMAIL_API_KEY = process.env.EMAIL_API_KEY;

export function generateRandomSixDigitNumber() {
    const min = 100000;
    const max = 999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function checkVerifyCode(username: string, verify: number) {
    const key = USER_VALID.concat(username);
    const code = await kv.get<number>(key);
    console.log("[Verify] Code:", username, code, verify);
    return (code && verify === code);
}

export async function registerAccount(username: string, password: string, initCount: number) {
    const queryCode = await queryAccessCode(username);
    if (!queryCode || queryCode.length <= 0) {
        const accessCode = md5.hash(username + password);
        const ok = await kv.hsetnx(USER_ACCOUNT, username, accessCode);
        if (ok) {
            await kv.hsetnx<number>(USER_COUNT, accessCode, initCount);
        }
        return ok ? accessCode : null;
    }
    return null;
}

export async function emailValidCode(username: string, code: number) {
    const email = {
        Recipients: [{ Email: username, Fields: { name: "" } }],
        Content: {
            Body: [
                { ContentType: "HTML", Charset: "utf-8", Content: `您的验证码是：<strong>${code}</strong>` },
                { ContentType: "PlainText", Charset: "utf-8", Content: `您的验证码是：${code}` },
            ],
            From: "no-replay@chatpp.chat", Subject: `[ChatPP] 验证码：${code}`
        }
    };

    console.log("[Email] Code:", username, code);

    const response = await fetch("https://api.elasticemail.com/v4/emails", {
        headers: {
            "Content-Type": "application/json",
            "X-ElasticEmail-ApiKey": `${EMAIL_API_KEY}`,
        },
        method: "POST",
        body: JSON.stringify(email),
    });

    return response.ok;
}

export async function sendValidCode(username: string) {
    let ret = { error: true, username, exists: false, expire: 0, };
    const key = USER_VALID.concat(username);
    const queryCode = await queryAccessCode(username);
    if (queryCode && queryCode.length > 0) {
        ret.exists = true;
        return ret;
    }
    const expire = await kv.ttl(key);
    if (expire > 0) {
        ret.expire = expire;
        return ret;
    }

    const code = generateRandomSixDigitNumber();
    await kv.setex(key, USER_VALID_TIMEOUT, code);

    if (!(await emailValidCode(username, code))) {
        return ret;
    }

    ret.error = false;
    ret.expire = USER_VALID_TIMEOUT;
    return ret;
}

export async function authAccount(username: string, password: string) {
    const queryCode = await queryAccessCode(username);
    if (queryCode && queryCode.length > 0) {
        const accessCode = md5.hash(username + password);
        if (accessCode === queryCode) {
            return accessCode;
        }
    }
    return null;
}

export async function queryCount(accessCode: string) {
    if (!accessCode || accessCode.length <= 0) {
        return 0;
    }
    const userCount = await kv.hget<number>(USER_COUNT, accessCode);
    if (userCount && userCount < 0) {
        return 0;
    }
    return userCount ?? 0;
}

export async function decCount(accessCode: string, num: number = 1) {
    if (!accessCode || accessCode.length <= 0) {
        return 0;
    }
    const userCount = await kv.hget<number>(USER_COUNT, accessCode);
    if (userCount) {
        if (userCount >= num) {
           await kv.hincrby(USER_COUNT, accessCode, -1 * num);
        } else if (userCount > 0) {
           await kv.hincrby(USER_COUNT, accessCode, -1 * userCount);
        }
    }
    // always return the old value!!!
    return userCount;
}

export async function queryAccessCode(username: string) {
    if (!username || username.length <= 0) {
        return null;
    }
    return await kv.hget<string>(USER_ACCOUNT, username);
}
