import type { IdkTypeLoader } from "../../rs/config/idktype/IdkTypeLoader";
import type { ObjTypeLoader } from "../../rs/config/objtype/ObjTypeLoader";
import { Gender, PlayerAppearance } from "../../rs/config/player/PlayerAppearance";
import {
    PLAYER_BODY_RECOLOR_FROM_1,
    PLAYER_BODY_RECOLOR_FROM_2,
    PLAYER_BODY_RECOLOR_TO_1,
    PLAYER_BODY_RECOLOR_TO_2,
} from "../../rs/config/player/PlayerDesignColors";
import { Model } from "../../rs/model/Model";
import { ModelData } from "../../rs/model/ModelData";
import type { ModelLoader } from "../../rs/model/ModelLoader";
import type { TextureLoader } from "../../rs/texture/TextureLoader";

/**
 * Lightweight player chathead builder using IDK kits for head/jaw.
 * Caches by appearance hash to avoid rebuilding every dialog.
 */
export class PlayerChatheadFactory {
    private cache = new Map<string, Model>();
    private static readonly CACHE_VERSION = "chathead_v3";

    constructor(
        private readonly modelLoader: ModelLoader,
        private readonly textureLoader: TextureLoader,
        private readonly idkLoader: IdkTypeLoader,
        private readonly objTypeLoader?: ObjTypeLoader,
    ) {}

