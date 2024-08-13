import fs from "fs";
import mkdirp from "mkdirp";
import { logJson } from "./utils";

//@ts-ignore
const __dirname = new URL(".", import.meta.url).pathname;

export enum ServerEventTypes {
  API_CALL = "API_CALL",
  API_ERROR = "API_ERROR",
  API_LOG = "API_LOG",
  API_SUCCESS = "API_SUCCESS",
  DOCUMENTS = "DOCUMENTS",
  DOCUMENTS_DEL = "DOCUMENTS_DEL",
  GALLERIES = "GALLERIES",
  GALLERIES_DEL = "GALLERIES_DEL",
  TOPICS = "TOPICS",
  TOPICS_DEL = "TOPICS_DEL",
  TOPICS_MESSAGE = "TOPICS_MESSAGE",
  TOPICS_MESSAGE_DEL = "TOPICS_MESSAGE_DEL"
}

interface ServerEvent {
  date?: Date;
  timestamp?: number;
  type: ServerEventTypes;
  metadata: Record<string, any>;
}

export async function logEvent(event: ServerEvent) {
  const prefix = `🚀 ~ ${new Date().toLocaleString()} ~ logEvent `;

  const date = event.date ? event.date : new Date().toLocaleString();
  const newEvent = !event.date
    ? { date, timestamp: Date.now(), ...event }
    : event;
  try {
    await fs.promises.mkdir("logs", { recursive: true });

    // read
    const filePath = __dirname + "logs/events.json";
    console.log(prefix + filePath);
    if (!fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, "[]", { flag: "a+" });
    }
    const data = await fs.promises.readFile(filePath);
    const json = JSON.parse(data.toString());

    // write
    json.push(newEvent);
    await fs.promises.writeFile(filePath, "\n" + JSON.stringify(json, null, 2));
  } catch (error: any) {
    error = error as {
      errno: number;
      code: string;
      syscall: string;
      path: string;
    };

    if (error.code === "ENOENT") {
      await fs.promises.writeFile(
        __dirname + "/logs/events.json",
        JSON.stringify([newEvent])
      );
    }
  }
}

export async function getEvent(filter): Promise<ServerEvent | undefined> {
  const prefix = `🚀 ~ ${new Date().toLocaleString()} ~ getEvent `;
  mkdirp.sync(__dirname + "logs");
  const filePath = __dirname + "logs/events.json";
  console.log(prefix + filePath);

  if (!fs.existsSync(filePath)) {
    await fs.promises.writeFile(filePath, "[]", { flag: "a+" });
  }

  const data = await fs.promises.readFile(filePath);
  const json = JSON.parse(data.toString());
  const arr = json.filter(filter);
  logJson(prefix + "filtered", arr);
  const last = arr[arr.length - 1];
  logJson(prefix + "last", last);

  return last;
}
