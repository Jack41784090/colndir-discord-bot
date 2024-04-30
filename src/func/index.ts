import { Colors, EmbedBuilder, EmbedData, Message, TextBasedChannel } from "discord.js";
import ytdl from "ytdl-core";

export function capitalize(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
export function formalise(string: string): string {
    return string.split(/[\s_-]+/).map(s => capitalize(s.toLowerCase())).join(" ");
}

export function NewObject<T extends object, T2 extends object>
    (origin: T, _mod?: T2): T & T2
{
    const mod = (_mod || {}) as T2;
    return Object.assign({...origin}, mod);
}

export function getCharArray(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export function cutDownLength(string: string, limit: number) {
    const match = string.match(new RegExp(`[\\s\\S]{1,${limit}}`, 'g'));
    // console.log(match);
    return match?.[0] || null;
}

export function getErrorEmbed(message: string, options?: Partial<EmbedData>) {
    const b: EmbedData = {
        title: "Warning!",
        footer: {
            text: message
        },
        color: Colors.Red
    };
    return new EmbedBuilder(Object.assign(b, options))
}
export function getGreenflagEmbed(message: string, options?: Partial<EmbedData>) {
    const b: EmbedData = {
        title: "Done.",
        footer: {
            text: message
        },
        color: Colors.Green
    };
    return new EmbedBuilder(Object.assign(b, options))
}

/**
 * "Consecutive messages" defined as: fetching from "after: afterID", every message that has the same author, limited to 50.
 * @param afterID 
 * @param origin 
 * @param channel 
 * @returns 
 */
export async function getConsecutiveMessages(afterID: string, origin: Message<boolean>, channel: TextBasedChannel) {
    console.log("Fetch messages after origin")
    const corress = await channel.messages.fetch({
        after: afterID,
    });
    if (corress === undefined) return null;
    const story = [];
    const related = Array.from(corress.values()).reverse();
    related.unshift(origin);
    for (const m of related) {
        if (m.author.id === origin.author.id) {
            story.push(m);
        }
        else {
            break;
        }
    }
    return story;
}

export async function getAllMessages(submissionChannel: TextBasedChannel) {
    const fetch100 = async (before?: string) => {
        const messages = await submissionChannel.messages.fetch({
            before: before || undefined,
            limit: 100,
        }).then(ms => Array.from(ms.values()).reverse());
        return messages
    }
    const messages: Message[] = [];
    let fetched = await fetch100();
    while (fetched.length === 100) {
        messages.push(...fetched);
        fetched = await fetch100(fetched[0].id);
    }
    messages.push(...fetched);
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    console.log(`Fetched ${messages.length} messages`)
    return messages;
}

export function getPromiseStatus(p: Promise<unknown>): Promise<'pending' | 'fulfilled' | 'rejected'> {
    const t = {};
    return Promise.race([p, t])
        .then(v =>
            (v === t)?
                "pending":
                "fulfilled",
            () => "rejected"
        );
}

export function roundToDecimalPlace(number: number, decimalPlace: number = 1) {
    if (number === 0) return 0;

    const decimal = Math.pow(10, decimalPlace);

    if (decimalPlace === undefined) {
        let value: number;
        for (let i = 0; i < 25; i++) {
            const newDecimal = Math.pow(10, decimalPlace + i);
            value = Math.round((number + Number.EPSILON) * newDecimal) / newDecimal;
            if (value !== 0) {
                break;
            }
        }
        return value!;
    }
    else {
        return Math.round((number + Number.EPSILON) * decimal) / decimal;
    }
}

export function uniformRandom(_1: number, _2: number, decimize = false): number {
    const parametersIntegers = Number.isInteger(_1) && Number.isInteger(_2);
    const random = Math.random(); // [0.0, 1.0]

    const result = Math.min(_1, _2) + ((Math.abs(_1 - _2) + Number(parametersIntegers)) * random);

    return parametersIntegers && !decimize?
        Math.floor(result):
        result;
}
export function average(...nums: Array<number>) {
    let total = 0;
    for (let i = 0; i < nums.length; i++) {
        const n = nums[i];
        total += n;
    }
    return total / (nums.length || 1);
}
export function gaussianRandom(_mean: number, _standardDeviation: number): number {
    // Box Muller Transform
    let u, v;
    while (!u || !v) {
        u = Math.random();
        v = Math.random();
    }
    const x_N0_1 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

    return _mean + _standardDeviation * x_N0_1;
}
export function clamp(value: number, min: number = Number.NEGATIVE_INFINITY, max: number = Number.POSITIVE_INFINITY) {
    return Math.max(Math.min(value, max), min);
}

export function extractYouTubeID(url: string) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}
  
export async function getVideoInfo(youtubeLink: string) {
    const match = extractYouTubeID(youtubeLink);
    if (!match) return null;
    
    try {
        const videoInfo = ytdl(`https://www.youtube.com/watch?v=${match}`, {
            filter: 'audioandvideo',
            quality: 'highest',
        });
        return videoInfo;
    }
    catch(e) {
        return e as Error;
    }
}

export async function TestFunction() {
    // const ike = await bot.users.fetch(IKE_USERID);
    // const merc = await bot.users.fetch(MERC_USERID)
    // const b = await Battle.Create({
    //     channel: await bot.channels.fetch('1232126725039587389') as TextBasedChannel,
    //     users: [merc, ike],
    //     teamMapping: {
    //         'enemy': [merc],
    //         'player': [ike]
    //     },
    //     pvp: true
    // })
    
    // // const a1 = new AbilityInstance({
    // //     associatedBattle: b,
    // //     name: AbilityName.Stab,
    // //     trigger: AbilityTrigger.StartSkirmish,
    // // });
    // // const a2 = new AbilityInstance({
    // //     associatedBattle: b,
    // //     name: AbilityName.Slash,
    // //     trigger: AbilityTrigger.EndSkirmish,
    // // });
    // b.spawnUsers();

    // for (let i = 0; i < 40; i++) {
    //     const pierce = i;
    //     const armor = 20
    //     const attacker = b.playerEntities[0];
    //     const defender = b.playerEntities[1];
    //     attacker.equippedWeapon.force = pierce;
    //     defender.equippedArmour.defence = armor;
    //     const pd = calculateForceDamage(attacker, defender, 100);
    //     console.log(`[f: ${pierce}, d: ${armor}] = ${pd}`);
    // }

    // const startPierceFail = 0.057
    // const startForceFail = 0.007
    // const tick = 0.001
    // const totalResult: Array<[[number, number], number]> = [];
    // for (let o = -2000; o < 2000; o++) {
    //     for (let oi = -2000; oi < 2000; oi++) {
    //         const rs = [];
    //         for (let i = 0; i < 10; i++) {
    //             for (let x = 0; x < 10; x++) {
    //                 const p1 = b.playerEntities[0];
    //                 const p2 = b.playerEntities[1];
    
    //                 p1.equippedWeapon.force = i;
    //                 p1.equippedWeapon.pierce = 10 - i;
    //                 p2.equippedArmour.defence = x;
    //                 p2.equippedArmour.armour = 10 - x;
    //                 // b.skirmish(b.playerEntities[0], b.playerEntities[1]);
    //                 const result = Clash(b.playerEntities[0], b.playerEntities[1], startPierceFail + o * tick, startForceFail + oi * tick);
    //                 rs.push(result)
    //             }
    //         }
    
    //         rs.sort((a, b) => a.totalDamage - b.totalDamage);
    //         const totalDamage = rs.map(r => r.totalDamage);
    //         const normalDistribution = std(totalDamage);
    //         // console.log(normalDistribution)
    //         totalResult.push([[startPierceFail + o * tick, startForceFail + o * tick] as [number,number], normalDistribution as unknown as number]);
    //     }
    // }

    // totalResult.sort((a, b) => a[1] - b[1]);
    // const mostOptimal = totalResult[0];
    // const leastOptimal = totalResult[totalResult.length - 1];
    // console.log(totalResult[0], totalResult[totalResult.length - 1]);
    // const rs = [];
    // for (let i = 0; i < 10; i++) {
    //     for (let x = 0; x < 10; x++) {
    //         const p1 = b.playerEntities[0];
    //         const p2 = b.playerEntities[1];

    //         p1.equippedWeapon.force = i;
    //         p1.equippedWeapon.pierce = 10 - i;
    //         p2.equippedArmour.defence = x;
    //         p2.equippedArmour.armour = 10 - x;
    //         // b.skirmish(b.playerEntities[0], b.playerEntities[1]);
    //         const result = Clash(b.playerEntities[0], b.playerEntities[1], leastOptimal[0][0], leastOptimal[0][1]);
    //         rs.push(result)
    //     }
    // }

    // rs.sort((a, b) => a.totalDamage - b.totalDamage);
    // rs.forEach(r => {
    //     const { totalDamage, pierceDamage, forceDamage, weaponPierce, weaponForce, armourArmour, armourDefence } = r;
    //     console.log(`[f: ${weaponForce}, d: ${armourDefence}] = ${forceDamage}`, `[p: ${weaponPierce}, a: ${armourArmour}] = ${pierceDamage}`, `=== ${totalDamage}`);
    // })

    // const rs = [];

    // for (let i = 0; i < 10; i++) {
    //     for (let x = 0; x < 10; x++) {
    //         const p1 = b.playerEntities[0];
    //         const p2 = b.playerEntities[1];

    //         p1.equippedWeapon.force = i;
    //         p1.equippedWeapon.pierce = 10 - i;
    //         p2.equippedArmour.defence = x;
    //         p2.equippedArmour.armour = 10 - x;
    //         // b.skirmish(b.playerEntities[0], b.playerEntities[1]);
    //         const result = Clash(b.playerEntities[0], b.playerEntities[1]);
    //         rs.push(result)
    //     }
    // }

    // // for (let i = 0; i < 20; i++) {
    // //     const p1 = b.playerEntities[0];
    // //     const p2 = b.playerEntities[1];

    // //     p1.equippedWeapon.pierce = 5;
    // //     p2.equippedArmour.armour = i;
    // //     // b.skirmish(b.playerEntities[0], b.playerEntities[1]);
    // //     const { totalDamage, pierceDamage, forceDamage } = Clash(b.playerEntities[0], b.playerEntities[1]);
    // //     console.log(`[p: 0, a: ${i}] = ${pierceDamage}`);
    // // }
    // rs.sort((a, b) => a.totalDamage - b.totalDamage);
    // rs.forEach(r => {
    //     const { totalDamage, pierceDamage, forceDamage, weaponPierce, weaponForce, armourArmour, armourDefence } = r;
    //     console.log(`[f: ${weaponForce}, d: ${armourDefence}] = ${forceDamage}`, `[p: ${weaponPierce}, a: ${armourArmour}] = ${pierceDamage}`, `=== ${totalDamage}`);
    // })


}

export function isSubset<T>(_superset: Set<T>, _subset: Set<T>): boolean;
export function isSubset<T>(_superset: T[], _subset: T[]): boolean
export function isSubset<T>(_superset: T[] | Set<T>, _subset: T[] | Set<T>): boolean {
    const subset = Array.isArray(_subset)? _subset: Array.from(_subset);
    const superset = Array.isArray(_superset)? _superset: Array.from(_superset);
    return subset.every(value => superset.includes(value));
}

export function getLoadingEmbed() {
    const url = "https://cdn.discordapp.com/attachments/571180142500511745/829109314668724234/ajax-loader.gif";
    const loadingEmbed = new EmbedBuilder()
        .setAuthor({
            name: "Wait a while.",
            iconURL: url,
            url: url,
        })
        .setTitle("Now Loading...");
    return loadingEmbed;
}

export * from './add-to-team';
export * from './battle-func';
export * from './database';
export * from './googledocs';
export * from './openai';
export * from './register';

