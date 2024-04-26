import { Battle } from '@classes/Battle';
import { EntityStats, Location, WeaponMultiplier, WeaponMultiplierAction } from './battle-types';

export type AbilityMultiplier = [EntityStats, WeaponMultiplierAction, WeaponMultiplier];
export enum AbilityTrigger {
    Always = 'always',
    StartRound = 'startRound',
    EndRound = 'endRound',
    OnHit = 'onHit',
    OnUse = 'onUse',
    Proc = 'proc',
}
export type Targetting = 'self' | 'ally' | 'enemy'
export type AOE = number | 'all'
export interface AbilityData {
    trigger: AbilityTrigger;
    name: string;
    desc: string | null;
    targetting: Targetting;
    AOE: AOE;
    castLocation: Location[];
    targetLocation: Location[];
};
export enum AbilityName {
    None = 'null',
    Stab = 'phy-stab',
    Slash = 'phy-slash',
}

export interface Ability {
    associatedBattle?: Battle;
    trigger: AbilityTrigger;
    name: AbilityName;
    desc: string | null;
    targetting: Targetting;
    AOE: AOE;
    castLocation: Location[];
    targetLocation: Location[];
}
export type AbilityNames = keyof AbilityData;
