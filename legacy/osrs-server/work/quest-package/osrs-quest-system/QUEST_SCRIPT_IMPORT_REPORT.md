# Quest Script Import Report

Source: OSRS Wiki API and `Quests/List`.

Generated file:

- `data/quest-scripts.json`

Counts:

- Quest scripts: 209
- High quality scripts: 158
- Medium quality scripts: 51
- Low quality scripts: 0
- Scripts with quest point rewards: 180
- Scripts with skill requirements: 129
- Scripts with quest requirements: 130
- Scripts with XP rewards: 146
- Scripts with item requirements: 189
- Item requirement links: 1,478

What is imported:

- Quest details
- Start text and start map
- Difficulty and length
- Skill requirements
- Quest point requirements
- Required prior quests
- Required/relevant item links
- Recommended skills/items/travel links
- Quest enemies/kills
- Quest point rewards
- XP rewards where clearly marked as experience
- Reward unlock/item candidates
- Walkthrough section headings as stage hints

Known limits:

- OSRS Wiki item fields include alternatives, components and obtain-during-quest notes. Items are marked `direct` or `contextual`, but exact alternatives still need per-quest scripting.
- Rewards that are lamps or choice-based rewards may need custom handling.
- Some subquests do not use the same reward template as normal quests.
- True 100% gameplay correctness needs playtesting once exact quest steps are authored.
