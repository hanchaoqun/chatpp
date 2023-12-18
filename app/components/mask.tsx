import { IconButton } from "./button";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";

import { DEFAULT_MASK_AVATAR, Mask, Updater } from "../store/mask";
import { ModelConfig, ROLES } from "../store";
import { Message } from "../api/type/typing";
import { Input, List } from "./ui-lib";
import { Avatar } from "./emoji";
import Locale from "../locales";


import chatStyle from "./chat.module.scss";
import { ModelConfigList } from "./model-config";

export function MaskAvatar(props: { mask: Mask }) {
  return props.mask.avatar !== DEFAULT_MASK_AVATAR ? (
    <Avatar avatar={props.mask.avatar} />
  ) : (
    <Avatar model={props.mask.modelConfig.model} />
  );
}

export function MaskConfig(props: {
  mask: Mask;
  updateMask: Updater<Mask>;
  extraListItems?: JSX.Element;
  readonly?: boolean;
}) {

  const updateConfig = (updater: (config: ModelConfig) => void) => {
    if (props.readonly) return;

    const config = { ...props.mask.modelConfig };
    updater(config);
    props.updateMask((mask) => (mask.modelConfig = config));
  };

  return (
    <>
      <ContextPrompts
        context={props.mask.context}
        updateContext={(updater) => {
          const context = props.mask.context.slice();
          updater(context);
          props.updateMask((mask) => (mask.context = context));
        }}
      />

      <List>
        <ModelConfigList
          modelConfig={{ ...props.mask.modelConfig }}
          updateConfig={updateConfig}
        />
        {props.extraListItems}
      </List>
    </>
  );
}

export function ContextPrompts(props: {
  context: Message[];
  updateContext: (updater: (context: Message[]) => void) => void;
}) {
  const context = props.context;

  const addContextPrompt = (prompt: Message) => {
    props.updateContext((context) => context.push(prompt));
  };

  const removeContextPrompt = (i: number) => {
    props.updateContext((context) => context.splice(i, 1));
  };

  const updateContextPrompt = (i: number, prompt: Message) => {
    props.updateContext((context) => (context[i] = prompt));
  };

  return (
    <>
      <div className={chatStyle["context-prompt"]} style={{ marginBottom: 20 }}>
        {context.map((c, i) => (
          <div className={chatStyle["context-prompt-row"]} key={i}>
            <select
              value={c.role}
              className={chatStyle["context-role"]}
              onChange={(e) =>
                updateContextPrompt(i, {
                  ...c,
                  role: e.target.value as any,
                })
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Input
              value={c.content}
              type="text"
              className={chatStyle["context-content"]}
              rows={1}
              onInput={(e) =>
                updateContextPrompt(i, {
                  ...c,
                  content: e.currentTarget.value as any,
                })
              }
            />
            <IconButton
              icon={<DeleteIcon />}
              className={chatStyle["context-delete-button"]}
              onClick={() => removeContextPrompt(i)}
              bordered
            />
          </div>
        ))}

        <div className={chatStyle["context-prompt-row"]}>
          <IconButton
            icon={<AddIcon />}
            text={Locale.Context.Add}
            bordered
            className={chatStyle["context-prompt-button"]}
            onClick={() =>
              addContextPrompt({
                role: "system",
                content: "",
                date: "",
                tokens: 0,
              })
            }
          />
        </div>
      </div>
    </>
  );
}

