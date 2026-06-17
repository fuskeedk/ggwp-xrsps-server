# OSRS Quest NPC Mapping QA Report

This report scores the automatic quest-to-NPC/monster mapping against OSRS Wiki evidence.

- Total relations checked: 2452
- Score >= 0.98: 507
- Score >= 0.95: 1744
- Score >= 0.90: 2395 (97.68%)
- Score < 0.90: 57
- Review needed: 57 (2.32%)
- Story-only review needed: 0
- Entity type mismatches: 0

Review needed by role:

- helper: 55
- turn_in: 2

Review needed by evidence source:

- walkthrough.interaction: 59

Interpretation:

- Relations scoring 0.98+ are backed by the strongest structured evidence.
- Relations scoring 0.90-0.97 are likely correct but may still need spot review for final game scripting.
- Relations below 0.90, especially story-only category links, should be manually approved or removed.
- A realistic 98-100% target means resolving the review queue, then rerunning this report.
