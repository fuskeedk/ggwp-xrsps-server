import type { ServerServices } from "../ServerServices";
import type { PlayerState } from "../player";
import { encodeMessage } from "../../network/messages";
import { logger } from "../../utils/logger";

export type SocialFriendEntry = {
    name: string;
    previousName: string;
    world: number;
    rank: number;
    isOnline: boolean;
};

export type SocialIgnoreEntry = {
    name: string;
    previousName: string;
};

const GGWP_WORLD_ID = 255;

function normalizeSocialName(name: string): string {
    return name.trim().replace(/_/g, " ");
}

function socialKey(name: string): string {
    return normalizeSocialName(name).toLowerCase();
}

export class FriendsService {
    constructor(private readonly svc: ServerServices) {}

    addFriend(owner: PlayerState, rawName: string): boolean {
        const ownerKey = socialKey(owner.name ?? "");
        const friendKey = socialKey(rawName);
        if (!ownerKey || !friendKey || ownerKey === friendKey) {
            return false;
        }
        const added = owner.social.addFriend(rawName);
        if (added) {
            this.persistSocial(owner);
        }
        return added;
    }

    removeFriend(owner: PlayerState, rawName: string): boolean {
        const removed = owner.social.removeFriend(rawName);
        if (removed) {
            this.persistSocial(owner);
        }
        return removed;
    }

    addIgnore(owner: PlayerState, rawName: string): boolean {
        const ownerKey = socialKey(owner.name ?? "");
        const ignoreKey = socialKey(rawName);
        if (!ownerKey || !ignoreKey || ownerKey === ignoreKey) {
            return false;
        }
        const added = owner.social.addIgnore(rawName);
        if (added) {
            this.persistSocial(owner);
        }
        return added;
    }

    removeIgnore(owner: PlayerState, rawName: string): boolean {
        const removed = owner.social.removeIgnore(rawName);
        if (removed) {
            this.persistSocial(owner);
        }
        return removed;
    }

    setFriendRank(owner: PlayerState, rawName: string, rank: number): void {
        owner.social.setFriendRank(rawName, rank);
        this.persistSocial(owner);
    }

    isFriend(owner: PlayerState, rawName: string): boolean {
        return owner.social.isFriend(rawName);
    }

    isIgnored(owner: PlayerState, rawName: string): boolean {
        return owner.social.isIgnored(rawName);
    }

    buildFriendList(owner: PlayerState): SocialFriendEntry[] {
        return owner.social.getFriends().map((name) => {
            const online = this.findOnlinePlayer(name);
            return {
                name,
                previousName: name,
                world: online ? GGWP_WORLD_ID : 0,
                rank: owner.social.getFriendRank(name),
                isOnline: online !== undefined,
            };
        });
    }

    buildIgnoreList(owner: PlayerState): SocialIgnoreEntry[] {
        return owner.social.getIgnores().map((name) => ({
            name,
            previousName: name,
        }));
    }

    syncToPlayer(player: PlayerState): void {
        const sock = this.svc.players?.getSocketByPlayerId(player.id);
        if (!sock) {
            return;
        }
        const friends = this.buildFriendList(player);
        const ignores = this.buildIgnoreList(player);
        this.svc.networkLayer.withDirectSendBypass("social_sync", () => {
            this.svc.networkLayer.sendWithGuard(
                sock,
                encodeMessage({ type: "friend_list", payload: { friends } }),
                "friend_list",
            );
            this.svc.networkLayer.sendWithGuard(
                sock,
                encodeMessage({ type: "ignore_list", payload: { ignores } }),
                "ignore_list",
            );
        });
    }

    /** Sync friend/ignore lists after login loading — avoids batching with player_sync. */
    scheduleSyncToPlayer(player: PlayerState): void {
        const playerId = player.id | 0;
        setTimeout(() => {
            const online = this.svc.players?.getById(playerId);
            if (!online) {
                return;
            }
            this.syncToPlayer(online);
        }, 3000);
    }

    notifyFriendPresenceChanged(player: PlayerState): void {
        const changedName = player.name?.trim();
        if (!changedName) {
            return;
        }
        const players = this.svc.players;
        if (!players) {
            return;
        }
        players.forEach((_ws, onlinePlayer) => {
            if (onlinePlayer.id === player.id) {
                return;
            }
            if (this.isFriend(onlinePlayer, changedName)) {
                this.syncToPlayer(onlinePlayer);
            }
        });
    }

    sendPrivateMessage(sender: PlayerState, recipientName: string, text: string): boolean {
        const target = this.findOnlinePlayer(recipientName);
        if (!target) {
            this.svc.messagingService.sendGameMessageToPlayer(
                sender,
                `Unable to find player: ${normalizeSocialName(recipientName)}`,
            );
            return false;
        }
        if (target.id === sender.id) {
            this.svc.messagingService.sendGameMessageToPlayer(
                sender,
                "You can't send a message to yourself.",
            );
            return false;
        }
        if (this.isIgnored(target, sender.name ?? "")) {
            this.svc.messagingService.sendGameMessageToPlayer(
                sender,
                "This player is not accepting private messages at this time.",
            );
            return false;
        }

        const message = text.trim().slice(0, 200);
        if (!message) {
            return false;
        }

        const senderName = sender.name ?? "Player";
        const recipientDisplay = target.name ?? normalizeSocialName(recipientName);

        this.sendDirectChat(target.id, "private_in", senderName, message);
        this.sendDirectChat(sender.id, "private_out", recipientDisplay, message);
        return true;
    }

    private persistSocial(player: PlayerState): void {
        const key = player.__saveKey;
        if (!key) {
            return;
        }
        try {
            this.svc.playerPersistence.saveSnapshot(key, player);
        } catch (err) {
            logger.warn(`[social] failed to persist friends for ${key}`, err);
        }
    }

    private sendDirectChat(
        playerId: number,
        messageType: "private_in" | "private_out" | "game",
        from: string | undefined,
        text: string,
    ): void {
        const sock = this.svc.players?.getSocketByPlayerId(playerId);
        if (!sock) {
            return;
        }
        this.svc.networkLayer.withDirectSendBypass("chat_direct", () =>
            this.svc.networkLayer.sendWithGuard(
                sock,
                encodeMessage({
                    type: "chat",
                    payload: {
                        messageType,
                        from,
                        text,
                    },
                }),
                "chat_direct",
            ),
        );
    }

    private findOnlinePlayer(name: string): PlayerState | undefined {
        const key = socialKey(name);
        const players = this.svc.players;
        if (!players) {
            return undefined;
        }
        let found: PlayerState | undefined;
        players.forEach((_ws, player) => {
            if (!found && socialKey(player.name ?? "") === key) {
                found = player;
            }
        });
        return found;
    }
}
