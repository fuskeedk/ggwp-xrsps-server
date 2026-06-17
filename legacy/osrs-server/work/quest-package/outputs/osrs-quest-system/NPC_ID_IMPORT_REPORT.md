# NPC ID Import Report

## Source

- Source: osrsbox/osrsbox-db `docs/npcs-summary.json`
- URL: https://raw.githubusercontent.com/osrsbox/osrsbox-db/refs/heads/master/docs/npcs-summary.json

## Counts

- NPC records with numeric IDs: 1601
- NPC records still missing numeric IDs: 336
- Unique numeric server NPC IDs indexed: 4757
- Broad name matches with multiple numeric IDs: 859

## Server usage

- Use `primaryGameNpcId` when your server only accepts one id.
- Use `gameNpcIds` when an NPC has multiple cache variants.
- Use `data/npc-id-index.json` or `getBestDialogueNodeByGameNpcId(...)` when the server gives you a numeric NPC id.

## Missing sample

- `squawking_steve_beanie`: 'Squawking' Steve Beanie ('Squawking' Steve Beanie)
- `abyssal_antibody`: Abyssal antibody (Abyssal antibody)
- `abyssal_axon`: Abyssal axon (Abyssal axon)
- `academic`: Academic (Academic)
- `acatzin`: Acatzin (Acatzin)
- `adala`: Adala (Adala)
- `adrius`: Adrius (Adrius)
- `advisor`: Advisor (Advisor)
- `aemilia`: Aemilia (Aemilia)
- `agile_warrior`: Agile Warrior (Agile Warrior)
- `akkha`: Akkha (Akkha)
- `akrisae`: Akrisae (Akrisae)
- `alba`: Alba (Alba)
- `alina`: Alina (Alina)
- `amascut`: Amascut (Amascut)
- `amoxliatl`: Amoxliatl (Amoxliatl)
- `ana_in_a_barrel`: Ana in a barrel (Ana in a barrel)
- `anne`: Anne (Anne)
- `antos`: Antos (Antos)
- `apparition`: Apparition (Apparition)
- `apprentice_cordelia`: Apprentice Cordelia (Apprentice Cordelia)
- `apprentice_felix`: Apprentice Felix (Apprentice Felix)
- `apprentice_tamara`: Apprentice Tamara (Apprentice Tamara)
- `araxyte`: Araxyte (Araxyte)
- `archmage_sedridor`: Archmage Sedridor (Archmage Sedridor)
- `argenthorg`: Argenthorg (Argenthorg)
- `aris`: Aris (Aris)
- `armoured_zombie_defender_of_varrock`: Armoured zombie (Defender of Varrock) (Armoured zombie (Defender of Varrock))
- `armoured_zombie_the_curse_of_arrav`: Armoured zombie (The Curse of Arrav) (Armoured zombie (The Curse of Arrav))
- `armoured_zombie_zemouregal_s_base`: Armoured zombie (Zemouregal's Base) (Armoured zombie (Zemouregal's Base))
- `arrav`: Arrav (Arrav)
- `artima`: Artima (Artima)
- `asgarnia_smith`: Asgarnia Smith (Asgarnia Smith)
- `ashuelot_reis`: Ashuelot Reis (Ashuelot Reis)
- `asleif_hamalsdotter`: Asleif Hamalsdotter (Asleif Hamalsdotter)
- `attala`: Attala (Attala)
- `atza`: Atza (Atza)
- `aya`: Aya (Aya)
- `ba_ba`: Ba-Ba (Ba-Ba)
- `balance_elemental`: Balance Elemental (Balance Elemental)
- `barbarian_bartender`: Barbarian bartender (Barbarian bartender)
- `barus`: Barus (Barus)
- `big_fish_secrets_of_the_north`: Big Fish (Secrets of the North) (Big Fish (Secrets of the North))
- `black_eye_bethel`: Black Eye Bethel (Black Eye Bethel)
- `black_jaguar_scrambled`: Black jaguar (Scrambled!) (Black jaguar (Scrambled!))
- `blacksmith_cam_torum`: Blacksmith (Cam Torum) (Blacksmith (Cam Torum))
- `blacksmith_tal_teklan`: Blacksmith (Tal Teklan) (Blacksmith (Tal Teklan))
- `blood_moon`: Blood Moon (Blood Moon)
- `blood_totem`: Blood Totem (Blood Totem)
- `bloody_jack`: Bloody Jack (Bloody Jack)

## Broad match sample

