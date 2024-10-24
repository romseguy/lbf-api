import cors from "cors";
import express from "express";
import fu, { UploadedFile } from "express-fileupload";
import expressPino from "express-pino-logger";
import fs from "fs";
import glob from "glob";
//import sizeOf from "image-size";
import sizeOf from "probe-image-size";
import mkdirp from "mkdirp";
import path from "path";
import pino from "pino";
import stream from "stream";
import { TypedRequestBody } from "./types";
import {
  bytesForHuman,
  directorySize,
  getSize,
  isImage,
  isDirectory
} from "./utils";
import fileTypeChecker from "file-type-checker";
import dotenv from "dotenv";
dotenv.config();

import { URL } from "url";

//@ts-ignore
const __filename = new URL("", import.meta.url).pathname;
//@ts-ignore
const __dirname = new URL(".", import.meta.url).pathname;

//#region constants
const MAX_ALLOWED_SIZE = 1000000000; // 1Gb
const PORT = 3001;
//#endregion

//#region bootstrap
const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const root = process.env.ROOT;
mkdirp.sync(root);
app.use(expressPino({ logger }));
app.use(cors());
app.use(express.json({ limit: "25mb" }));
//app.use(express.urlencoded({limit: '25mb'}));
app.use(
  fu({
    defCharset: "utf8",
    defParamCharset: "utf8"
  })
);
// app.use('/', express.static("files"))
//#endregion

app.get("/", function getDocuments(req, res, next) {
  const id = req.query.eventId || req.query.orgId || req.query.userId;

  if (!id) {
    return res.status(400).send("Vous devez indiquer un id");
  }
  const dir = `${root}/${id}`;

  glob(dir + "/*", {}, (err, filePaths) => {
    if (err) throw err;
    res.send(
      filePaths.map((filePath) => {
        const bytes = getSize(filePath);
        const time = fs.statSync(filePath).mtime.getTime();
        const url = path.relative(dir, filePath);

        if (isImage(url)) {
          const result = sizeOf.sync(fs.readFileSync(filePath));
          return {
            url,
            bytes,
            ...result
          };
        }

        return { url, time, bytes };
      })
    );
  });

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
});

app.get("/images", function getDocuments(req, res, next) {
  let dir = root;
  let subDir = root;
  glob(subDir + "/*", {}, async (err, filePaths) => {
    if (err) throw err;

    //let i = 0;
    let files = [];
    for (const filePath of filePaths) {
      if (isDirectory(filePath)) continue;
      const name = path.relative(dir, filePath);
      const bytes = getSize(filePath);
      const ffs = fs.statSync(filePath);
      const time = ffs.mtime.getTime();

      // console.log("🚀 ~ glob ~ filePath:", filePath);
      const url = path.resolve(filePath);
      // console.log("🚀 ~ glob ~ url:", url);
      const file = fs.readFileSync(url);
      // const t = fileTypeChecker.detectFile(file);
      // // console.log("🚀 ~ glob ~ t:", t);
      const s = fileTypeChecker.validateFileType(file, ["png", "gif", "jpeg"]);
      // console.log("🚀 ~ glob ~ s:", s);
      // const s = await fileTypeFromFile(url);
      // // console.log("🚀 ~ glob ~ s:", s, url);

      if (s) {
        // if (i > 25) continue;
        // i = i + 1;
        files.push({ url: name, time, bytes, isImage: s });
      }
    }

    res.send(files);
  });
});

app.get("/check", (req, res, next) => {
  res.status(200).send("check");
});

app.get("/download", (req, res, next) => {
  const id = req.query.eventId || req.query.orgId || req.query.userId;
  if (!id) {
    return res.status(400).send("Vous devez indiquer un id");
  }

  if (!req.query.fileName) {
    return res.status(400).send("Vous devez indiquer un nom de fichier");
  }

  const dirPath = `${root}/${id}`;
  const file = `${dirPath}/${req.query.fileName}`;
  res.download(file);
});

