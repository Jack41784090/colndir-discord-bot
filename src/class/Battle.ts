import bot from "@bot";
import { Emoji, INTERFACE_PERSIST_TIME, INTERFACE_REFRESH_TIME } from "@constants";
import { AbilityName, AbilityTrigger, Armour, BattleConfig, BattleField, BotType, EntityConstance, EntityInitRequirements, iDealWithResult, iEntity, Location, StatusEffectApplyType, StatusEffectType, TimeSlot, TimeSlotState, UserData, Weapon } from "@ctypes";
import { addHPBar, capitalize, damage, defaultArmour, defaultWeapon, findDifference, getAbilityState, GetCombatCharacter, getLoadingEmbed, getRealAbilityName, GetUserData, isSubset, maxHP, maxOrganisation, maxPosture, maxStamina, setUpInteractionCollect, stringifyAbility, uniformRandom, virtual } from "@functions";
import colors from 'ansi-colors';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CollectedInteraction, Collection, EmbedBuilder, Interaction, InteractionCollector, InteractionResponse, Message, Snowflake, StringSelectMenuBuilder, StringSelectMenuInteraction, TextBasedChannel, User } from "discord.js";
import { EventEmitter } from "events";
import { Ability, StatusEffect } from "./Ability";

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

    private initaitor: Entity;
    private target: Entity | null = null;
    private selectedAbility: Ability | null = null;
    private ended = false;
    private timeoutCount = 0;
    private mode: 'select-ability' | 'select-target' = 'select-target';
    private interfaceMessage: Message | undefined;
    private listener: InteractionCollector<CollectedInteraction> | undefined;

    static async New(ar: ActionRequest, itr: ButtonInteraction, resItr: InteractionResponse) {
        const initator = ar.battle.playerEntitiesList.find(e => e.base.id === itr.user.id);
        if (!initator) return;

        const instance = new AttackInterface(ar, itr, resItr, initator);
        instance.start();
        return instance.interfacePromise;
    }

    private constructor(ar: ActionRequest, itr: ButtonInteraction, resItr: InteractionResponse, initiator: Entity) {
        this.initaitor = initiator;
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
            this.selectedAbility ?? battle.newAbilityAtCurrentTime_get(AbilityName.Idle, { initiator: this.initaitor }));
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
                        `${Emoji.HEART}: ${addHPBar(maxHP(this.initaitor.base), this.initaitor.hp, true)}\n`+
                        `${Emoji.STAMINA}: ${addHPBar(maxStamina(this.initaitor.base), this.initaitor.stamina, true)}\n`+
                        `${Emoji.MORALE}: ${addHPBar(maxOrganisation(this.initaitor.base), this.initaitor.org, true)}\n`+
                        `${Emoji.POSTURE}: ${addHPBar(maxPosture(this.initaitor.base), this.initaitor.pos, true)}\n`+
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
                const ability = battle.newAbilityAtCurrentTime_get(
                    selected as AbilityName,
                    { target: this.target ?? undefined, initiator: this.initaitor ?? undefined }
                );
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

