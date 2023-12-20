import { NextRequest, NextResponse } from "next/server";
import querystring from 'querystring'

interface CodeReq {
    code: string
}

interface AccessTokenResponse {
    openid: string
    access_token: string
}

interface UserInfoResponse {
    openid: string
    nickname: string
    sex: number
    province: string
    city: string
    country: string
    headimgurl: string
    unionid?: string
    errcode?: string
    errmsg?: string
}

export async function POST(req: NextRequest) {
    if (req.method === 'POST') {

        const body = req.body as ReadableStream<Uint8Array>;
        const chunks: Uint8Array[] = [];
        const reader = body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const dataCode = Buffer.concat(chunks);

        const { code } = JSON.parse(dataCode.toString()) as CodeReq;
        // 构建请求参数
        const appId = process.env.LOGIN_APP_ID;
        const appSecret = process.env.LOGIN_APP_SECRET;

        const params = {
            appid: appId,
            secret: appSecret,
            code: code,
            grant_type: 'authorization_code',
        }

        // 将请求参数作为查询字符串拼接到 URL 中
        const url = `https://api.weixin.qq.com/sns/oauth2/access_token?${querystring.stringify(
            params
        )}`

        // 发送请求并解析响应
        const response = await fetch(url)
        const data: AccessTokenResponse = await response.json()
        const { openid, access_token } = data

        // 构建获取用户信息的请求参数
        const userParams = {
            access_token: access_token,
            openid: openid,
            lang: 'zh_CN',
        }

        // 拼接获取用户信息的请求 URL
        const userUrl = `https://api.weixin.qq.com/sns/userinfo?${querystring.stringify(
            userParams
        )}`

        // 发送获取用户信息的请求并解析响应
        const userResponse = await fetch(userUrl)
        const userData: UserInfoResponse = await userResponse.json()

        if (userData.errcode) {
            return NextResponse.json({ message: userData.errmsg || '获取用户信息失败' })
        } else {
            return NextResponse.json(userData)
        }
    } else {
        return NextResponse.json({ message: '该 API 仅支持 POST 请求' })
    }
}
