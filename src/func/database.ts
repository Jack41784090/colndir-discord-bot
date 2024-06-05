
//#region FIREBASE
import bot from "@bot";
import { COMBATCHARACTER_COLLECTION_NAME, DEFAULT_LEAVE_MESSAGE, DEFAULT_WELCOME_MESSAGE, GUILDINFO_COLLECTION_NAME, USERINFO_COLLECTION_NAME } from "@constants";
import { CombatCharacter, GuildData, UserData } from "@ctypes";
import { NewObject } from "@functions";
import { Image } from "canvas";
import { User } from "discord.js";
import * as firebase_admin from "firebase-admin";
import * as app from "firebase-admin/firestore";
import * as fs from "fs";
import path from "path";
import { getDefaultCharacter } from "./battle-func";

// firebase login
firebase_admin.initializeApp({
    credential: firebase_admin.credential.cert({
        projectId: process.env['FB_PROJECT_ID'],
        privateKey: process.env['FB_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
        clientEmail: process.env['FB_CLIENT_EMAIL'],
    })
});
const database = app.getFirestore()

export async function GetData(collection: string, doc: string) {
    const docRef = database.collection(collection).doc(doc);
    const snapShot = await docRef.get();
    return snapShot.exists?
        snapShot.data()!:
        null;
}
export async function SaveData<T extends object>(collection: string, doc: string, data: T, 
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

export async function SaveUserData(userID: string, userdata: Partial<UserData>) {
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
export async function GetUserData(id: string): Promise<UserData>;
export async function GetUserData(author: User): Promise<UserData> 
export async function GetUserData(id_author: string | User): Promise<UserData | null> {
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

export async function SaveGuildData(serverID: string, gd: Partial<GuildData>) {
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
    ) as GuildData;
}
export async function GetGuildData(serverID: string) {
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

export async function GetCombatCharacter(id: string, options?: {
    createNew?: boolean,
    authorise?: User
}) {
    const { authorise, createNew } = options ?? {};
    const character = await GetData(COMBATCHARACTER_COLLECTION_NAME, id) as CombatCharacter | null;

    if (character === null) {
        if (createNew) {
            return await SaveCombatCharacter(id, getDefaultCharacter());
        }
        else {
            return null;
        }
    }

    if (character.authorised.includes("all") || (authorise && character.authorised.includes(authorise.id))) {
        const r = Object.assign(getDefaultCharacter(), character);
        if (Object.keys(r).length !== Object.keys(character).length) {
            await SaveData(COMBATCHARACTER_COLLECTION_NAME, id, r);
        }
        return r;
    }

    return null;
}
export async function SaveCombatCharacter(id: string, character: Partial<CombatCharacter>): Promise<CombatCharacter> {
    console.log(`Saving Combat Character Data [${id}]...`)
    return await SaveData(COMBATCHARACTER_COLLECTION_NAME, id, character, 
        (data, document) => {
            const newgd = Object.assign(data, character);
            console.log(`||=> Exists, ${JSON.stringify(newgd)}`);
            document.update(newgd);
        },
        (document) => {
            console.log(`||=> Does not exist. Creating new data.`);
            const defaultData = Object.assign(getDefaultCharacter(), character);
            document.set(defaultData);
        }
    ) as CombatCharacter;
}

export async function CreateNewUser(author: User): Promise<UserData> {
    const defaultData = GetDefaultUserData(author.id, author)
    return await SaveUserData(author.id, defaultData);
}

export function GetDefaultGuildData(id: string, opt: Partial<GuildData> = {}): GuildData {
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
export function GetDefaultUserData(id: string, _user?: Partial<UserData>): UserData {
    return Object.assign({
        id,
        username: "",
        characters: [],
        combatCharacters: [],
    }, _user);
}
export function GetFileImage(_path: string): Promise<Image | null> {
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
