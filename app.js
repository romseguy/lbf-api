(() => {
    const defines = {};
    const entry = [null];
    function define(name, dependencies, factory) {
        defines[name] = { dependencies, factory };
        entry[0] = name;
    }
    define("require", ["exports"], (exports) => {
        Object.defineProperty(exports, "__cjsModule", { value: true });
        Object.defineProperty(exports, "default", { value: (name) => resolve(name) });
    });
    var __importDefault = (this && this.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };
    define("types", ["require", "exports"], function (require, exports) {
        "use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
    });
    define("utils", ["require", "exports", "fs/promises", "fs", "path"], function (require, exports, promises_1, fs_1, path_1) {
        "use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.isImage = exports.getSize = exports.directorySize = exports.bytesForHuman = void 0;
        fs_1 = __importDefault(fs_1);
        path_1 = __importDefault(path_1);
        function bytesForHuman(bytes, decimals = 0) {
            const units = ["o", "Ko", "Mo", "Go"];
            let i = 0;
            for (i; bytes > 1024; i++) {
                bytes /= 1024;
            }
            return parseFloat(bytes.toFixed(decimals)) + units[i];
        }
        exports.bytesForHuman = bytesForHuman;
        async function directorySize(directory) {
            const files = await (0, promises_1.readdir)(directory);
            const stats = files.map((file) => (0, promises_1.stat)(path_1.default.join(directory, file)));
            return (await Promise.all(stats)).reduce((accumulator, { size }) => accumulator + size, 0);
        }
        exports.directorySize = directorySize;
        function getSize(path) {
            // Get the size of a file or folder recursively
            let size = 0;
            if (fs_1.default.statSync(path).isDirectory()) {
                const files = fs_1.default.readdirSync(path);
                files.forEach((file) => {
                    size += getSize(path + "/" + file);
                });
            }
            else {
                size += fs_1.default.statSync(path).size;
            }
            return size;
        }
        exports.getSize = getSize;
        function isImage(fileName) {
            const str = fileName.toLowerCase();
            return (str.includes(".png") ||
                str.includes(".jpg") ||
                str.includes(".jpeg") ||
                str.includes(".bmp") ||
                str.includes(".webp"));
        }
        exports.isImage = isImage;
    });
    define("app", ["require", "exports", "cors", "express", "express-fileupload", "express-pino-logger", "fs", "glob", "image-size", "mkdirp", "path", "pino", "stream", "utils"], function (require, exports, cors_1, express_1, express_fileupload_1, express_pino_logger_1, fs_2, glob_1, image_size_1, mkdirp_1, path_2, pino_1, stream_1, utils_1) {
        "use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        cors_1 = __importDefault(cors_1);
        express_1 = __importDefault(express_1);
        express_fileupload_1 = __importDefault(express_fileupload_1);
        express_pino_logger_1 = __importDefault(express_pino_logger_1);
        fs_2 = __importDefault(fs_2);
        glob_1 = __importDefault(glob_1);
        image_size_1 = __importDefault(image_size_1);
        mkdirp_1 = __importDefault(mkdirp_1);
        path_2 = __importDefault(path_2);
        pino_1 = __importDefault(pino_1);
        stream_1 = __importDefault(stream_1);
        //#region constants
        const MAX_ALLOWED_SIZE = 1000000000; // 1Gb
        const PORT = 3001;
        //#endregion
        //#region bootstrap
        const app = (0, express_1.default)();
        const logger = (0, pino_1.default)({ level: process.env.LOG_LEVEL || "info" });
        const root = `../lbf/public/files`;
        mkdirp_1.default.sync(root);
        app.use((0, express_pino_logger_1.default)({ logger }));
        app.use((0, cors_1.default)());
        app.use(express_1.default.json({ limit: "25mb" }));
        //app.use(express.urlencoded({limit: '25mb'}));
        app.use((0, express_fileupload_1.default)());
        // app.use('/', express.static("files"))
        //#endregion
        app.get("/", function getDocuments(req, res, next) {
            const id = req.query.eventId || req.query.orgId || req.query.userId;
            if (!id) {
                return res.status(400).send("Vous devez indiquer un id");
            }
            const dir = `${root}/${id}`;
            (0, glob_1.default)(dir + "/*", {}, (err, filePaths) => {
                if (err)
                    throw err;
                res.send(filePaths.map((filePath) => {
                    const bytes = (0, utils_1.getSize)(filePath);
                    const url = path_2.default.relative(dir, filePath);
                    if ((0, utils_1.isImage)(url))
                        return {
                            url,
                            bytes,
                            ...(0, image_size_1.default)(filePath)
                        };
                    return { url, bytes };
                }));
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
                const { width, height } = (0, image_size_1.default)(file);
                return res.status(200).json({ width, height });
            }
            catch (error) {
                logger.error(error);
                return res.status(500).send({ message: error.message });
            }
        });
        app.get("/size", async (req, res, next) => {
            try {
                const id = req.query.orgId || req.query.eventId || req.query.userId || "";
                const dirPath = `${root}/${id}`;
                const dirSize = (0, utils_1.getSize)(id ? dirPath : root);
                return res.status(200).json({ current: dirSize, max: MAX_ALLOWED_SIZE });
            }
            catch (error) {
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
            const r = fs_2.default.createReadStream(file);
            const ps = new stream_1.default.PassThrough(); // stream error handling
            stream_1.default.pipeline(r, ps, // stream error handling
            (err) => {
                if (err) {
                    logger.info(err); // No such file or any other kind of error
                    return res.sendStatus(400);
                }
            });
            ps.pipe(res);
        });
        app.post("/", async (req, res, next) => {
            const dirSize = await (0, utils_1.directorySize)(root);
            if (dirSize > MAX_ALLOWED_SIZE)
                return res.status(400).send({
                    message: `Limite de ${(0, utils_1.bytesForHuman)(MAX_ALLOWED_SIZE)} atteinte`
                });
            const id = req.body?.eventId || req.body?.orgId || req.body?.userId;
            if (!id) {
                return res.status(400).send("Vous devez indiquer un id");
            }
            if (!req.files || Object.keys(req.files).length === 0) {
                return res.status(400).send("Aucun fichier à envoyer");
            }
            const file = req.files.file;
            const fsMb = file.size / (1024 * 1024);
            if (fsMb > 10) {
                return res.status(400).send("Fichier trop volumineux");
            }
            const dirPath = `${root}/${id}`;
            mkdirp_1.default.sync(dirPath);
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
        });
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
            mkdirp_1.default.sync(dir);
            try {
                const file = dir + "/emailList.json";
                if (!fs_2.default.existsSync(file)) {
                    await fs_2.default.promises.writeFile(file, "[]", { flag: "a+" });
                }
                const data = await fs_2.default.promises.readFile(file);
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
                await fs_2.default.promises.writeFile(file, JSON.stringify(json));
                res.json(json);
            }
            catch (error) {
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
            mkdirp_1.default.sync(dir);
            try {
                const file = dir + "/emailList.json";
                if (!fs_2.default.existsSync(file)) {
                    await fs_2.default.promises.writeFile(file, "[]", { flag: "a+" });
                }
                const data = await fs_2.default.promises.readFile(file);
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
                await fs_2.default.promises.writeFile(file, JSON.stringify(json));
                res.json({ email });
            }
            catch (error) {
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
            const filePath = path_2.default.join(dir, req.body.fileName);
            if (!fs_2.default.existsSync(dir) || !fs_2.default.existsSync(filePath))
                return res.status(400).send({ message: "Document introuvable" });
            try {
                await fs_2.default.promises.unlink(filePath);
                res.json({ fileName: req.body.fileName });
            }
            catch (error) {
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
            if (!fs_2.default.existsSync(dir))
                return res.status(200).send({ message: "Dossier introuvable" });
            try {
                await fs_2.default.promises.rm(dir, { recursive: true, force: true });
                res.json({ dirName: id });
            }
            catch (error) {
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
    });
    
    'marker:resolver';

    function get_define(name) {
        if (defines[name]) {
            return defines[name];
        }
        else if (defines[name + '/index']) {
            return defines[name + '/index'];
        }
        else {
            const dependencies = ['exports'];
            const factory = (exports) => {
                try {
                    Object.defineProperty(exports, "__cjsModule", { value: true });
                    Object.defineProperty(exports, "default", { value: require(name) });
                }
                catch {
                    throw Error(['module "', name, '" not found.'].join(''));
                }
            };
            return { dependencies, factory };
        }
    }
    const instances = {};
    function resolve(name) {
        if (instances[name]) {
            return instances[name];
        }
        if (name === 'exports') {
            return {};
        }
        const define = get_define(name);
        if (typeof define.factory !== 'function') {
            return define.factory;
        }
        instances[name] = {};
        const dependencies = define.dependencies.map(name => resolve(name));
        define.factory(...dependencies);
        const exports = dependencies[define.dependencies.indexOf('exports')];
        instances[name] = (exports['__cjsModule']) ? exports.default : exports;
        return instances[name];
    }
    if (entry[0] !== null) {
        return resolve(entry[0]);
    }
})();