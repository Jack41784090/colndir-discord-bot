import bot from "@bot";
import { Emoji, INTERFACE_PERSIST_TIME, INTERFACE_REFRESH_TIME } from "@constants";
import { AbilityName, AbilityTrigger, Armour, BattleConfig, BattleField, BotType, EntityConstance, EntityInitRequirements, EntityStatus, EntityStatusApplyType, EntityStatusType, Location, TimeSlot, TimeSlotState, UserData, Weapon, iEntity } from "@ctypes";
import { Clash, GetCombatCharacter, GetEmptyArmour, GetEmptyWeapon, GetEntityConstance, GetUserData, NewObject, capitalize, getAbilityState, getErrorEmbed, getKeyFromEnumValue, getLoadingEmbed, isSubset, setUpInteractionCollect, stringifyAbility, syncVirtualandActual } from "@functions";
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CollectedInteraction, Collection, EmbedBuilder, Interaction, InteractionCollector, InteractionResponse, Message, StringSelectMenuBuilder, StringSelectMenuInteraction, TextBasedChannel, User } from "discord.js";
import { EventEmitter } from "events";
import { AbilityInstance } from "./Ability";

class ActionRequest {
    private interfaceMessage: Message | null;
    public battle: Battle;
    private readied = new Set<string>();
    private turnEnded: Set<string> = new Set();
    private activatedList: Set<string> = new Set();
    
    private constructor(b: Battle, m: Message) {
        // Implementation of GameSession
        this.battle = b;
        this.interfaceMessage = m;
    }

    public static async Create(b: Battle, readied: string[]) {
        const instance = new ActionRequest(b, await b.channel.send({ embeds: [ getLoadingEmbed() ] }));
        instance.readied = new Set(readied);
        return instance;
    }

    public async enter(user: User) {
        this.activatedList.add(user.id);
        this.turnEnded.delete(user.id);
        await this.updateAttackInterface();
    }

    public async exit(user: User) {
        this.turnEnded.add(user.id);
        this.activatedList.delete(user.id);
        await this.updateAttackInterface();
    }

    private async handleInteraction(interface_itr: Interaction) {
        if (!interface_itr.isButton() || interface_itr.customId !== 'activate-attack-interface') return;
        
        const user = interface_itr.user;
        const notAPlayer = !this.battle.userDataList.some(p => p.id === user.id);
        const alreadyActivated = this.activatedList.has(user.id);
        const isReady = !this.readied.has(user.id);
        
        if (notAPlayer || alreadyActivated || isReady) {
            await interface_itr.reply({
                embeds: [this.getErrorEmbed(user)],
                ephemeral: true
            });
            return;
        }
        
        await this.enter(user);
        const interface_res = await interface_itr.deferReply({ ephemeral: true });
        return AttackInterface.New(this, interface_itr, interface_res);
    }

    private getErrorEmbed(user: User): EmbedBuilder {
        const reasons = [
            this.battle.userDataList.some(p => p.id === user.id) ? '' : 'You are not a player.',
            this.activatedList.has(user.id) ? 'You have already activated the attack interface.' : '',
            this.turnEnded.has(user.id) ? `You are ready for action. Ability is \`${this.battle.playerTimeslots.get(user.id)?.[0]?.ability.name}\`.` : '',
        ].filter(Boolean).join(' ');

        return new EmbedBuilder().setDescription(`You cannot make a selection. Reason: ${reasons || 'Unknown reason'}`);
    }

    public async setupInteractionCollector() {
        await this.updateAttackInterface()
        setUpInteractionCollect(
            bot.user?.client!,
            this.handleInteraction.bind(this),
            { message: this.interfaceMessage }
        );

        await new Promise(resolve => {
            const interval = setInterval(() => {
                if (isSubset(this.turnEnded, this.readied)) {
                    console.log('||=> All players have ended their turn');
                    clearInterval(interval);
                    this.interfaceMessage?.delete();
                    resolve(void 0);
                }
            }, 1000);
        });
    }

