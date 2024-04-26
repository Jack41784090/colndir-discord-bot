import { EntityInstance } from '@classes/Battle';
import charactersJSON from '@data/characters.json';
import { TextBasedChannel, User } from 'discord.js';

export type WeaponType = 'physical' | 'magical'
export type WeaponMultiplierAction = 'add' | 'multiply';
export type WeaponMultiplier = [Reality, WeaponMultiplierAction, WeaponMultiplier | number];
export interface Weapon {
    type: WeaponType,
    name: string,
    pierce: number,
    force: number,
    multipliers: WeaponMultiplier[],
}
export interface Armour {
    name: string,
    armour: number,
    defence: number,
}

// // Physical attributes
// str: number,    // Strength: muscle density
// dex: number,    // Dexterity: precision, skill with physical items and tools
// spd: number,    // Speed: quickness
// siz: number,    // Size: body mass
// end: number,    // Endurance: stamina, resistance to fatigue

// // Mental attributes
// int: number,    // Intelligence: knowledge of pragmatic magic
// spr: number,    // Spirit: connection to the spiritual world
// fai: number,    // Faith: faith in the divine
// wil: number,    // Willpower: mental strength
// cha: number,    // Charisma: ability to influence others
// beu: number,    // Beauty: physical appearance
export interface EntityConstance extends PureCharacter {
    owner?: string,
    username?: string,
    id?: string,
    iconURL?: string,
    name: string,
}
export interface Entity {
    base: EntityConstance,
    name: string,
    warSupport: number,
    stamina: number,
    HP: number,
    org: number,
    loc: Location,

    status: EntityStatus[],

    equippedWeapon: Weapon,
    equippedArmour: Armour,
    id: {
        botType: BotType,
        isPlayer: boolean,
        isPvp: boolean,
    }
}
export type EntityStatus = {
    type: EntityStatusType,
    name: EntityStats,
    value: number,
    duration: number,
}
export enum EntityStatusType {
    IncreaseStat = 'IncreaseStat',
    DecreaseStat = 'DecreaseStat',
    MultiplyStat = 'MultiplyStat',
}

export interface BattleConfig {
    channel: TextBasedChannel,
    users: User[];
    teamMapping: Record<Team, User[]>;
    pvp: boolean;
}
export type BattleField = Map<Location, EntityInstance[]>;
export type Location = 'front' | 'back' | 'front-support' | 'back-support'
export type BotType = 'naught' | 'approach_attack' | 'passive_supportive'
export type Team = 'player' | 'enemy'
export type Character = typeof charactersJSON.Dummy
export type PureCharacter = Omit<Character, 'name' | 'description' | 'authorised'>
export type ClashResultFate = "Miss" | "Hit" | "CRIT"
export type EntityStats = keyof Omit<EntityConstance, 'name' | 'owner' | 'username' | 'id' | 'iconURL'>;
export enum Reality {
    Force = 'force',
    Mana = 'mana',
    Spirituality = 'spirituality',
    Divinity = 'divinity',
    Precision = 'precision',
    Maneuver = 'maneuver',
    Convince = 'convince',
    Bravery = 'bravery',
}

