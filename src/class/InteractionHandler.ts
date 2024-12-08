import { CombatCharacter, GetScript, GuildData, ProfileInteractionType, ProfileType, SaveScript, UserData, ValidProfileData } from "@ctypes";
import { GetCombatCharacter, GetGuildData, getPromiseStatus, GetUserData, SaveCombatCharacter, SaveGuildData, SaveUserData } from '@functions';
import { Message } from 'discord.js';
import { Battle } from "./Battle";

function isUserData(data: object): data is UserData {
    return 'username' in data;
}

function isGuildData(data: object): data is GuildData {
    return 'roleChannelID' in data;
}

function isCombatCharacter(data: object): data is CombatCharacter {
    return 'authorised' in data;
}

function Script(method: 'get', type: ProfileType): GetScript;
function Script(method: 'save', type: ProfileType): SaveScript;
function Script(method: 'get', data: ValidProfileData): GetScript;
function Script(method: 'save', data: ValidProfileData): SaveScript;
function Script(method: 'get' | 'save', type_data: ProfileType | ValidProfileData): GetScript | SaveScript {
    if (typeof type_data === 'number') {
        const type = type_data;
        switch (type) {
            case ProfileType.CombatCharacter:
                return method === 'get' ? GetCombatCharacter : SaveCombatCharacter;
            case ProfileType.Guild:
                return method === 'get' ? GetGuildData : SaveGuildData;
            case ProfileType.User:
                return method === 'get' ? GetUserData : SaveUserData;
        }
    }

    if (isUserData(type_data)) return method === 'get' ? GetUserData : SaveUserData;
    if (isGuildData(type_data)) return method === 'get' ? GetGuildData : SaveGuildData;
    if (isCombatCharacter(type_data)) return method === 'get' ? GetCombatCharacter : SaveCombatCharacter;

    throw new Error("Invalid data type provided to Script.");
}

function getDataType(data: ValidProfileData): ProfileType | null {
    if (isUserData(data)) return ProfileType.User;
    if (isGuildData(data)) return ProfileType.Guild;
    if (isCombatCharacter(data)) return ProfileType.CombatCharacter;
    return null;
}

class Profile {
    saveMethod: SaveScript;
    type: ProfileType;
    id: string;
    data: ValidProfileData;
    eventManager: EventManager;

    private constructor(
        data: ValidProfileData,
        type: ProfileType,
        saveMethod: SaveScript,
    ) {
        this.data = data;
        this.type = type;
        this.id = `${type}:${this.data.id}`;
        this.eventManager = new EventManager(this);
        this.saveMethod = saveMethod;
    }

    static Create(
        data: ValidProfileData,
        saveMethod: SaveScript,
    ): Profile | null {
        console.log(`Creating Profile (${data.id})...`);
        const type = getDataType(data);
        if (type === null) {
            console.error("Invalid Profile Data Provided.");
            return null;
        }
        return new Profile(data, type, saveMethod);
    }

    async save() {
        console.log(`Saving Data (${this.data.id})...`);
        this.saveMethod(this.data.id, this.data);
    }

    async delete() {
        console.log(`Deleting Profile (${getDataType(this.data)})...`);
        ProfileManager.Instance().profileMap.delete(this.data.id);
    }
}

class EventManager {
    interval: NodeJS.Timeout;
    profile: Profile;
    pending: Array<InteractionEvent> = [];
    handling: Array<InteractionEvent> = [];
    handlerPromise: Promise<void> = Promise.resolve();

    constructor(profile: Profile) {
        this.profile = profile;
        this.interval = setInterval(() => {
            this.maybeHandle();
        }, 10 * 1000);
    }

    async maybeHandle(): Promise<void> {
        const handlerStatus = await getPromiseStatus(this.handlerPromise);
        if (handlerStatus === 'fulfilled') {
            await this.handle();
        }
    }

    async handle() {
        if (this.handling.length === 0) {
            if (this.pending.length === 0) {
                clearInterval(this.interval);
                await this.profile.delete(); 
                await this.profile.save();
                return;
            }
            this.handling = this.pending;
            this.pending = [];
        }

        this.handlerPromise = 
            Promise.allSettled(this.handling.map(event => event.Promise()))
                .then(async () => {
                    this.handling.forEach(event => { if (!event.stopped) event.Stop() });
                    this.handling = [];

                    if (this.pending.length > 0) {
                        console.log("\t\tPending is not empty, reusing.")
                        await this.handle();
                    } else {
                        console.log("\t\tAll done.")
                        await this.profile.save();
                    }
                });
    }

    registerEvent(event: InteractionEvent) {
        this.pending.push(event);
    }

    getDuplicateEvent(type: ProfileInteractionType): InteractionEvent | null {
        const duplicate = this.pending.find(i => i.type === type) || this.handling.find(i => i.type === type);
        if (duplicate) duplicate.Stop();
        return duplicate || null;
    }
}

class InteractionEvent {
    static STANDARD_TIMEOUT = 10 * 1000;

    type: ProfileInteractionType = ProfileInteractionType.Default;
    profile: Profile;
    interactedMessage?: Message;
    stoppable: boolean;
    stopped: boolean = false;
    timerPromise_resolve: (_v: void | PromiseLike<void>) => void = () => {};
    timerPromise_timeout: NodeJS.Timeout;
    timerPromise: Promise<void>;

