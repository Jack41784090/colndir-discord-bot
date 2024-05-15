import { Ability, StatusEffect } from "@classes/Ability";
import { Entity } from "@classes/Battle";
import { Emoji, LOGCO_ORG, LOGCO_SIZ_HP, LOGCO_STR_HP, XCO_ORG, XCO_SIZ_HP, XCO_STR_HP, forceFailFallCoef, iEntityKeyEmoji, pierceFailFallCoef } from "@constants";
import { AbilityName, AbilityTrigger, Armour, BeforeAfter, Character, ClashStringParams, DamageReport, EntityConstance, PureCharacter, Reality, StatusEffectApplyType, StatusEffectType, TimeSlotState, ToStringTuple, UserData, Weapon, WeaponMultiplier, iAbility, iBattleResult, iEntity, iEntityStats, iStatusEffect } from "@ctypes";
import charactersJSON from '@data/characters.json';
import { NewObject, clamp, getCharArray, getWithSign, roundToDecimalPlace } from "@functions";
import { Client, CollectedInteraction, EmbedBuilder, Interaction, InteractionCollector, InteractionCollectorOptions, User } from "discord.js";
import { isArray, isNumber } from "mathjs";

export function setUpInteractionCollect( client: Client<true>, cb: (itr: Interaction) => void,
    options: Partial<InteractionCollectorOptions<CollectedInteraction>> = {}) {
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
export function damage(attacker: iEntity, defender: iEntity): DamageReport {
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

export function attack(attacker: Entity | iEntity, target: Entity | iEntity, value: number | ((report: DamageReport) => number), type: keyof iEntityStats = 'hp', apply = false) {
    // const ability = this.getAction();
    // const targetAbility = target.getAction();

    const vattacker =
        attacker instanceof Entity?
            apply?
                attacker.applyCurrentStatus():
                attacker.virtual():
            attacker;
    const vTarget =
        target instanceof Entity?
            apply?
                target.applyCurrentStatus():
                target.virtual():
            target;
    const attackerDiff = apply ? [findDifference(attacker, vattacker)] : [];
    const targetDiff = apply ? [findDifference(target, vTarget)] : [];

    if (value instanceof Function) value = value(damage(vattacker, vTarget));
    const oldValue = vTarget[type];
    vTarget[type] -= value;
    targetDiff.push({
        [type]: [oldValue, vTarget[type]]
    })

    return {
        attackerDiff,
        targetDiff,
        vattacker,
        vTarget,
        value,
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

export function getDefaultAbility(): Omit<Required<iAbility>, 'associatedBattle' | 'attacker' | 'target'> {
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

export function addHPBar(x: {
    maxValue: number,
    nowValue: number,
    reducedValue?: number,
    spiked?: boolean,
    proportion?: number,
}) {
    const bar = '█';
    const line = '|';
    const slush = '░';
    const increased = '▓'

    let { maxValue, nowValue, reducedValue, spiked, proportion } = x;

    // Ensuring non-negative, logical values for parameters
    maxValue = Math.max(0, maxValue);
    nowValue = Math.max(0, Math.min(nowValue, maxValue)); // Ensure within bounds
    reducedValue = Math.min(reducedValue ?? 0, maxValue)
    proportion = Math.max(1, proportion ?? maxValue); // Ensure at least 1 unit

    // Calculate scaling factors and units
    const scaleFactor = proportion / maxValue;
    let currentUnits = Math.round(nowValue * scaleFactor);
    let reducedUnits = Math.round(reducedValue * scaleFactor);
    let increasedUnits = 0;
    if (reducedUnits < 0) {
        currentUnits = Math.max(0, currentUnits + reducedUnits);
        reducedUnits = 0;
        increasedUnits = Math.max(-reducedUnits, Math.round(proportion) - currentUnits);
    }
    let availableUnits = Math.round(proportion) - currentUnits - reducedUnits;

    // Correct any negative unit calculations
    if (availableUnits < 0) {
        const excess = -availableUnits;
        reducedUnits = Math.max(0, reducedUnits - excess); // Reduce reducedUnits first
        availableUnits = 0;
    }

    // Build the health bar string
    let result = '';
    result += bar.repeat(currentUnits);
    result += slush.repeat(reducedUnits);
    result += increased.repeat(increasedUnits);
    result += line.repeat(availableUnits);

    // Add spikes if required
    if (spiked) {
        result = '`' + result + '`';
    }

    return result;
}

type ob = { [key: string]: any };
export function findDifference<T extends ob>(entity1: T, entity2: T, layer = 2): Record<string, ToStringTuple> {
    if (layer < 1) return {} as Record<string, ToStringTuple>;
    const result = {} as Record<string, ToStringTuple>;
    for (const _key in entity1) {
        const key = _key as keyof iEntity;
        if (typeof entity1[key] !== typeof entity2[key]) {
            result[key] = [entity1[key], entity2[key]]
        }
        else if (isArray(entity1[key]) && isArray(entity2[key])) {
            const array1 = entity1[key] as any[];
            const array2 = entity2[key] as any[];
            if (array1.length !== array2.length) {
                result[key] = [array1, array2];
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
                    result[key] = diffArray;
                }
            }
        }
        else if (typeof entity1[key] === 'object') {
            const subResult = findDifference(entity1[key], entity2[key], layer - 1);
            if (Object.keys(subResult).length > 0) {
                result[key] = [entity1[key], entity2[key]];
            }
        }
        else if (entity1[key] !== entity2[key]) {
            result[key] = [entity1[key], entity2[key]];
        }
    }
    return result;
}

export function virtual(entity: iEntity): iEntity {
    return NewObject(entity, {
        actionQueue: entity.actionQueue.map(a => NewObject(a)),
        status: entity.status.map(s => NewObject(s)),
        equippedWeapon: NewObject(entity.equippedWeapon),
        equippedArmour: NewObject(entity.equippedArmour),
    });
}

export function clashString(c: ClashStringParams){
    if ('damage' in c && isNumber(c.entity[c.type])) {
        const max = getMax(c.entity, c.type ?? 'hp') ?? 0
        const now = c.entity[c.type] as number;
        const statusEmoji = iEntityKeyEmoji[c.type as keyof typeof iEntityKeyEmoji] ?? Emoji.STATUS;
        const reactionEmoji = c.damage < 0?
            Emoji.SPARKLES:
            Emoji.BOOM;
        const damageSign = getWithSign(-roundToDecimalPlace(c.damage, 3));
        const hpBar = addHPBar({
            maxValue: max,
            nowValue: now,
            reducedValue: Math.min(c.damage, clamp(max, 0)),
            spiked: true
        });

        return `${statusEmoji} ${reactionEmoji} ${damageSign}\n`+
            `${hpBar} ${now<0?getBelowZeroComment(c.type??'equippedArmour'):""}`;
    }
    else if ('before' in c) {
        const diff = c.after - c.before
        const statusEmoji = iEntityKeyEmoji[c.type as keyof typeof iEntityKeyEmoji] ?? Emoji.STATUS;
        const reactionEmoji = diff > 0?
            Emoji.SPARKLES:
            Emoji.BOOM;
        const damageSign = getWithSign(roundToDecimalPlace(diff, 3));
        const hpBar = addHPBar({
            maxValue: getMax(c.entity, c.type ?? 'hp') ?? 0,
            nowValue: c.after,
            reducedValue: Math.min(-diff, clamp(c.before, 0)),
            spiked: true
        });

        return `${statusEmoji} ${reactionEmoji} ${damageSign}\n`+
            `${hpBar} ${c.after<0?getBelowZeroComment(c.type??'equippedArmour'):""}`;
    }
    return '';
}

export function getBelowZeroComment(element: keyof iEntity) {
    switch (element) {
        case 'hp':
            return `${Emoji.DOUBLE_EXCLAMATION} **DEAD**`;
        case 'pos':
            return `${Emoji.DOUBLE_EXCLAMATION} **POSTURE BREAK**`;
        case 'org':
            return `${Emoji.DOUBLE_EXCLAMATION} **ROUTED**`;
        case 'stamina':
            return `${Emoji.DOUBLE_EXCLAMATION} **EXHAUSTED**`;
        default:
            return '';
    }
}

export function getMax(e: iEntity, key: keyof iEntity) {
    switch(key) {
        case 'hp':
            return maxHP(e.base);
        case 'org':
            return maxOrganisation(e.base);
        case 'pos':
            return maxPosture(e.base);
        case 'stamina':
            return maxStamina(e.base);
        default:
            return null
    }
}

export function stringifyDifference(d: BeforeAfter, entity: Entity) {
    const main = d.map(v => {
        const x = Object.entries(v);
        return x.map(([key, [before, after]]) => {    
            const b4 = before as number;
            const af = after as number;
            if (entity[key as keyof iEntityStats] !== undefined && isNumber(b4) && isNumber(af)) {
                return clashString({
                    entity: entity,
                    before: b4,
                    after: af,
                    type: key as keyof iEntityStats,
                });
            }
            else return '';
        }).filter(x => x).join('\n');
    })
        .join('\n');
    
    return main?
        `# ${entity.getFullName()}: \n${main}\n`:
        '';
}

export function updateRoundEmbed(roundEmbed: EmbedBuilder,dwr: iBattleResult,) {
    return roundEmbed.setDescription(
        `${roundEmbed.data.description ?? ''}\n` +
        `\`\`\` ${dwr.desc} \`\`\`\n` +
        `${stringifyDifference(dwr.attackerDiff, dwr.attacker)}` +
        `${stringifyDifference(dwr.targetDiff, dwr.target)}`
    );
}
