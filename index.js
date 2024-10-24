import { spawn } from "child_process";
import { watch } from "watchlist";

let childProcess = null;

const startServer = () => {
  if (childProcess) {
    childProcess.kill();
  }

  console.info("Starting/Restarting dev server");

  childProcess = spawn("node", ["--loader=tsm", "./app.ts"], {
    stdio: "inherit",
    env: process.env
  });
};

watch(["."], startServer, { eager: true });
