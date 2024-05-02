import { Ability, StatusEffect } from "@classes/Ability";
import { Entity } from "@classes/Battle";
import { Emoji, LOGCO_ORG, LOGCO_SIZ_HP, LOGCO_STR_HP, XCO_ORG, XCO_SIZ_HP, XCO_STR_HP, forceFailFallCoef, pierceFailFallCoef } from "@constants";
import { AbilityName, AbilityTrigger, Armour, Character, EntityConstance, PureCharacter, Reality, StatusEffectApplyType, StatusEffectType, TimeSlotState, UserData, Weapon, WeaponMultiplier, iAbility, iEntity, iStatusEffect } from "@ctypes";
import charactersJSON from '@data/characters.json';
import { NewObject, getCharArray, roundToDecimalPlace } from "@functions";
import { Client, CollectedInteraction, Collection, Interaction, InteractionCollector, InteractionCollectorOptions, User } from "discord.js";
import { isArray } from "mathjs";

export function setUpInteractionCollect(
    client: Client<true>, cb: (itr: Interaction) => void,
    options: Partial<InteractionCollectorOptions<CollectedInteraction>> = {}
) {
    // console.log('Setting up interaction collector...');
    const interCollector = new InteractionCollector(client, options);
    interCollector.on('collect', cb);
    return interCollector;
}

export function weaponDamage(attacker: iEntity): number {
    return attacker.equippedWeapon.multipliers.reduce((acc: number, [stat, action, multiplier]) => {
        // console.log(`\t\t${stat} ${action} ${multiplier}: ${acc} ${action === 'add' ? `+ ${DecipherMultiplier(attacker, [stat, action, multiplier])}` : `* ${1 + DecipherMultiplier(attacker, [stat, action, multiplier])}`}`);
        switch (action) {
            case 'add':
                return acc + DecipherMultiplier(attacker, [stat, action, multiplier]);
            case 'multiply':
                return acc * (1 + DecipherMultiplier(attacker, [stat, action, multiplier]));
            default:
                return acc;
        }
    }, 0);
}
export function pierceDamage(attacker: iEntity, defender: iEntity, wd = weaponDamage(attacker)): number {
    const weaponPierce = attacker.equippedWeapon.pierce;
    const weaponForce = attacker.equippedWeapon.force;
    const armourArmour = defender.equippedArmour.armour;
    const armourStack = Math.min(10, armourArmour / (weaponPierce||1));
    let pierceDamage = wd * (1 + weaponForce * 0.1); // Base damage calculation with force included

    if (weaponPierce <= armourArmour) {
        pierceDamage *= Math.exp(-pierceFailFallCoef * armourStack * (armourArmour - weaponPierce))
    }
    else {
        pierceDamage += 0.5 * (weaponPierce - armourArmour)
    }
    return pierceDamage
}
export function forceDamage(attacker: iEntity, defender: iEntity, wd = weaponDamage(attacker)): number {
    const weaponPierce = attacker.equippedWeapon.pierce;
    const weaponForce = attacker.equippedWeapon.force;
    const armourDefence = defender.equippedArmour.defence;
    const defenceStack = Math.min(10, armourDefence / (weaponForce||1));
    let fd = 0

    if (weaponForce <= armourDefence) {
        fd = wd * Math.exp(-forceFailFallCoef * defenceStack * (armourDefence - weaponForce))
    }
    else {
        fd = wd * (weaponForce / (armourDefence || 1)**1.005)
    }
    return fd
}
export function damage(attacker: iEntity, defender: iEntity) {
    const weaponPierce = attacker.equippedWeapon.pierce;
    const weaponForce = attacker.equippedWeapon.force;
    const armourArmour = defender.equippedArmour.armour;
    const armourDefence = defender.equippedArmour.defence;
    const wd = weaponDamage(attacker);
    let pd = pierceDamage(attacker, defender, wd);
    let fd = forceDamage(attacker, defender, wd);

    return {
        weaponPierce,
        weaponForce,
        armourArmour,
        armourDefence,

        weaponDamage: wd,
        pierceDamage: pd,
        forceDamage: fd,
        totalDamage: pd + fd,
    }
}
export function additionalOrgansation(entity:PureCharacter): number {
    const { fai, spr, int } = entity;
    const x = roundToDecimalPlace(fai + spr * 0.4 - int * 0.1, 3);
    return LOGCO_ORG * Math.log(XCO_ORG * x + 1) + additionalHP(entity) * 0.1;
}
export function maxOrganisation(entity: EntityConstance): number {
    return 5 + additionalOrgansation(entity);
}
export function additionalStamina(entity: PureCharacter): number {
    const { str, siz, end } = entity;
    const x = roundToDecimalPlace(str * 0.15 - siz * 0.1 + end * 0.7, 3);
    return LOGCO_ORG * Math.log(XCO_ORG * x + 1);
}
export function maxStamina(entity: EntityConstance): number {
    return 5 + additionalStamina(entity);
}
export function additionalPosture(entity: PureCharacter): number {
    const { str, dex, acr } = entity;
    const x = roundToDecimalPlace(dex * 0.55 + str * 0.25 + acr * 0.175, 3);
    return LOGCO_ORG * Math.log(XCO_ORG * x + 1) * 0.1;
}
export function maxPosture(entity: EntityConstance): number {
    return 5 + additionalPosture(entity);
}
export function additionalHP(entity:PureCharacter): number {
    const { str, siz } = entity;
    const x = roundToDecimalPlace(str * 0.33, 3);

    const z = roundToDecimalPlace(siz * 0.67, 3);
    return LOGCO_STR_HP * Math.log(XCO_STR_HP * x + 1) + LOGCO_SIZ_HP * Math.log(XCO_SIZ_HP * z + 1);
}
export function maxHP(entity: EntityConstance): number {
    return 10 + additionalHP(entity);
}
export function reality(entity: iEntity, reality: Reality): number {
    const { str, siz, spd, dex, int, spr, fai, wil } = entity.base;
    switch (reality) {
        case Reality.Force:
            return (str * 0.45) * (1 + (siz ** 1.5) * 0.3);
        case Reality.Mana:
            return int * 0.25 + spr * 0.15 - fai * 0.1;
        case Reality.Spirituality:
            return spr * 0.25 + fai * 0.15 - int * 0.1;
        case Reality.Divinity:
            return fai * 0.25 + spr * 0.15 - int * 0.1;
        case Reality.Precision:
            return dex * 0.85 + spd * 0.15;
        case Reality.Convince:
            return dex * 0.75 + spd * 0.25;
        case Reality.Maneuver:
            return dex * 0.75 + spd * 0.25;
        case Reality.Bravery:
            return fai * 0.55 + wil * 0.45 + spr * 0.05;
            default:
            return entity.base[reality];
    }
}
export function defaultArmour(): Armour {
    return {
        name: 'None',
        armour: 0,
        defence: 0,
    }
}
export function defaultWeapon(): Weapon {
    return {
        pierce: 0,
        force: 0,
        name: 'None',
        type: 'physical',
        multipliers: [
            [Reality.Force, 'add', 1],
            [Reality.Precision, 'multiply', .1]
        ],
    }
}

