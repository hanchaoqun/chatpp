"use client";

import styles from "./cover.module.scss";
import { useState } from 'react';

export function Cover() {
    const [password, setPassword] = useState('');
    const [isProtected, setIsProtected] = useState(true);

    function handleSubmit(event: { preventDefault: () => void; }) {
        event.preventDefault();
        const correctPassword = '123456'; // 此处需要自行设置正确的密码
        if (password === correctPassword) {
            setIsProtected(false);
        }
    }

    return (
        <>
            {isProtected && (
                <div className={styles.cover}>
                    <h1>请输入密码：</h1>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                        <button className={styles.submitButton} type="submit">确认</button>
                    </form>
                </div>
            )}
        </>
    );
}
