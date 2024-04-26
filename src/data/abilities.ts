import { Ability, AbilityName, AbilityTrigger } from "@ctypes";

export const abilitiesMap = new Map<AbilityName, Ability>([
    [
        AbilityName.Stab, {
            "trigger": AbilityTrigger.OnHit,
            "name": AbilityName.Stab,
            "desc": "A piercing attack that can more easily target critical points of an enemy target. More difficult to block than a slash, but easier for the stab to miss. For blades and swords.",
            "targetting": "enemy",
            "AOE": 1,
            "castLocation": ["front"],
            "targetLocation": ["front"]
        }
    ],
    [
        AbilityName.Slash, {
            "trigger": AbilityTrigger.OnHit,
            "name": AbilityName.Slash,
            "desc": "A wide, sweeping attack that can hit multiple enemies at once. More difficult to dodge than a stab, but easier to block. For blades and swords.",
            "targetting": "enemy",
            "AOE": 1,
            "castLocation": ["front"],
            "targetLocation": ["front"]
        }
    ]
]);