class DealWithResult implements iDealWithResult {
    desc: string;
    initiatorDiff: Collection<string, { toString: () => string }>;
    targetDiff: Collection<string, { toString: () => string }>;
    vInitiator: iEntity;
    vTarget: iEntity;
    initiator: Entity;
    target: Entity;
    constructor(d: Partial<iDealWithResult> & { vInitiator: iEntity, vTarget: iEntity, target: Entity, initiator: Entity }) {
        this.desc = d.desc ?? 'None';
        this.initiatorDiff = d.initiatorDiff ?? findDifference(d.initiator, d.vInitiator);
        this.targetDiff = d.targetDiff ?? findDifference(d.target, d.vTarget);
        this.vInitiator = d.vInitiator;
        this.vTarget = d.vTarget;
        this.initiator = d.initiator;
        this.target = d.target;
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

    warSupport: number;
    stamina: number;
    hp: number;
    org: number;
    pos: number;

    loc: Location = 'front';
    status: StatusEffect[] = [];
    equippedWeapon: Weapon = defaultWeapon();
    equippedArmour: Armour = defaultArmour();
    botType: BotType = BotType.Enemy;
    isPlayer: boolean = false;
    isPvp: boolean = false;

    constructor(options: EntityInitRequirements) {
        this.base = options.base;
        this.team = options.team;
        this.name = options.name ?? this.name;
        this.loc = options.loc ?? this.loc;
        this.equippedWeapon = options.equippedWeapon ?? this.equippedWeapon;
        this.equippedArmour = options.equippedArmour ?? this.equippedArmour;
        this.botType = options.botType ?? this.botType;
        this.isPlayer = options.isPlayer ?? this.isPlayer;
        this.isPvp = options.isPvp ?? this.isPvp;
        
        this.warSupport = options.warSupport ?? maxHP(this.base);
        this.stamina = options.stamina ?? maxStamina(this.base);
        this.hp = options.hp ?? maxHP(this.base);
        this.org = options.org ?? maxOrganisation(this.base);
        this.pos = options.pos ?? maxPosture(this.base);
    }

    applyStatus(s: StatusEffect) {
        const virtualStats = virtual(this);
        switch (s.type) {
            case StatusEffectType.IncreaseStat:
                if (s.name)
                    virtualStats.base[s.name] += s.value;
                break;
            case StatusEffectType.DecreaseStat:
                if (s.name)
                    virtualStats.base[s.name] -= s.value;
                break;
            case StatusEffectType.MultiplyStat:
                if (s.name)
                    virtualStats.base[s.name] *= s.value;
                break;
            case StatusEffectType.Bleed:
                virtualStats.hp -= s.value;
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
        console.log(`【Apply Status】 ${this.name} / ${this.base.username}`)
        const virtualStats = virtual(this)
        for (const s of this.status) {
            console.log(
                `${s.emoji??Emoji.STATUS} ${s.type} |`+
                `name:${colors.blue(s.name ?? 'undefined')} `+
                `value:${colors.blue(s.value.toString())} `+
                `dur:${colors.blue(s.duration.toString())} `);

            const sameAbilitySources = this.status.filter(x =>
                x.source.from instanceof Ability // check if source is an ability
                && (x.source.from as Ability).name === s.source.from.name); // check if the ability name is the same
            if (s.applyType === StatusEffectApplyType.persistent && sameAbilitySources.length > 1) {
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

    virtual() {
        return virtual(this);
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
                const characterBase = await GetCombatCharacter(p.combatCharacters[0]);
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
        for (const [loc, entities] of Object.entries(this.toBeSpawnedRecord)) {
            if (entities.length > 0) console.log(`【Spawning】 ${entities.length} entities at ${loc}`);
            this.ensureBattlefieldFormation(loc as Location).push(...entities);
            this.playerEntitiesList.push(...entities);
            this.toBeSpawnedRecord[loc as Location] = [];
        }
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

    public newAbilityAtCurrentTime_get(name: AbilityName, options: Partial<Ability> & { initiator: Entity }) {
        return new Ability({ associatedBattle: this, name, begin: this.time, ...options })
    }

    public entityTimeState_get(userid: string) {
        const ts = this.playerTimeslots.get(userid)?.[0];
        const con = ts ? getAbilityState(ts.ability, this.time) : TimeSlotState.Idle;
        // console.log(`@${this.time}: ${userid} @ ${con} /with ${ts?.ability.name}`)
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
    queueTimelineAbilities(userid: string, ...ability: Ability[]) {
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
    }
    advanceTime() {
        this.time++;
        this.sortAndRemovePastTimelineAbilities();
    }
    //#endregion
    
    //#region Round Management
    public begin() {
        console.log('【Begin】')
        if (this.time === -1) this.round();
    }
    private dealWithWindupHit(initiator: Entity, target: Entity, ts: TimeSlot): DealWithResult {
        const targetTS = this.playerTimeslots.get(target.base.id)?.[0];
        const abilityName = `\`${getRealAbilityName(ts.ability.name)}\``;
        const targetAbilityName = targetTS?
            `\`${getRealAbilityName(targetTS.ability.name)}\``:
            'unknown ability'

        // hp hit
        console.log(`【Damage】 ${initiator.name} hits ${target.name} with ${abilityName} while ${target.name} is winding up ${targetAbilityName}!`)
        const vInitiator = initiator.applyCurrentStatus();
        const vTarget = target.applyCurrentStatus();

        const target_BarBeforeDamage = '`'+`${
            vTarget.hp > 0 ?
                addHPBar(maxHP(vTarget.base), vTarget.hp):
                Emoji.BOOM
        }`+'`'

        const d = damage(vInitiator, vTarget);
        console.log(`【Damage】`, d)

        vTarget.hp -= d.totalDamage;

        const iniDiff = findDifference(target, vTarget);
        const tarDiff = findDifference(target, vTarget);

        const target_BarAfterDamage = '`'+`${
            vTarget.hp > 0 ?
                addHPBar(maxHP(vTarget.base), vTarget.hp):
                Emoji.BOOM
        }`+'`'

        return new DealWithResult({
            desc: `\n${initiator.name} hits ${target.name} with ${abilityName} while ${target.name} is winding up!`,
            initiatorDiff: iniDiff,
            targetDiff: tarDiff,
            vInitiator,
            vTarget,
            initiator,
            target,
        })
    }
    private dealWithRecoveryHit(initiator: Entity, target: Entity, ts: TimeSlot): DealWithResult {
        const targetTS = this.playerTimeslots.get(target.base.id)?.[0];
        const abilityName = `\`${getRealAbilityName(ts.ability.name)}\``;
        const targetAbilityName = targetTS?
            `\`${getRealAbilityName(targetTS.ability.name)}\``:
            'unknown ability'

        // hp hit
        console.log(`【Damage】 ${initiator.name} hits ${target.name} with ${abilityName} while ${target.name} is recovering from ${targetAbilityName}!`)
        const vInitiator = initiator.applyCurrentStatus();
        const vTarget = target.applyCurrentStatus();

        const target_BarBeforeDamage = '`'+`${
            vTarget.hp > 0 ?
                addHPBar(maxHP(vTarget.base), vTarget.hp):
                Emoji.BOOM
        }`+'`'

        const d = damage(vInitiator, vTarget);
        console.log(`【Damage】`, d)

        vTarget.hp -= d.totalDamage;

        const target_BarAfterDamage = '`'+`${
            vTarget.hp > 0 ?
                addHPBar(maxHP(vTarget.base), vTarget.hp):
                Emoji.BOOM
        }`+'`'

        return new DealWithResult({
            desc: `\n${initiator.name} hits ${target.name} with ${abilityName} while ${target.name} is recovering!`,
            initiatorDiff: findDifference(initiator, vInitiator),
            targetDiff: findDifference(target, vTarget),
            vInitiator,
            vTarget,
            initiator,
            target,
        })
    }
    private dealWithClash(initiator: Entity, target: Entity, ts: TimeSlot): DealWithResult {
        const targetTS = this.playerTimeslots.get(target.base.id)?.[0];
        const abilityName = `\`${getRealAbilityName(ts.ability.name)}\``;
        const targetAbilityName = targetTS?
            `\`${getRealAbilityName(targetTS.ability.name)}\``:
            'unknown ability'

        // clash, posture hit
        console.log(`【Clash】 ${initiator.name} clashes with ${target.name}`)
        const vInitiator = initiator.applyCurrentStatus();
        const vTarget = target.applyCurrentStatus();

        const target_BarBeforeDamage = '`'+`${
            vTarget.pos > 0 ?
                addHPBar(maxPosture(vTarget.base), vTarget.pos):
                Emoji.BOOM
        }`+'`'

        const d = damage(vInitiator, vTarget);
        const postureDamage = (d.forceDamage * 0.65 + d.pierceDamage * 0.35)/10 * uniformRandom(0.95, 1.05);
        console.log(`【Damage】`, d, postureDamage)

        vTarget.pos -= postureDamage;

        const target_BarAfterDamage = '`'+`${
            vTarget.pos > 0 ?
                addHPBar(maxPosture(vTarget.base), vTarget.pos):
                Emoji.BOOM
        }`+'`'

        return new DealWithResult({
            desc: `\n${initiator.name} clashes with ${target.name}!`,
            initiatorDiff: findDifference(initiator, vInitiator),
            targetDiff: findDifference(target, vTarget),
            vInitiator,
            vTarget,
            initiator,
            target,
        })
    }
    private dealWithPlayerTimeslot(ts: TimeSlot, id: Snowflake): DealWithResult | null {
        const initiator = ts.ability.initiator;
        const target = ts.ability.target;
        const initiatorState = this.entityTimeState_get(id);
        const targetState = this.entityTimeState_get(target.base.id);
        const targetTS = this.playerTimeslots.get(target.base.id)?.[0];

        if (!initiatorState || !targetState || !targetTS) return null;
    
        console.log(colors.bgGreen(`——— ${this.userCache.get(id)?.username} ———`))

        console.log(
            `${Emoji.SWORD} ${colors.green(this.userCache.get(id)?.username ?? 'unknown')} `+
            `${colors.underline(initiatorState)} [${ts.ability.name}]\n`+
            `${Emoji.SHIELD} ${colors.green(this.userCache.get(target.base.id ?? '')?.username ?? 'unknown')} `+
            `${colors.underline(targetState)} [${targetTS?.ability.name}]`
        );

        ts.ability.confirm();       
        switch (initiatorState) {
            case TimeSlotState.Windup:
                ts.ability.emit(AbilityTrigger.Windup, initiator, target, ts.ability);
                return new DealWithResult({
                    desc: `${initiator.name} is winding up ${ts.ability.name}.`,
                    vInitiator: initiator.applyCurrentStatus(),
                    vTarget: target.applyCurrentStatus(),
                    initiator,
                    target,
                })
            case TimeSlotState.Swing:
                ts.ability.emit(AbilityTrigger.Swing, initiator, target, ts.ability);
                switch (targetState) {
                    case TimeSlotState.Windup:
                        return this.dealWithWindupHit(initiator, target, ts);
                    case TimeSlotState.Recovery:
                        return this.dealWithRecoveryHit(initiator, target, ts);
                    case TimeSlotState.Swing:
                        return this.dealWithClash(initiator, target, ts);
                    default:
                        return null;
                }
            case TimeSlotState.Recovery:
                ts.ability.emit(AbilityTrigger.Recovery, initiator, target, ts.ability);
                return new DealWithResult({
                    desc: `${initiator.name} is recovering from ${ts.ability.name}.`,
                    vInitiator: initiator.applyCurrentStatus(),
                    vTarget: target.applyCurrentStatus(),
                    initiator,
                    target,
                })
            default:
                return null;
        }

    }
    private async requestAction(userID: string[]): Promise<unknown> {
        console.log(`【Request Action】 Requesting action from ${userID.join(', ')}`)
        return ActionRequest.Create(this, userID).then(ar => ar.setupInteractionCollector());
    }
    private async round() {
        this.advanceTime();
        console.log(colors.bgRed(colors.redBright(`【Round】 ${this.time}`)));
        
        this.spawnUsers();

        const idleUsers = this.userDataList.map(p => p.id).filter(id => this.entityTimeState_get(id) === TimeSlotState.Idle);
        if (idleUsers.length > 0) {
            await this.requestAction(idleUsers);
        }

        const roundEmbed = new EmbedBuilder()
            .setTitle(`【Round ${this.time}】`)
        console.log(`【Timeslots】 ${this.playerTimeslots.size}`)
        for (const [id, timeslots] of this.playerTimeslots) {
            let ts: TimeSlot | undefined = timeslots[0];
            while (ts && getAbilityState(ts.ability, this.time) === TimeSlotState.Past) { ts = timeslots.shift(); }
            if (ts) {
                const r = this.dealWithPlayerTimeslot(timeslots[0], id)
                if (!r) continue;
                console.log(r.initiatorDiff);
                console.log(r.targetDiff);
            }
            else {
                await this.requestAction([id]);
            }
        }
        // this.channel.send({ embeds: [roundEmbed] });
        
        setTimeout(() => {
            this.round();
        }, 1000);
    }
    //#endregion
}
