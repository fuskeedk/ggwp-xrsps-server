import {
    COINS_ID,
    UNTRADEABLE_ID,
    WHIP_ID,
    createTradeHarness,
    fillInventoryWithUntradeable,
} from "./tradeTestHarness";
import { CHATBOX_GROUP_ID } from "../server/src/widgets/InterfaceService";

let passed = 0;
let failed = 0;
const failures: string[] = [];
let currentDescribe = "";
let currentIt = "";

function assert(condition: boolean, msg: string): void {
    if (condition) {
        passed++;
        return;
    }
    failed++;
    failures.push(`${currentDescribe} > ${currentIt} — ${msg}`);
    console.error(`  FAIL: ${msg}`);
}

function assertEq<T>(actual: T, expected: T, msg: string): void {
    assert(actual === expected, `${msg} — expected ${String(expected)}, got ${String(actual)}`);
}

function describe(name: string, fn: () => void): void {
    currentDescribe = name;
    console.log(`\n${name}`);
    fn();
}

function it(name: string, fn: () => void): void {
    currentIt = name;
    fn();
}

describe("trade request flow", () => {
    it("opens a session when the target accepts a request", () => {
        const harness = createTradeHarness();
        harness.requestTrade(1, 2);

        const requestMsg = harness.lastTradeMessage(2);
        assert(requestMsg?.kind === "request", "target should receive trade request");

        harness.acceptRequest(2, 1);

        const openA = harness.lastTradeMessage(1);
        const openB = harness.lastTradeMessage(2);
        assert(openA?.kind === "open", "initiator should get open payload");
        assert(openB?.kind === "open", "responder should get open payload");
        if (openA?.kind === "open" && openB?.kind === "open") {
            assertEq(openA.stage, "offer", "session should start in offer stage");
            assertEq(openB.stage, "offer", "session should start in offer stage");
        }
    });

    it("auto-starts when both players request each other", () => {
        const harness = createTradeHarness();
        harness.requestTrade(1, 2);
        harness.requestTrade(2, 1);

        const openA = harness.lastTradeMessage(1);
        const openB = harness.lastTradeMessage(2);
        assert(openA?.kind === "open", "reciprocal request should open trade for player 1");
        assert(openB?.kind === "open", "reciprocal request should open trade for player 2");
    });

    it("declines a request without opening trade", () => {
        const harness = createTradeHarness();
        harness.requestTrade(1, 2);
        harness.declineRequest(2, 1);

        const last = harness.lastTradeMessage(2);
        assert(last?.kind !== "open", "declined request should not open trade");
        assert(
            harness.getPlayer(1).gameMessages.some((msg) => msg.includes("declined")),
            "initiator should be notified of decline",
        );
    });

    it("accepts from chat meslayer via handleResumePauseButton", () => {
        const harness = createTradeHarness();
        harness.requestTrade(1, 2);

        const handled = harness.manager.handleResumePauseButton(
            harness.getPlayer(2),
            CHATBOX_GROUP_ID << 16,
            0,
            0,
        );
        assert(handled, "chat accept should be handled");
        assertEq(harness.lastTradeMessage(2)?.kind, "open", "chat accept should open trade");
    });
});

describe("trade offer flow", () => {
    it("moves offered items out of inventory and into trade state", () => {
        const harness = createTradeHarness();
        harness.setSlot(1, 0, COINS_ID, 1000);
        harness.setSlot(2, 0, WHIP_ID, 1);
        harness.requestTrade(1, 2);
        harness.acceptRequest(2, 1);

        harness.offer(1, 0, COINS_ID, 500);

        assertEq(harness.countItem(1, COINS_ID), 500, "offered coins should leave inventory");
        const update = harness.lastTradeMessage(1);
        assert(update?.kind === "update", "offer should broadcast update");
        if (update?.kind === "update") {
            assertEq(update.self.offers[0]?.itemId, COINS_ID, "self offer item id");
            assertEq(update.self.offers[0]?.quantity, 500, "self offer quantity");
        }
    });

    it("returns removed offers to inventory", () => {
        const harness = createTradeHarness();
        harness.setSlot(1, 0, COINS_ID, 1000);
        harness.requestTrade(1, 2);
        harness.acceptRequest(2, 1);
        harness.offer(1, 0, COINS_ID, 400);
        harness.remove(1, 0, 200);

        assertEq(harness.countItem(1, COINS_ID), 800, "removed offer should return to inventory");
        const update = harness.lastTradeMessage(1);
        if (update?.kind === "update") {
            assertEq(update.self.offers[0]?.quantity, 200, "offer slot should shrink");
        } else {
            assert(false, "expected update after remove");
        }
    });

    it("blocks untradeable items", () => {
        const harness = createTradeHarness();
        harness.setSlot(1, 0, UNTRADEABLE_ID, 1);
        harness.requestTrade(1, 2);
        harness.acceptRequest(2, 1);

        harness.offer(1, 0, UNTRADEABLE_ID, 1);

        assertEq(harness.countItem(1, UNTRADEABLE_ID), 1, "untradeable item should stay in inventory");
        assert(
            harness.getPlayer(1).gameMessages.some((msg) => msg.includes("isn't tradeable")),
            "player should get untradeable feedback",
        );
    });
});

