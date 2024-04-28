import bot from "@bot";
import { Emoji, INTERFACE_PERSIST_TIME, INTERFACE_REFRESH_TIME } from "@constants";
import { AbilityName, AbilityTrigger, Armour, BattleConfig, BattleField, BotType, Entity, EntityConstance, EntityStatus, EntityStatusApplyType, EntityStatusType, Location, Team, UserData, Weapon } from "@ctypes";
import characterJSON from "@data/characters.json";
import { Clash, GetCombatCharacter, GetEmptyArmour, GetEmptyWeapon, GetEntity, GetEntityConstance, GetUserData, NewObject, capitalize, getErrorEmbed, setUpInteractionCollect, stringifyAbilityList } from "@functions";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CollectedInteraction, EmbedBuilder, InteractionCollector, Message, StringSelectMenuBuilder, StringSelectMenuInteraction, TextBasedChannel, User } from "discord.js";
import { EventEmitter } from "events";
import { AbilityInstance } from "./Ability";

export class EntityInstance implements Entity {
    readonly base: Readonly<EntityConstance>;
    name: string;
    warSupport: number;
    stamina: number;
    HP: number;
    org: number;
    loc: Location;
    status: EntityStatus[] = [];
    equippedWeapon: Weapon;
    equippedArmour: Armour;
    id: {
        botType: BotType;
        isPlayer: boolean;
        isPvp: boolean;
    };

    constructor(_option: Partial<Entity>) {
        const options: Entity = Object.assign({
            warSupport: 1,
            stamina: 1,
            base: NewObject(characterJSON.Dummy),
            name: 'UnregisteredEntity',
            HP: 0,
            org: 0,
            loc: 'front',
            equippedWeapon: GetEmptyWeapon(),
            equippedArmour: GetEmptyArmour(),
            status: [],
            id: {
                botType: 'player',
                isPlayer: true,
                isPvp: false,
            }
        }, _option);

        this.base = options.base;
        this.name = options.name;
        this.warSupport = options.warSupport;
        this.stamina = options.stamina;
        this.HP = options.HP;
        this.org = options.org;
        this.loc = options.loc;
        this.equippedWeapon = options.equippedWeapon;
        this.equippedArmour = options.equippedArmour;
        this.id = options.id;
    }

    applyStatus(s: EntityStatus) {
        const virtualStats = NewObject(this) as Entity;
        switch (s.type) {
            case EntityStatusType.IncreaseStat:
                if (s.name)
                    virtualStats.base[s.name] += s.value;
                break;
            case EntityStatusType.DecreaseStat:
                if (s.name)
                    virtualStats.base[s.name] -= s.value;
                break;
            case EntityStatusType.MultiplyStat:
                if (s.name)
                    virtualStats.base[s.name] *= s.value;
                break;
            case EntityStatusType.Bleed:
                virtualStats.HP -= s.value;
                break;
        }
        s.duration--;
        if (s.duration <= 0) {
            const i = this.status.indexOf(s);
            this.status.splice(i, 1);
        }
        return virtualStats;
    }

    applyCurrentStatus() {
        const virtualStats = NewObject(this) as Entity;
        for (const s of this.status) {
            const sameAbilitySources = this.status.filter(x =>
                x.source.from instanceof AbilityInstance // check if source is an ability
                && (x.source.from as AbilityInstance).name === s.source.from.name); // check if the ability name is the same
            if (s.applyType === EntityStatusApplyType.persistent && sameAbilitySources.length > 1) {
                const strongest = sameAbilitySources.reduce((acc, x) => {
                    if (x.value > acc.value) return x;
                    else return acc;
                }, s);
                Object.assign(virtualStats, this.applyStatus(strongest));
            }
            else {
                Object.assign(virtualStats, this.applyStatus(s));
            }
        }

        return virtualStats;
    }
}

export class Battle extends EventEmitter {
    // Discord 
    channel: TextBasedChannel;
    battleUI: Message | null = null;
    userCache: Record<string, User> = {};

    // Party
    players: UserData[];
    playerEntities: EntityInstance[];

    // Entity-Related Information
    totalEnemyCount: number = 0;
    enemyCount: number = 0;
    playerCount: number = 0;
    battlefield: BattleField = new Map<Location, EntityInstance[]>();
    toBeSpawnedRecord: Record<Location, EntityInstance[]> = {
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
        this.on(AbilityTrigger.Proc, (ability: AbilityInstance) => {
            console.log(`Ability: ${ability.name} procceeded`);
        });
    }

    static async Create(c: BattleConfig): Promise<Battle> {
        const party = c.users.map(u => GetUserData(u.id));
        const battle = new Battle(c, await Promise.all(party));
        const fighters = await Promise.all(
            battle.players.map(async p => {
                const c = await GetCombatCharacter(p.combatCharacters[0])
                if (c) {
                    const cons = GetEntityConstance(c, p);
                    return GetEntity(cons, { name: c.name, id: { botType: BotType.Player, isPlayer: true, isPvp: true } });
                }
                else return null;
            })
        ).then(c => c.filter(x => x !== null) as EntityInstance[]);
        
        battle.userCache = c.users.reduce((acc, u) => {
            acc[u.id] = u;
            return acc;
        }, battle.userCache);
        battle.teamMapping = NewObject(c.teamMapping);
        battle.queueSpawn('front', ...fighters.filter(f => f.id.botType === 'player'));
        return battle;
    }
    
