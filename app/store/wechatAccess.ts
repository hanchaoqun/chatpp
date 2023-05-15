import { redirect } from 'next/navigation';
import { useAccessStore, AccessType } from "./access";

function getBaseUrl() {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    // todo: make it possible to test with localhost??
    const baseUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;
    return baseUrl;
}

export default function getcode() {
    // 构造微信登录链接
    const appId = "wxcbca0560767325da";
    const baseUrl = getBaseUrl();
    const redirectUri = `${baseUrl}/login/callback`;
    return `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_login&state=wechat_login_chatpp#wechat_redirect`
}

export function checkLogin() {
    const accessStore = useAccessStore.getState();
    const accessType = accessStore.accessType;
    const wechatData = accessStore.wechatData;
    if (accessType == AccessType.WeChat && wechatData.openid != "") {
        window.alert("欢迎：" + wechatData.nickname);
    } else {
        redirect("/login");
    }
}