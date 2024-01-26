import { NextRequest, NextResponse } from "next/server";
import { requestOpenAi, responseStreamOpenAi, checkResponseStreamOpenAi } from "./openai";
import { requestGemini, responseStreamGemini, checkResponseStreamGemini } from "./gemini";

export async function request(model: string, req: NextRequest, stream: boolean) {
    if (model.startsWith("gpt")) {
        return await requestOpenAi(req, stream);
    }
    if (model.startsWith("gemini")) {
        return await requestGemini(req, stream);
    }
    return new Response(
        ["```json\nERROR: Model : ", model, " not support!\n```"].join(""),
    );
}

export async function checkResponseStream(model: string, res: Response, stream: boolean) {
    if (model.startsWith("gpt")) {
        return await checkResponseStreamOpenAi(res, stream);
    }
    if (model.startsWith("gemini")) {
        return await checkResponseStreamGemini(res, stream);
    }
    return new Response(
        ["```json\nERROR: Model : ", model, " not support!\n```"].join(""),
    );
}

export async function responseStream(model: string, res: any, encoder: TextEncoder, decoder: TextDecoder) {
    if (model.startsWith("gpt")) {
        return await responseStreamOpenAi(res, encoder, decoder);
    }
    if (model.startsWith("gemini")) {
        return await responseStreamGemini(res, encoder, decoder);
    }
    return new Response(
        ["```json\nERROR: Model : ", model, " not support!\n```"].join(""),
    );
}

