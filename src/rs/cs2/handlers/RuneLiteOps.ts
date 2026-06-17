/**
 * RuneLite-specific CS2 opcodes used by patched client scripts.
 */
import { Opcodes } from "../Opcodes";
import type { HandlerMap } from "./HandlerTypes";

export function registerRuneLiteOps(handlers: HandlerMap): void {
    // RUNELITE_EXECUTE (6599): runelite_callback in patched scripts.
    // Pops callback name; scripts continue after this (e.g. docheat for ::commands).
    handlers.set(Opcodes.RUNELITE_EXECUTE, (ctx) => {
        if (ctx.stringStackSize <= 0) {
            return;
        }
        const eventName = ctx.stringStack[--ctx.stringStackSize];
        ctx.onRuneliteCallback?.(eventName);
    });
}
