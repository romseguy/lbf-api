import { readdir, stat } from "fs/promises";
import fs from "fs";
import path from "path";

export function bytesForHuman(bytes, decimals = 0) {
  const units = ["o", "Ko", "Mo", "Go"];
  let i = 0;

  for (i; bytes > 1024; i++) {
    bytes /= 1024;
  }

  return parseFloat(bytes.toFixed(decimals)) + units[i];
}

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