    private async updateAttackInterface() {
        if (this.interfaceMessage) {
            this.interfaceMessage = await this.interfaceMessage.edit(this.battle.attackInterface_get()).catch(console.error) ?? null;
            return this.interfaceMessage;
        }
        else {
            this.interfaceMessage = await this.battle.channel.send(this.battle.attackInterface_get()).catch(console.error) ?? null;
            return this.interfaceMessage;
        }
    }
}

class AttackInterface {
    public interfacePromise: Promise<unknown>;
    public interfacePromise_resolve?: (value: unknown) => void;

    private interface_itr: ButtonInteraction;
    private interaction_res: InteractionResponse;

    private actionRequest: ActionRequest;
    private endTurnID: string;
    private selectMenuID: string;
    private switchToSelectAbilityID: string;
    private switchToSelectTargetID: string;

    private target: Entity | null = null;
    private selectedAbility: AbilityInstance | null = null;
    private ended = false;
    private timeoutCount = 0;
    private mode: 'select-ability' | 'select-target' = 'select-target';
    private interfaceMessage: Message | undefined;
    private listener: InteractionCollector<CollectedInteraction> | undefined;

    static async New(ar: ActionRequest, itr: ButtonInteraction, resItr: InteractionResponse) {
        const instance = new AttackInterface(ar, itr, resItr);
        instance.start();
        return instance.interfacePromise;
    }

    private constructor(ar: ActionRequest, itr: ButtonInteraction, resItr: InteractionResponse) {
        this.interface_itr = itr;
        this.interaction_res = resItr;
        this.actionRequest = ar;
        this.endTurnID  = `end-turn_${itr.user.id}`
        this.selectMenuID = `select-menu_${itr.user.id}`;
        this.switchToSelectAbilityID = `switch-to-select-ability_${itr.user.id}`;
        this.switchToSelectTargetID = `switch-to-select-target_${itr.user.id}`

        this.interfacePromise = new Promise(resolve => {
            this.interfacePromise_resolve = resolve;
        });
    }

    public closeInterface() {
        // console.log('Closing interface')
        const battle = this.actionRequest.battle;
        if (this.listener) this.listener.stop();
        this.ended = true;
        battle.queueTimelineAbilities(
            this.interface_itr.user.id,
            this.selectedAbility ??
                new AbilityInstance({ associatedBattle: battle, name: AbilityName.Idle }));
        this.actionRequest.exit(this.interface_itr.user).then(() => {
            while (!this.interfacePromise_resolve) {}
            this.interface_itr.deleteReply();
            this.interfacePromise_resolve(void 0);
        });
    }

    public getInterface() {
        return {
            embeds: [
                new EmbedBuilder()
                    .setTitle("Attack Interface")
                    .setDescription(
                        `${Emoji.TARGET}: ${this.target?.name || 'None'}\n`+
                        `${Emoji.SWORD}: ${this.selectedAbility ? stringifyAbility(this.selectedAbility) : 'None'}`
                    )
            ],
            components: [
                this.returnButtonActionRow(),
                this.returnSelectMenuActionRow(),
            ]
        }
    }

