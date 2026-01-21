import { Color, LaunchProps, MenuBarExtra, getPreferenceValues, showHUD, Icon, launchCommand, LaunchType } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { useEffect, useState } from "react";
import { formatDuration, startCaffeinate, stopCaffeinate, isCaffeinated, getCaffeinationInfo, type CaffeinationInfo } from "./utils";

const iconMap: Record<string, { caffeinated: string; decaffeinated: string }> = {
  pot: { caffeinated: "☕", decaffeinated: "🫖" },
  mug: { caffeinated: "☕", decaffeinated: "🍵" },
  cup: { caffeinated: "☕", decaffeinated: "🥤" },
  "paper-cup": { caffeinated: "☕", decaffeinated: "🥛" },
};

function formatTimeRemaining(endTime: number): string {
  const now = Date.now();
  const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
  
  if (remaining === 0) return "ending soon";
  
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else if (minutes > 0) {
    return `${minutes}m remaining`;
  } else {
    return `${remaining}s remaining`;
  }
}

function formatEndTime(endTime: number): string {
  const date = new Date(endTime);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const displayHours = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

function getCaffeinationStatusText(info: CaffeinationInfo | null): string {
  if (!info) return "Caffeinated ☕";
  
  switch (info.type) {
    case "manual":
      return "Caffeinated ☕";
    case "timed":
      return info.endTime ? `Until ${formatTimeRemaining(info.endTime)}` : "Timed ☕";
    case "until":
      return info.endTime ? `Until ${formatEndTime(info.endTime)}` : "Scheduled ☕";
    case "while":
      return info.appName ? `While ${info.appName} runs` : "App-based ☕";
    case "scheduled":
      return "Scheduled ☕";
    default:
      return "Caffeinated ☕";
  }
}

export default function Command(props: LaunchProps) {
  const hasLaunchContext = props.launchContext?.caffeinated !== undefined;
  const preferences = getPreferenceValues<Preferences.Index>();

  const [caffeinated, setCaffeinated] = useState(hasLaunchContext ? props.launchContext?.caffeinated ?? false : false);
  const [caffeinationInfo, setCaffeinationInfo] = useState<CaffeinationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(!hasLaunchContext);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, []);

  async function checkStatus() {
    const status = await isCaffeinated();
    const info = await getCaffeinationInfo();
    
    setCaffeinated(status);
    setCaffeinationInfo(info);
    setIsLoading(false);
  }

  const handleCaffeinateStatus = async () => {
    if (caffeinated) {
      await stopCaffeinate({ menubar: true, status: true });
      if (preferences.hidenWhenDecaffeinated) {
        showHUD("💤 Your computer is now decaffeinated");
      }
    } else {
      await startCaffeinate({ menubar: true, status: true });
    }
    await checkStatus();
  };

  if (preferences.hidenWhenDecaffeinated && !caffeinated && !isLoading) {
    return null;
  }

  const selectedIcon = iconMap[preferences.icon] || iconMap.pot;
  const icon = caffeinated ? selectedIcon.caffeinated : selectedIcon.decaffeinated;
  const statusText = caffeinated ? getCaffeinationStatusText(caffeinationInfo) : "Decaffeinated 💤";

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={icon}
      tooltip={statusText}
    >
      {!isLoading && (
        <>
          <MenuBarExtra.Item
            title={statusText}
            icon={caffeinated ? Icon.CheckCircle : Icon.Circle}
          />
          {caffeinationInfo && caffeinationInfo.endTime && (
            <MenuBarExtra.Item
              title={`Ends: ${formatEndTime(caffeinationInfo.endTime)}`}
              subtitle={formatTimeRemaining(caffeinationInfo.endTime)}
            />
          )}
          {caffeinationInfo && caffeinationInfo.appName && (
            <MenuBarExtra.Item
              title={`Watching: ${caffeinationInfo.appName}`}
              icon={Icon.AppWindow}
            />
          )}
          <MenuBarExtra.Separator />
          <MenuBarExtra.Item
            title={caffeinated ? "Decaffeinate" : "Caffeinate"}
            onAction={handleCaffeinateStatus}
            icon={Icon.Power}
          />
          <MenuBarExtra.Item
            title="Caffeinate While..."
            onAction={() => launchCommand({ name: "caffeinateWhile", type: LaunchType.UserInitiated })}
            icon={Icon.AppWindow}
          />
          <MenuBarExtra.Separator />
          <MenuBarExtra.Item
            title="Refresh"
            onAction={checkStatus}
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
          />
        </>
      )}
    </MenuBarExtra>
  );
}