app.get("/dimensions", async (req, res, next) => {
  try {
    const id = req.query.eventId || req.query.orgId || req.query.userId;
    if (!id) {
      return res.status(400).send("Vous devez indiquer un id");
    }

    if (!req.query.fileName) {
      return res.status(400).send("Vous devez indiquer un nom de fichier");
    }

    const file = `${__dirname}/files/${id}/${req.query.fileName}`;
    const { width, height } = sizeOf.sync(fs.readFileSync(file));
    return res.status(200).json({ width, height });
  } catch (error: any) {
    logger.error(error);
    return res.status(500).send({ message: error.message });
  }
});

app.get("/size", async (req, res, next) => {
  try {
    const id = req.query.orgId || req.query.eventId || req.query.userId || "";
    const dirPath = `${root}/${id}`;
    const dirSize = getSize(id ? dirPath : root);
    return res.status(200).json({ current: dirSize, max: MAX_ALLOWED_SIZE });
  } catch (error: any) {
    logger.error(error);
    return res.status(500).send({ message: error.message });
  }
});

app.get("/view", (req, res, next) => {
  const id = req.query.eventId || req.query.orgId || req.query.userId;
  if (!id) {
    return res.status(400).send("Vous devez indiquer un id");
  }

  if (!req.query.fileName) {
    return res.status(400).send("Vous devez indiquer un nom de fichier");
  }

  const file = `${__dirname}/files/${id}/${req.query.fileName}`;
  const r = fs.createReadStream(file);
  const ps = new stream.PassThrough(); // stream error handling

  stream.pipeline(
    r,
    ps, // stream error handling
    (err) => {
      if (err) {
        logger.info(err); // No such file or any other kind of error
        return res.sendStatus(400);
      }
    }
  );

  ps.pipe(res);
});

app.post(
  "/",
  async (
    req: TypedRequestBody<{
      eventId?: string;
      orgId?: string;
      userId?: string;
    }>,
    res,
    next
  ) => {
    const dirSize = await directorySize(root);
    if (dirSize > MAX_ALLOWED_SIZE)
      return res.status(400).send({
        message: `Limite de ${bytesForHuman(MAX_ALLOWED_SIZE)} atteinte`
      });
    const id = req.body?.eventId || req.body?.orgId || req.body?.userId;
    if (!id) {
      return res.status(400).send("Vous devez indiquer un id");
    }
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send("Aucun fichier à envoyer");
    }
    const file = req.files.file as UploadedFile;
    const fsMb = file.size / (1024 * 1024);
    if (fsMb > 10) {
      return res.status(400).send("Fichier trop volumineux");
    }
    const dirPath = `${root}/${id}`;
    mkdirp.sync(dirPath);
    if (file) {
      file.mv(`${dirPath}/${file.name}`, function (err) {
        if (err) {
          return res.status(500).send(err);
        }
        res.json({
          file: `${file.name}`
        });
      });
    }
  }
);

app.post("/mails", async (req, res, next) => {
  if (!req.body?.eventId) {
    res.status(400).send("Vous devez indiquer un événement");
    return;
  }
  if (!Array.isArray(req.body?.mails)) {
    res.status(400).send("Vous devez fournir une liste de {email, mail}");
    return;
  }

  let uploadDir = req.body?.eventId;
  const dir = `${root}/${uploadDir}`;
  mkdirp.sync(dir);

  try {
    const file = dir + "/emailList.json";

    if (!fs.existsSync(file)) {
      await fs.promises.writeFile(file, "[]", { flag: "a+" });
    }

    const data = await fs.promises.readFile(file);
    const json = JSON.parse(data.toString());

    for (const { email, mail } of req.body.mails) {
      if (!json.find(({ email: e }) => e === email)) {
        logger.info("sent mail to", email);
        //const info = await transport.sendMail(mail)
        /*
         * info includes the result, the exact format depends on the transport mechanism used
         * info.messageId most transports should return the final Message-Id value used with this property
         * info.envelope includes the envelope object for the message
         * info.accepted is an array returned by SMTP transports (includes recipient addresses that were accepted by the server)
         * info.rejected is an array returned by SMTP transports (includes recipient addresses that were rejected by the server)
         * info.pending is an array returned by Direct SMTP transport.
         *   Includes recipient addresses that were temporarily rejected together with the server response
         *   response is a string returned by SMTP transports and includes the last SMTP response from the server
         */
        json.push({ email, status: "PENDING" });
      }
    }

    await fs.promises.writeFile(file, JSON.stringify(json));

    res.json(json);
  } catch (error) {
    logger.error(error);
    res.status(500).send(error);
  }
});