export function getDefaultCharacter(): PureCharacter {
    return NewObject(charactersJSON.Dummy);
}
export function GetEntityConstance(entity: Character, player?: User | UserData): EntityConstance {
    const { name, str, dex, spd, siz, int, spr, fai, end, cha, beu, wil, acr } = entity;
    return {
        id: player?.id ?? getCharArray(20),
        username: player?.username,
        name: name,
        acr: acr,
        str: str,
        dex: dex,
        spd: spd,
        siz: siz,
        int: int,
        spr: spr,
        fai: fai,
        end: end,
        cha: cha,
        beu: beu,
        wil: wil,
    }
}

export function DecipherMultiplier(e: iEntity, x: WeaponMultiplier): number {
    const i = x[0]
    if (typeof x[2] === 'number') {
        return reality(e, i as Reality) * x[2];
    }
    else {
        return reality(e, i as Reality) * DecipherMultiplier(e, x[2]);
    }
}

export function syncVirtualandActual(virtual: iEntity, actual: Entity) {
    actual.hp = virtual.hp;
    actual.stamina = virtual.stamina;
    actual.org = virtual.org;
    actual.warSupport = virtual.warSupport;
    actual.status = virtual.status;
    actual.pos = virtual.pos;
    actual.loc = virtual.loc;
}

export function getKeyFromEnumValue(enumObj: any, value: any): string | undefined {
    return Object.keys(enumObj).find(key => enumObj[key] === value);
}

export function stringifyAbility(ability: Ability) {
    return `[\`${ability.name}\`] ${ability.desc}`;
}

