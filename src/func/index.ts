import bot from "@bot";
import { ProfileInteractionType, ProfileManager } from "@classes/InteractionHandler";
import { COLNDIR_SERVERID, NORM_CHAR_LIMIT } from "@constants";
import { AnyThreadChannel, BaseGuildTextChannel, BaseMessageOptions, CategoryChannel, Channel, ChannelType, Colors, EmbedBuilder, EmbedData, ForumChannel, Guild, GuildForumTag, Message, MessageCreateOptions, NonThreadGuildBasedChannel, TextBasedChannel, TextChannel, ThreadChannel, VoiceBasedChannel } from "discord.js";
import ytdl from "ytdl-core";

export function capitalize(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
export function formalise(string: string): string {
    return string.split(/[\s_-]+/).map(s => capitalize(s.toLowerCase())).join(" ");
}

export function NewObject<T extends object, T2 extends object>(origin: T, _mod?: T2): T & T2 {
    const mod = (_mod || {}) as T2;
    return Object.assign({ ...origin }, mod);
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
            text: message ?? "Error encountered."
        },
        color: Colors.Red
    };
    return new EmbedBuilder(Object.assign(b, options))
}
export function getErrorMessage(message: string, options?: Partial<EmbedData>): BaseMessageOptions {
    return {
        embeds: [getErrorEmbed(message, options)]
    }
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
export async function getAllArchivedThreads(channel: Exclude<NonThreadGuildBasedChannel, CategoryChannel | VoiceBasedChannel>): Promise<AnyThreadChannel[]> {
    let lastThreadId: string | undefined = undefined;
    const posts: AnyThreadChannel[] = [];

    while (true) {
        const fetchedThreads: AnyThreadChannel[] = await channel.threads.fetchArchived({
            before: lastThreadId,
            limit: 100
        }).then(threads => Array.from(threads.threads.values()));

        if (fetchedThreads.length === 0) {
            break;
        }

        posts.push(...fetchedThreads);
        lastThreadId = fetchedThreads[fetchedThreads.length - 1].id; // Update the last thread ID for pagination

        if (fetchedThreads.length < 100) {
            break; // If fewer than 100 threads are returned, it means we've fetched the last page
        }
    }

    // Ensure posts are sorted by creation timestamp
    posts.sort((a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0));
    return posts;
}
export async function getAllChannelThreads(channel: Exclude<NonThreadGuildBasedChannel, CategoryChannel | VoiceBasedChannel>) {
    const fetchedActives = await channel.threads.fetchActive();
    const fetchedArchivesPublic = await getAllArchivedThreads(channel as ForumChannel)
    const total = [...Array.from(fetchedActives.threads.values()), ...Array.from(fetchedArchivesPublic.values()),]
    console.log(`Fetched ${total.length} threads`)
    return total;
}
export async function getAllThreads(guild: Guild) {
    const threads: AnyThreadChannel[] = [];
    const allChannels = await guild.channels.fetch();
    for (const [id, c] of allChannels) {
        if (!c?.isTextBased() || !(c instanceof BaseGuildTextChannel)) continue;
        const channel = c;
        const fetched = await getAllChannelThreads(channel);
        threads.push(...fetched);
    }
    return threads;
}

export function getPromiseStatus(p: Promise<unknown>): Promise<'pending' | 'fulfilled' | 'rejected'> {
    const t = {};
    return Promise.race([p, t])
        .then(v =>
            (v === t) ?
                "pending" :
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

    return parametersIntegers && !decimize ?
        Math.floor(result) :
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

export function textToVector(text: string): Map<string, number> {
    const wordFrequency = new Map<string, number>();
    text.split(/\s+/).forEach((word) => {
        wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
    return wordFrequency;
}

export function cosineSimilarity(vec1: Map<string, number>, vec2: Map<string, number>): number {
    const intersection = new Set([...vec1.keys()].filter(x => vec2.has(x)));
    let dotProduct = 0;
    intersection.forEach(word => {
        dotProduct += (vec1.get(word) || 0) * (vec2.get(word) || 0);
    });

    let magnitude1 = 0;
    vec1.forEach(value => magnitude1 += value * value);
    magnitude1 = Math.sqrt(magnitude1);

    let magnitude2 = 0;
    vec2.forEach(value => magnitude2 += value * value);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 && magnitude2)
        return dotProduct / (magnitude1 * magnitude2);
    else
        return 0;
}

export function levenshteinDistance(s1: string, s2: string): number {
    // console.log(s1)
    // console.log(s2)
    const arr = Array.from({ length: s2.length + 1 }, (_, i) => i);

    for (let i = 1; i <= s1.length; i++) {
        let prev = i;
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            const temp = arr[j];
            arr[j] = Math.min(arr[j] + 1, arr[j - 1] + 1, prev + cost);
            prev = temp;
        }
    }

    return arr[s2.length];
}

export function extractDiscordLinks(text: string): string[] {
    const regex = /https:\/\/discord\.com\/channels\/\d+\/\d+(\/\d+)?/g;
    return [...text.matchAll(regex)].map(match => match[0]);
}

export async function getPostMessage(post: ThreadChannel): Promise<Message | null>{
    const messages = Array.from((await post.messages.fetch()).values()).reverse();
    return messages.length > 0 ? messages[0] : null;
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
    catch (e) {
        return e as Error;
    }
}

async function move(oldForum: ForumChannel, newForum: ForumChannel) {
    // const posts = await oldForum.threads.fetch();
    // const archived = await getAllForumArchivedPosts(oldForum);
    // const newForumPosts = (await newForum.threads.fetch()).threads.concat((await newForum.threads.fetchArchived()).threads);

    // // console.log(`Old Major: ${posts.threads.map(p => p.name).join(", ")}`)
    // // console.log(`Old Minor: ${archived.map(p => p.name).join(", ")}`)

    // const minorLoreTag = newForum.availableTags.find(t => t.name.toLowerCase().includes('minor lore'))!;
    // const majorLoreTag = newForum.availableTags.find(t => t.name.toLowerCase().includes('major lore'))!;

    // if (!minorLoreTag || !majorLoreTag) {
    //     console.error(`forum ${newForum.name} has no ${minorLoreTag ? 'major' : 'minor'} lore tag`);
    //     return;
    // }
    
    // const major = posts.threads
    //     .filter(p => p.appliedTags.length > 0&&
    //         !newForumPosts.some(p2 => p2.name === p.name))
    // const minor = archived
    //     .filter(p => p.appliedTags.length > 0 &&
    //         !newForumPosts.some(p2 => p2.name === p.name)
    //     )

    // console.log(`Major: ${major.map(p => p.name).join(", ")}`)
    // console.log(`Minor: ${minor.map(p => p.name).join(", ")}`)

    // const all: Promise<unknown>[] = [];
    // major.forEach(p => {
    //     all.push(post(p, newForum, majorLoreTag, false));
    // })
    // minor.forEach(p => {
    //     all.push(post(p, newForum, minorLoreTag, true));
    // })

    // return Promise.all(all);
}
async function post(post: ThreadChannel, newForum: ForumChannel, tag: GuildForumTag, archive: boolean) {
    const messages = Array.from((await post.messages.fetch()).values()).reverse();
    const firstMessage = messages.shift()!;

    return new Promise(resolve => {
        newForum.threads.create({
            name: post.name,
            message: {
                content: firstMessage.content,
                embeds: firstMessage.embeds,
                files: firstMessage.attachments.map(a => a.url),
            },
        }).then(async t => {
            t.setAppliedTags([tag.id]);
            await t.setLocked(true);
            for (const m of messages) {
                await t.send({
                    content: m.content,
                    embeds: m.embeds,
                    files: m.attachments.map(a => a.url),
                });
            }
            if (archive) {
                await t.setArchived(true);
            }
            resolve(void 0);
        })
    })
}

export async function getRandomTextChannel(): Promise<TextBasedChannel | null> {
    const allGuildIDs = Array.from((await bot.guilds.fetch()).values()).map(oag => oag.id);
    const randomChannel = await (await bot.guilds.fetch(allGuildIDs[Math.floor(Math.random() * allGuildIDs.length)])).channels
        .fetch().then(c => c.filter(c => c?.isTextBased()).random() as TextBasedChannel);
    console.log(ChannelType[randomChannel?.type])
    return randomChannel ?? null;
}

export function isSubset<T>(_superset: Set<T>, _subset: Set<T>): boolean;
export function isSubset<T>(_superset: T[], _subset: T[]): boolean
export function isSubset<T>(_superset: T[] | Set<T>, _subset: T[] | Set<T>): boolean {
    const subset = Array.isArray(_subset) ? _subset : Array.from(_subset);
    const superset = Array.isArray(_superset) ? _superset : Array.from(_superset);
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

export function getConditionalTexts(text: string, condition: boolean): string {
    return condition ?
        text:
        '';
}

export function getWithSign(number: number) {
    return getConditionalTexts("+", number > 0) + getConditionalTexts("-", number < 0) + `${Math.abs(number)}`;
}

export function properPrint(thing: any) {
    const typeofThing = typeof thing;
    if (typeofThing === 'string') return `"${thing}"`;
    if (typeofThing === 'object') return JSON.stringify(thing, null, 2);
    return thing?.toString() ?? thing;
}

export function splitContentToMaxChar(content: string): string[] {
    const splittedContent = content.split('\n').filter(s => s.length > 0);
    if (splittedContent.length === 0) return [];
    let firstMessage: string = '';
    while (splittedContent.length > 0 && firstMessage.length + splittedContent[0].length < NORM_CHAR_LIMIT) {
        firstMessage += splittedContent.shift() + '\n';
    }
    return [firstMessage, ...splitContentToMaxChar(splittedContent.join('\n'))];
}

export async function createLorePost(content: string, title: string, forum: ForumChannel, opt?: Partial<MessageCreateOptions>) {
    const splittedContent = splitContentToMaxChar(content);
    const startingMessage = splittedContent.shift();
    if (!startingMessage) {
        console.error('No content found');
        return;
    }
    const post = await forum.threads.create({
        name: title,
        message: Object.assign({
            content: startingMessage,
        }, opt),
    });

    for (const m of splittedContent) {
        await post.send(m);
    }
}

export async function fetchContent(url: string): Promise<Message | Channel | null> {
    const regex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/?(\d+)?/;
    const match = url.match(regex);

    if (!match) {
        console.error('Invalid URL');
        return null;
    }

    const [, guildId, channelId, messageId] = match;

    try {
        const guild = await bot.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId);

        if (messageId && channel?.isTextBased()) {
            const messageChannel = channel as TextChannel;
            const message = await messageChannel.messages.fetch(messageId);
            return message;
        } else {
            return channel;
        }
    } catch (error) {
        if (error instanceof Error) console.error('Error fetching content:', error.message);
        return null;
    }
}
export async function TestFunction() {
    const event = await ProfileManager.Register(COLNDIR_SERVERID, ProfileInteractionType.DefaultGuild);
    console.log(event);
    // const estiaForum = await bot.channels.fetch(NEWESTIA_NEWFORUMID);
    // const allposts = await getAllChannelThreads(estiaForum as ForumChannel);
    // console.log(allposts.map(p => p.name).join(", "));

    // const ike = await bot.users.fetch(IKE_USERID);
    // const merc = await bot.users.fetch(MERC_USERID)
    // const b = await Battle.Create({
    //     channel: await bot.channels.fetch('1232126725039587389') as TextBasedChannel,
    //     users: [merc, ike],
    //     teamMapping: {
    //         [merc.id]: "Merc",
    //         [ike.id]: "Ike",
    //     },
    // })

    // b.spawnUsers();
    
    // const a1 = new Ability({
    //     associatedBattle: b,
    //     name: AbilityName.Stab,
    //     attacker: b.playerEntitiesList.find(e => e.base.id === MERC_USERID)!,
    //     target: b.playerEntitiesList.find(e => e.base.id ===  IKE_USERID)!,
    //     begin: 0,
    // });
    // const a2 = new Ability({
    //     associatedBattle: b,
    //     name: AbilityName.Slash,
    //     attacker: b.playerEntitiesList.find(e => e.base.id === IKE_USERID)!,
    //     target: b.playerEntitiesList.find(e => e.base.id === MERC_USERID),
    //     begin: 0,
    // });

    // const p1 = b.playerEntitiesList.find(e => e.base.id === MERC_USERID)!;
    // const p2 = b.playerEntitiesList.find(e => e.base.id === IKE_USERID)!;
    // p1.queueAction(a1); p2.queueAction(a2);

    // b.begin();
    
    // const oldEstia = await bot.channels.fetch('1203824119490289705') as ForumChannel;
    // const newSigurd = await bot.channels.fetch('1238766847558549634') as ForumChannel;
    // const existingNewPosts = await getAllChannelThreads(newSigurd);

    // const allPosts = await getAllChannelThreads(oldEstia);
    // const noTagsPosts = allPosts.filter(p => p.appliedTags.length === 0); // posts made by Noah
    // for (const p of noTagsPosts) {
    //     if (existingNewPosts.find(xp => xp.name === p.name)) {
    //         continue;
    //     }
    //     const allMessages = await getAllMessages(p as PublicThreadChannel)
    //     const likelyLoreMessages = allMessages.filter(m =>
    //         m.author.id === NOAH_USERID
    //         &&m.mentions.users.size === 0
    //         &&(m.content.length > 250
    //             ||(m.attachments.size > 0 && m.content.length > 50)
    //             ||m.content.startsWith("**")
    //             ||m.content.startsWith("`")
    //         )
    //     );
    //     console.log(`Post ${p.name} likely lore messages: ${likelyLoreMessages.length}`)
    //     for (const m of likelyLoreMessages) {
    //         const splittedContent = m.content.split('\n');
    //         let proposedTitle: string | undefined;
    //         while ((proposedTitle = splittedContent.shift()) !== undefined) {
    //             const nonLetterMatches = proposedTitle.replace(/[`#*\[\]{}'"<>\/?\\|@#$%^&()_+=-]/g, '').split(' ').filter(s => s.length > 0);
    //             // console.log(nonLetterMatches, nonLetterMatches.length)
    //             if (nonLetterMatches && nonLetterMatches.length > 0) {
    //                 proposedTitle = nonLetterMatches.join(' ');
    //                 break;
    //             }
    //         }

    //         console.log(`Message ${m.id} - ${m.content.substring(0, 25).replace(/\n/g, ' ')}...`)
    //         if (proposedTitle === undefined) {
    //             console.error(`No title found`)
    //             continue;
    //         }
    //         console.log(`Proposed title: ${proposedTitle}`)

    //         await createLorePost(splittedContent.join('\n'), proposedTitle.substring(0,100), newSigurd, {
    //             embeds: m.embeds,
    //             files: m.attachments.map(a => a.url),
    //         });
    //     }
    // }
}

export * from './add-to-team';
export * from './battle-func';
export * from './googledocs';
export * from './openai';
export * from './register';

