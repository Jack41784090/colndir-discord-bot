import { Battle, EntityInstance } from '@classes/Battle';
import { EntityStats, Location, WeaponMultiplier, WeaponMultiplierAction } from './battle-types';

export type AbilityMultiplier = [EntityStats, WeaponMultiplierAction, WeaponMultiplier];
export enum AbilityTrigger {
    Immediate = 'always',
    StartSkirmish = 'startRound',
    EndSkirmish = 'endRound',
    OnUse = 'onUse',
    OnHit = 'onHit',
    Proc = 'proc',
}
export type Targetting = 'self' | 'ally' | 'enemy'
export type AOE = number | 'all'
export enum AbilityName {
    None = 'null',
    Stab = 'phy-stab',
    Slash = 'phy-slash',
    Sigurdian_Strength = 'phy-sigurdian-strength',
}

export interface Ability {
    initiator?: EntityInstance;
    target?: EntityInstance;
    associatedBattle?: Battle;

    trigger: AbilityTrigger;
    name: AbilityName;
    desc: string | null;
    targetting: Targetting;
    AOE: AOE;
    castLocation: Location[];
    targetLocation: Location[];
    timeRequired: number;
}

