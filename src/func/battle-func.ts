import { AbilityInstance } from "@classes/Ability";
import { EntityInstance } from "@classes/Battle";
import { LOGCO_ORG, LOGCO_SIZ_HP, LOGCO_STR_HP, XCO_ORG, XCO_SIZ_HP, XCO_STR_HP } from "@constants";
import { Armour, Character, Entity, EntityConstance, Reality, UserData, Weapon, WeaponMultiplier } from "@ctypes";
import { roundToDecimalPlace, uniformRandom } from "@functions";
import { Client, CollectedInteraction, Interaction, InteractionCollector, InteractionCollectorOptions, User } from "discord.js";

export function setUpInteractionCollect(
    client: Client<true>, cb: (itr: Interaction) => void,
    options: Partial<InteractionCollectorOptions<CollectedInteraction>> = {}
) {
    // console.log('Setting up interaction collector...');
    const interCollector = new InteractionCollector(client, options);
    interCollector.on('collect', cb);
    return interCollector;
}

export function Clash(attacker: Entity, defender: Entity, ability?: AbilityInstance) {
    console.log(`\tClash: ${attacker.base.username} => ${defender.base.username}`);

    if (ability) {
            
    }

    const damage = attacker.equippedWeapon.multipliers.reduce((acc: number, [stat, action, multiplier]) => {
        console.log(`\t\t${stat} ${action} ${multiplier}: ${acc} ${action === 'add' ? `+ ${DecipherMultiplier(attacker, [stat, action, multiplier])}` : `* ${1 + DecipherMultiplier(attacker, [stat, action, multiplier])}`}`);
        switch (action) {
            case 'add':
                return acc + DecipherMultiplier(attacker, [stat, action, multiplier]);
            case 'multiply':
                return acc * (1 + DecipherMultiplier(attacker, [stat, action, multiplier]));
            default:
                return acc;
        }
    }, 0);
    const jitter = uniformRandom(0.95, 1.05);

    return damage * jitter;
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
        force: 0,
        name: 'None',
        type: 'physical',
        pierce: 0,
        multipliers: [],
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

export function GetEntity(base: EntityConstance, options: Partial<Entity> = {}): EntityInstance {
    return new EntityInstance({ base: base, ...options });
}

export function GetRealityValue(entity: Entity, reality: Reality): number {
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

export function DecipherMultiplier(e: Entity, x: WeaponMultiplier): number {
    const i = x[0]
    if (typeof x[2] === 'number') {
        return GetRealityValue(e, i as Reality) * x[2];
    }
    else {
        return GetRealityValue(e, i as Reality) * DecipherMultiplier(e, x[2]);
    }
}
