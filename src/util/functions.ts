import { ChannelType, Colors, EmbedBuilder, EmbedData, ForumChannel } from "discord.js";
import bot from "../bot";

export function capitalize(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
export function formalise(string: string): string {
    return string.split(/[\s_-]+/).map(s => capitalize(s.toLowerCase())).join(" ");
}

export function empty_ud(): Record<string, any> {
    return {
        characters: [],
    };
}

export function NewObject<T extends object, T2 extends object>
    (origin: T, _mod?: T2): T & T2
{
    const mod = (_mod || {}) as T2;
    return Object.assign({...origin}, mod);
}

export function character(length: number): string {
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

export async function loreChannelsUpdate() {
    console.log("Updating Lore Channels...")
    const lore_forums = await bot.guilds.fetch()
        .then(async s => {
            const loreChannels = [];
            for (const [_, g] of s) {
                const guild = await g.fetch()
                const channels_collection = await guild.channels.fetch().catch(_ => null);
                if (!channels_collection) continue;
                const lores = Array
                    .from(channels_collection.values())
                    .filter(c => c && c.type === ChannelType.GuildForum && c.name.toLowerCase() === 'lore') as ForumChannel[];
                loreChannels.push(...lores)
            }
            return loreChannels;
        })
        .catch(e => {
            console.error(e);
            return null;
        });
    
    if (lore_forums) {
        for (let i = 0; i < lore_forums.length; i++) {
            const forum = lore_forums[i];
            console.log(`|=> Updating for [${forum.guild.name}] (${forum.parent?.name || ''} ${forum.name})`)
            const tags = forum.availableTags;
            const major_tag = tags.find(tag => tag.name.toLowerCase().includes('major'))
            const minor_tag = tags.find(tag => tag.name.toLowerCase().includes('minor'))
            if (!major_tag || !minor_tag) {
                console.error(`forum ${forum.name} has no major / minor tag`);
                continue;
            }
            else {
                console.log(`||=> found major / minor lore`)
            }

            const posts = Array.from((await forum.threads.fetchArchived()).threads.values());
            const new_posts = Array.from((await forum.threads.fetch()).threads.values())
            posts.unshift(... new_posts);
            posts.forEach(p => {
                if (!p.locked && !p.archived) {
                    p.setLocked(true).catch(e => console.error(e));
                    console.log(`|||=> locked "${p.name}"`)
                }
                if (p.appliedTags.includes(major_tag.id)) {
                    p.setArchived(false).catch(e => console.error(e))
                    console.log(`|||=> de-archived "${p.name}"`)
                }
                else if (p.appliedTags.includes(minor_tag.id)) {
                    if (!p.archived) p.setArchived(true).catch(e => console.error(e))
                    console.log(`|||=> archived "${p.name}"`)

                }
            })
        }

        console.log("| Done")
    }
    else {
        console.log("| No lore forums")
    }
    
}
