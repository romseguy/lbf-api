import fs from "fs";
import glob from "glob";
//import sizeOf from "image-size";
import sizeOf from "probe-image-size";
import path from "path";
import { getSize, isImage } from "./utils";
import dotenv from "dotenv";
dotenv.config();

import { URL } from "url";

//@ts-ignore
const __filename = new URL("", import.meta.url).pathname;
//@ts-ignore
const __dirname = new URL(".", import.meta.url).pathname;

const root = "/home/archie/Desktop/Code/lbf-api/content";

function myConsole(...expr) {
  console.log("🚀", expr);
}

const fp = async (dirPath, dirName) => {
  const array = [];

  return new Promise(
    (resolve) => {
      glob(dirPath + "/*", {}, (err2, filePaths) => {
        for (const filePath of filePaths) {
          let fileName = path.relative(dirPath, filePath);
          fileName = fileName.substring(0, fileName.length - 3);
          array.push(fileName);
        }
        resolve(array);
      });
    }
    //(reject) => {}
  );
};

const dp = async () => {
  const m = [];

  return new Promise(
    (resolve) => {
      glob(root + "/*", {}, async (err, dirPaths) => {
        for (const dirPath of dirPaths) {
          const dirName = path.relative(root, dirPath);
          const fileNames = await fp(dirPath, dirName);
          m.push({
            tree: dirName,
            branches: fileNames
          });
        }
        resolve(m);
      });
    }
    //(reject) => {}
  );
};

dp().then((value) => {
  console.log("🚀 ~ dp ~ value:", JSON.stringify(value));
});

// glob(root + "/**/*", {}, (err, filePaths) => {
//   for (const filePath of filePaths) {
//     console.log("🚀 ~ glob ~ filePath:", filePath);
//     //     const treeName = path.relative(dir, filePath);
//     //     map[treeName] = "";
//   }

//   //console.log("🚀 ~ t ~ t:", map);
// });

{
  /*
      const files = []
      const walker  = walk.walk('./files', { followLinks: false });

      walker.on('file', function(root, stat, next) {
        if (root.includes(req.query.orgId)) files.push(stat.name);
        next();
      });

      walker.on('end', function() {
        res.send(files);
      });
    */
}
