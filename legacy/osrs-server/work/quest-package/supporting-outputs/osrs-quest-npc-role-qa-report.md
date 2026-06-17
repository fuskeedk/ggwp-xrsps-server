# OSRS Quest NPC Role QA Report

This report checks individual roles, so a valid `enemy` role can be kept even if a noisy `turn_in` role needs review.

- Total role links checked: 3630
- Verified role links: 3569 (98.32%)
- Review role links: 61 (1.68%)
- Score >= 0.95: 2464
- Score >= 0.90: 3569 (98.32%)

Review needed by role:

- helper: 57
- turn_in: 4

Files:

- `osrs-quest-npc-role-qa.csv`: all scored role links
- `osrs-quest-npc-role-review-queue.csv`: role links that need manual approval
- `osrs-quest-npc-mapping-role-verified.json`: safe role-level verified mapping