export function getAbilityState(ability: Ability, time: number): TimeSlotState {
    const { begin, windup, swing, recovery } = ability;
    if (ability.getFinishTime() < time) return TimeSlotState.Past;
    if (time < begin) return TimeSlotState.Idle;
    if (time < begin + windup) return TimeSlotState.Windup;
    if (time < begin + windup + swing) return TimeSlotState.Swing;
    if (time < begin + windup + swing + recovery) return TimeSlotState.Recovery;
    return TimeSlotState.Idle;
}

export function getDefaultAbility(): Omit<Required<iAbility>, 'associatedBattle' | 'initiator' | 'target'> {
    return {
        trigger: AbilityTrigger.Immediate,
        name: AbilityName.Idle,
        desc: null,
        targetting: 'enemy',
        AOE: 1,
        castLocation: ['front'],
        targetLocation: ['front'],
        windup: 0,
        swing: 0,
        recovery: 0,
        begin: -1,
    }
}

export function getDefaultStatusEffect(): Omit<iStatusEffect, 'source'> {
    return {
        emoji: Emoji.STATUS,
        type: StatusEffectType.None,
        applyType: StatusEffectApplyType.stackable,
        value: 0,
        duration: 0,
    }
}

export function getRealAbilityName(ability: AbilityName): string {
    return getKeyFromEnumValue(AbilityName, ability) ?? ability;
}

export function addHPBar(_maxValue: number, _nowValue: number, spiked = false, _maxBarProportion = Math.round(_maxValue)) {
    const bar = '█';
    const line = '|';

    if (_maxValue < 0) _maxValue = 0;
    if (_nowValue < 0) _nowValue = 0;
    if (_nowValue > _maxValue) _nowValue = _maxValue;

    const maxValue =
        _maxValue * (_maxBarProportion / _maxValue);
    const nowValue =
        _nowValue * (_maxBarProportion / _maxValue);

    const blockCount =
        nowValue <= 0?
            0:
            Math.round(nowValue);
    const lineCount = Math.round(maxValue) - blockCount;

    // debug("_maxBarProportion", _maxBarProportion);
    // debug("_maxValue", _maxValue);
    // debug("_nowValue", _nowValue);
    // debug("maxValue", maxValue);
    // debug("nowValue", nowValue);
    // debug("blockCount", blockCount);
    // debug("lineCount", lineCount);

    let result = '';
    for (let i = 0; i < blockCount; i++) {
        result += bar;
    }
    for (let i = 0; i < lineCount; i++) {
        result += line;
    }
    const spikes = spiked? '`': '';

    return spikes + result + spikes;
}

type ob = { [key: string]: any };
export function findDifference(entity1: ob, entity2: ob, layer = 2) {
    if (layer < 1) return new Collection<string, [{ toString: () => string }, { toString: () => string }]>();

    if ('emoji' in entity1) console.log('Finding difference...', entity1, entity2)
    const result = new Collection<string, [{ toString: () => string }, { toString: () => string }]>();
    for (const _key in entity1) {
        const key = _key as keyof iEntity;
        if (typeof entity1[key] !== typeof entity2[key]) {
            result.set(key, [entity1[key], entity2[key]]);
        }
        else if (isArray(entity1[key]) && isArray(entity2[key])) {
            const array1 = entity1[key] as any[];
            const array2 = entity2[key] as any[];
            if (array1.length !== array2.length) {
                result.set(key, [array1, array2]);
            }
            else {
                const diffArray: [StatusEffect[], StatusEffect[]] = [[], []];
                for (let i = 0; i < array1.length; i++) {
                    if (array1[i] !== array2[i]) {
                        diffArray[0].push(array1[i]);
                        diffArray[1].push(array2[i]);
                    }
                }
                if (diffArray[0].length > 0) {
                    result.set(key, diffArray);
                }
            }
        }
        else if (typeof entity1[key] === 'object') {
            const subResult = findDifference(entity1[key], entity2[key], layer - 1);
            if (subResult.size > 0) {
                result.set(key, [entity1[key], entity2[key]]);
            }
        }
        else if (entity1[key] !== entity2[key]) {
            result.set(key, [entity1[key], entity2[key]]);
        }
    }
    return result;
}

export function virtual(entity: Entity): iEntity {
    return NewObject(entity, {
        status: entity.status.map(s => NewObject(s)),
        equippedWeapon: NewObject(entity.equippedWeapon),
        equippedArmour: NewObject(entity.equippedArmour),
        base: NewObject(entity.base),
    });
}