    get(appearance: PlayerAppearance | undefined): Model | undefined {
        if (!appearance) {
            return undefined;
        }
        const keyBase = appearance.getCacheKey?.() ?? JSON.stringify(appearance);
        const key = `${keyBase}|${PlayerChatheadFactory.CACHE_VERSION}`;
        const cached = this.cache.get(key);
        if (cached) return cached;

        // Detect malformed appearance where kits is actually equipment (length > 7)
        // or plain missing kits.
        let kits = appearance.kits;
        let equip = appearance.equip;

        if (kits && kits.length > 7) {
            // Likely equipment data misplaced in kits slot (common in some debug sources)
            if (!equip || equip.length === 0 || (equip.length > 0 && equip[0] === -1)) {
                equip = kits;
            }
            // Fallback to default body kits for the gender
            const def =
                appearance.gender === Gender.FEMALE
                    ? PlayerAppearance.defaultFemale(this.idkLoader)
                    : PlayerAppearance.defaultMale(this.idkLoader);
            kits = def.kits;
        }

        // If head/jaw kits are missing, seed them from defaults so the chathead still renders
        // when equipment definitions lack dedicated chat models.
        if (!kits || kits.length < 2 || kits[0] === -1 || kits[1] === -1) {
            const def =
                appearance.gender === Gender.FEMALE
                    ? PlayerAppearance.defaultFemale(this.idkLoader)
                    : PlayerAppearance.defaultMale(this.idkLoader);
            const safe = kits ? kits.slice(0, 7) : new Array<number>(7).fill(-1);
            if (safe.length < 7) safe.length = 7;
            if (safe[0] === -1) safe[0] = def.kits[0];
            if (safe[1] === -1) safe[1] = def.kits[1];
            kits = safe;
        }

        const headKitId = kits?.[0] ?? -1; // head
        const jawKitId = kits?.[1] ?? -1; // jaw/beard (OSRS part 1)

        const idkCount = this.idkLoader.getCount();
        // Debug log trimmed to avoid spam; toggle if needed.

        const modelIds: number[] = [];

        // Helper to push models
        const parts: ModelData[] = [];

        const preloaded = new Set<number>();

        const pushItemModelDatas = (ids: number[], item: any) => {
            for (const mid of ids) {
                if (!(typeof mid === "number" && mid >= 0)) continue;
                const md = this.modelLoader.getModel(mid);
                if (!md) continue;
                if (item?.recolorFrom) {
                    for (let r = 0; r < item.recolorFrom.length; r++) {
                        md.recolor(item.recolorFrom[r], item.recolorTo?.[r]);
                    }
                }
                if (item?.retextureFrom) {
                    for (let r = 0; r < item.retextureFrom.length; r++) {
                        md.retexture(item.retextureFrom[r], item.retextureTo?.[r]);
                    }
                }
                this.applyBodyRecolors(md, appearance);
                parts.push(md);
                preloaded.add(mid | 0);
                modelIds.push(mid | 0);
            }
        };

        const pushKitModels = (kitId: number) => {
            if (!(kitId >= 0)) return;
            const kit = this.idkLoader.load(kitId);
            if (!kit) return;

            let sourceIds = kit.ifModelIds;
            if (!sourceIds || !sourceIds.some((id) => id >= 0)) {
                sourceIds = kit.modelIds;
            }

            if (!Array.isArray(sourceIds)) return;
            for (const mid of sourceIds) {
                if (!(typeof mid === "number" && mid >= 0)) continue;
                const md = this.modelLoader.getModel(mid);
                if (!md) continue;
                if (kit.recolorFrom) {
                    for (let r = 0; r < kit.recolorFrom.length; r++) {
                        md.recolor(kit.recolorFrom[r], kit.recolorTo[r]);
                    }
                }
                if (kit.retextureFrom) {
                    for (let r = 0; r < kit.retextureFrom.length; r++) {
                        md.retexture(kit.retextureFrom[r], kit.retextureTo[r]);
                    }
                }
                this.applyBodyRecolors(md, appearance);
                parts.push(md);
                preloaded.add(mid | 0);
                modelIds.push(mid | 0);
            }
        };

        // 1. Equipment (Helmets/Masks)
        let headCoveredByItem = false;
        if (equip && equip.length > 0) {
            const rawHead = equip[0];
            if (rawHead >= 256 && rawHead < 512) {
                // 256-511 encodes a kit (id = val - 256)
                const kitId = rawHead - 256;
                pushKitModels(kitId);
                headCoveredByItem = true;
            } else if (rawHead >= 0 && this.objTypeLoader) {
                // Item ids encoded as val - 512 (but try raw first)
                const candidates: number[] = [];
                const masked = rawHead & 0x7fff;
                const offsets = [0, -512, -1024, -2048, 512, 1024, 2048];
                for (const off of offsets) {
                    const cand = masked + off;
                    if (cand >= 0 && !candidates.includes(cand)) candidates.push(cand);
                }

                const objCount = (this.objTypeLoader as any)?.getCount?.();
                const headPreferred: { item: any; id: number }[] = [];
                const anyValid: { item: any; id: number }[] = [];

                const isValidItem = (it: any): boolean => {
                    if (!it) return false;
                    return typeof it.name === "string" && it.name !== "null";
                };

                for (const cand of candidates) {
                    try {
                        if (typeof objCount === "number" && cand >= objCount) {
                            continue;
                        }
                        const it = this.objTypeLoader.load(cand);
                        const headPresent =
                            (it?.maleHeadModel ?? -1) >= 0 ||
                            (it?.maleHeadModel2 ?? -1) >= 0 ||
                            (it?.femaleHeadModel ?? -1) >= 0 ||
                            (it?.femaleHeadModel2 ?? -1) >= 0;
                        const info = {
                            name: (it as any)?.name,
                            m1: (it as any)?.maleHeadModel,
                            m2: (it as any)?.maleHeadModel2,
                            f1: (it as any)?.femaleHeadModel,
                            f2: (it as any)?.femaleHeadModel2,
                            b1: (it as any)?.maleModel,
                            b2: (it as any)?.maleModel1,
                            b3: (it as any)?.maleModel2,
                        };
                        if (isValidItem(it)) {
                            if (headPresent) headPreferred.push({ item: it, id: cand });
                            anyValid.push({ item: it, id: cand });
                        }
                    } catch {}
                }

                let foundItem: any;
                let resolvedItemId = -1;
                if (headPreferred.length) {
                    foundItem = headPreferred[0].item;
                    resolvedItemId = headPreferred[0].id;
                } else if (anyValid.length) {
                    foundItem = anyValid[0].item;
                    resolvedItemId = anyValid[0].id;
                }

                if (foundItem) {
                    // Unnote / unplaceholder to get real wearable definition
                    try {
                        if (foundItem.noteTemplate !== -1 && foundItem.unnotedId >= 0) {
                            const base = this.objTypeLoader.load(foundItem.unnotedId);
                            if (base) {
                                if (isValidItem(base)) {
                                    foundItem = base;
                                    resolvedItemId =
                                        foundItem.id ?? foundItem._id ?? resolvedItemId;
                                }
                            }
                        }
                        if (foundItem.placeholderTemplate !== -1 && foundItem.placeholder !== -1) {
                            const base = this.objTypeLoader.load(foundItem.placeholder);
                            if (base) {
                                if (isValidItem(base)) {
                                    foundItem = base;
                                    resolvedItemId =
                                        foundItem.id ?? foundItem._id ?? resolvedItemId;
                                }
                            }
                        }
                    } catch {}

                    const isFemale = appearance.gender === Gender.FEMALE;
                    const primary = isFemale ? foundItem.femaleHeadModel : foundItem.maleHeadModel;
                    const secondary = isFemale
                        ? foundItem.femaleHeadModel2
                        : foundItem.maleHeadModel2;
                    const models: number[] = [];
                    if (primary >= 0) models.push(primary);
                    if (secondary >= 0) models.push(secondary);
                    if (models.length) {
                        pushItemModelDatas(models, foundItem);
                        headCoveredByItem = true;
                    } else {
                        // Fallback: some items only populate body models; use them so helmets still show.
                        const bodyModels: number[] = [];
                        const b1 = isFemale ? foundItem.femaleModel : foundItem.maleModel;
                        const b2 = isFemale ? foundItem.femaleModel1 : foundItem.maleModel1;
                        const b3 = isFemale ? foundItem.femaleModel2 : foundItem.maleModel2;
                        if (b1 >= 0) bodyModels.push(b1);
                        if (b2 >= 0) bodyModels.push(b2);
                        if (b3 >= 0) bodyModels.push(b3);
                        if (bodyModels.length) {
                            pushItemModelDatas(bodyModels, foundItem);
                            headCoveredByItem = true;
                        }
                    }
                } else {
                    for (const cand of candidates) {
                        const md = this.modelLoader.getModel(cand);
                        if (md) {
                            this.applyBodyRecolors(md, appearance);
                            parts.push(md);
                            preloaded.add(cand | 0);
                            modelIds.push(cand | 0);
                            headCoveredByItem = true;
                            break;
                        }
                    }
                }
            }
        }

        // 2. Kits (Hair/Jaw)
        // If head kit is missing, try to find a fallback from IDK
        let effectiveHeadKitId = headKitId;
        if (effectiveHeadKitId === -1) {
            for (let id = 0; id < idkCount; id++) {
                try {
                    const kit = this.idkLoader.load(id);
                    if (!kit) continue;
                    if (kit.bodyPartyId === 0) {
                        effectiveHeadKitId = id;
                        break;
                    }
                } catch {}
            }
        }

        // Only add base head kit if no helmet chathead models were found
        if (!headCoveredByItem) pushKitModels(effectiveHeadKitId);
        pushKitModels(jawKitId);

        if (!modelIds.length) {
            return undefined;
        }

        for (const mid of modelIds) {
            const md = this.modelLoader.getModel(mid);
            if (md) {
                if (!preloaded.has(mid | 0)) parts.push(md);
            }
        }
        if (!parts.length) {
            return undefined;
        }

        const merged = ModelData.merge(parts, parts.length);
        const model = merged.light(this.textureLoader, 64 + 64, 850, -30, -50, -30);
        this.cache.set(key, model);
        return model;
    }

    clear(): void {
        this.cache.clear();
    }

    private applyBodyRecolors(md: ModelData, appearance: PlayerAppearance): void {
        const colors = Array.isArray(appearance.colors) ? appearance.colors : [];
        for (let c = 0; c < 5; c++) {
            const idx = (colors[c] ?? 0) | 0;
            const pal1 = PLAYER_BODY_RECOLOR_TO_1[c] ?? [];
            if (idx >= 0 && idx < pal1.length) {
                md.recolor(PLAYER_BODY_RECOLOR_FROM_1[c] | 0, pal1[idx] | 0);
            }
            const pal2 = PLAYER_BODY_RECOLOR_TO_2[c] ?? [];
            if (idx >= 0 && idx < pal2.length) {
                md.recolor(PLAYER_BODY_RECOLOR_FROM_2[c] | 0, pal2[idx] | 0);
            }
        }
    }
}
