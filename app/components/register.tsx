import Head from "next/head";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./register.module.scss";
import { useAccessStore, AccountResponse } from "../store";

export default function Register() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [verifyCode, setVerifyCode] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const router = useRouter();

    const accessStore = useAccessStore();

    // 验证提交的数据
    const validate = async (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        const emailPattern = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/;
        const emailValid = emailPattern.test(email);

        if (!emailValid) {
            setErrorMsg("请输入有效的邮箱地址");
        } else if (password.length < 6) {
            setErrorMsg("密码长度至少 6 位");
        } else if (password !== confirmPassword) {
            setErrorMsg("两次输入的密码不相同");
        } else {
            const result = await accessStore.loginOrRegister("register", email, password, parseInt(verifyCode, 10));
            if (!result.error && accessStore.isLogin()) {
                setErrorMsg("注册成功，请返回登录");
                return;
            }
            setErrorMsg(result.msg ?? "注册失败");
        }
    };

    const sendVerifyCode = async (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        const emailPattern = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/;
        const emailValid = emailPattern.test(email);
        if (!emailValid) {
            setErrorMsg("请输入有效的邮箱地址");
            return;
        }
        const result = await accessStore.sendVerifyCode(email);
        if (result.error) {
            if (result.exists) {
                setErrorMsg("该邮箱已注册");
            } else if (result.expire > 0) {
                setErrorMsg(`请等待且检查邮箱邮件，或者 ${result.expire} 秒后重试`);
            } else {
                setErrorMsg(`发送失败，请检查邮箱或网络`);
            }
            return;
        }
        setErrorMsg("发送成功，请登录邮箱查收");
    };

    const redirectToLogin = (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        router.push('/login');
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Register | Next.js App</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>
            <div className={styles.form}>
                <h3>ChatPP Register</h3>
                <input
                    className={styles.input}
                    type="text"
                    placeholder="邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    className={styles.input}
                    type="password"
                    placeholder="密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <input
                    className={styles.input}
                    type="password"
                    placeholder="确认密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <div className={styles["sub-form"]}>
                    <input
                        className={`${styles.input} ${styles["input-sub"]}`}
                        type="text"
                        placeholder="验证码"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value)}
                    />
                    <button className={`${styles.button} ${styles["button-sub"]}`} onClick={sendVerifyCode}>
                        发送
                    </button>
                </div>
                <span className={styles.error}>{errorMsg}</span>
                <button className={styles.button} onClick={validate}>
                    注册
                </button>
                <button className={styles.button} onClick={redirectToLogin}>
                    返回
                </button>
            </div>
        </div>
    );
}
