import { ModelType } from "../store";
import BotIcon from "../icons/bot.svg";
import BlackBotIcon from "../icons/black-bot.svg";
import UserIcon from "../icons/user.svg";
import GeminiIcon from "../icons/gemini.svg";


export function Avatar(props: { model?: ModelType; avatar?: string }) {
  if (props.model) {
    return (
      <div className="no-dark">
        {
          props.model?.startsWith("gpt-4")
          ? ( <BlackBotIcon className="user-avatar" /> ) 
          : (
              props.model?.startsWith("gemini") || props.model?.startsWith("claude")
              ? <GeminiIcon className="user-avatar" /> 
              : <BotIcon className="user-avatar" /> 
            )
        }
      </div>
    );
  }

  return (
    <div className="no-dark">
      <UserIcon className="user-avatar" />
    </div>
  );
}

