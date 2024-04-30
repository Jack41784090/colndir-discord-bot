import { AbilityInstance } from "@classes/Ability";
import { Entity, Team } from "@classes/Battle";
import { LOGCO_ORG, LOGCO_SIZ_HP, LOGCO_STR_HP, XCO_ORG, XCO_SIZ_HP, XCO_STR_HP, forceFailFallCoef, pierceFailFallCoef } from "@constants";
import { Ability, AbilityName, AbilityTrigger, Armour, Character, EntityConstance, EntityInitRequirements, Reality, TimeSlotState, UserData, Weapon, WeaponMultiplier, iEntity } from "@ctypes";
import { roundToDecimalPlace } from "@functions";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, CollectedInteraction, EmbedBuilder, Interaction, InteractionCollector, InteractionCollectorOptions, User } from "discord.js";

export function setUpInteractionCollect(
    client: Client<true>, cb: (itr: Interaction) => void,
    options: Partial<InteractionCollectorOptions<CollectedInteraction>> = {}
) {
    // console.log('Setting up interaction collector...');
    const interCollector = new InteractionCollector(client, options);
    interCollector.on('collect', cb);
    return interCollector;
}

export function calculateWeaponDamage(attacker: iEntity): number {
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

export function calculatePierceDamage(attacker: iEntity, defender: iEntity, weaponDamage = calculateWeaponDamage(attacker)): number {
    // Pierce damage calculation
    // if (armourArmour <= weaponPierce) {
    //     pierceDamage *= (1 + Math.abs(armourArmour - weaponPierce) * 0.1);
    // }
    // else if (weaponPierce >= armourArmour * 0.5) {
    //     pierceDamage -= (armourArmour - weaponPierce);
    // }
    // else {
    //     pierceDamage -= ((armourArmour - weaponPierce)**2);
    // }

    const weaponPierce = attacker.equippedWeapon.pierce;
    const weaponForce = attacker.equippedWeapon.force;
    const armourArmour = defender.equippedArmour.armour;
    const armourStack = Math.min(10, armourArmour / weaponPierce);
    let pierceDamage = weaponDamage * (1 + weaponForce * 0.1); // Base damage calculation with force included

    if (weaponPierce <= armourArmour) {
        pierceDamage *= Math.exp(-pierceFailFallCoef * armourStack * (armourArmour - weaponPierce))
    }
    else {
        pierceDamage += 0.5 * (weaponPierce - armourArmour)
    }
    return pierceDamage
}

export function calculateForceDamage(attacker: iEntity, defender: iEntity, weaponDamage = calculateWeaponDamage(attacker)): number {
    const weaponPierce = attacker.equippedWeapon.pierce;
    const weaponForce = attacker.equippedWeapon.force;
    const armourDefence = defender.equippedArmour.defence;
    const defenceStack = Math.min(10, armourDefence / weaponForce);
    let forceDamage = 0

    if (weaponForce <= armourDefence) {
        forceDamage = weaponDamage * Math.exp(-forceFailFallCoef * defenceStack * (armourDefence - weaponForce))
    }
    else {
        forceDamage = weaponDamage * (weaponForce / (armourDefence || 1)**1.005)
    }
    return forceDamage
}

export function Clash(attacker: iEntity, defender: iEntity) {
    // console.log(`\tClash: ${attacker.base.username} => ${defender.base.username}`);

    const weaponPierce = attacker.equippedWeapon.pierce;
    const weaponForce = attacker.equippedWeapon.force;
    const armourArmour = defender.equippedArmour.armour;
    const armourDefence = defender.equippedArmour.defence;
    const weaponDamage = calculateWeaponDamage(attacker);
    let pierceDamage = calculatePierceDamage(attacker, defender, weaponDamage);
    let forceDamage = calculateForceDamage(attacker, defender, weaponDamage);

    return {
        weaponPierce,
        weaponForce,
        armourArmour,
        armourDefence,

        pierceDamage,
        forceDamage,
        totalDamage: pierceDamage + forceDamage,
    }
}

export function GetAdditionalOrgansation(entity: Omit<Character, 'authorised' | 'description'>): number {
    const { fai, spr, int } = entity;
    const x = roundToDecimalPlace(fai + spr * 0.4 - int * 0.1, 3);
    return LOGCO_ORG * Math.log(XCO_ORG * x + 1) + GetAdditionalHP(entity) * 0.1;
}

export function GetMaxOrganisation(entity: EntityConstance): number {
    return 5 + GetAdditionalOrgansation(entity);
}

export function GetAdditionalHP(entity: Omit<Character, 'authorised' | 'description'>): number {
    const { str, siz } = entity;
    const x = roundToDecimalPlace(str * 0.33, 3);
    const z = roundToDecimalPlace(siz * 0.67, 3);
    return LOGCO_STR_HP * Math.log(XCO_STR_HP * x + 1) + LOGCO_SIZ_HP * Math.log(XCO_SIZ_HP * z + 1);
}

export function GetMaxHP(entity: EntityConstance): number {
    return 10 + GetAdditionalHP(entity);
}

export function GetEmptyArmour(): Armour {
    return {
        name: 'None',
        armour: 0,
        defence: 0,
    }
}

export function GetEmptyWeapon(): Weapon {
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

export function GetEntityConstance(entity: Character, player?: User | UserData): EntityConstance {
    const { name, str, dex, spd, siz, int, spr, fai, end, cha, beu, wil } = entity;
    return {
        id: player?.id,
        username: player?.username,
        name: name,
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

export function GetRealityValue(entity: iEntity, reality: Reality): number {
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

export function DecipherMultiplier(e: iEntity, x: WeaponMultiplier): number {
    const i = x[0]
    if (typeof x[2] === 'number') {
        return GetRealityValue(e, i as Reality) * x[2];
    }
    else {
        return GetRealityValue(e, i as Reality) * DecipherMultiplier(e, x[2]);
    }
}


export function syncVirtualandActual(virtual: iEntity, actual: Entity) {
    actual.HP = virtual.HP;
    actual.stamina = virtual.stamina;
    actual.org = virtual.org;
    actual.warSupport = virtual.warSupport;
    actual.status = virtual.status;
}


export function getKeyFromEnumValue(enumObj: any, value: any): string | undefined {
    return Object.keys(enumObj).find(key => enumObj[key] === value);
}

export function stringifyAbility(ability: AbilityInstance) {
    return `[\`${ability.name}\`] ${ability.desc}`;
}

export function getAbilityState(ability: AbilityInstance, time: number): TimeSlotState {
    const { begin, windup, swing, recovery } = ability;
    if (ability.getFinishTime() < time) return TimeSlotState.Past;
    if (time < begin) return TimeSlotState.Idle;
    if (time < begin + windup) return TimeSlotState.Windup;
    if (time < begin + windup + swing) return TimeSlotState.Swing;
    if (time < begin + windup + swing + recovery) return TimeSlotState.Recovery;
    return TimeSlotState.Idle;
}

export function getDefaultAbility(): Omit<Required<Ability>, 'associatedBattle' | 'initiator' | 'target'> {
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