    /**
     * A skirmish is defined as such: a series of clashes between the attacker and the defender, after
     * both had chosen their series of actions under the attack interface.
     * @param attacker 
     * @param defender 
     * @returns 
     */
    skirmish(attacker: EntityInstance, attackerSequence: AbilityInstance[], defender: EntityInstance, defenderSequence: AbilityInstance[]) {
        console.log(`Skirmish: ${attacker.base.username} => ${defender.base.username}`);

        const roundAttacker = NewObject(attacker) as Entity;
        const roundDefender = NewObject(defender) as Entity;
        
        this.emit(AbilityTrigger.StartSkirmish, roundAttacker, roundDefender);
        Object.assign(roundAttacker, attacker.applyCurrentStatus());
        Object.assign(roundDefender, defender.applyCurrentStatus());

        const clashResult = Clash(roundAttacker, roundDefender);
        const {
            pierceDamage,
            forceDamage,
            totalDamage,
        } = clashResult
        this.emit(AbilityTrigger.OnUse, roundAttacker, roundDefender);

        this.emit(AbilityTrigger.EndSkirmish, roundAttacker, roundDefender);

        this.syncVirtualandActual(roundAttacker, attacker);
        this.syncVirtualandActual(roundDefender, defender);

        return void 0;
    }

    syncVirtualandActual(virtual: Entity, actual: EntityInstance) {
        actual.HP = virtual.HP;
        actual.stamina = virtual.stamina;
        actual.org = virtual.org;
        actual.warSupport = virtual.warSupport;
        actual.status = virtual.status;
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

    ensureBattlefieldFormation(formation: Location): EntityInstance[] {
        const form = this.battlefield.get(formation) || this.battlefield.set(formation, []).get(formation)!;
        return form;
    }

    queueSpawn(loc: Location, ...entity: EntityInstance[]) {
        this.toBeSpawnedRecord[loc].push(...entity);
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
        const selectedActionsMap = new Map<string, AbilityInstance[]>();
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
                        selectedActionsMap.set(interface_itr.user.id, abilityList);
                        exit(interface_itr.user).then(() => {
                            resolve(void 0);
                        });
                    }
                    const getInterface = () => {
                        return {
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("Attack Interface")
                                    .setDescription(`${Emoji.TARGET}: ${target?.name || 'None'}\n${Emoji.SWORD}: ${stringifyAbilityList(abilityList) || 'None'}`)
                            ],
                            components: [
                                returnButtonActionRow(),
                                returnSelectMenuActionRow(),
                            ]
                        }
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
                                        Emoji.TARGET:
                                        Emoji.SWORD
                                    ),
                                new ButtonBuilder()
                                    .setCustomId(endTurnID)
                                    .setStyle(ButtonStyle.Danger)
                                    .setLabel('End Turn')
                                    .setEmoji(Emoji.RED_SIGN)
                            )
                    }
                    const returnSelectMenuActionRow = () => {
                        return new ActionRowBuilder<StringSelectMenuBuilder>()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(selectMenuID)
                                    .addOptions(
                                        mode === 'select-ability' ?
                                            Array.from(Object.entries(AbilityName)).map(c => (
                                                {
                                                    label: c[0],
                                                    value: c[1]
                                                }
                                            )):
                                            this.playerEntities.map(e => ({
                                                label: `${e.name} / ${e.base.username}`,
                                                value: e.base.id || ''
                                            }))
                                    )
                            )
                    }
                    const listenToQueue = async (reason: string) => {
                        if (ended) return;
                        // console.log('L ' + reason);
                        await interface_itr.editReply(getInterface());
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
                        }, { max: 1, message: interfaceMessage, time: INTERFACE_REFRESH_TIME * 1000 });
                        listener.on('end', (c, r) => {
                            // console.log('Listener ended ' + r);
                            if (r === 'time') {
                                timeoutCount++;
                                if (timeoutCount >= Math.floor(INTERFACE_PERSIST_TIME / INTERFACE_REFRESH_TIME)) {
                                    closeInterface();
                                }
                                else {
                                    listenToQueue('timeout');
                                }
                            }
                            else if (r === 'limit') {
                                timeoutCount = 0;
                            }
                        })
                    }
                    const handleSelectMenu = async (itr: StringSelectMenuInteraction) => {
                        await itr.deferUpdate();
                        const selected = itr.values[0];
                        if (selected) {
                            if (mode === 'select-ability') {
                                const ability = new AbilityInstance({ associatedBattle: this, name: selected as AbilityName });
                                if (ability) {
                                    mode = 'select-target';
                                    abilityList.push(ability);
                                }
                            }
                            else {
                                const selectedTarget = this.playerEntities.find(e => e.base.id === selected);
                                if (selectedTarget) {
                                    mode = 'select-ability';
                                    target = selectedTarget;
                                }
                            }
                        }
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

                    let target: EntityInstance | null = null;
                    const abilityList: AbilityInstance[] = [];
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


        // 3. Once all players have ended their turn, the round will start.
        await new Promise((resolve) => {
            const interval = setInterval(() => {
                // if (isSubset(this.players.map(p => p.id), turnEnded)) {
                if (turnEnded.length === 1) {
                    clearInterval(interval);
                    resolve(void 0);
                }
            }, 1000);
        });

        // 4. The round will start, and the skirmish will begin.
        const p1 = selectedActionsMap.get(this.playerEntities[0].base.id!) || [];
        const p2 = selectedActionsMap.get(this.playerEntities[1].base.id!) || [];
        p1.forEach(a => a.confirm());
        p2.forEach(a => a.confirm());
        this.skirmish(
            this.playerEntities[0], p1,
            this.playerEntities[1], p2,
        );
    }
}