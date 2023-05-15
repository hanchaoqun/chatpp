"use client"
import { useRouter } from "next/navigation";
import { useSearchParams } from 'next/navigation';
import { useEffect } from "react";
import { useAccessStore } from "../../store";

export default function Callback() {
    const router = useRouter();

    // 获取微信授权回调地址的参数
    const searchParams = useSearchParams();
    const code = searchParams?.get('code');
    const accessStore = useAccessStore();
    // 查询 access_token
    useEffect(() => {
        fetch('/api/wechat', {
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
        })
            .then(res => res.json())
            .then(data => {
                accessStore.updateWeChatData(data);
                router.push("/")
            });
    }, [])

    return (
        <div>
            <p>正在进行微信授权登录，请稍候...</p>
        </div>
    );
}