- `currency_the_alchemist`: 'Currency' The Alchemist via osrsbox_exact_name -> 3594, 3595 (2 ids)
- `transmute_the_alchemist`: 'Transmute' The Alchemist via osrsbox_exact_name -> 3592, 3593 (2 ids)
- `entry`: ? ? ? ? via osrsbox_exact_name -> 1182, 1183, 1184, 1185, 1186, 1187, 1188, 1189, 1190, 1191 (10 ids)
- `abigale`: Abigale via osrsbox_exact_name -> 7623, 7633, 7635 (3 ids)
- `abomination`: Abomination via osrsbox_exact_name -> 8260, 8261, 8262 (3 ids)
- `achietties`: Achietties via osrsbox_exact_name -> 4923, 8054, 8156, 8164, 8172 (5 ids)
- `adamant_dragon`: Adamant dragon via osrsbox_exact_name -> 8030, 8090 (2 ids)
- `advisor_ghrim`: Advisor Ghrim via osrsbox_exact_name -> 5447, 5448 (2 ids)
- `aeonisig_raispher`: Aeonisig Raispher via osrsbox_exact_name -> 3774, 8043 (2 ids)
- `afflicted`: Afflicted via osrsbox_exact_name -> 1293, 1294, 1297, 1298 (4 ids)
- `agnar`: Agnar via osrsbox_exact_name -> 3937, 9273 (2 ids)
- `agrith_naar`: Agrith Naar via osrsbox_exact_name -> 911, 6388 (2 ids)
- `agrith_na_na`: Agrith-Na-Na via osrsbox_exact_name -> 4880, 6369 (2 ids)
- `aivas`: Aivas via osrsbox_exact_name -> 8123, 8128 (2 ids)
- `akthanakos`: Akthanakos via osrsbox_exact_name -> 3578, 3579, 3582 (3 ids)
- `ali_morrisane`: Ali Morrisane via osrsbox_exact_name -> 3533, 4585 (2 ids)
- `alice`: Alice via osrsbox_exact_name -> 504, 4422 (2 ids)
- `alrena`: Alrena via osrsbox_exact_name -> 4249, 4250, 4251 (3 ids)
- `amelia`: Amelia via osrsbox_exact_name -> 8180, 8530 (2 ids)
- `ana`: Ana via osrsbox_exact_name -> 4629, 4630, 4677 (3 ids)
- `ancient_guardian`: Ancient Guardian via osrsbox_exact_name -> 10654, 10665 (2 ids)
- `ancient_guardian_desert_treasure_ii`: Ancient Guardian (Desert Treasure II) via osrsbox_base_name -> 10654, 10665 (2 ids)
- `andiess_juip`: Andiess Juip via osrsbox_exact_name -> 8228, 8229 (2 ids)
- `angry_bear`: Angry bear via osrsbox_exact_name -> 1060, 4692 (2 ids)
- `angry_giant_rat`: Angry giant rat via osrsbox_exact_name -> 1062, 4689, 4690 (3 ids)
- `angry_goblin`: Angry goblin via osrsbox_exact_name -> 1065, 4691 (2 ids)
- `angry_unicorn`: Angry unicorn via osrsbox_exact_name -> 1061, 4688 (2 ids)
- `animated_steel_armour_tarn_s_lair`: Animated steel armour (Tarn's Lair) via osrsbox_base_name -> 2452, 6438 (2 ids)
- `anita`: Anita via osrsbox_exact_name -> 7156, 7157 (2 ids)
- `anna`: Anna via osrsbox_exact_name -> 967, 969, 4220 (3 ids)
- `archer_lost_city`: Archer (Lost City) via osrsbox_base_name -> 1157, 3301, 4096, 4097, 4098 (5 ids)
- `arianwyn`: Arianwyn via osrsbox_exact_name -> 3432, 8865, 8866, 8867, 8868, 9014, 9248 (7 ids)
- `arrg`: Arrg via osrsbox_exact_name -> 642, 643, 6392 (3 ids)
- `artur_hosidius`: Artur Hosidius via osrsbox_exact_name -> 7898, 7899, 10976 (3 ids)
- `arzinian_avatar_of_magic`: Arzinian Avatar of Magic via osrsbox_exact_name -> 1233, 1234, 1235 (3 ids)
- `arzinian_avatar_of_ranging`: Arzinian Avatar of Ranging via osrsbox_exact_name -> 1230, 1231, 1232 (3 ids)
- `arzinian_avatar_of_strength`: Arzinian Avatar of Strength via osrsbox_exact_name -> 1227, 1228, 1229 (3 ids)
- `askeladden`: Askeladden via osrsbox_exact_name -> 8402, 8403, 8404, 8405 (4 ids)
- `assassin`: Assassin via osrsbox_exact_name -> 4568, 10940, 10941, 10942 (4 ids)
- `assassin_a_kingdom_divided`: Assassin (A Kingdom Divided) via osrsbox_base_name -> 4568, 10940, 10941, 10942 (4 ids)
- `assassin_while_guthix_sleeps`: Assassin (While Guthix Sleeps) via osrsbox_base_name -> 4568, 10940, 10941, 10942 (4 ids)
- `assistant_le_smith`: Assistant Le Smith via osrsbox_exact_name -> 4722, 6806 (2 ids)
- `asteros_arceuus`: Asteros Arceuus via osrsbox_exact_name -> 10889, 10978, 10979 (3 ids)
- `atlas`: Atlas via osrsbox_exact_name -> 10658, 10669 (2 ids)
- `aubury`: Aubury via osrsbox_exact_name -> 2886, 10681 (2 ids)
- `auguste`: Auguste via osrsbox_exact_name -> 4715, 4716, 4717, 4718 (4 ids)
- `avan`: Avan via osrsbox_exact_name -> 386, 387 (2 ids)
- `awowogei`: Awowogei via osrsbox_exact_name -> 3396, 3397, 5264, 6812 (4 ids)
- `baby_tanglefoot`: Baby tanglefoot via osrsbox_exact_name -> 5853, 5854 (2 ids)
- `baker`: Baker via osrsbox_exact_name -> 3208, 8724, 8725 (3 ids)