describe("trade finalize flow", () => {
    it("swaps items when both players accept and confirm", () => {
        const harness = createTradeHarness();
        harness.setSlot(1, 0, COINS_ID, 1000);
        harness.setSlot(2, 0, WHIP_ID, 1);
        harness.requestTrade(1, 2);
        harness.acceptRequest(2, 1);

        harness.offer(1, 0, COINS_ID, 250);
        harness.offer(2, 0, WHIP_ID, 1);

        harness.accept(1);
        harness.accept(2);
        harness.confirm(1);
        harness.confirm(2);

        assertEq(harness.countItem(1, COINS_ID), 750, "player 1 should keep unoffered coins");
        assertEq(harness.countItem(1, WHIP_ID), 1, "player 1 should receive whip");
        assertEq(harness.countItem(2, WHIP_ID), 0, "player 2 should lose whip");
        assertEq(harness.countItem(2, COINS_ID), 250, "player 2 should receive coins");
        assertEq(harness.lastTradeMessage(1)?.kind, "close", "trade should close for player 1");
        assertEq(harness.lastTradeMessage(2)?.kind, "close", "trade should close for player 2");
    });

    it("returns offered items when a player declines", () => {
        const harness = createTradeHarness();
        harness.setSlot(1, 0, COINS_ID, 500);
        harness.requestTrade(1, 2);
        harness.acceptRequest(2, 1);
        harness.offer(1, 0, COINS_ID, 300);
        harness.decline(1);

        assertEq(harness.countItem(1, COINS_ID), 500, "decline should return all offered coins");
        assertEq(harness.lastTradeMessage(1)?.kind, "close", "decline should close trade");
    });

    it("aborts finalize when the receiver has no space", () => {
        const harness = createTradeHarness();
        fillInventoryWithUntradeable(harness.getPlayer(1));
        harness.setSlot(2, 0, WHIP_ID, 1);

        harness.requestTrade(1, 2);
        harness.acceptRequest(2, 1);
        harness.offer(2, 0, WHIP_ID, 1);
        harness.accept(1);
        harness.accept(2);
        harness.confirm(1);
        harness.confirm(2);

        assertEq(harness.countItem(1, WHIP_ID), 0, "full receiver should not receive whip");
        assertEq(harness.countItem(2, WHIP_ID), 0, "whip should remain in offers after failed finalize");
        assert(
            harness.getPlayer(1).gameMessages.some((msg) => msg.includes("enough space")),
            "full receiver should get space error",
        );
        const update = harness.lastTradeMessage(1);
        assert(update?.kind === "update", "failed finalize should return to offer stage");
        if (update?.kind === "update") {
            assertEq(update.stage, "offer", "session should reset to offer stage");
        }
    });

    it("rolls back the first receiver if the second finalize apply fails", () => {
        const harness = createTradeHarness();
        harness.setSlot(1, 0, COINS_ID, 100);
        harness.setSlot(2, 0, WHIP_ID, 1);
        harness.requestTrade(1, 2);
        harness.acceptRequest(2, 1);
        harness.offer(1, 0, COINS_ID, 100);
        harness.offer(2, 0, WHIP_ID, 1);
        harness.accept(1);
        harness.accept(2);

        harness.setFailAddForPlayerId(2);
        harness.confirm(1);
        harness.confirm(2);
        harness.setFailAddForPlayerId(null);

        assertEq(harness.countItem(1, WHIP_ID), 0, "rollback should remove received whip from player 1");
        assertEq(harness.countItem(1, COINS_ID), 0, "player 1 coins should still be in offers");
        assertEq(harness.countItem(2, WHIP_ID), 0, "player 2 whip should still be in offers");
        assert(
            harness.getPlayer(1).gameMessages.some((msg) => msg.includes("Trade failed")),
            "both players should see trade failed message",
        );
    });
});

describe("trade request expiry", () => {
    it("expires stale requests on tick", () => {
        const harness = createTradeHarness();
        harness.requestTrade(1, 2, 0);
        harness.manager.tick(100);

        const closeMsg = harness.lastTradeMessage(2);
        assert(closeMsg?.kind === "close", "expired request should notify target");
        if (closeMsg?.kind === "close") {
            assert(
                (closeMsg.reason ?? "").includes("expired"),
                "close reason should mention expiry",
            );
        }
        assert(
            harness.getPlayer(1).gameMessages.some((msg) => msg.includes("expired")),
            "initiator should be notified of expiry",
        );
    });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length > 0) {
    console.error("\nFailures:");
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    process.exit(1);
}
