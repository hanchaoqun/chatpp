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
            setErrorMsg("Please enter a valid email address");
        } else if (password.length < 6) {
            setErrorMsg("Password must be at least 6 characters");
        } else if (password !== confirmPassword) {
            setErrorMsg("Passwords entered twice are different");
        } else {
            const result = await accessStore.loginOrRegister("register", email, password, parseInt(verifyCode, 10));
            if (!result.error && accessStore.isLogin()) {
                setErrorMsg("Successfully, please return to login");
                return;
            }
            setErrorMsg(result.msg ?? "Registration failed");
        }
    };

    const sendVerifyCode = async (e: { preventDefault: () => void; }) => {
        e.preventDefault();
        const emailPattern = /^[\w-]+(\.[\w-]+)*@[\w-]+(\.[\w-]+)+$/;
        const emailValid = emailPattern.test(email);
        if (!emailValid) {
            setErrorMsg("Please enter a valid email address");
            return;
        }
        const result = await accessStore.sendVerifyCode(email);
        if (result.error) {
            if (result.exists) {
                setErrorMsg("Email is already registered, please return to login");
            } else if (result.expire > 0) {
                setErrorMsg(`Didn't see the email, maybe in the trash? Or try again after ${result.expire} seconds`);
            } else {
                setErrorMsg(`Failed to send, please check email or network`);
            }
            return;
        }
        setErrorMsg("Sent successfully, please login to your email to check");
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
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    className={styles.input}
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <input
                    className={styles.input}
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <div className={styles["sub-form"]}>
                    <input
                        className={`${styles.input} ${styles["input-sub"]}`}
                        type="text"
                        placeholder="Verification code"
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value)}
                    />
                    <button className={`${styles.button} ${styles["button-sub"]}`} onClick={sendVerifyCode}>
                        Send
                    </button>
                </div>
                <span className={styles.error}>{errorMsg}</span>
                <button className={styles.button} onClick={validate}>
                    Register
                </button>
                <button className={styles.button} onClick={redirectToLogin}>
                    Return
                </button>
            </div>
        </div>
    );
}
