import type { PersistentSubState } from "./PersistentSubState";

export type PlayerSocialPersistentEntry = {
    friends?: string[];
    ignores?: string[];
    ranks?: Record<string, number>;
};

function normalizeSocialName(name: string): string {
    return name.trim().replace(/_/g, " ");
}

function socialKey(name: string): string {
    return normalizeSocialName(name).toLowerCase();
}

export class PlayerSocialState implements PersistentSubState<PlayerSocialPersistentEntry | undefined> {
    private readonly friends: string[] = [];
    private readonly ignores: string[] = [];
    private readonly ranks = new Map<string, number>();

    getFriends(): readonly string[] {
        return this.friends;
    }

    getIgnores(): readonly string[] {
        return this.ignores;
    }

    getFriendRank(name: string): number {
        return this.ranks.get(socialKey(name)) ?? 0;
    }

    addFriend(rawName: string): boolean {
        const friendName = normalizeSocialName(rawName);
        const friendKey = socialKey(friendName);
        if (!friendKey) {
            return false;
        }
        if (this.friends.some((entry) => socialKey(entry) === friendKey)) {
            return false;
        }
        this.friends.push(friendName);
        return true;
    }

    removeFriend(rawName: string): boolean {
        const friendKey = socialKey(rawName);
        const next = this.friends.filter((entry) => socialKey(entry) !== friendKey);
        if (next.length === this.friends.length) {
            return false;
        }
        this.friends.length = 0;
        this.friends.push(...next);
        this.ranks.delete(friendKey);
        return true;
    }

    addIgnore(rawName: string): boolean {
        const ignoreName = normalizeSocialName(rawName);
        const ignoreKey = socialKey(ignoreName);
        if (!ignoreKey) {
            return false;
        }
        if (this.ignores.some((entry) => socialKey(entry) === ignoreKey)) {
            return false;
        }
        this.ignores.push(ignoreName);
        return true;
    }

    removeIgnore(rawName: string): boolean {
        const ignoreKey = socialKey(rawName);
        const next = this.ignores.filter((entry) => socialKey(entry) !== ignoreKey);
        if (next.length === this.ignores.length) {
            return false;
        }
        this.ignores.length = 0;
        this.ignores.push(...next);
        return true;
    }

    setFriendRank(rawName: string, rank: number): void {
        const friendKey = socialKey(rawName);
        if (!friendKey) {
            return;
        }
        this.ranks.set(friendKey, rank | 0);
    }

    isFriend(rawName: string): boolean {
        const friendKey = socialKey(rawName);
        return this.friends.some((entry) => socialKey(entry) === friendKey);
    }

    isIgnored(rawName: string): boolean {
        const ignoreKey = socialKey(rawName);
        return this.ignores.some((entry) => socialKey(entry) === ignoreKey);
    }

    serialize(): PlayerSocialPersistentEntry | undefined {
        if (this.friends.length === 0 && this.ignores.length === 0 && this.ranks.size === 0) {
            return undefined;
        }
        const ranks: Record<string, number> = {};
        for (const [key, rank] of this.ranks.entries()) {
            ranks[key] = rank;
        }
        return {
            friends: this.friends.length > 0 ? [...this.friends] : undefined,
            ignores: this.ignores.length > 0 ? [...this.ignores] : undefined,
            ranks: this.ranks.size > 0 ? ranks : undefined,
        };
    }

    deserialize(data: PlayerSocialPersistentEntry | undefined): void {
        this.friends.length = 0;
        this.ignores.length = 0;
        this.ranks.clear();
        if (!data) {
            return;
        }
        if (Array.isArray(data.friends)) {
            for (const name of data.friends) {
                if (typeof name === "string" && name.trim()) {
                    this.addFriend(name);
                }
            }
        }
        if (Array.isArray(data.ignores)) {
            for (const name of data.ignores) {
                if (typeof name === "string" && name.trim()) {
                    this.addIgnore(name);
                }
            }
        }
        if (data.ranks && typeof data.ranks === "object") {
            for (const [key, rank] of Object.entries(data.ranks)) {
                if (typeof rank === "number" && Number.isFinite(rank)) {
                    this.ranks.set(key.toLowerCase(), rank | 0);
                }
            }
        }
    }
}
