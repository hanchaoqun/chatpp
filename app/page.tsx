"use client";

import { Analytics } from "@vercel/analytics/react";
import { Home } from "./components/home";
import { getServerSideConfig } from "./config/server";
import { useEffect } from "react";
import { useAccessStore } from "./store/access";
import { redirect } from 'next/navigation';


const serverConfig = getServerSideConfig();

export default function App() {

  useEffect(() => {
    const accessStore = useAccessStore.getState();
    if (!accessStore.isLogin()) {
      redirect("/login");
    }
  }, []);

  return (
    <>
      {<Home />}
      {serverConfig?.isVercel && <Analytics />}
    </>
  );
}