    protected constructor(profile: Profile, stoppable: boolean, mes?: Message) {
        console.log(`${profile.id}: Creating Interaction Event`)
        this.profile = profile
        this.interactedMessage = mes;
        this.stoppable = stoppable

        this.timerPromise = new Promise<void>((resolve) => {
            this.timerPromise_resolve = resolve;
        });

        this.timerPromise_timeout = this.Timeout();
    }

    async Stop() {
        this.stopped = true;
        this.interactedMessage?.delete().catch(_err => null);
        clearTimeout(this.timerPromise_timeout);
        this.timerPromise_resolve();
    }

    Promise() {
        return this.timerPromise;
    }

    Activity() {
        clearTimeout(this.timerPromise_timeout);
        this.timerPromise_timeout = this.Timeout();
    }

    Timeout(): NodeJS.Timeout {
        return setTimeout(async () => {
            this.timerPromise_resolve();
            this.Stop();
        }, InteractionEvent.STANDARD_TIMEOUT);
    }
}

class DefaultInteractionEvent extends InteractionEvent {
    constructor(profile: Profile, mes?: Message) {
        super(profile, true, mes);
        this.type = ProfileInteractionType.Default;
    }
}

class BattleInteractionEvent extends InteractionEvent {
    battle: Battle;
    constructor(profile: Profile, battle: Battle, mes?: Message) {
        super(profile, true, mes);
        this.type = ProfileInteractionType.Battle;
        this.battle = battle;
    }
}

class RegistrationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RegistrationError";
    }
}

export class ProfileManager {
    profileMap: Map<string, Profile> = new Map();
    private static instance: ProfileManager;

    static Instance(): ProfileManager {
        if (!ProfileManager.instance) {
            ProfileManager.instance = new ProfileManager();
        }
        return ProfileManager.instance;
    }

    private static async ensureProfile<ValidProfileData>(
        id: string,
        getScript: GetScript,
        saveScript: SaveScript,
    ): Promise<Profile | null> {
        if (id.length === 0) return null;

        const instance = this.Instance();
        const existingProfile = instance.profileMap.get(id);
        if (existingProfile) {
            console.log(`Profile (${id}) already exists.`);
            return existingProfile;
        }
        else {
            const fetchedData = await getScript(id);
            if (fetchedData) {
                const newProfile = Profile.Create(fetchedData, saveScript);
                if (!newProfile) return null;
                instance.profileMap.set(id, newProfile);
                return newProfile;
            } else {
                return null;
            }
        }
    }

    public static async GuildData(_id: string): Promise<GuildData | null> {
        const profile = await this.ensureProfile(_id, GetGuildData, SaveGuildData);
        return profile ? profile.data as GuildData : null;
    }

    public static async UserData(_id: string): Promise<UserData | null> {
        const profile = await this.ensureProfile(_id, GetUserData, SaveUserData);
        return profile ? profile.data as UserData : null;
    }

    public static async SaveGuildData(_id: string, data: Partial<GuildData>) {
        const profile = await this.ensureProfile(_id, GetGuildData, SaveGuildData);
        if (profile) {
            Object.assign(profile.data, data);
            await SaveGuildData(_id, profile.data as GuildData);
        }
    }

    public static async SaveUserData(_id: string, data: Partial<UserData>) {
        const profile = await this.ensureProfile(_id, GetUserData, SaveUserData);
        if (profile) {
            Object.assign(profile.data, data);
            await SaveUserData(_id, profile.data as UserData);
        }
    }

    private static createEvent(type: ProfileInteractionType, profile: Profile, optionals?: { associatedMes?: Message, battle?: Battle }): InteractionEvent | null {
        switch (type) {
            case ProfileInteractionType.Battle:
                return new BattleInteractionEvent(profile, optionals?.battle!, optionals?.associatedMes);
            case ProfileInteractionType.Default:
                return new DefaultInteractionEvent(profile, optionals?.associatedMes);
            default:
                return null;
        }
    }

    private static getDuplicateEvent(profile: Profile, type: ProfileInteractionType): InteractionEvent | null {
        const duplicate = profile.eventManager.getDuplicateEvent(type);
        return duplicate;
    }

    public static async Register<T extends InteractionEvent>(
        dataType: ProfileType,
        id: string,
        type: ProfileInteractionType,
        optionals?: { associatedMes?: Message, userData?: UserData, battle?: Battle }
    ): Promise<InteractionEvent | RegistrationError> {
        console.log(`Registering event (${id}): ${ProfileType[dataType]}`);

        const getScript = Script('get', dataType);
        const saveScript = Script('save', dataType);

        const profile = await this.ensureProfile(id, getScript, saveScript);
        if (!profile) return new RegistrationError("Invalid id provided with Register. ID: " + id);

        const event = this.createEvent(type, profile, optionals) as T;
        if (!event) return new RegistrationError("Invalid Interaction Event Type.");

        const duplicate = this.getDuplicateEvent(profile, type);
        if (duplicate && duplicate.stoppable) {
            console.log(`Stopping duplicate event (${id}): ${ProfileInteractionType[type]}`);
            duplicate.Stop();
        } else if (duplicate) {
            console.log(`Duplicate event (${id}): ${ProfileInteractionType[type]}`);
            return new RegistrationError("Duplicate Interaction Event.");
        }

        console.log(`Registering event (${id}): ${ProfileInteractionType[type]}`);
        profile.eventManager.registerEvent(event);
        return event;
    }
}