app.post("/mail", async (req, res, next) => {
  if (!req.body?.eventId) {
    res.status(400).send("Vous devez indiquer un événement");
    return;
  }
  if (!req.body?.mail) {
    res.status(400).send("Vous devez fournir un mail");
    return;
  }
  const email = req.body.mail.to.replace(/<|>/g, "");
  logger.info("POST /mail", req.body.eventId, email);

  let uploadDir = req.body?.eventId;
  const dir = `${root}/${uploadDir}`;
  mkdirp.sync(dir);

  try {
    const file = dir + "/emailList.json";

    if (!fs.existsSync(file)) {
      await fs.promises.writeFile(file, "[]", { flag: "a+" });
    }

    const data = await fs.promises.readFile(file);
    const json = JSON.parse(data.toString());

    if (!json.find(({ email: e }) => e === email)) {
      //const info = await transport.sendMail(req.body.mail)
      /*
       * info includes the result, the exact format depends on the transport mechanism used
       * info.messageId most transports should return the final Message-Id value used with this property
       * info.envelope includes the envelope object for the message
       * info.accepted is an array returned by SMTP transports (includes recipient addresses that were accepted by the server)
       * info.rejected is an array returned by SMTP transports (includes recipient addresses that were rejected by the server)
       * info.pending is an array returned by Direct SMTP transport.
       *   Includes recipient addresses that were temporarily rejected together with the server response
       *   response is a string returned by SMTP transports and includes the last SMTP response from the server
       */
      json.push({ email, status: "PENDING" });
    }

    await fs.promises.writeFile(file, JSON.stringify(json));

    res.json({ email });
  } catch (error) {
    logger.error(error);
    res.status(500).send(error);
  }
});

app.delete("/", async (req, res, next) => {
  const id = req.body?.orgId || req.body?.eventId || req.body?.userId;
  if (!id) {
    return res.status(400).send("Vous devez indiquer un id");
  }

  if (!req.body?.fileName)
    return res
      .status(400)
      .send({ message: "Veuillez spécifier le nom du document à supprimer" });

  const dir = `${root}/${id}`;
  const filePath = path.join(dir, req.body.fileName);

  if (!fs.existsSync(dir) || !fs.existsSync(filePath))
    return res.status(400).send({ message: "Document introuvable" });

  try {
    await fs.promises.unlink(filePath);
    res.json({ fileName: req.body.fileName });
  } catch (error) {
    logger.error(error);
    return res
      .status(500)
      .send({ message: "Le document n'a pas pu être supprimé" });
  }
});

app.delete("/folder", async (req, res, next) => {
  const id = req.body?.eventId || req.body?.orgId || req.body?.userId;
  if (!id) {
    return res.status(400).send({ message: "Vous devez indiquer un id" });
  }

  const dir = `${root}/${id}`;

  if (!fs.existsSync(dir))
    return res.status(200).send({ message: "Dossier introuvable" });

  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
    res.json({ dirName: id });
  } catch (error) {
    logger.error(error);
    return res
      .status(500)
      .send({ message: "Le dossier n'a pas pu être supprimé" });
  }
});

app.listen(PORT, () => {
  logger.info(`Listening at http://localhost:${PORT} ; root=${root}`);
});

{
  /* 
    const nodemailerSendgrid = require('nodemailer-sendgrid')
    const EMAIL_API_KEY = "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"
    const transport = nodemailer.createTransport(
      nodemailerSendgrid({
        apiKey: EMAIL_API_KEY
      })
    );
  */
}
