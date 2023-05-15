import md5 from "spark-md5";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY?: string;
      CODE?: string;
      ACCESS_TYPE?: number;
      PROXY_URL?: string;
      VERCEL?: string;
      INIT_USER_COUNT?: number;
      DEC_GPT4_USER_COUNT?: number;
      EMAIL_API_KEY?: string;
    }
  }
}

export enum AccessType {
  WeChat,
  Code,
  Token,
  Account,
}

const ACCESS_CODES = (function getAccessCodes(): Set<string> {
  const code = process.env.CODE;

  try {
    const codes = (code?.split(",") ?? [])
      .filter((v) => !!v)
      .map((v) => md5.hash(v.trim()));
    return new Set(codes);
  } catch (e) {
    return new Set();
  }
})();

const ACCESS_TYPE = process.env.ACCESS_TYPE?? AccessType.Account
const INIT_USER_COUNT = process.env.INIT_USER_COUNT?? 100;
const DEC_GPT4_USER_COUNT = process.env.DEC_GPT4_USER_COUNT?? 20;

export const getServerSideConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }

  return {
    apiKey: process.env.OPENAI_API_KEY,
    code: process.env.CODE,
    codes: ACCESS_CODES,
    accessType: ACCESS_TYPE,
    proxyUrl: process.env.PROXY_URL,
    isVercel: !!process.env.VERCEL,
    initUserCount: INIT_USER_COUNT,
    decGpt4UserCount: DEC_GPT4_USER_COUNT,
  };
};
