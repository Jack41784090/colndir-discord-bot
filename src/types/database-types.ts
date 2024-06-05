import { CombatCharacter } from "./battle-types";

export type ColndirCharacter = {
    NAME: string;
    SEX: string;
    RACE: string;
    ALIAS?: string;
    AGE: string;
    ETHNICITY: string;
    HEIGHT?: string;
    WEIGHT?: string;
    AFFILIATION: string;
    ALIGNMENT: string;
    POWERS_AND_ABILITIES: string;
    EQUIPMENT: string;
    BACKGROUND: string;
    PERSONALITY_TRAITS: string;
    MISCELLANEOUS?: string;
    APPEARANCE?: string;
    thread: string;
    guildID: string;
    userID: string;
}
export type UserData = {
    id: string;
    username: string;
    characters: string[]
    combatCharacters: string[]
}
export type GuildData = {
    id: string;
    registeredCharacters: ColndirCharacter[],
    roleChannelID: string;
    roleMessageID: string[];
    welcomeMessage: string;
    welcomeChannelID: string;
    leaveMessage: string;
    leaveChannelID: string;
    approvedChannelID: string;
    pendingChannelID: string;
}

export enum ProfileType { User, Guild, CombatCharacter }
export enum ProfileInteractionType { Default, Dungeon, Battle }
export type ValidProfileData = UserData | GuildData | CombatCharacter;

export type SaveScript = (id: string, data: ValidProfileData) => Promise<ValidProfileData>;
export type GetScript = (id: string) => Promise<ValidProfileData | null>
