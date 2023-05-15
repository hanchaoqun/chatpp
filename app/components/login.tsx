import { useRouter } from "next/navigation";
import { useState } from "react";
import Head from "next/head";
import styles from "./login.module.scss";
import { useAccessStore, AccountResponse } from "../store";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    const accessStore = useAccessStore();

    const handleLogin = async function() {
        const result = await accessStore.loginOrRegister("login", email, password);
        if (!result.error && accessStore.isLogin()) {
           setErrorMsg("登录成功");
           router.push("/");
           return;
        }
        setErrorMsg(result.msg??"登录失败");
    };

    const handleRegister = async function() {
        router.push("/register");
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Login | Next.js App</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>
            <div className={styles.form}>
                <h3>Chatpp Login</h3>
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
                <span className={styles.error}>{errorMsg}</span>
                <button className={styles.button} onClick={handleLogin}>
                    登录
                </button>
                <button className={styles.button} onClick={handleRegister}>
                    注册
                </button>
            </div>
        </div>
    );
}
