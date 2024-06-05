import bot from "@bot";
import { Emoji, INTERFACE_PERSIST_TIME, INTERFACE_REFRESH_TIME } from "@constants";
import { AbilityName, AbilityTrigger, Armour, BattleConfig, BattleField, BeforeAfter, BotType, EntityConstance, EntityInitRequirements, iBattleResult, iEntity, Location, StatusEffectApplyType, StatusEffectType, TimeSlotState, UserData, Weapon } from "@ctypes";
import { addHPBar, attack, capitalize, damage, defaultArmour, defaultWeapon, findDifference, getAbilityState, GetCombatCharacter, getLoadingEmbed, getRealAbilityName, isSubset, maxHP, maxOrganisation, maxPosture, maxStamina, properPrint, setUpInteractionCollect, stringifyAbility, uniformRandom, updateRoundEmbed, virtual } from "@functions";
import colors from 'ansi-colors';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, CollectedInteraction, Collection, EmbedBuilder, Interaction, InteractionCollector, InteractionResponse, Message, StringSelectMenuBuilder, StringSelectMenuInteraction, TextBasedChannel, User } from "discord.js";
import { EventEmitter } from "events";
import { Ability, StatusEffect } from "./Ability";
import { ProfileManager } from "./InteractionHandler";

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
            this.turnEnded.has(user.id) ? `You are ready for action. Ability is \`${
                this.battle.playerEntitiesList.find(e => e.base.id === user.id)?.getAction()?.name}\`` : ''
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

    private constructor(ar: ActionRequest, itr: ButtonInteraction, resItr: InteractionResponse, attacker: Entity) {
        this.initaitor = attacker;
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
        this.initaitor.queueAction(
            this.selectedAbility ?? battle.newAbilityAtCurrentTime_get(AbilityName.Idle, { attacker: this.initaitor }));
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
                        `${Emoji.HEART}: ${addHPBar({
                            maxValue: maxHP(this.initaitor.base),
                            nowValue: this.initaitor.hp,
                            spiked: true
                        })}\n`+
                        `${Emoji.STAMINA}: ${addHPBar({
                            maxValue: maxStamina(this.initaitor.base),
                            nowValue: this.initaitor.stamina,
                            spiked: true
                        })}\n`+
                        `${Emoji.MORALE}: ${addHPBar({
                            maxValue: maxOrganisation(this.initaitor.base),
                            nowValue: this.initaitor.org,
                            spiked: true
                        })}\n`+
                        `${Emoji.POSTURE}: ${addHPBar({
                            maxValue: maxPosture(this.initaitor.base),
                            nowValue: this.initaitor.pos,
                            spiked: true
                        })}\n`+
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
                    { target: this.target ?? undefined, attacker: this.initaitor ?? undefined }
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

/**
 * Represents the result of a battle.
 * @implements iBattleResult
 * @class
 * @classdesc Represents the result of a battle.
 * @param {Partial<iBattleResult>} d - The partial battle result data along with the required entities.
 * @returns {BattleResult} A new instance of the BattleResult class.
 * @example
 * const result = new BattleResult({
 *      desc: 'None',
 *      attackerDiff: [findDifference(attacker, vattacker)],
 *      targetDiff: [findDifference(target, vTarget)],
 *      vattacker: attacker.applyCurrentStatus(),
 *      vTarget: target.applyCurrentStatus(),
 *      attacker: attacker,
 *      target: target,
 * });
 */
class BattleResult implements iBattleResult {
    desc: string;
    attackerDiff: BeforeAfter;
    targetDiff: BeforeAfter;
    vattacker: iEntity;
    vTarget: iEntity;
    attacker: Entity;
    target: Entity;

    /**
     * Constructs a new instance of the BattleResult class.
     * @param d - The partial battle result data along with the required entities.
     */
    constructor(d: Partial<iBattleResult> & { vattacker: iEntity, vTarget: iEntity, target: Entity, attacker: Entity }) {
        this.desc = d.desc ?? 'None';
        this.attackerDiff = d.attackerDiff ?? [findDifference(d.attacker, d.vattacker)];
        this.targetDiff = d.targetDiff ?? [findDifference(d.target, d.vTarget)];
        this.vattacker = d.vattacker;
        this.vTarget = d.vTarget;
        this.attacker = d.attacker;
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
    actionQueue: Ability[] = [];
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
        if (!this.status.includes(s)) this.status.push(s);
        const virtualStats = virtual(this);
        const virtualStatus = virtualStats.status.find(x => x.source.id === s.source.id)!;
        switch (virtualStatus.type) {
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
        virtualStatus.duration--;
        if (virtualStatus.duration <= 0) {
            const i = virtualStats.status.indexOf(s);
            virtualStats.status.splice(i, 1);
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

    getFullName() {
        return `${this.name} <@${this.base.id}>`
    }

    shiftAction() {
        return this.actionQueue.shift();
    }
    queueAction(ability: Ability) {
        this.actionQueue.push(ability);
    }

    getState(time: number) {
        const r = this.actionQueue.length > 0 ? getAbilityState(this.actionQueue[0], time) : TimeSlotState.Idle;
        console.log(`【State】 ${this.name} / ${this.base.username}  @${time} with ${this.actionQueue[0]?.name} = ${r}`)
        return r;
    }

    getAction(): Ability | null {
        return this.actionQueue[0] ?? null;
    }

    sortActionQueue(time: number) {
        this.actionQueue = this.actionQueue.filter(a => a.getFinishTime() > time);
        this.actionQueue.sort((a, b) => a.begin - b.begin);
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
    time: number = -1;

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
        const party = c.users.map(u => ProfileManager.UserData(u.id));

        // 2. Create a new Battle instance and inject the players into the party argument
        const battle = new Battle(c, await Promise.all(party).then(c => c.filter(x => x !== null) as UserData[]));
        
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

    syncVirtualandActual(virtual: iEntity, actual: Entity) {
        const diff = findDifference(virtual, actual.virtual());
        console.log(`【Sync】 ${actual.name} / ${actual.base.username} with ${Object.entries(diff).map((d: any) => `${d[0]}: ${properPrint(d[1][0])} -> ${properPrint(d[1][1])}`).join(', ')} `);

        actual.hp = virtual.hp;
        actual.stamina = virtual.stamina;
        actual.org = virtual.org;
        actual.warSupport = virtual.warSupport;
        actual.status = virtual.status.map(s => new StatusEffect(s));
        actual.actionQueue = virtual.actionQueue.map(a => new Ability(Object.assign(a, { associatedBattle: this, attacker: a.attacker ?? actual })));
        actual.pos = virtual.pos;
        actual.loc = virtual.loc;
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
            if (entities.length > 0) {
                console.log(`【Spawning】 ${entities.length} entities at ${loc}`);
                this.ensureBattlefieldFormation(loc as Location).push(...entities);
                this.playerEntitiesList.push(...entities);
                this.toBeSpawnedRecord[loc as Location] = [];
            }
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
            const entityState = e.getState(this.time);
            const entityIsReady = entityState !== TimeSlotState.Idle && entityState !== TimeSlotState.Past;
            return `\n${entityIsReady ? '✅' : '❌'} **${e.name}** / ${this.userCache.get(e.base.id??'') || `\`${e.base.username}\``} [${e.loc}]`
        }).join('');
        return teamHeader + individualStatus;
    }

    public newAbilityAtCurrentTime_get(name: AbilityName, options: Partial<Ability> & { attacker: Entity }) {
        return new Ability({ associatedBattle: this, name, begin: this.time, ...options })
    }
    //#endregion 

    //#region Ensurance
    ensureBattlefieldFormation(formation: Location): Entity[] {
        const form = this.battlefield.get(formation) || this.battlefield.set(formation, []).get(formation)!;
        return form;
    }
    //#endregion

    //#region Timeslotting
    sortAndRemovePastTimelineAbilities() {
        this.playerEntitiesList.forEach(e => {
            e.sortActionQueue(this.time);
        })
    }
    advanceTime() {
        const round = `【Round】 ${this.time}`;
        this.time++;
        console.log(colors.bgRed(colors.redBright(round)));
        return round;
    }
    getAbilityState(ability: Ability) {
        return getAbilityState(ability, this.time);
    }
    //#endregion
    
    //#region Round Management
    public begin() {
        console.log('【Begin】')
        if (this.time === -1) this.round();
    }
    private async requestAction(userID: string[]): Promise<unknown> {
        console.log(`【Request Action】 Requesting action from ${userID.join(', ')}`)
        return ActionRequest.Create(this, userID).then(ar => ar.setupInteractionCollector());
    }

    private dealWithWindupHit(attacker: Entity, target: Entity): BattleResult {
        const ability = attacker.getAction();
        const targetAbility = target.getAction();
        if (!ability) return new BattleResult({ desc: 'No ability found', attacker, target, vattacker: attacker.virtual(), vTarget: target.virtual() });
        const abilityName = getRealAbilityName(ability.name)
        const targetAbilityName = targetAbility?
            `\`${getRealAbilityName(targetAbility.name)}\``:
            '`IDLE`'

        console.log(`【Damage】 ${attacker.name} hits ${target.name} with ${abilityName} while ${target.name} is winding up ${targetAbilityName}!`)

        return new BattleResult({
            desc: `${attacker.name+
                attacker.base.username ?
                    `/${attacker.base.username}`:
                    ''
            } hits ${target.name+
                target.base.username ?
                    `/${target.base.username}`:
                    ''
            } with ${abilityName} while ${target.name} is winding up!`,
            attacker,
            target,
            ... attack(attacker, target, damage(attacker, target).totalDamage, 'hp'),
        })
    }
    private dealWithRecoveryHit(attacker: Entity, target: Entity): BattleResult {
        const ability = attacker.getAction();
        const targetAbility = target.getAction();
        if (!ability) return new BattleResult({ desc: 'No ability found', attacker: attacker, target, vattacker: attacker.virtual(), vTarget: target.virtual() });
        const abilityName = getRealAbilityName(ability.name)
        const targetAbilityName = targetAbility?
            `\`${getRealAbilityName(targetAbility.name)}\``:
            '`IDLE`'

        console.log(`【Damage】 ${attacker.name} hits ${target.name} with ${abilityName} while ${target.name} is recoverying ${targetAbilityName}!`)

        return new BattleResult({
            desc: `${attacker.name +
                attacker.base.username ?
                    `/${attacker.base.username}`:
                    ''
            } hits ${
                target.name +
                target.base.username ?
                    `/${target.base.username}`:
                    ''
            } with ${abilityName} while ${target.name} is recovering!`,
            attacker,
            target,
            ...attack(attacker, target, damage(attacker, target).totalDamage, 'hp'),
        })
    }
    private dealWithClash(attacker: Entity, target: Entity): BattleResult {
        console.log(`【Clash】 ${attacker.name} clashes with ${target.name}`)

        // SET UP CONSTANTS
        const ability = attacker.getAction();
        const targetAbility = target.getAction();
        if (!ability) return new BattleResult({ desc: 'No ability found', attacker: attacker, target, vattacker: attacker.virtual(), vTarget: target.virtual() });
        
        const abilityName = getRealAbilityName(ability.name)
        const targetAbilityName = targetAbility?
            `\`${getRealAbilityName(targetAbility.name)}\``:
            '`IDLE`'

        let {
            attackerDiff,
            targetDiff,
            vattacker,
            vTarget,
            value,
        } = attack(attacker, target, dr => {
            const postureDamage = (dr.forceDamage * 0.65 + dr.pierceDamage * 0.35) * uniformRandom(0.95, 1.05);
            return postureDamage;
        }, 'pos', true);
        console.log(`Clash-Before-NOPOS: ${JSON.stringify(target)}\n${JSON.stringify(attacker)}`)
        console.log(`Clash-After-NOPOS: ${JSON.stringify(vTarget)}\n${JSON.stringify(vattacker)}`)
        
        console.log(`【Damage】${attacker.name} hits ${target.name} with ${abilityName}!`,
            `${target.pos} - ${value} = ${vTarget.pos}`)

        // POSTURE BROKEN
        if (vTarget.pos <= 0) {
            // consequence 1: hp damage
            const {
                attackerDiff: POSBRK_attackerDiff,
                targetDiff: POSBRK_targetDiff,
                vattacker: POSBRK_vattacker,
                vTarget: POSBRK_vTarget,
            } =
                attack(vattacker, vTarget, damage(vattacker, vTarget).totalDamage, 'hp', false)
            attackerDiff = attackerDiff.concat(POSBRK_attackerDiff);
            targetDiff = targetDiff.concat(POSBRK_targetDiff);

            console.log(`Clash-Before-DMGPOS: ${JSON.stringify(vTarget)}\n${JSON.stringify(vattacker)}`)
            vattacker = POSBRK_vattacker;
            vTarget = POSBRK_vTarget;
            console.log(`Clash-After-DMGPOS: ${JSON.stringify(vTarget)}\n${JSON.stringify(vattacker)}`)

            // consequence 2: lose ability, go into recovery
            vTarget.actionQueue.shift();
            for (let i = 0; i < (targetAbility?.recovery??0) * 2; i++) {
                vTarget.actionQueue.push(Ability.Recovering(
                    this, target, (targetAbility?.recovery??0) + i
                ))
            }
            
            // consequence 3: posture reset
            const oldValue = vTarget.pos;
            const resetValue = maxPosture(target.base) / 2
            vTarget.pos = resetValue;
            console.log(`【Posture】${target.name}'s posture is reset!`, `${oldValue} -> ${resetValue}`)
            // 3. THIRD RECORD OF DIFFERENCE: POSTURE BROKEN
            targetDiff.push({
                pos: [oldValue, resetValue]
            })
        }

        const desc = `${attacker.name+(attacker.base.username?`/${attacker.base.username}`:'')} [${abilityName}]`+
                        " clashes with "+
                    `${target.name+(target.base.username?`/${target.base.username}`:'')} [${targetAbilityName}]!`;
        return new BattleResult({
            desc,
            attackerDiff,
            targetDiff,
            vattacker,
            vTarget,
            attacker,
            target,
        })
    }

    dealWithPlayerTimeslot(attacker: Entity): BattleResult | null {
        const attackerAbility = attacker.getAction();
        const attackerState = attacker.getState(this.time);
        const target = attackerAbility?.target;
        const targetAbility = target?.getAction();
        const targetState = target?.getState(this.time);

        if (!attackerAbility || !attackerState || !target || !targetAbility || !targetState) {
            return null;
        }

        const attackerUser = this.userCache.get(attacker.base.id);
        const targetUser = this.userCache.get(target.base.id);
        const attackerDisplayName = colors.green(attackerUser?.username ?? attacker.name)
        const targetDisplayName = colors.green(targetUser?.username ?? target.name)
    
        console.log(colors.bgGreen(`——— ${attackerDisplayName} ———`))
        console.log(
            `${Emoji.SWORD} ${attackerDisplayName} `+
            `${colors.underline(attackerState)} [${attackerAbility.name}]\n`+
            `${Emoji.SHIELD} ${targetDisplayName} `+
            `${colors.underline(targetState)} [${targetAbility.name}]`
        );

        attackerAbility.confirm();
        switch (attackerState) {
            case TimeSlotState.Windup:
                attackerAbility.emit(AbilityTrigger.Windup, attacker, target, attackerAbility);
                return new BattleResult({
                    desc: `${attacker.name} is winding up ${getRealAbilityName(attackerAbility.name)}.`,
                    vattacker: attacker.applyCurrentStatus(),
                    vTarget: target.applyCurrentStatus(),
                    attacker,
                    target,
                })
            case TimeSlotState.Swing:
                attackerAbility.emit(AbilityTrigger.Swing, attacker, target, attackerAbility);
                switch (targetState) {
                    case TimeSlotState.Windup:
                        return this.dealWithWindupHit(attacker, target);
                    case TimeSlotState.Recovery:
                        return this.dealWithRecoveryHit(attacker, target);
                    case TimeSlotState.Swing:
                        return this.dealWithClash(attacker, target);
                    default:
                        return null;
                }
            case TimeSlotState.Recovery:
                attackerAbility.emit(AbilityTrigger.Recovery, attacker, target, attackerAbility);
                return new BattleResult({
                    desc: `${attacker.name} is recovering from ${getRealAbilityName(attackerAbility.name)}.`,
                    vattacker: attacker.applyCurrentStatus(),
                    vTarget: target.applyCurrentStatus(),
                    attacker,
                    target,
                })
            default:
                return null;
        }

    }
    private async round() {
        const roundString = this.advanceTime();
        this.spawnUsers();
        this.sortAndRemovePastTimelineAbilities();
        await this.requestAction(this.playerEntitiesList.filter(e => e.getState(this.time) === TimeSlotState.Idle).map(e => e.base.id));

        const roundEmbed = new EmbedBuilder().setTitle(roundString)
        const battleResults = [];
        for (const entity of this.playerEntitiesList) {
            console.log(`【${entity.name}】`)
            const r = this.dealWithPlayerTimeslot(entity);
            if (r) {
                console.log(`【Deal With Result】 ${r.desc}`)
                updateRoundEmbed(roundEmbed, r);
                battleResults.push(r);
            }
        }
        for (const r of battleResults) {
            this.syncVirtualandActual(r.vattacker, r.attacker);
            this.syncVirtualandActual(r.vTarget, r.target);
        }
        this.channel.send({ embeds: [roundEmbed] });
        
        setTimeout(() => {
            this.round();
        }, 1000);
    }
    //#endregion
}


