import { getItemDefinition } from "../../src/data/items";

/** Match OpenRune admin spawns: bank notes when count is above this threshold. */
export const ADMIN_SPAWN_NOTE_THRESHOLD = 10;

export function canAdminSpawnAsNotes(itemId: number): boolean {
    const def = getItemDefinition(itemId);
    if (!def || def.stackable || def.noted) {
        return false;
    }
    const noteId = def.noteId | 0;
    if (noteId <= 0) {
        return false;
    }
    const noteDef = getItemDefinition(noteId);
    return noteDef?.noted === true;
}

export function resolveAdminSpawnItem(
    itemId: number,
    quantity: number,
): { itemId: number; asNotes: boolean } {
    const qty = Math.max(1, quantity | 0);
    if (qty > ADMIN_SPAWN_NOTE_THRESHOLD && canAdminSpawnAsNotes(itemId)) {
        const noteId = getItemDefinition(itemId)!.noteId | 0;
        return { itemId: noteId, asNotes: true };
    }
    return { itemId, asNotes: false };
}
