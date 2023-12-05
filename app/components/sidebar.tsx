import { useEffect, useMemo, useRef, useState } from "react";

import styles from "./home.module.scss";

import { IconButton } from "./button";
import SettingsIcon from "../icons/settings.svg";
import ChatGptIcon from "../icons/chatgpt.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import LogoutIcon from "../icons/logout.svg";
import PayIcon from "../icons/pay.svg";
import { UserCount, AccessType, useAccessStore } from "../store";

import Locale from "../locales";

import { useAppConfig, useChatStore } from "../store";

import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  NARROW_SIDEBAR_WIDTH,
  Path,
} from "../constant";

import { Link, useNavigate } from "react-router-dom";
import { useMobileScreen } from "../utils";
import dynamic from "next/dynamic";
import { redirect, useRouter } from "next/navigation";

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => null,
});

function useDragSideBar() {
  const limit = (x: number) => Math.min(MAX_SIDEBAR_WIDTH, x);

  const config = useAppConfig();
  const startX = useRef(0);
  const startDragWidth = useRef(config.sidebarWidth ?? 300);
  const lastUpdateTime = useRef(Date.now());

  const handleMouseMove = useRef((e: MouseEvent) => {
    if (Date.now() < lastUpdateTime.current + 50) {
      return;
    }
    lastUpdateTime.current = Date.now();
    const d = e.clientX - startX.current;
    const nextWidth = limit(startDragWidth.current + d);
    config.update((config) => (config.sidebarWidth = nextWidth));
  });

  const handleMouseUp = useRef(() => {
    startDragWidth.current = config.sidebarWidth ?? 300;
    window.removeEventListener("mousemove", handleMouseMove.current);
    window.removeEventListener("mouseup", handleMouseUp.current);
  });

  const onDragMouseDown = (e: MouseEvent) => {
    startX.current = e.clientX;

    window.addEventListener("mousemove", handleMouseMove.current);
    window.addEventListener("mouseup", handleMouseUp.current);
  };
  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth < MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const barWidth = shouldNarrow
      ? NARROW_SIDEBAR_WIDTH
      : limit(config.sidebarWidth ?? 300);
    const sideBarWidth = isMobileScreen ? "100vw" : `${barWidth}px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return {
    onDragMouseDown,
    shouldNarrow,
  };
}


export function SideBar(props: { className?: string }) {
  const chatStore = useChatStore();
  const accessStore = useAccessStore.getState();
  const username = accessStore.username;
  const [userCount, setUserCount] = useState<UserCount>();
  const router = useRouter();
  useEffect(() => {
    setUserCount(accessStore.userCount);
  }, [accessStore.userCount]);

  useEffect(() => {
    if (!accessStore.isLogin()) {
      router.push("/login");
    }
    accessStore.fetchUserCount()
      .then((count) => {
        setUserCount(count);
        accessStore.updateUserCount(count);
      });
  }, []);

  const getAccessType = useMemo(
    () => accessStore.getAccessType(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // drag side bar
  const { onDragMouseDown, shouldNarrow } = useDragSideBar();
  const navigate = useNavigate();

  const logout = function () {
    accessStore.updateCode("");
    router.push("/login");
  }

  const charge = function () {
    router.push("/charge");
  }

  const refreshPoints = function () {
    accessStore.fetchUserCount()
      .then((count) => {
        setUserCount(count);
        accessStore.updateUserCount(count);
      });
  }

  return (
    <div
      className={`${styles.sidebar} ${props.className} ${shouldNarrow && styles["narrow-sidebar"]
        }`}
    >
      <div className={styles["sidebar-header"]}>
        <div className={styles["sidebar-title"]}>ChatGPT</div>
        <div className={styles["sidebar-sub-title"]}>
          Powered by OpenAI
        </div>
        <div className={styles["sidebar-logo"] + " no-dark"}>
          <ChatGptIcon />
        </div>
      </div>

      {getAccessType == AccessType.Account ? (
        <div className={styles["sidebar-userinfo"]}>
          <div className={styles["sidebar-userinfo-actions"]}>
            <div className={styles["sidebar-userinfo-action"]}>
              <IconButton
                reverse={true}
                icon={<LogoutIcon />}
                text={shouldNarrow ? undefined : "LOGOUT"}
                onClick={() => { logout() }}
                shadow
              />
            </div>
          </div>
          <div className={styles["sidebar-userinfo-action"]}>
            <IconButton
              reverse={true}
              icon={<PayIcon />}
              text={shouldNarrow ? undefined : "QUOTA [" + userCount?.points + "]"}
              onClick={() => { refreshPoints() }}
              shadow
            />
          </div>
        </div>
      ) : (
        <></>
      )}

      <div
        className={styles["sidebar-body"]}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            navigate(Path.Home);
          }
        }}
      >
        <ChatList narrow={shouldNarrow} />
      </div>

      <div className={styles["sidebar-tail"]}>
        <div className={styles["sidebar-actions"]}>
          <div className={styles["sidebar-action"] + " " + styles.mobile}>
            <IconButton
              icon={<CloseIcon />}
              onClick={() => navigate(Path.Chat)}
            />
          </div>
          <div className={styles["sidebar-action"]}>
            <Link to={Path.Settings}>
              <IconButton icon={<SettingsIcon />} shadow />
            </Link>
          </div>
        </div>
        <div>
          <IconButton
            icon={<AddIcon />}
            text={shouldNarrow ? undefined : Locale.Home.NewChat}
            onClick={() => {
              chatStore.newSession();
              //navigate(Path.Chat);
            }}
            shadow
          />
        </div>
      </div>

      <div
        className={styles["sidebar-drag"]}
        onMouseDown={(e) => onDragMouseDown(e as any)}
      ></div>
    </div >
  );
}
