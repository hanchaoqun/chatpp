import * as React from "react";

import styles from "./button.module.scss";

export function IconButton(props: {
  onClick?: () => void;
  icon?: JSX.Element;
  type?: "primary" | "danger";
  text?: string;
  bordered?: boolean;
  shadow?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
  reverse?: boolean;
}) {
  return (
    <button
      className={
        styles["icon-button"] +
        ` ${props.bordered && styles.border} ${props.shadow && styles.shadow} ${
          props.className ?? ""
        } clickable ${styles[props.type ?? ""]}`
      }
      onClick={props.onClick}
      title={props.title}
      disabled={props.disabled}
      role="button"
    >
      {!props.reverse && props.icon && (
        <div
          className={
            styles["icon-button-icon"] +
            ` ${props.type === "primary" && "no-dark"}`
          }
        >
          {props.icon}
        </div>
      )}

      {!props.reverse && props.text && (
        <div className={styles["icon-button-text"]}>{props.text}</div>
      )}


      {props.reverse && props.text && (
          <div className={styles["icon-button-text-rev"]}>{props.text}</div>
      )}

      {props.reverse && props.icon && (
          <div
              className={
                  styles["icon-button-icon-rev"] +
                  ` ${props.type === "primary" && "no-dark"}`
              }
          >
            {props.icon}
          </div>
      )}
    </button>
  );
}
