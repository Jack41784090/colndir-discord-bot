import { AbilityInstance } from '@classes/Ability';
import { Entity } from '@classes/Battle';
import charactersJSON from '@data/characters.json';
import { Snowflake, TextBasedChannel, User } from 'discord.js';

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
    username?: string,
    id?: string,
    iconURL?: string,
    name: string,
}
export type EntityInitRequirements = Partial<iEntity> & { base: EntityConstance, team: string }
export interface iEntity {
    team: string,
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
    botType: BotType,
    isPlayer: boolean,
    isPvp: boolean,
}

export enum EntityStatusApplyType {
    persistent = 'persistent',
    stackable = 'stackable',
}
export interface EntityStatusSource {
    from: Entity | AbilityInstance,
}
export type EntityStatus = {
    source: EntityStatusSource,
    type: EntityStatusType,
    applyType: EntityStatusApplyType,
    name?: EntityStats,
    value: number,
    duration: number,
}
export enum EntityStatusType {
    IncreaseStat = 'IncreaseStat',
    DecreaseStat = 'DecreaseStat',
    MultiplyStat = 'MultiplyStat',
    Bleed = 'Bleed',
}
export enum TimeSlotState {
    Past = 'past',
    Windup = 'windup',
    Swing = 'swing',
    Recovery = 'recovery',
    Idle = 'idle',
}

export interface TimeSlot {
    ability: AbilityInstance,
    time: number,
}
export interface BattleConfig {
    channel: TextBasedChannel,
    users: User[];
    teamMapping: Record<Snowflake, string>;
}
export type BattleField = Map<Location, Entity[]>;
export type Location = 'front' | 'back' | 'front-support' | 'back-support'
export enum BotType {
    Player = 'player',
    Enemy = 'enemy',
}
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

