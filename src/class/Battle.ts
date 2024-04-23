import { User } from "discord.js";
import charactersJSON from '../data/characters.json';
import { GetUserData } from "../util/database";
import { roundToDecimalPlace, uniformRandom } from "../util/functions";
import { UserData } from "../util/typedef";

type BattleField = Map<Location, Entity[]>;
type Location = 'front' | 'back' | 'front-support' | 'back-support'
type BotType = 'naught' | 'approach_attack' | 'passive_supportive'
type Targetting = 'null' | 'self' | 'ally' | 'enemy'
type AOE = number | 'all'
type Team = 'player' | 'enemy'
type Character = typeof charactersJSON.Warrior
type ClashResultFate = "Miss" | "Hit" | "CRIT"
type WeaponType = 'physical' | 'magical' | 'spiritual' | 'divine'
type EntityStats = 'str' | 'dex' | 'spd' | 'siz' | 'int' | 'spr' | 'fai'
type Reality = 'bruteForce' | 'magicPower' | 'spiritPower' | 'faithPower' | 'weaponPrecision';

type WeaponMultiplierAction = 'add' | 'multiply';
type WeaponMultiplier = [EntityStats | Reality, WeaponMultiplierAction, WeaponMultiplier];


interface Ability {
    name: string,
    cooldown: number,
    desc: string | null,
    targetting: Targetting,
    AOE: AOE,
}
interface Weapon {
    type: WeaponType,
    name: string,
    piercing: number,
    baseDamage: number,
    multipliers: WeaponMultiplier[],
}
interface Armour {
    name: string,
    armour: number,
}
interface EntityConstance {
    owner?: string,
    username?: string,
    iconURL?: string,

    str: number,    // Strength: muscle density
    dex: number,    // Dexterity: precision, skill with physical items and tools
    spd: number,    // Speed: quickness
    siz: number,    // Size: body mass
    int: number,    // Intelligence: knowledge of pragmatic magic
    spr: number,    // Spirit: connection to the spiritual world
    fai: number,    // Faith: faith in the divine

    abilities: Ability[],
    maxHP: number,
    maxOrg: number,
}
interface Entity {
    base: EntityConstance,
    name: string,
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
interface BattleConfig {
    users: User[];
    teamMapping: Record<Team, User>;
    pvp: boolean;
}

export class Battle {
    static readonly LOGCO_ORG = 11.1;
    static readonly XCO_ORG = 0.23;
    static readonly LOGCO_STR_HP = 8.3;
    static readonly XCO_STR_HP = 0.6;
    static readonly LOGCO_SIZ_HP = 12;
    static readonly XCO_SIZ_HP = 0.7;

    // Party
    players: UserData[];
    playerEntities: Entity[];

    // Entity-Related Information
    totalEnemyCount: number = 0;
    enemyCount: number = 0;
    playerCount: number = 0;
    battlefield: BattleField = new Map<Location, Entity[]>();
    toBeSpawnedRecord: Record<Location, Entity[]> = {
        'back': [],
        'back-support': [],
        'front': [],
        'front-support': []
    };

    // gamemode
    pvp: boolean;

    private constructor(c: BattleConfig, party: UserData[]) {
        this.playerEntities = []
        this.players = party;
        this.pvp = c.pvp;
    }

    static GetAdditionalOrgansation(entity: Character): number {
        const { fai, spr, int } = entity;
        const x = roundToDecimalPlace(fai + spr * 0.4 - int * 0.1, 3);
        return Battle.LOGCO_ORG * Math.log(Battle.XCO_ORG * x + 1) + Battle.GetAdditionalHP(entity) * 0.1;
    }

    static GetAdditionalHP(entity: Character): number {
        const { str, siz } = entity;
        const x = roundToDecimalPlace(str * 0.33, 3);
        const z = roundToDecimalPlace(siz * 0.67, 3);
        return Battle.LOGCO_STR_HP * Math.log(Battle.XCO_STR_HP * x + 1) + Battle.LOGCO_SIZ_HP * Math.log(Battle.XCO_SIZ_HP * z + 1);
    }

    static GetEntityConstance(entity: Character): EntityConstance {
        const { name, str, dex, spd, siz, int, spr, fai } = entity;
        return {
            username: name,
            str: str,
            dex: dex,
            spd: spd,
            siz: siz,
            int: int,
            spr: spr,
            fai: fai,
            abilities: [],
            maxHP: 10 + Battle.GetAdditionalHP(entity),
            maxOrg: 5 + Battle.GetAdditionalOrgansation(entity),
        }
    }

    static async Create(c: BattleConfig): Promise<Battle> {
        const party = c.users.map(u => {
            return GetUserData(u.id);
        });
        const battle = new Battle(c, await Promise.all(party));
        // await battle.init();
        return battle;
    }

