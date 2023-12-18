import { NextRequest, NextResponse } from "next/server";
import { requestOpenAi, responseStreamOpenAi  } from "./openai";


export async function request(model: string, req: NextRequest, stream: boolean) {
    if (model.startsWith("gpt")) {
        return await requestOpenAi(req, stream);
    }
    return await requestOpenAi(req, stream);
}

export async function responseStream(model: string, res: any, encoder: TextEncoder, decoder: TextDecoder) {
    if (model.startsWith("gpt")) {
        return await responseStreamOpenAi(res, encoder, decoder);
    }
    return await responseStreamOpenAi(res, encoder, decoder);
}