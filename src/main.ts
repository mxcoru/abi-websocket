import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";

import { Server } from "socket.io";
import { handleSocket } from "./socket";

const port = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(helmet());

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
    },
});

io.on("connection", handleSocket(io));

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});