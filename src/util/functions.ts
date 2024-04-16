import { Colors, EmbedBuilder, EmbedData, Message, TextBasedChannel, TextChannel, ThreadChannel } from "discord.js";
import bot from "../bot";
import { getGoogleDocImage } from "./googledocs";

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

export async function congregateStory (afterID: string, origin: Message<boolean>, channel: TextBasedChannel) {
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

export async function findThumbnail(threadChannel: ThreadChannel) {
    const messages = await threadChannel.messages.fetch();
    const postMessage = messages.last();
    if (postMessage?.author.id !== bot.user?.id) {
        return "The latest message is not made by me.";
    }

    const linkTitle = messages.find(msg => msg.embeds[0]?.title?.includes('https://'))?.embeds[0].title;
    const link = linkTitle?.match(/https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+/i)?.[0];
    if (!link) {
        return "No link found in the title.";
    }

    // Extract IDs from the found link
    const [, , , , , linkedChannelId, linkedMessageId] = link.split('/');

    // Fetch the origin message using the extracted IDs
    const originChannel = await bot.channels.fetch(linkedChannelId) as TextChannel;
    const originMessage = originChannel?.isTextBased() ? await originChannel.messages.fetch(linkedMessageId) : null;
    if (!originMessage) {
        return "Failed to fetch the origin message.";
    }

    // Process the story from the origin message
    const story = await congregateStory(linkedMessageId, originMessage, originChannel);
    if (!story) {
        return "Failed to fetch the story.";
    }

    // Update the latest post with the image from the story
    if (postMessage) {
        const images = story.flatMap(msg => Array.from(msg.attachments.values()));
        if (images.length > 0) { // text submission
            const imageEmbed = new EmbedBuilder(postMessage.embeds[0] as EmbedData).setImage(images[0].url);
            await postMessage.edit({ embeds: [imageEmbed] });
        }
        else if (story[0].embeds[0] && story[0].embeds[0].thumbnail) { // likely a Google submission
            const match = story[0].content.match(/^https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)\/edit/i);
            const m2 = match?.[1] || null;
            if (!m2) {
                return "Failed to find a Google Doc link.";
            }
            const image_links = await getGoogleDocImage(m2!);
            if (!image_links) {
                return "Failed to fetch images from the Google Doc.";
            }
            const imageEmbed = new EmbedBuilder(postMessage.embeds[0] as EmbedData).setImage(null);
            await postMessage.edit({ embeds: [imageEmbed], files: image_links.map(l => ({ attachment: l, name: 'image.png' }))});
        }
    }
    else {
        return "Failed to find the latest message.";
    }

    return null;
}

export async function fetchAllMessages(submissionChannel: TextBasedChannel) {
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


