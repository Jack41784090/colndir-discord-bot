export const HOUR = 1000 * 60 * 60;
export const GOOGLEDOCS_REGEX = /^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)\/edit/i;
export const DISCORD_CDN_REGEX = /https:\/\/cdn\.discordapp\.com\/attachments\/\d+\/\d+\/\w+\.(?:jpg|png|gif)\?[\w=&-]+/i;
export const DISCORD_MEDIA_REGEX = /https:\/\/media\.discordapp\.net\/attachments\/\d+\/\d+\/\w+\.(?:jpg|png|gif)\?[\w=&-]+/i;
export const NORM_CHAR_LIMIT = 2000;
export const DESCRIPTION_LIMIT = 4096;
export const FIELD_NAME_LIMIT = 256;
export const FIELD_VALUE_LIMIT = 1024;
export const NOAH_USERID = '843757875477741569';
export const MERC_USERID = '262871357455466496';
export const IKE_USERID = '634873409393917952';
export const NOAH_DMID= '1232116541890363403';
export const LAB_CHANNELID = '1232126725039587389'

export const COLNDIR_SERVERID = '981009510934151188';
export const ALTPAKT_SERVERID = '1206814142938357780';

export const LOGCO_ORG = 11.1;
export const XCO_ORG = 0.23;
export const LOGCO_STR_HP = 8.3;
export const XCO_STR_HP = 0.6;
export const LOGCO_SIZ_HP = 12;
export const XCO_SIZ_HP = 0.7;

export const pierceFailFallCoef = 0.057
export const forceFailFallCoef = 0.007

export const FORESEE = 4;

export const INTERFACE_PERSIST_TIME = 15
export const INTERFACE_REFRESH_TIME = 5

export enum Emoji {
    BOOM = '💥',
    STATUS = '📊',
    TARGET = '🎯',
    SHIELD = '🛡️',
    SWORD = '⚔️',
    HEART = '❤️',
    MORALE = '🔵',
    STAMINA = '🟢',
    POSTURE = '🟡',
    CLOCK = '⏰',
    BOMB = '💣',
    FIRE = '🔥',
    ICE = '❄️',
    WIND = '🌀',
    EARTH = '🌍',
    RED_SIGN = '🚫',
    THINKING = '🤔',
}

export enum iEntityKeyEmoji {
    stamina = Emoji.STAMINA,
    hp = Emoji.HEART,
    org = Emoji.MORALE,
    pos = Emoji.POSTURE,
}
