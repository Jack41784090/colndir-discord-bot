export type Character = {
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
}
export type UserData = {
    characters: Character[]
}

export const HOUR = 1000 * 60 * 60;
export const GOOGLEDOCS_REGEX = /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)\/edit/i;
export const DISCORD_CDN_REGEX = /https:\/\/cdn\.discordapp\.com\/attachments\/\d+\/\d+\/\w+\.(?:jpg|png|gif)\?[\w=&-]+/i;
export const DISCORD_MEDIA_REGEX = /https:\/\/media\.discordapp\.net\/attachments\/\d+\/\d+\/\w+\.(?:jpg|png|gif)\?[\w=&-]+/i;
