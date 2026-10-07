/**
 * Per-sector difficulty. Sector 1 matches the original tuning; each further
 * sector nudges enemies and hazards up a little (with caps so late sectors
 * stay winnable), and rewards up slightly to compensate.
 */
export function sectorDifficulty(sector) {
  const step = Math.max(sector - 1, 0);
  const scale = (perSector, cap) => Math.min(1 + perSector * step, cap);
  return {
    sector,
    enemyHp: Math.round(60 * scale(0.15, 2.5)), // 60, 69, 78, 87…
    enemyDamage: [Math.round(8 * scale(0.12, 2)), Math.round(16 * scale(0.12, 2))], // 8–16, 9–18, 10–20…
    enemyAccuracy: Math.min(0.03 * step, 0.12), // added to the pirate's hit chance
    pirateChance: Math.min(0.4 + 0.05 * step, 0.65),
    hazard: Math.min(0.08 * step, 0.3), // makes crew-event mishaps more likely
    scrapMultiplier: scale(0.1, 1.8),
  };
}
