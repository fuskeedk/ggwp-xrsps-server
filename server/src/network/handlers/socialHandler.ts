import type { MessageHandler } from "../MessageRouter";
import type { MessageHandlerServices } from "../MessageHandlers";
import type { MessageRouter } from "../MessageRouter";
import { logger } from "../../utils/logger";

export function registerSocialHandlers(
    router: MessageRouter,
    services: MessageHandlerServices,
): void {
    router.register("social_friend", createFriendHandler(services));
    router.register("social_ignore", createIgnoreHandler(services));
    router.register("social_private_message", createPrivateMessageHandler(services));
}

function createFriendHandler(services: MessageHandlerServices): MessageHandler<"social_friend"> {
    return (ctx) => {
        const player = ctx.player;
        if (!player) {
            return;
        }
        const friends = services.friendsService;
        if (!friends) {
            return;
        }
        const action = ctx.payload.action;
        const name = String(ctx.payload.name ?? "");
        if (action === "add") {
            const added = friends.addFriend(player, name);
            services.queueChatMessage({
                messageType: "game",
                text: added
                    ? `Added ${name.trim().replace(/_/g, " ")} to your friends list.`
                    : "Unable to add that player to your friends list.",
                targetPlayerIds: [player.id],
            });
        } else {
            friends.removeFriend(player, name);
            services.queueChatMessage({
                messageType: "game",
                text: `Removed ${name.trim().replace(/_/g, " ")} from your friends list.`,
                targetPlayerIds: [player.id],
            });
        }
        friends.syncToPlayer(player);
        logger.info(`[social] friend ${action} for ${player.name}: ${name}`);
    };
}

function createIgnoreHandler(services: MessageHandlerServices): MessageHandler<"social_ignore"> {
    return (ctx) => {
        const player = ctx.player;
        if (!player) {
            return;
        }
        const friends = services.friendsService;
        if (!friends) {
            return;
        }
        const action = ctx.payload.action;
        const name = String(ctx.payload.name ?? "");
        if (action === "add") {
            const added = friends.addIgnore(player, name);
            services.queueChatMessage({
                messageType: "game",
                text: added
                    ? `Added ${name.trim().replace(/_/g, " ")} to your ignore list.`
                    : "Unable to add that player to your ignore list.",
                targetPlayerIds: [player.id],
            });
        } else {
            friends.removeIgnore(player, name);
            services.queueChatMessage({
                messageType: "game",
                text: `Removed ${name.trim().replace(/_/g, " ")} from your ignore list.`,
                targetPlayerIds: [player.id],
            });
        }
        friends.syncToPlayer(player);
        logger.info(`[social] ignore ${action} for ${player.name}: ${name}`);
    };
}

function createPrivateMessageHandler(
    services: MessageHandlerServices,
): MessageHandler<"social_private_message"> {
    return (ctx) => {
        const player = ctx.player;
        if (!player) {
            return;
        }
        const friends = services.friendsService;
        if (!friends) {
            return;
        }
        friends.sendPrivateMessage(player, String(ctx.payload.recipient ?? ""), String(ctx.payload.text ?? ""));
    };
}