    private returnButtonActionRow() {
        return new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        this.mode === 'select-ability' ?
                        this.switchToSelectTargetID:
                        this.switchToSelectAbilityID)
                    .setLabel(
                        this.mode === 'select-ability' ?
                        'Switch to Select Target':
                        'Switch to Select Ability'
                    )
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(
                        this.mode === 'select-ability' ?
                        Emoji.TARGET:
                        Emoji.SWORD
                    ),
                new ButtonBuilder()
                    .setCustomId(this.endTurnID)
                    .setStyle(ButtonStyle.Danger)
                    .setLabel('End Turn')
                    .setEmoji(Emoji.RED_SIGN)
            )
    }

    private returnSelectMenuActionRow() {
        return new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(this.selectMenuID)
                    .addOptions(
                        this.mode === 'select-ability' ?
                            Array.from(Object.entries(AbilityName)).map(c => (
                                {
                                    label: c[0],
                                    value: c[1]
                                }
                            )):
                            this.actionRequest.battle.playerEntitiesList.map(e => ({
                                label: `${e.name} / ${e.base.username}`,
                                value: e.base.id || ''
                            }))
                    )
            )
    }

    private async listenToQueue(reason: string) {
        if (this.ended) return;
        // console.log('L ' + reason);
        await this.interface_itr.editReply(this.getInterface());
        this.listener = setUpInteractionCollect(bot.user?.client!, async itr => {
            if (itr.isStringSelectMenu() && itr.customId === this.selectMenuID) {
                this.handleSelectMenu(itr);
            }
            else if (itr.isButton() && (itr.customId === this.switchToSelectAbilityID || itr.customId === this.switchToSelectTargetID || itr.customId === this.endTurnID)) {
                this.handleButton(itr);
            }
            else {
                this.listenToQueue('invalid interaction');
            }
        }, { max: 1, message: this.interfaceMessage, time: INTERFACE_REFRESH_TIME * 1000 });
        this.listener.on('end', (_, r: string) => {
            // console.log('Listener ended ' + r);
            if (r === 'time') {
                this.timeoutCount++;
                if (this.timeoutCount >= Math.floor(INTERFACE_PERSIST_TIME / INTERFACE_REFRESH_TIME)) {
                    this.closeInterface();
                }
                else {
                    this.listenToQueue('timeout');
                }
            }
            else if (r === 'limit') {
                this.timeoutCount = 0;
            }
        })
    }

    private async handleSelectMenu(itr: StringSelectMenuInteraction) {
        await itr.deferUpdate();
        const battle = this.actionRequest.battle;
        const selected = itr.values[0];
        if (selected) {
            if (this.mode === 'select-ability') {
                const ability = battle.newAbilityAtCurrentTime_get(selected as AbilityName);
                if (ability) {
                    this.mode = 'select-target';
                    this.selectedAbility = ability;
                }
            }
            else {
                const selectedTarget = battle.playerEntitiesList.find(e => e.base.id === selected);
                if (selectedTarget) {
                    this.mode = 'select-ability';
                    this.target = selectedTarget;
                }
            }
        }
        this.listenToQueue('select-menu selected');
    }

    private async handleButton(itr: ButtonInteraction) {
        await itr.deferUpdate();
        if (itr.customId === this.endTurnID) {
            this.closeInterface();
        }
        else {
            this.mode = this.mode === 'select-ability' ? 'select-target' : 'select-ability';
            this.listenToQueue('button clicked');
        }
    }

    private start() {
        this.interaction_res.fetch().then(m => {
            this.interfaceMessage = m;
            return this.listenToQueue('start');
        });
    }
}

export class Team {
    name: string;
    members: Entity[];
    constructor(name: string, members: Entity[]) {
        this.members = members;
        this.name = name;
    }
    push(...members: Entity[]) {
        for (const member of members) {
            const exist = this.members.find(m => m.base.id === member.base.id);
            if (!exist) {
                this.members.push(member);
            }
        }
    }
}

export class Entity implements iEntity {
    readonly base: Readonly<EntityConstance>;
    team: string;
    name: string = '[?]';
    warSupport: number = 1;
    stamina: number = 1;
    HP: number = 0;
    org: number = 0;
    loc: Location = 'front';
    status: EntityStatus[] = [];
    equippedWeapon: Weapon = GetEmptyWeapon();
    equippedArmour: Armour = GetEmptyArmour();
    botType: BotType = BotType.Enemy;
    isPlayer: boolean = false;
    isPvp: boolean = false;

    constructor(options: EntityInitRequirements) {
        this.base = options.base;
        this.team = options.team;
        this.name = options.name ?? this.name;
        this.loc = options.loc ?? this.loc;
        this.warSupport = options.warSupport ?? this.warSupport;
        this.stamina = options.stamina ?? this.stamina;
        this.HP = options.HP ?? this.HP;
        this.org = options.org ?? this.org;
        this.equippedWeapon = options.equippedWeapon ?? this.equippedWeapon;
        this.equippedArmour = options.equippedArmour ?? this.equippedArmour;
        this.botType = options.botType ?? this.botType;
        this.isPlayer = options.isPlayer ?? this.isPlayer;
        this.isPvp = options.isPvp ?? this.isPvp;
    }

