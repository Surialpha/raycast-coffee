import { showToast, Toast } from "@raycast/api";
import { startCaffeinate } from "./utils";

interface Arguments {
  hours: string;
  minutes: string;
  seconds: string;
}

export default async function Command(props: { arguments: Arguments }) {
  const { hours, minutes, seconds } = props.arguments;
  const hasValue = hours || minutes || seconds;

  if (!hasValue) {
    await showToast(Toast.Style.Failure, "⏱️ No values set for caffeinate duration");
    return;
  }

  const validInput =
    (!hours || (Number.isInteger(Number(hours)) && Number(hours) >= 0)) &&
    (!minutes || (Number.isInteger(Number(minutes)) && Number(minutes) >= 0)) &&
    (!seconds || (Number.isInteger(Number(seconds)) && Number(seconds) >= 0));

  if (!validInput) {
    await showToast(Toast.Style.Failure, "🔢 Please ensure all arguments are whole numbers");
    return;
  }

  const totalSeconds = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  const formattedTime = `${hours ? `${hours}h` : ""}${minutes ? `${minutes}m` : ""}${seconds ? `${seconds}s` : ""}`;

  const caffeinationInfo = {
    type: "timed" as const,
    startTime: Date.now(),
    endTime: Date.now() + totalSeconds * 1000,
    duration: totalSeconds,
  };

  await startCaffeinate(
    { menubar: true, status: true },
    `☕ Caffeinating your computer for ${formattedTime}`,
    `-t ${totalSeconds}`,
    caffeinationInfo
  );
}
