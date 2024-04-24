import { Armour, BattleConfig, BattleField, Character, Entity, EntityConstance, Location, UserData, Weapon, WeaponMultiplier } from "@ctypes";
import { GetCombatCharacter, GetUserData, roundToDecimalPlace, uniformRandom } from "@functions";
import { EmbedBuilder, Message, TextBasedChannel, User } from "discord.js";
import { EventEmitter } from "events";
import { Ability } from "./Ability";

export class Battle extends EventEmitter {
    static readonly LOGCO_ORG = 11.1;
    static readonly XCO_ORG = 0.23;
    static readonly LOGCO_STR_HP = 8.3;
    static readonly XCO_STR_HP = 0.6;
    static readonly LOGCO_SIZ_HP = 12;
    static readonly XCO_SIZ_HP = 0.7;

    // Discord 
    channel: TextBasedChannel;
    battleUI: Message | null = null;

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
        super();
        this.playerEntities = []
        this.players = party;
        this.pvp = c.pvp;
        this.channel = c.channel;
        this.on("procAbility", (ability: Ability) => {
            console.log(`Ability: ${ability.name} executed`);
        });
    }

    static async Create(c: BattleConfig): Promise<Battle> {
        const party = c.users.map(u => GetUserData(u.id));
        const battle = new Battle(c, await Promise.all(party));
        const fighters = await Promise.all(
            battle.players.map(async p => {
                const c = await GetCombatCharacter(p.combatCharacters[0])
                if (c) {
                    const cons = Battle.GetEntityConstance(c, p);
                    return Battle.GetEntity(cons);
                }
                else return null;
            })
        ).then(c => c.filter(x => x !== null) as Entity[]);
        battle.toBeSpawnedRecord.front = fighters;
        return battle;
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

    static GetEntityConstance(entity: Character, player?: User | UserData): EntityConstance {
        const { name, str, dex, spd, siz, int, spr, fai } = entity;
        return {
            username: player?.username ?? name,
            name: name,
            str: str,
            dex: dex,
            spd: spd,
            siz: siz,
            int: int,
            spr: spr,
            fai: fai,
            maxHP: 10 + Battle.GetAdditionalHP(entity),
            maxOrg: 5 + Battle.GetAdditionalOrgansation(entity),
        }
    }

    static GetEntity(entity: EntityConstance): Entity {
        return {
            warSupport: 1,
            stamina: 1,
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
    
    static Clash({
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

    ensureBattlefieldFormation(formation: Location): Entity[] {
        return this.battlefield.get(formation) || this.battlefield.set(formation, []).get(formation)!;
    }

    queueSpawn(entity: Entity, loc: Location) {
        this.toBeSpawnedRecord[loc].push(entity);
    }

    spawnUsers() {
        console.log('Spawning Users');
        for (const [loc, entities] of Object.entries(this.toBeSpawnedRecord)) {
            console.log(`Spawning ${entities.length} entities at ${loc}`);
            this.ensureBattlefieldFormation(loc as Location).push(...entities);
            this.playerEntities.push(...entities);
            this.toBeSpawnedRecord[loc as Location] = [];
        }
        console.log(this.playerEntities.map(e => `${e.name} / ${e.base.username} [${e.loc}]`));
    }

    async startRound() {
        this.emit('startRound');
        if (!this.battleUI) {
            this.battleUI = await this.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Loading Battle...")
                ]
            });
        }
        
        this.spawnUsers();
        

        this.emit('endRound');
    }
}