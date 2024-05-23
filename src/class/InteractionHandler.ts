import bot from "@bot";
import { DEFAULT_LEAVE_MESSAGE, DEFAULT_WELCOME_MESSAGE, GUILDINFO_COLLECTION_NAME, USERINFO_COLLECTION_NAME } from "@constants";
import { Character, GuildData, UserData } from "@ctypes";
import { getDefaultCharacter, getPromiseStatus, NewObject } from '@functions';
import { Image } from "canvas";
import { Message, User } from 'discord.js';

//#region FIREBASE
import * as firebase_admin from "firebase-admin";
import * as app from "firebase-admin/firestore";
import * as fs from "fs";
import path from "path";
import { Battle } from "./Battle";

// firebase login
firebase_admin.initializeApp({
    credential: firebase_admin.credential.cert({
        projectId: process.env['FB_PROJECT_ID'],
        privateKey: process.env['FB_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
        clientEmail: process.env['FB_CLIENT_EMAIL'],
    })
});
const database = app.getFirestore()

async function GetData(collection: string, doc: string) {
    const docRef = database.collection(collection).doc(doc);
    const snapShot = await docRef.get();
    return snapShot.exists?
        snapShot.data()!:
        null;
}
async function SaveData<T extends object>(collection: string, doc: string, data: T, 
    existCB?: (data: T, document: app.DocumentReference) => void,
    notExistCB?: (document: app.DocumentReference) => void
) {
    const document = database.collection(collection).doc(doc);
    const snapshotData = await document.get();

    console.log(`Saving Data [${collection}] => [${doc}]`, JSON.stringify(data));
    if (snapshotData.exists) {
        if (existCB) existCB(snapshotData.data() as T, document);
        else {
            console.log(`||=> Exists`);
            await document.update(data);
        }
    }
    else {
        if (notExistCB) notExistCB(document);
        else {
            console.log(`||=> Does not exist. Creating new data.`);
            await document.set(data);
        }
    }

    return data;
}

async function SaveUserData(userID: string, userdata: Partial<UserData>) {
    return await SaveData(USERINFO_COLLECTION_NAME, userID, userdata, 
        (data, document) => {
            console.log(`||=> Exists`);
            const updated = Object.assign(data, userdata)
            document.update({
                id: updated.id,
                username: updated.username,
                characters: updated.characters,
                combatCharacters: updated.combatCharacters,
            });
        },
        (document) => {
            console.log(`||=> Does not exist. Creating new data.`);
            const defaultData = GetDefaultUserData(userID, userdata);
            document.set({
                id: defaultData.id,
                username: defaultData.username,
                characters: defaultData.characters,
                combatCharacters: defaultData.combatCharacters,
            });
        }
    ) as UserData;
}
async function GetUserData(id: string): Promise<UserData>;
async function GetUserData(author: User): Promise<UserData> 
async function GetUserData(id_author: string | User): Promise<UserData | null> {
    const {user, id} = typeof id_author === 'string' ?
        { user: await bot.users.fetch(id_author).catch(_ => null), id: id_author }:
        { user: id_author, id: id_author.id };
    
    if (!user) return null;

    const fetched: FirebaseFirestore.DocumentData | null = await GetData(USERINFO_COLLECTION_NAME, id);
    const defaultData: UserData = GetDefaultUserData(user.id, user);
    if (fetched === null) {
        const existingUser = await bot.users.fetch(id).catch(_ => null);
        if (!existingUser) return null;
        return await CreateNewUser(user);
    }
    else {
        const ud = {
            id: fetched.id?.length > 0 ? fetched.id : user.id,
            username: fetched.username?.length > 0 ? fetched.username : user.username,
            characters: fetched.characters ?? [],
            combatCharacters: fetched.combatCharacters ?? [],
        } as UserData;
        console.log(`Got User Data [${id}]`, JSON.stringify(ud));
        return ud;
    }
}

async function SaveGuildData(serverID: string, gd: Partial<GuildData>) {
    console.log(`Saving Guild Data [${serverID}]...`)
    return await SaveData(GUILDINFO_COLLECTION_NAME, serverID, gd, 
        (data, document) => {
            const newgd = Object.assign(data, gd);
            console.log(`||=> Exists, ${JSON.stringify(newgd)}`);
            document.update(newgd);
        },
        (document) => {
            console.log(`||=> Does not exist. Creating new data.`);
            const defaultData = GetDefaultGuildData(serverID, gd);
            document.set(defaultData);
        }
    );
}
async function GetGuildData(serverID: string) {
    console.log(`Getting Guild Data [${serverID}]...`)
    
    const fetched = await GetData(GUILDINFO_COLLECTION_NAME, serverID);
    const defaultData = GetDefaultGuildData(serverID, fetched || {});
    if (fetched === null) {
        const guildExists = await bot.guilds.fetch(serverID).catch(_ => null);
        if (!guildExists) return null;
        await SaveGuildData(serverID, defaultData);
    }
    const gd = NewObject(defaultData, fetched || {})
    console.log(`Got Guild Data [${serverID}]`, JSON.stringify(gd));
    
    return gd as GuildData;
}

export async function GetCombatCharacter(id: string, authorise?: User) {
    const character = await GetData('Combat Character', id) as Character | null;
    if (character !== null && (character.authorised.includes("all") || character.authorised.includes(authorise?.id || ""))) {
        const r = Object.assign(getDefaultCharacter(), character);
        if (Object.keys(r).length !== Object.keys(character).length) {
            await SaveData('Combat Character', id, r);
        }
        return r;
    }
    return null;
}
async function CreateNewUser(author: User): Promise<UserData> {
    const defaultData = GetDefaultUserData(author.id, author)
    return await SaveUserData(author.id, defaultData);
}

function GetDefaultGuildData(id: string, opt: Partial<GuildData> = {}): GuildData {
    return Object.assign({
        id,
        roleChannelID: "",
        roleMessageID: [],
        welcomeMessage: DEFAULT_WELCOME_MESSAGE,
        welcomeChannelID: "",
        leaveMessage: DEFAULT_LEAVE_MESSAGE,
        leaveChannelID: "",
        approvedChannelID: "",
        pendingChannelID: "",
        registeredCharacters: [],
    }, opt);
}
function GetDefaultUserData(id: string, _user?: Partial<UserData>): UserData {
    return Object.assign({
        id,
        username: "",
        characters: [],
        combatCharacters: [],
    }, _user);
}
function GetFileImage(_path: string): Promise<Image | null> {
    const image = new Image();
    return new Promise((resolve) => {
        fs.readFile(path.join(__dirname, _path), 'utf8', (err, buffer) => {
            if (err) {
                console.error(err);
                resolve(null);
            }

            const timeout = setTimeout(() => {
                image.onload = null;
                resolve(null);
            }, 10 * 1000);
            image.onload = () => {
                clearTimeout(timeout);
                resolve(image);
            };
            image.src = buffer;
        });
    });
}
//#endregion

export enum ProfileInteractionType { DefaultUser, DefaultGuild, Dungeon, Battle }

class Profile {
    pending: Array<InteractionEvent>
    handling: Array<InteractionEvent>
    handlerPromise: Promise<unknown>
    handleInterval;

    constructor() {
        this.pending = [];
        this.handling = [];
        this.handlerPromise = Promise.resolve();
        this.handleInterval = setInterval(() => {
            this.maybeHandle();
        }, 1000)
    }

    async maybeHandle(): Promise<void> {
        const handlerStatus = await getPromiseStatus(this.handlerPromise)
        if (handlerStatus === 'fulfilled') {
            await this.handle();
        }
    }
    
    // Wait for all interactions for a player to end, then save UserData to the cloud
    // That way, I don't have to spam the save function and burn "write" money.
    // TODO: Try and make a "reject" section, when a new interaction is detected in "pending".
    // TODO: Then, in the reject section, renew the Promise.all();
    // NOTE: allSettled cannot detect promises that are just pushed in, so we need a handling and pending array.
    async handle() {
        if (this.handling.length === 0) {
            if (this.pending.length === 0) {
                this.delete(); 
                return;
            }
            this.handling = this.pending;
            this.pending = [];
        }

        this.handlerPromise =
            // 1. Wait for the first waves of interactions in "handling" to finish.
            Promise.allSettled(this.handling.map(_e => _e.Promise()))
                .then(() => {
                    // 2. Stop each interaction if it hasn't been stopped already.
                    this.handling.forEach(_e => { if (!_e.stopped) _e.Stop() });
                    this.handling = [];

                    // 3. If there are still pending interactions looking to save
                    if (this.pending.length > 0) {
                        // 3a. There is, so redo HandlePlayer
                        console.log("\t\tPending is not empty, reusing.")
                        return this.handle();
                    }
                    else {
                        // 3b. All done. Save to cloud.
                        console.log("\t\tAll done.")
                        this.save();
                    }
                });
    }

    delete() { console.error(`Profile delete not implemented.`) }
    async save() { console.error(`Profile save not implemented.`)}
}
export class UserProfile extends Profile {
    id: string;
    constructor(public userData: UserData) {
        super()
        this.id = `user:${userData.id}`
        console.log(`Creating User Profile (${this.id})...`);
    }

    override async save() {
        console.log(`Saving User Data (${this.id})...`);
        await SaveUserData(this.userData.id, this.userData);
    }

    override async delete() {
        clearInterval(this.handleInterval);
        console.log(`Deleting User Profile (${this.id})...`);
        ProfileManager.Instance().userProfilesMap.delete(this.userData.id);
    }
}
export class GuildProfile extends Profile {
    id: string;
    pending: Array<InteractionEvent> = [];
    handling: Array<InteractionEvent> = [];
    handlerPromise: Promise<unknown> = Promise.resolve();
    constructor(public guildData: GuildData) {
        super();
        this.id = `guild:${guildData.id}`
        console.log(`Creating Guild Profile (${this.id})...`);
    }

    override async save() {
        console.log(`Saving Guild Data (${this.id})...`);
        await SaveGuildData(this.guildData.id, this.guildData);
    }

    override async delete() {
        clearInterval(this.handleInterval);
        console.log(`Deleting Guild Profile (${this.id})...`);
        ProfileManager.Instance().guildProfileMap.delete(this.guildData.id);
    }
}

class InteractionEvent {
    static STANDARD_TIMEOUT = 10 * 1000;

    type: ProfileInteractionType = ProfileInteractionType.DefaultUser;
    profile: UserProfile | GuildProfile;
    interactedMessage?: Message;
    stoppable: boolean;
    stopped: boolean = false;

    timerPromise_resolve: (_v: void | PromiseLike<void>) => void = () => {};
    timerPromise_timeout: NodeJS.Timeout;
    timerPromise: Promise<void>;

    protected constructor(profile: UserProfile | GuildProfile, stoppable: boolean, mes?: Message) {
        console.log(`${profile.id}: Creating Interaction Event (${ProfileInteractionType[this.type]})`)
        this.profile = profile
        this.interactedMessage = mes;
        this.stoppable = stoppable

        this.timerPromise = new Promise<void>((resolve) => {
            this.timerPromise_resolve = resolve;
        });

        // inactivity stop
        this.timerPromise_timeout = this.Timeout();
    }

    /** Removing the player's presence in the activity and allows for a new one to be generated */
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
    constructor(id: GuildProfile | UserProfile, mes?: Message) {
        super(id, true, mes);
        this.type = id instanceof GuildProfile ? ProfileInteractionType.DefaultGuild : ProfileInteractionType.DefaultUser;
    }
}
class BattleInteractionEvent extends InteractionEvent {
    battle: Battle;
    constructor(id: GuildProfile | UserProfile, battle: Battle, mes?: Message) {
        super(id, true, mes);
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
    // instance values
    guildProfileMap: Map<string, GuildProfile> = new Map();
    userProfilesMap: Map<string, UserProfile> = new Map();
    private static instance: ProfileManager;

    // static to access data easier
    static Instance(): ProfileManager {
        if (ProfileManager.instance === undefined) {
            ProfileManager.instance = new ProfileManager();
        }
        return this.instance;
    }

    // Ensure a user profile exists and return it.
    private static async ensureUserProfile(id: string, userData?: UserData): Promise<UserProfile | null> {
        if (id.length === 0) return null;
        if (!this.instance) this.instance = this.Instance();
        const get = this.instance.userProfilesMap.get(id);
        if (get) {
            return get
        }
        else {
            const fetch = await GetUserData(id);
            return fetch ?
                this.instance.userProfilesMap.set(id,new UserProfile(userData ?? fetch)).get(id)!:
                null;
        }
    }
    private static async ensureGuildProfile(id: string, guildData?: GuildData): Promise<GuildProfile | null> {
        if (!this.instance) this.instance = this.Instance();
        const get = this.instance.guildProfileMap.get(id);
        if (get) {
            return get
        }
        else {
            const fetch = await GetGuildData(id);
            return fetch ?
                this.instance.guildProfileMap.set(id,new GuildProfile(guildData ?? fetch)).get(id)!:
                null;
        }
    }
    public static async GuildData(_id: string): Promise<GuildData | null> {
        return this.ensureGuildProfile(_id).then(x => x?.guildData ?? null);
    }
    public static async UserData(_id: string): Promise<UserData | null> {
        return this.ensureUserProfile(_id).then(x => x?.userData ?? null);
    }

    public static async SaveGuildData(_id: string, data: Partial<GuildData>) {
        return this.ensureGuildProfile(_id).then(x => x ? x.guildData = Object.assign(x.guildData, data) as GuildData : null);
    }
    public static async SaveUserData(_id: string, data: Partial<UserData>) {
        return this.ensureUserProfile(_id).then(x => x ? x.userData = Object.assign(x.userData, data) as UserData : null);
    }

    // Helper to create specific interaction events based on type.
    private static createEvent(type: ProfileInteractionType, id: GuildProfile | UserProfile, { associatedMes, dungeon, battle }: any): InteractionEvent | null {
        switch (type) {
            case ProfileInteractionType.Battle:
                return new BattleInteractionEvent(id, battle!, associatedMes);
            case ProfileInteractionType.DefaultUser:
            case ProfileInteractionType.DefaultGuild:
                return new DefaultInteractionEvent(id, associatedMes);
            default:
                return null;
        }
    }

    // Check for duplicate events.
    private static getDuplicateEvent(userProfile: Profile, type: ProfileInteractionType) {
        const duplicate = userProfile.pending.find(i => i.type === type) || userProfile.handling.find(i => i.type === type);
        if (duplicate) duplicate.Stop(); // Stops the duplicate event.
        return duplicate || null;
    }

    private static GetEvent<E extends InteractionEvent>(_id: string, type: ProfileInteractionType): E | null {
        const map = this.instance.userProfilesMap.get(_id);
        return map?.handling.find(_e => _e.type === type) as E ||
            map?.pending.find(_e => _e.type === type) || null;
    }

    // Simplified registration method for interaction events.
    public static async Register<T extends InteractionEvent>(id: string, type: ProfileInteractionType, optionals?: {
        associatedMes?: Message,
        userData?: UserData,
        battle?: Battle
    }) {
        console.log(`Registering event (${id}): ${ProfileInteractionType[type]}`);
        const { associatedMes, userData, battle } = optionals ?? {};

        const profile = (await ProfileManager.ensureGuildProfile(id) ?? await ProfileManager.ensureUserProfile(id));
        if (!profile) return new RegistrationError("Invalid id provided with Register. ID: " + id);

        const event = this.createEvent(type, profile, { associatedMes, userData, battle }) as T;
        if (!event) return new RegistrationError("Invalid Interaction Event Type."); // Early exit if no event created.

        const duplicate = this.getDuplicateEvent(profile, type);
        if (duplicate) {
            if (duplicate.stoppable) {
                console.log(`Stopping duplicate event (${id}): ${ProfileInteractionType[type]}`);
                duplicate.Stop(); // Stops the duplicate event.
            }
            else {
                console.log(`Duplicate event (${id}): ${ProfileInteractionType[type]}`);
                return new RegistrationError("Duplicate Interaction Event."); // Early exit if duplicate event.
            }
        }

        console.log(`Registering event (${id}): ${ProfileInteractionType[type]}`);
        profile.pending.push(event);
        return event;
    }
}