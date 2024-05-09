import bot from "@bot";
import { DEFAULT_LEAVE_MESSAGE, DEFAULT_WELCOME_MESSAGE, GUILDINFO_COLLECTION_NAME, USERINFO_COLLECTION_NAME } from "@constants";
import { Character, GuildData, UserData } from "@ctypes";
import { getDefaultCharacter, NewObject } from "@functions";
import { Image } from "canvas";
import { User } from "discord.js";
import * as firebase_admin from "firebase-admin";
import * as app from "firebase-admin/firestore";
import * as fs from "fs";
import path from "path";


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
    notExistCB?: (data: T, document: app.DocumentReference) => void
) {
    const document = database.collection(collection).doc(doc);
    const snapshotData = await document.get();

    console.log(`Saving Data [${collection}] => [${doc}]`, JSON.stringify(data));
    if (snapshotData.exists) {
        if (existCB) existCB(data, document);
        else {
            console.log(`||=> Exists`);
            await document.update(data);
        }
    }
    else {
        if (notExistCB) notExistCB(data, document);
        else {
            console.log(`||=> Does not exist. Creating new data.`);
            await document.set(data);
        }
    }

    return data;
}

export async function SaveUserData(data: UserData) {
    const defaultUserData = GetDefaultUserData();
    return await SaveData("User", data.id, NewObject(defaultUserData, data));
}
export async function GetUserData(id: string): Promise<UserData>;
export async function GetUserData(author: User): Promise<UserData> 
export async function GetUserData(id_author: string | User): Promise<UserData> {
    const {user, id} = typeof id_author !== 'string' ?
        { user: id_author, id: id_author.id }:
        { user: await bot.users.fetch(id_author), id: id_author };

    const fetched: FirebaseFirestore.DocumentData | null = await GetData(USERINFO_COLLECTION_NAME, id);
    const defaultData: UserData = GetDefaultUserData(user);
    const data: UserData = NewObject(defaultData, fetched || {});
    if (fetched === null) {
        await CreateNewUser(user);
    }
    return data;
}

export async function SaveGuildData(serverID: string, gd: Partial<GuildData>) {
    const defaultData = GetDefaultGuildData(gd);
    return await SaveData(GUILDINFO_COLLECTION_NAME, serverID, gd, 
        (data, document) => {
            console.log(`||=> Exists`);
            document.update(data);
        },
        (data, document) => {
            console.log(`||=> Does not exist. Creating new data.`);
            document.set(defaultData);
        }
    );
}
export async function GetGuildData(serverID: string) {
    const fetched = await GetData(GUILDINFO_COLLECTION_NAME, serverID);
    const defaultData = GetDefaultGuildData(fetched || {});
    if (fetched === null) {
        await SaveGuildData(serverID, defaultData);
    }
    return NewObject(defaultData, fetched || {});
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
export async function CreateNewUser(author: User): Promise<UserData> {
    const defaultData = GetDefaultUserData(author)
    return await SaveUserData(defaultData);
}

export function GetDefaultGuildData(opt: Partial<GuildData> = {}): GuildData {
    return Object.assign({
        roleChannelID: "",
        roleMessageID: [],
        welcomeMessage: DEFAULT_WELCOME_MESSAGE,
        welcomeChannelID: "",
        leaveMessage: DEFAULT_LEAVE_MESSAGE,
        leaveChannelID: "",
    }, opt);
}
export function GetDefaultUserData(_user?: User): UserData {
    const { username, id } = _user || {
        username: "", id: "",
    };
    return {
        id,
        username,
        characters: [],
        combatCharacters: [],
    };
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