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

export const GOOGLEDOCS_REGEX = /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)\/edit/i;

