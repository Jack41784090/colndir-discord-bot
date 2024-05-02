import { iStatusEffect, Reality, StatusEffectApplyType, StatusEffectType, Weapon, WeaponMultiplier } from "@ctypes";
import { Collection } from "discord.js";

export const statusEffectMap = new Collection<StatusEffectType, Omit<iStatusEffect, 'source'>>([
    [StatusEffectType.Bleed, {
        emoji: '💔',
        type: StatusEffectType.Bleed,
        applyType: StatusEffectApplyType.stackable,
        value: 0,
        duration: 0,
    }],
]);
