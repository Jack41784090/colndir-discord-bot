import bot from "@bot";
import { Ability } from "@classes/Ability";
import { Armour, BattleConfig, BattleField, Character, Entity, EntityConstance, Location, Team, UserData, Weapon, WeaponMultiplier } from "@ctypes";
import abilitiesJSON from "@data/abilities.json";
import { GetCombatCharacter, GetUserData, NewObject, capitalize, getErrorEmbed, roundToDecimalPlace, setUpInteractionCollect, uniformRandom } from "@functions";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CollectedInteraction, EmbedBuilder, InteractionCollector, Message, StringSelectMenuBuilder, StringSelectMenuInteraction, TextBasedChannel, User } from "discord.js";
import { EventEmitter } from "events";

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
    userCache: Record<string, User> = {};

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
    teamMapping: Record<Team, User[]> = {
        'player': [],
        'enemy': [],
    }

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
        
        battle.userCache = c.users.reduce((acc, u) => {
            acc[u.id] = u;
            return acc;
        }, battle.userCache);
        battle.teamMapping = NewObject(c.teamMapping);
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
            maxHP: 10 + Battle.GetAdditionalHP(entity),
            maxOrg: 5 + Battle.GetAdditionalOrgansation(entity),
        }
    }

    static GetEntity(entity: EntityConstance): Entity {
        return {
            warSupport: 1,
            stamina: 1,
            base: entity,
            name: entity.name,
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

    private getTeamStatusString(team: Team, ready: string[]) {
        const teamHeader = `## Team ${capitalize(team)}\n`
        const individualStatus = this.teamMapping[team].map(u => {
            const e = this.playerEntities.find(e => e.base.username === u.username);
            if (e) {
                return `\n${ready.includes(e.base.id || '') ? '✅' : '❌'} **${e.name}** / ${this.userCache[e.base.id??''] || `\`${e.base.username}\``} [${e.loc}]`
            }
            else return '';
        }).join('');
        return teamHeader + individualStatus;
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

    async updateBattleUI(ready: string[] = []) {
        if (!this.battleUI) {
            this.battleUI = await this.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Loading Battle...")
                ]
            });
        }

        this.battleUI = await this.battleUI!.edit({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`${this.getTeamStatusString('player', ready)}\n\n${this.getTeamStatusString('enemy', ready)}`)
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('activate-attack-interface')
                            .setStyle(ButtonStyle.Primary)
                            .setLabel('⚔️')
                    )
            ]
        });
        return this.battleUI;
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
        this.updateBattleUI();

        // 1. Click the sword button to activate the attack interface.
        // Each player can only activate the attack interface once, but can come back to it once they end turn.
        const turnEnded: string[] = [];
        const activatedList: string[] = [];
        const enter = async (u: User) => {
            // console.log('Entering ' + u.id);
            activatedList.push(u.id);
            const i = turnEnded.indexOf(u.id)
            if (i !== -1) {
                turnEnded.splice(i, 1);
            }
            await this.updateBattleUI(turnEnded)
            // console.log(activatedList, turnEnded.map(u => u.id));
        }
        const exit = async (u: User) => {
            // console.log('Exiting ' + u.id);
            turnEnded.push(u.id);
            const i = activatedList.indexOf(u.id)
            if (i !== -1) {
                activatedList.splice(i, 1);
            }
            await this.updateBattleUI(turnEnded);
            // console.log(activatedList, turnEnded.map(u => u.id));
        }
        const attackInterfaceCollector = setUpInteractionCollect(bot.user?.client!, async interface_itr => {
            if (interface_itr.isButton() && interface_itr.customId === 'activate-attack-interface') {
                const notAPlayer = !this.players.map(p => p.id).includes(interface_itr.user.id);
                const alreadyActivated = activatedList.includes(interface_itr.user.id);
                if (notAPlayer) {
                    await interface_itr.reply({ embeds: [getErrorEmbed('You are not a player in this battle.')], ephemeral: true });
                    return;
                }
                if (alreadyActivated) {
                    return;
                }
                else await enter(interface_itr.user);

                const interface_res = await interface_itr.deferReply({ ephemeral: true });

                // 2. The attack interface will show as a Promise, resolving when the player ends their turn.
                // interface_itr will be edited a lot.
                await new Promise((resolve) => {
                    const closeInterface = () => {
                        // console.log('Closing interface')
                        listener.stop();
                        ended = true;
                        exit(interface_itr.user).then(() => {
                            resolve(void 0);
                        });
                    }
                    const returnButtonActionRow = () => {
                        return new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(
                                        mode === 'select-ability' ?
                                        switchToSelectTargetID:
                                        switchToSelectAbilityID)
                                    .setLabel(
                                        mode === 'select-ability' ?
                                        'Switch to Select Target':
                                        'Switch to Select Ability'
                                    )
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji(
                                        mode === 'select-ability' ?
                                        '🎯':
                                        '⚔️'
                                    ),
                                new ButtonBuilder()
                                    .setCustomId(endTurnID)
                                    .setStyle(ButtonStyle.Danger)
                                    .setLabel('End Turn')
                                    .setEmoji('🛑')
                            )
                    }
                    const returnSelectMenuActionRow = () => {
                        return new ActionRowBuilder<StringSelectMenuBuilder>()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(selectMenuID)
                                    .addOptions(
                                        mode === 'select-ability' ?
                                            Array.from(Object.values(abilitiesJSON)).map(c => (
                                                {
                                                    label: c.name,
                                                    value: c.name
                                                }
                                            )):
                                            this.playerEntities.map(e => ({
                                                label: e.name,
                                                value: e.base.username!
                                            }))
                                    )
                            )
                    }
                    const listenToQueue = async (reason: string) => {
                        if (ended) return;
                        // console.log('L ' + reason);
                        await interface_itr.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("Attack Interface")
                            ],
                            components: [
                                returnButtonActionRow(),
                                returnSelectMenuActionRow(),
                            ]
                        });
                        listener = setUpInteractionCollect(bot.user?.client!, async itr => {
                            if (itr.isStringSelectMenu() && itr.customId === selectMenuID) {
                                handleSelectMenu(itr);
                            }
                            else if (itr.isButton() && (itr.customId === switchToSelectAbilityID || itr.customId === switchToSelectTargetID || itr.customId === endTurnID)) {
                                handleButton(itr);
                            }
                            else {
                                listenToQueue('invalid interaction');
                            }
                        }, { max: 1, message: interfaceMessage, time: 1 * 1000 });
                        listener.on('end', (c, r) => {
                            // console.log('Listener ended ' + r);
                            if (r === 'time') {
                                if (timeoutCount > 3) {
                                    closeInterface();
                                }
                                listenToQueue('timeout');
                                timeoutCount++;
                            }
                            else if (r === 'limit') {
                                timeoutCount = 0;
                            }
                        })
                    }
                    const handleSelectMenu = async (itr: StringSelectMenuInteraction) => {
                        await itr.deferUpdate();
                        listenToQueue('select-menu selected');
                    }
                    const handleButton = async (itr: ButtonInteraction) => {
                        await itr.deferUpdate();
                        if (itr.customId === endTurnID) {
                            closeInterface();
                        }
                        else {
                            mode = mode === 'select-ability' ? 'select-target' : 'select-ability';
                            listenToQueue('button clicked');
                        }
                    }

                    const endTurnID = `end-turn_${interface_itr.user.id}`;
                    const selectMenuID = `select-menu_${interface_itr.user.id}`;
                    const switchToSelectAbilityID = `switch-to-select-ability_${interface_itr.user.id}`;
                    const switchToSelectTargetID = `switch-to-select-target_${interface_itr.user.id}`;

                    let ended = false;
                    let timeoutCount = 0;
                    let mode: 'select-ability' | 'select-target' = 'select-target';
                    let interfaceMessage: Message;
                    let listener: InteractionCollector<CollectedInteraction>;
                    interface_res.fetch().then(m => {
                        listenToQueue('start');
                        interfaceMessage = m;
                    });
                })

                await interface_itr.deleteReply();
            }
        }, { message: this.battleUI });

        this.emit('endRound');
    }
}