    applyStatus(s: EntityStatus) {
        const virtualStats = NewObject(this) as iEntity;
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
        const virtualStats = NewObject(this) as iEntity;
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
    userCache = new Collection<string, User>();

    // Party
    userDataList: UserData[];
    playerEntitiesList: Entity[];

    // Entity-Related Information
    teams: Team[] = [];
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

    // Timeslotting
    playerTimeslots = new Collection<string, TimeSlot[]>();
    time: number = -1;
    timeslots: TimeSlot[] = []

    private constructor(c: BattleConfig, party: UserData[]) {
        super();
        this.playerEntitiesList = []
        this.userDataList = party;
        this.channel = c.channel;
        this.on(AbilityTrigger.Proc, (ability: AbilityInstance) => {
            console.log(`Ability: ${ability.name} procceeded`);
        });
    }

    /**
     * Creates a new Battle instance with the given configuration.
     * @param c The BattleConfig object containing the configuration for the battle.
     * @returns A Promise that resolves to a Battle instance.
     */
    static async Create(c: BattleConfig): Promise<Battle> {
        // 1. Get from Database the UserData of each player
        const party = c.users.map(u => GetUserData(u.id));

        // 2. Create a new Battle instance and inject the players into the party argument
        const battle = new Battle(c, await Promise.all(party));
        
        // 3. Get from Database the CombatCharacter of each player
        const fighters = await Promise.all(
            battle.userDataList.map(async p => {
                const characterBase = await GetCombatCharacter(p.combatCharacters[0]) as EntityConstance;
                return characterBase ?
                    new Entity({
                        base: Object.assign(characterBase, p),
                        team: c.teamMapping[p.id],
                        name: characterBase.name,
                        botType: BotType.Player,
                        isPlayer: true,
                        isPvp: true
                    }):
                    null;
            })
        ).then(c => c.filter(x => x !== null) as Entity[]);
        
        // 4. Populate userCache
        for (const user of c.users) {
            battle.userCache.set(user.id, user);
        }

        // 5. Assigning teams
        fighters.forEach(f => battle.teamAssign(c.teamMapping[f.base.id!], [f]));
        console.log(battle.teams);

        // 6. Queue the fighters to be spawned
        battle.spawnAtLocation('front', ...fighters.filter(f => f.botType === BotType.Player));
        
        return battle;
    }

    //#region Team Management
    teamAssign(name: string, members: Entity[] = []) {
        const exist = this.teams.find(t => t.name === name);
        if (exist) {
            exist.push(...members);
        }
        else {
            this.teams.push(new Team(name, members));
        }
    }
    //#endregion

    //#region Spawn
    spawnAtLocation(loc: Location, ...entity: Entity[]) {
        this.toBeSpawnedRecord[loc].push(...entity);
    }
    spawnUsers() {
        console.log('Spawning Users');
        for (const [loc, entities] of Object.entries(this.toBeSpawnedRecord)) {
            console.log(`Spawning ${entities.length} entities at ${loc}`);
            this.ensureBattlefieldFormation(loc as Location).push(...entities);
            this.playerEntitiesList.push(...entities);
            this.toBeSpawnedRecord[loc as Location] = [];
        }
        console.log(this.playerEntitiesList.map(e => `${e.name} / ${e.base.username} [${e.loc}]`));
    }
    //#endregion

    //#region External information getting
    public attackInterface_get() {
        return {
            embeds: [
                new EmbedBuilder()
                    .setDescription(`${this.teams.map(t => this.teamStatusDesc_get(t)).join('\n\n')}`)
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
        };
    }

    public teamStatusDesc_get(team: Team) {
        const teamHeader = `## Team ${capitalize(team.name)}\n`
        const individualStatus = team.members.map(e => {
            const entityState = this.entityTimeState_get(e.base.id || '');
            const entityIsReady = entityState !== TimeSlotState.Idle && entityState !== TimeSlotState.Past;
            return `\n${entityIsReady ? '✅' : '❌'} **${e.name}** / ${this.userCache.get(e.base.id??'') || `\`${e.base.username}\``} [${e.loc}]`
        }).join('');
        return teamHeader + individualStatus;
    }

    public newAbilityAtCurrentTime_get(name: AbilityName) {
        return new AbilityInstance({ associatedBattle: this, name, begin: this.time })
    }

    public entityTimeState_get(userid: string) {
        const ts = this.playerTimeslots.get(userid)?.[0];
        const con = ts ? getAbilityState(ts.ability, this.time) : TimeSlotState.Idle
        console.log(`@${this.time}: ${userid} @ ${con} /with ${ts?.ability.name}`)
        return con;
    }
    //#endregion 

    //#region Ensurance
    ensureBattlefieldFormation(formation: Location): Entity[] {
        const form = this.battlefield.get(formation) || this.battlefield.set(formation, []).get(formation)!;
        return form;
    }
    ensureTimeSlot(userId: string): TimeSlot[] {
        if (!this.playerTimeslots.has(userId)) {
            this.playerTimeslots.set(userId, []);
        }
        return this.playerTimeslots.get(userId)!;
    }
    //#endregion

    //#region Timeslotting
    queueTimelineAbilities(userid: string, ...ability: AbilityInstance[]) {
        this.ensureTimeSlot(userid).push(...ability.map(a => {
            return {
                ability: a,
                time: a.begin,
            }
        }));
    }
    sortAndRemovePastTimelineAbilities() {
        this.playerTimeslots = this.playerTimeslots.mapValues(v => v.sort((a, b) => a.time - b.time));
        for (const playerID of this.playerTimeslots.keys()) {
            while (this.entityTimeState_get(playerID) === TimeSlotState.Past) {
                this.playerTimeslots.get(playerID)!.shift();
            }
        }
        console.log(this.playerTimeslots.map((v, k) => `${k}: ${v.map(a => `${a.ability.name} @ ${a.time}`).join(', ')}`));
    }
    advanceTime() {
        this.time++;
        this.sortAndRemovePastTimelineAbilities();
    }
    //#endregion
    
    //#region Round Management
    public begin() {
        if (this.time === -1) this.startRound();
    }

    private async requestAction(userID: string[]): Promise<unknown> {
        console.log(`|=> Requesting action from ${userID.join(', ')}`)
        return ActionRequest.Create(this, userID).then(ar => ar.setupInteractionCollector());
    }
    private async startRound() {
        this.advanceTime();
        console.log(`Round ${this.time} started`);
        
        this.spawnUsers();

        const idleUsers = this.userDataList.map(p => p.id).filter(id => this.entityTimeState_get(id) === TimeSlotState.Idle);
        if (idleUsers.length > 0) {
            await this.requestAction(idleUsers);
        }

        for (const [id, timeslots] of this.playerTimeslots) {
            const e = this.playerEntitiesList.find(e => e.base.id === id);
            const ts = timeslots[0];
            const target = this.playerEntitiesList.find(e => e.base.id === ts.ability.target?.base.id);
            const state = getAbilityState(ts.ability, this.time);

            await this.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            `${Emoji.SWORD} ${e?.name} used ${getKeyFromEnumValue(AbilityName, ts.ability.name)} on ${target?.name} ${
                                state === TimeSlotState.Windup ? 'and was winding up the attack...' :
                                state === TimeSlotState.Swing ? 'and was swinging!' :
                                state === TimeSlotState.Recovery ? 'and was recovering from the attack.' :
                                ''
                            }`
                        )
                ]
            })
        }
        
        setTimeout(() => {
            this.startRound();
        }, 1000);
    }   
    
    /**
    * A skirmish is defined as such: a series of clashes between the attacker and the defender, after
    * both had chosen their series of actions under the attack interface.
    * @param attacker 
    * @param defender 
    * @returns 
    */
    skirmish(attacker: Entity, attackerSequence: AbilityInstance, defender: Entity, defenderSequence: AbilityInstance) {
        console.log(`Skirmish: ${attacker.base.username} => ${defender.base.username}`);

        const roundAttacker = NewObject(attacker) as iEntity;
        const roundDefender = NewObject(defender) as iEntity;
        
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

        syncVirtualandActual(roundAttacker, attacker);
        syncVirtualandActual(roundDefender, defender);

        return void 0;
    }
    //#endregion
}