import { Battle, Entity } from '@classes/Battle';
import { EntityStats, Location, WeaponMultiplier, WeaponMultiplierAction } from './battle-types';

export type AbilityMultiplier = [EntityStats, WeaponMultiplierAction, WeaponMultiplier];
export enum AbilityTrigger {
    Immediate = 'always',
    StartSkirmish = 'startRound',
    EndSkirmish = 'endRound',
    ReceiveDamage = 'onReceiveDamage',
    Hit = 'onHit',
    Damage = 'onDamage',
    Miss = 'onMiss',
    Windup = 'onWindup',
    Swing = 'onSwing',
    Recovery = 'onRecovery',
    Proc = 'proc',
}
export type Targetting = 'self' | 'ally' | 'enemy'
export type AOE = number | 'all'
export enum AbilityName {
    Idle = 'null',
    Stab = 'phy-stab',
    Slash = 'phy-slash',
    Sigurdian_Strength = 'phy-sigurdian-strength',
}

export interface iAbility {
    initiator?: Entity;
    target?: Entity;
    associatedBattle?: Battle;

    trigger: AbilityTrigger;
    name: AbilityName;
    desc: string | null;
    targetting: Targetting;
    AOE: AOE;
    castLocation: Location[];
    targetLocation: Location[];

    begin?: number;
    windup: number;
    swing: number;
    recovery: number;
}

