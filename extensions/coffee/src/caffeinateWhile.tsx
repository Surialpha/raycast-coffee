import { Action, ActionPanel, Form, popToRoot } from "@raycast/api";
import { useEffect, useState } from "react";
import { getRunningApplications, caffeinateWhileAppRunning } from "./utils";

interface App {
  name: string;
  pid: number;
}

export default function Command() {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<App[]>([]);
  
  useEffect(() => {
    (async () => {
      const runningApps = await getRunningApplications();
      setApps(runningApps);
      setLoading(false);
    })();
  }, []);

  return (
    <Form
      isLoading={loading}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Caffeinate"
            onSubmit={async (data) => {
              const selectedApp = apps.find(app => app.pid.toString() === data.process);
              if (selectedApp) {
                await caffeinateWhileAppRunning(
                  selectedApp.name,
                  selectedApp.pid,
                  { menubar: true, status: true }
                );
              }
              popToRoot();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="process" title="Application">
        {apps.map((app) => (
          <Form.Dropdown.Item 
            key={app.pid} 
            value={app.pid.toString()} 
            title={app.name} 
          />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
