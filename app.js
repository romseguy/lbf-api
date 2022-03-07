const fs = require('fs')
const stream = require('stream')
const path = require('path')
const cors = require('cors')
const express = require('express')
const fu = require('express-fileupload')
//const walk = require('walk')
const glob = require('glob')
const mkdirp = require('mkdirp')
const nodemailer = require('nodemailer')
const nodemailerSendgrid = require('nodemailer-sendgrid')
const { readdir, stat } = require('fs/promises');

const MAX_ALLOWED_SIZE = 100000000 // 100Mb

const directorySize = async directory => {
  const files = await readdir(directory);
  const stats = files.map(file => stat(path.join(directory, file)));

  return (await Promise.all(stats)).reduce((accumulator, { size }) => accumulator + size, 0);
}

const EMAIL_API_KEY = "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"

const transport = nodemailer.createTransport(
  nodemailerSendgrid({
    apiKey: EMAIL_API_KEY
  })
);

const app = express()
const port = 3000
const root = `${__dirname}/files`

app.use(cors())
app.use(express.json({ limit: '25mb' }))
//app.use(express.urlencoded({limit: '25mb'}));
app.use(fu())

// app.use('/', express.static("files"))

app.get('/', (req, res, next) => {
  const id = req.query.orgId || req.query.userId
  if (!id) {
    res.status(400).send("Vous devez indiquer un id d'organisation ou d'utilisateur");
    return;
  }

  const dir = `${root}/${id}`

  glob(dir + "/*", {}, (err, files) => {
    if (err) throw err
    files = files.map(file => path.relative(dir, file))
    res.send(files)
  })

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
})


app.get('/download', (req, res, next) => {
  if (!req.query.orgId) {
    res.status(400).send("Vous devez indiquer un id d'organisation");
    return;
  }

  if (!req.query.fileName) {
    res.status(400).send("Vous devez indiquer un nom de fichier");
    return;
  }

  const file = `${__dirname}/files/${req.query.orgId}/${req.query.fileName}`;
  res.download(file);
})

app.get('/size', (req, res, next) => {
  const id = req.query.orgId || req.query.eventId || req.query.userId || ""
  const dirPath = `${root}/${id}`
  const dirSize = await directorySize(dirPath)
  return res.status(200).send({ current: dirSize, max: MAX_ALLOWED_SIZE });
})

app.get('/view', (req, res, next) => {
  const id = req.query.orgId || req.query.eventId || req.query.userId || "all"

  if (!req.query.fileName) {
    return res.status(400).send("Vous devez indiquer un nom de fichier");
  }

  const file = `${__dirname}/files/${id}/${req.query.fileName}`;
  const r = fs.createReadStream(file)
  const ps = new stream.PassThrough() // stream error handling

  stream.pipeline(
    r,
    ps, // stream error handling
    (err) => {
      if (err) {
        console.log(err) // No such file or any other kind of error
        return res.sendStatus(400);
      }
    }
  )

  ps.pipe(res)
})

app.post('/', async (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("Aucun fichier à envoyer");
  }

  const dirSize = await directorySize(root)
  if (dirSize > MAX_ALLOWED_SIZE) {
    return res.status(400).send({ message: "Limite de 100Mo atteinte" });
  }

  const id = req.body?.eventId || req.body?.orgId || req.body?.userId || "all"
  const dirPath = `${root}/${id}`
  mkdirp.sync(dirPath)

  const file = req.files.file

  if (file) {
    file.mv(
      `${dirPath}/${file.name}`,
      function (err) {
        if (err) {
          return res.status(500).send(err)
        }
        res.json({
          file: `${file.name}`,
        })
      },
    )
  }
})

app.post('/mails', async (req, res, next) => {
  if (!req.body?.eventId) {
    res.status(400).send("Vous devez indiquer un événement");
    return;
  }
  if (!Array.isArray(req.body?.mails)) {
    res.status(400).send("Vous devez fournir une liste de {email, mail}");
    return;
  }

  let uploadDir = req.body?.eventId
  const dir = `${root}/${uploadDir}`
  mkdirp.sync(dir)

  try {
    const file = dir + "/emailList.json"

    if (!fs.existsSync(file)) {
      await fs.promises.writeFile(file, "[]", { flag: "a+" })
    }

    const data = await fs.promises.readFile(file)
    const json = JSON.parse(data)

    for (const { email, mail } of req.body.mails) {
      if (!json.find(({ email: e }) => e === email)) {
        console.log("sent mail to", email);
        const info = await transport.sendMail(mail)
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
        json.push({ email, status: "PENDING" })
      }
    }

    await fs.promises.writeFile(file, JSON.stringify(json))

    res.json(json)
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

app.post('/mail', async (req, res, next) => {
  if (!req.body?.eventId) {
    res.status(400).send("Vous devez indiquer un événement");
    return;
  }
  if (!req.body?.mail) {
    res.status(400).send("Vous devez fournir un mail");
    return;
  }
  const email = req.body.mail.to.replace(/<|>/g, "")
  console.log("POST /mail", req.body.eventId, email);

  let uploadDir = req.body?.eventId
  const dir = `${root}/${uploadDir}`
  mkdirp.sync(dir)

  try {
    const file = dir + "/emailList.json"

    if (!fs.existsSync(file)) {
      await fs.promises.writeFile(file, "[]", { flag: "a+" })
    }

    const data = await fs.promises.readFile(file)
    const json = JSON.parse(data)

    if (!json.find(({ email: e }) => e === email)) {
      const info = await transport.sendMail(req.body.mail)
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
      json.push({ email, status: "PENDING" })
    }

    await fs.promises.writeFile(file, JSON.stringify(json))

    res.json({ email })
  } catch (error) {
    console.error(error)
    res.status(500).send(error)
  }
})

app.delete('/', async (req, res, next) => {
  if (!req.body.fileName)
    return res.status(400).send({ message: "Veuillez spécifier le nom du document à supprimer" });

  let uploadDir = req.body?.orgId || req.body?.userId

  const dir = `${root}/${uploadDir}`

  if (!fs.existsSync(dir))
    return res.status(400).send({ message: "Document introuvable" });

  try {
    await fs.promises.unlink(path.join(dir, req.body.fileName))
    res.json({ fileName: req.body.fileName })
  } catch (error) {
    console.error(error)
    return res.status(500).send({ message: "Le document n'a pas pu être supprimé" });
  }
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port} ; root=${root}`)
})
