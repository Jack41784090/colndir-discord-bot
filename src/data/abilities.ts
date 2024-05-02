import { AbilityName, AbilityTrigger, iAbility } from "@ctypes";
import { Collection } from "discord.js";

export const abilitiesMap = new Collection<AbilityName, Omit<iAbility, 'id'>>([
    [
        AbilityName.Idle, {
            trigger: AbilityTrigger.Immediate,
            name: AbilityName.Idle,
            desc: "Do nothing.",
            targetting: "self",
            AOE: 1,
            castLocation: ["front"],
            targetLocation: ["front"],
            windup: 1,
            swing: 0,
            recovery: 0,
        }
    ],
    [
        AbilityName.Stab, {
            trigger: AbilityTrigger.Swing,
            name: AbilityName.Stab,
            desc: "A piercing attack that can more easily target critical points of an enemy target. More difficult to block than a slash, but easier for the stab to miss. For blades and swords.",
            targetting: "enemy",
            AOE: 1,
            castLocation: ["front"],
            targetLocation: ["front"],
            windup: 1,
            swing: 3,
            recovery: 1,
        }
    ],
    [
        AbilityName.Slash, {
            trigger: AbilityTrigger.Swing,
            name: AbilityName.Slash,
            desc: "A wide, sweeping attack that can hit multiple enemies at once. More difficult to dodge than a stab, but easier to block. For blades and swords.",
            targetting: "enemy",
            AOE: 1,
            castLocation: ["front"],
            targetLocation: ["front"],
            windup: 1,
            swing: 3,
            recovery: 1,
        }
    ]
]);
