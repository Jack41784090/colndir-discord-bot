import charactersJSON from '@data/characters.json';
import { TextBasedChannel, User } from 'discord.js';

export interface Weapon {
    type: WeaponType,
    name: string,
    piercing: number,
    baseDamage: number,
    multipliers: WeaponMultiplier[],
}
export interface Armour {
    name: string,
    armour: number,
}
export interface EntityConstance {
    owner?: string,
    username?: string,
    id?: string,
    iconURL?: string,

    name: string,

    str: number,    // Strength: muscle density
    dex: number,    // Dexterity: precision, skill with physical items and tools
    spd: number,    // Speed: quickness
    siz: number,    // Size: body mass
    int: number,    // Intelligence: knowledge of pragmatic magic
    spr: number,    // Spirit: connection to the spiritual world
    fai: number,    // Faith: faith in the divine

    maxHP: number,
    maxOrg: number,
}
export interface Entity {
    base: EntityConstance,
    name: string,
    warSupport: number,
    stamina: number,
    HP: number,
    org: number,
    loc: Location,
    equippedWeapon: Weapon,
    equippedArmour: Armour,
    id: {
        botType: BotType,
        isPlayer: boolean,
        isPvp: boolean,
    }
}
export interface BattleConfig {
    channel: TextBasedChannel,
    users: User[];
    teamMapping: Record<Team, User[]>;
    pvp: boolean;
}
export type BattleField = Map<Location, Entity[]>;
export type Location = 'front' | 'back' | 'front-support' | 'back-support'
export type BotType = 'naught' | 'approach_attack' | 'passive_supportive'
export type Team = 'player' | 'enemy'
export type Character = typeof charactersJSON.Warrior
export type ClashResultFate = "Miss" | "Hit" | "CRIT"
export type WeaponType = 'physical' | 'magical'
export type EntityStats = 'str' | 'dex' | 'spd' | 'siz' | 'int' | 'spr' | 'fai'
export type Reality = 'bruteForce' | 'magicPower' | 'spiritPower' | 'faithPower' | 'weaponPrecision';

export type WeaponMultiplierAction = 'add' | 'multiply';
export type WeaponMultiplier = [EntityStats | Reality, WeaponMultiplierAction, WeaponMultiplier];