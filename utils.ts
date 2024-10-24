import { readdir, stat } from "fs/promises";
import fs, { lstatSync } from "fs";
import path from "path";

export function bytesForHuman(bytes, decimals = 0) {
  const units = ["o", "Ko", "Mo", "Go"];
  let i = 0;

  for (i; bytes > 1024; i++) {
    bytes /= 1024;
  }

  return parseFloat(bytes.toFixed(decimals)) + units[i];
}

export const isDirectory = (path) =>
  lstatSync(path) ? lstatSync(path).isDirectory() : false;

export async function directorySize(directory) {
  const files = await readdir(directory);
  const stats = files.map((file) => stat(path.join(directory, file)));

  return (await Promise.all(stats)).reduce(
    (accumulator, { size }) => accumulator + size,
    0
  );
}

export function getSize(path) {
  // Get the size of a file or folder recursively
  let size = 0;
  if (fs.statSync(path).isDirectory()) {
    const files = fs.readdirSync(path);
    files.forEach((file) => {
      size += getSize(path + "/" + file);
    });
  } else {
    size += fs.statSync(path).size;
  }
  return size;
}

export const getRefId = (
  entity?: string | Record<string, any> | null,
  key?: string
) => {
  if (!entity) return "";

  if (typeof entity === "string") return entity;

  if (typeof entity === "object") {
    const value = entity[key || "createdBy"];

    if (value) {
      if (typeof value === "string") return value;

      if (typeof value === "object") return value._id;
    }
  }

  return "";
};

export function isImage(fileName: string) {
  const str = fileName.toLowerCase();
  return (
    str.includes(".png") ||
    str.includes(".jpg") ||
    str.includes(".jpeg") ||
    str.includes(".bmp") ||
    str.includes(".webp")
  );
}

export function logJson(message: string, object?: any) {
  if (object) console.log(message, JSON.stringify(object, null, 2));
  else console.log(message);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const toHours = (ms) => toSeconds(ms) / 3600;
export const toMinutes = (ms) => toSeconds(ms) / 60;
export const toSeconds = (ms) => ms / 1000;
export const hoursToSeconds = (hours) => hours * 3600;
