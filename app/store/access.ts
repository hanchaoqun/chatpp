import { create } from "zustand";
import { persist } from "zustand/middleware";
import { StoreKey } from "../constant";

export interface WechatUserInfo {
  openid: string
  nickname: string
  sex?: number
  province?: string
  city?: string
  country?: string
  headimgurl?: string
  unionid?: string
  errcode?: string
  errmsg?: string
}

export interface AccountResponse {
  error: boolean,
  msg?: string,
  accessCode?: string,
  count?: number,
}

export interface VerifyResponse {
    error: boolean,
    username: string,
    exists: boolean,
    expire: number,
}

export enum AccessType {
  WeChat,
  Code,
  Token,
  Account,
}

export interface AccessControlStore {
  accessCode: string;
  token: string;
  wechatData: WechatUserInfo;
  accessType: number;
  userCount: number;
  username: string;

  updateToken: (_: string) => void;
  updateUsername: (_: string) => void;
  updateCode: (_: string) => void;
  updateUserCount: (_: number) => void;
  updateWeChatData: (_: WechatUserInfo) => void;
  getAccessType: () => number;
  fetchUserCount: () => Promise<number>;
  loginOrRegister: (action:string, username:string, password:string, verify?:number) => Promise<AccountResponse>;
  sendVerifyCode: (username:string) => Promise<VerifyResponse>;
  isNeedAccessCode: () => boolean;
  isAuthorized: () => boolean;
  isLogin: () => boolean;
  isNoFee: () => boolean;
  fetch: () => void;
}

let fetchState = 0; // 0 not fetch, 1 fetching, 2 done

export const useAccessStore = create<AccessControlStore>()(
  persist(
    (set, get) => ({
      accessCode: "",
      token: "",
      wechatData: {
        openid: "",
        nickname: "",
      },
      accessType: AccessType.Code,
      username: "",
      userCount: 0,

      getAccessType() {
        get().fetch();
        return get().accessType;
      },
      isNeedAccessCode() {
        const accessType = get().getAccessType();
        return (
          (accessType == AccessType.WeChat) ||
          (accessType == AccessType.Code) ||
          (accessType == AccessType.Account)
        );
      },
      updateCode(code: string) {
        set((state) => ({ accessCode: code }));
      },
      updateUsername(username: string) {
        set((state) => ({ username }));
      },
      updateUserCount(userCount: number) {
        set((state) => ({ userCount: userCount }));
      },
      updateToken(token: string) {
        set((state) => ({ token }));
      },
      updateWeChatData(wechatData: WechatUserInfo) {
        set((state) => ({ wechatData }));
        set((state) => ({ accessCode: wechatData.openid }));
      },
      sendVerifyCode(username:string) {
          async function asyncFetch() {
              let accountRsp : VerifyResponse = { error: true, username:"", exists: false, expire: 0, };
              try {
                  const response = await fetch("/api/account", {
                      method: 'post',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ action: "verify", username, }),
                  });
                  const res = await response.json() as VerifyResponse;
                  accountRsp = res;
              } catch (e) {
              }
              return accountRsp;
          };
          return new Promise(function (resolve, reject) {
              resolve(asyncFetch());
          });
      },
      loginOrRegister(action:string, username:string, password:string, verify?:number) {
          async function asyncFetch() {
              let accountRsp : AccountResponse = { error: true, msg: "Unknown error", };
              try {
                  const response = await fetch("/api/account", {
                      method: 'post',
                      headers: {
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ action, username, password, verify }),
                  });
                  const res = await response.json() as AccountResponse;
                  if (!res.error && !!res.accessCode) {
                      get().updateUsername(username);
                      get().updateCode(res.accessCode);
                      get().updateUserCount(res.count??0);
                      accountRsp = res;
                  } else {
                      accountRsp = { error:true, msg: res.msg, };
                  }
              } catch (e) {
              }
              return accountRsp;
          };
          return new Promise(function (resolve, reject) {
              resolve(asyncFetch());
          });
      },
      fetchUserCount() {
          async function asyncFetch() {
              const accessType = get().getAccessType();
              if (accessType != AccessType.Account || !get().isAuthorized()) {
                  return 0;
              }
              try {
                const response = await fetch("/api/account", {
                    method: 'post',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ action: "query", accessCode: get().accessCode }),
                });
                const res = await response.json();
                if (!res.error && !!res.accessCode) {
                    const count = res.count ?? 0;
                    get().updateUserCount(count);
                    // need login
                    if (!res.accessType || res.accessType != AccessType.Account) {
                        get().updateCode("");
                    }
                }
              } catch (e) {
              }
              return get().userCount;
          };
          return new Promise(function (resolve, reject) {
              resolve(asyncFetch());
          });
      },
      isNoFee() {
        const accessType = get().getAccessType();
        if (accessType != AccessType.Account) {
            return false;
        }
        return (get().userCount <= 0);
      },
      isLogin() {
        const accessType = get().getAccessType();
        if (accessType != AccessType.Account) {
            return true;
        }
        return (get().isAuthorized() && get().username.length > 0);
      },
      isAuthorized() {
        const accessType = get().getAccessType();
        return (
          (accessType == AccessType.WeChat && !!get().accessCode) ||
          (accessType == AccessType.Code && !!get().accessCode) ||
          (accessType == AccessType.Account && !!get().accessCode) ||
          (accessType == AccessType.Token && !!get().token)
        );
      },
      fetch() {
        if (fetchState > 0) return;
        fetchState = 1;
        fetch("/api/config", {
          method: "post",
          body: null,
        })
          .then((res) => res.json())
          .then((res: DangerConfig) => {
            console.log("[Config] got config from server", res);
            set(() => ({ ...res }));
          })
          .catch(() => {
            console.error("[Config] failed to fetch config");
          })
          .finally(() => {
            fetchState = 2;
          });
      },
    }),
    {
      name: StoreKey.Access,
      version: 1,
    },
  ),
);
