export interface EntityTypeHighlightStyle {
    slot: number;
    colorRgb?: number;
    thickness: number;
    alphaPercent: number;
    flags: number;
}

function clampPercent(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value <= 0) {
        return 0;
    }
    if (value >= 100) {
        return 100;
    }
    return Math.floor(value);
}

/**
 * Tracks CS2 highlight_npctype_* / highlight_loctype_* state for scripts.
 * Visual rendering is handled separately by the renderer when wired up.
 */
export class EntityTypeHighlightManager {
    private readonly stylesBySlot = new Map<number, EntityTypeHighlightStyle>();
    private readonly typesBySlot = new Map<number, Set<number>>();

    configure(
        slot: number,
        colorRgb: number | undefined,
        thickness: number,
        alphaPercent: number,
        flags: number,
    ): void {
        const normalizedSlot = slot | 0;
        this.stylesBySlot.set(normalizedSlot, {
            slot: normalizedSlot,
            colorRgb:
                colorRgb === undefined ? undefined : (Math.floor(colorRgb) & 0xffffff) >>> 0,
            thickness: thickness | 0,
            alphaPercent: clampPercent(alphaPercent),
            flags: flags | 0,
        });
    }

    addType(slot: number, typeId: number): void {
        const normalizedSlot = slot | 0;
        const normalizedTypeId = typeId | 0;
        let types = this.typesBySlot.get(normalizedSlot);
        if (!types) {
            types = new Set<number>();
            this.typesBySlot.set(normalizedSlot, types);
        }
        types.add(normalizedTypeId);
    }

    removeType(slot: number, typeId: number): void {
        const types = this.typesBySlot.get(slot | 0);
        if (!types) {
            return;
        }
        types.delete(typeId | 0);
        if (types.size === 0) {
            this.typesBySlot.delete(slot | 0);
        }
    }

    hasType(slot: number, typeId: number): boolean {
        const types = this.typesBySlot.get(slot | 0);
        return types ? types.has(typeId | 0) : false;
    }

    clear(slot: number): void {
        const normalizedSlot = slot | 0;
        this.typesBySlot.delete(normalizedSlot);
        this.stylesBySlot.delete(normalizedSlot);
    }

    findStyleForType(typeId: number): EntityTypeHighlightStyle | undefined {
        const normalizedTypeId = typeId | 0;
        for (const [slot, types] of this.typesBySlot) {
            if (!types.has(normalizedTypeId)) continue;
            const style = this.stylesBySlot.get(slot);
            if (style?.colorRgb !== undefined) {
                return style;
            }
        }
        return undefined;
    }
}
