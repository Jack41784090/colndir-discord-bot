import { Battle } from '@classes/Battle';
import abilitiesJSON from '@data/abilities.json';
import { Location } from './battle-types';

export type AbilityDamageType = 'slashing' | 'piercing' | 'bludgeoning' | 'spiritual'
export type AbilityTrigger = 'onActivation' | 'onHit' | 'always' | 'startRound' | 'endRound' | 'onDeath' | 'onDamage'
export type Targetting = 'self' | 'ally' | 'enemy'
export type AOE = number | 'all'
export type AbilityData = typeof abilitiesJSON.ability;

export interface AbilityConfig {
    associatedBattle: Battle;
    trigger: AbilityTrigger;
    name: string;
    desc: string | null;
    targetting: Targetting;
    AOE: AOE;
    castLocation: Location[];
    targetLocation: Location[];
}