    static GetEmptyArmour(): Armour {
        return {
            name: 'None',
            armour: 0,
        }
    }

    static GetEmptyWeapon(): Weapon {
        return {
            baseDamage: 1,
            name: 'None',
            type: 'physical',
            piercing: 0,
            multipliers: [],
        }
    }

    static GetEntity(entity: EntityConstance): Entity {
        return {
            base: entity,
            name: entity.username || 'Name',
            HP: entity.maxHP,
            org: entity.maxOrg,
            loc: 'front',
            equippedWeapon: Battle.GetEmptyWeapon(),
            equippedArmour: Battle.GetEmptyArmour(),
            id: {
                botType: 'approach_attack',
                isPlayer: true,
                isPvp: false,
            }
        }
    }

    static GetBruteForce(entity: Entity): number {
        const { str, siz, spd } = entity.base;
        return (str * 0.45) * (1 + (siz ^ 1.5) * 0.3 + spd * 0.1);
    }

    static GetWeaponPrecision(entity: Entity): number {
        const { dex, spd } = entity.base;
        return dex * 0.85 + spd * 0.15;
    }

    static GetAccuracy(entity: Entity): number {
        const { dex, spd } = entity.base;
        return dex * 0.75 + spd * 0.25;
    }

    static GetMagicPotential(entity: Entity): number {
        const { int, spr, fai } = entity.base;
        return int * 0.25 + spr * 0.15 - fai * 0.1;
    }

    static GetSpiritualConnection(entity: Entity): number {
        const { int, spr, fai } = entity.base;
        return spr * 0.25 + fai * 0.15 - int * 0.1;
    }

    static GetDivineConnection(entity: Entity): number {
        const { int, spr, fai } = entity.base;
        return fai * 0.25 + spr * 0.15 - int * 0.1;
    }

    static Decipher(e: Entity, x: WeaponMultiplier): number {
        if (typeof x[2] === 'number') {
            switch (x[0]) {
                case 'bruteForce':
                    return Battle.GetBruteForce(e) * x[2];
                case 'magicPower':
                    return Battle.GetMagicPotential(e) * x[2];
                case 'spiritPower':
                    return Battle.GetSpiritualConnection(e) * x[2];
                case 'faithPower':
                    return Battle.GetDivineConnection(e) * x[2];
                case 'weaponPrecision':
                    return Battle.GetWeaponPrecision(e) * x[2];
                default:
                    return e.base[x[0]] * x[2];
            }
        }
        else {
            switch (x[0]) {
                case 'bruteForce':
                    return Battle.GetBruteForce(e) * Battle.Decipher(e, x[2]);
                case 'magicPower':
                    return Battle.GetMagicPotential(e) * Battle.Decipher(e, x[2]);
                case 'spiritPower':
                    return Battle.GetSpiritualConnection(e) * Battle.Decipher(e, x[2]);
                case 'faithPower':
                    return Battle.GetDivineConnection(e) * Battle.Decipher(e, x[2]);
                case 'weaponPrecision':
                    return Battle.GetWeaponPrecision(e) * Battle.Decipher(e, x[2]);
                default:
                    return e.base[x[0]] * Battle.Decipher(e, x[2]);
            }
        }
    } 

    static CalculateDamage(attacker: Entity, defender: Entity, ability?: Ability) {
        console.log(`\tClash: ${attacker.base.username} => ${defender.base.username}`);
        // let fate: ClashResultFate = 'Miss';
        const damage = attacker.equippedWeapon.multipliers.reduce((acc: number, [stat, action, multiplier]) => {
            console.log(`\t\t${stat} ${action} ${multiplier}: ${acc} ${action === 'add' ? `+ ${Battle.Decipher(attacker, [stat, action, multiplier])}` : `* ${1 + Battle.Decipher(attacker, [stat, action, multiplier])}`}`);
            switch (action) {
                case 'add':
                    return acc + Battle.Decipher(attacker, [stat, action, multiplier]);
                case 'multiply':
                    return acc * (1 + Battle.Decipher(attacker, [stat, action, multiplier]));
                default:
                    return acc;
            }
        }, 0);
        const jitter = uniformRandom(0.95, 1.05);

        return damage * jitter;
    }
    
    static async Clash({
        attacker,
        defender,
        ability,
    }: {attacker: Character,defender: Character,ability: Ability,}
    ) {
        const attackerEntity = Battle.GetEntityConstance(attacker);
        const defenderEntity = Battle.GetEntityConstance(defender);
        const attackerEntityInstance = Battle.GetEntity(attackerEntity);
        const defenderEntityInstance = Battle.GetEntity(defenderEntity);
        const damage = Battle.CalculateDamage(attackerEntityInstance, defenderEntityInstance, ability);
        return damage;
    }
}