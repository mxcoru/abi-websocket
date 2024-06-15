import { Server, Socket } from "socket.io";

const otpIndex: Map<string, string> = new Map<string, string>();

export interface RegisterController {
    otp: string;
    username: string;
}

export interface RegisterViewer {
    otp: string;
}

export interface CommandController {
    type: string;
    data: any;
}

export interface CommandLeave {
    username: string;
}

export function handleSocket(server: Server): (socket: Socket) => void {
    return (socket: Socket) => handleEvents(socket, server);

}


function handleEvents(socket: Socket, server: Server) {
    socket.on("register.viewer", ({ otp }: RegisterViewer) => {
        socket.data.type = "viewer";
        socket.data.otp = otp;
        otpIndex.set(otp, socket.id);
    });

    socket.on("register.controller", async ({ otp, username }: RegisterController) => {
        if (socket.data.type == "viewer") {
            return;
        }

        socket.data.type = "controller";
        socket.data.username = username;

        if (otpIndex.has(otp)) {

            const viewerId = otpIndex.get(otp) as string;
            const viewer = server.sockets.sockets.get(viewerId);

            if (!viewer) {
                socket.emit("message.toast", "error", "Viewer not found");
                return;
            }

            const channel = `${viewer.id}-${otp}`;

            socket.join(channel);
            socket.data.channel = channel;
            socket.data.otp = otp;
            viewer.data.channel = socket.data.channel;
            viewer.join(socket.data.channel);

            viewer.emit("socketSession.set", socket.data.channel);
            socket.emit("socketSession.set", socket.data.channel);

            await updateControllerCount(socket.data.channel, server);

        } else {
            socket.emit("message.toast", "error", "OTP not found");
        }


    });

    socket.on("command.controller", (command: CommandController) => {
        if (socket.data.channel) {
            server.to(socket.data.channel).emit("command.controller", command);
        }
    });

    socket.on("command.leave", async ({ username }: CommandLeave) => {
        if (!socket.data.channel || socket.data.type != "controller") {
            return;
        }

        await leaveChannel(socket, server);
    })

    socket.on("disconnect", async () => {
        otpIndex.delete(socket.data.otp);

        await leaveChannel(socket, server);

    })
}

async function leaveChannel(socket: Socket, server: Server) {
    if (!socket.data.channel) {
        return;
    }

    switch (socket.data.type) {
        case "viewer":
            server.to(socket.data.channel).emit("socketSession.clear");
            break;
        case "controller":
            socket.leave(socket.data.channel);
            socket.emit("socketSession.clear");
            await updateControllerCount(socket.data.channel, server);
            break;
    }

    socket.data.channel = undefined;
}

async function updateControllerCount(room_id: string, server: Server) {
    const sockets = await server.to(room_id).fetchSockets();

    const controllerCount = sockets.filter((socket) => socket.data.type === "controller").length;
    server.to(room_id).emit("controllerCount.set", controllerCount);

}