import { CategoryChannel, ChannelType, EmbedBuilder, EmbedData, ForumChannel, Guild, GuildEmoji, GuildForumThreadMessageCreateOptions, Message, TextChannel, ThreadChannel, User } from 'discord.js';
import bot from '../bot';
import { RegisterCommand } from '../commands/slash_command/register';
import { GetData, GetDefaultUserData, SaveData } from './database';
import { capitalize, formalise, getConsecutiveMessages } from './functions';
import { getGoogleDocImage } from './googledocs';
import { Character, DISCORD_CDN_REGEX, DISCORD_MEDIA_REGEX, GOOGLEDOCS_REGEX, HOUR } from './typedef';

async function ensureForum(guild: Guild): Promise<string | ForumChannel> {
    const channels = await guild.channels.fetch();
    if (channels === undefined) return 'Error: Could not fetch channels.';
    const category = channels.find(c => c?.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'character rp category') as CategoryChannel;
    if (category === undefined) return 'Error: Could not find "Character RP Category" category.';
    const forum = channels.find(c => c?.type === ChannelType.GuildForum && c.name === 'character-list') as ForumChannel || await guild.channels.create({
        parent: category,
        type: ChannelType.GuildForum,
        name: 'character-list'
    }) as ForumChannel;
    if (forum == undefined) {
        return 'Error: Could not find or create "character-list" forum.';            
    }
    return forum;
}

async function ensureMemberSpecificEmoji(emoji_server: Guild) {
    console.log('Fetching members');
    const members_collection = await emoji_server.members.fetch();
    if (members_collection === undefined) return 'Error: Could not fetch members.'
    const members = Array.from(members_collection.values()).filter(m => !m.user.bot);

    // NOTE: cannot use other servers' emojis

    // emoji for tag
    console.log('Fetching emojis');
    const emojis = await emoji_server.emojis.fetch();
    if (emojis === undefined) return 'Error: Could not fetch emojis.';
    const emoji_map = new Map<string, GuildEmoji>();
    for (const m of members) {
        const link = `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`;
        const emoji = emojis.find(e => e.name === m.user.id) ||
            await emoji_server.emojis.create({
                attachment: link,
                name: m.user.id
            });
        emoji_map.set(m.user.id, emoji);
    }

    return emoji_map;
}

async function createUserTag(forum: ForumChannel, concerning_user: User, emoji: GuildEmoji | null = null) {
    let tag = forum.availableTags.find(t => t.name === concerning_user.username);
    if (tag === undefined) {
        await forum.setAvailableTags([
                ...forum.availableTags.concat([{
                    name: concerning_user.username,
                    id: concerning_user.id,
                    emoji: emoji,
                    moderated: false
                }])
            ]);
        tag = forum.availableTags[forum.availableTags.length - 1];
    }
    return tag;
}

export async function updateOldTags(forum: ForumChannel) {
    console.log('Retagging old posts');
    const fetched = await forum.threads.fetch();
    for (const t of Array.from(fetched.threads.values())) {
        const message = await t.messages.fetch();
        if (message === undefined) continue;
        const tagged_user = message.last()?.mentions.users.first();
        if (tagged_user === undefined) continue;
        const tag = forum.availableTags.find(t => t.name === tagged_user.username);
        if (tag === undefined) continue;
        await t.setAppliedTags([tag.id]);
    }
}

export async function register(guild: Guild, concerning_user: User, character: Character, original_message?: Message, ping: boolean = true) {
    
    // 1. Check if character is already registered
    const uinfo = await GetData("User", concerning_user.id) || GetDefaultUserData();
    const chars: Character[] = uinfo['characters'];
    let c: Character | undefined;
    if (chars && (c = chars.find(c => c.NAME === character.NAME))) {
        return 'Error: Character is already registered under: ' + c['thread'];
    }

    // 2. Get/create forum
    console.log('Getting/creating forum');
    const forum = await ensureForum(guild);
    if (typeof forum === 'string') return formalise(forum);

    // 3. Emoji
    // const emoji_map = await ensureMemberSpecificEmoji(guild);
        
    // 4. Get Tag
    // const tag = await createUserTag(forum, concerning_user);

    // 5. Update older tags

    // 6. Deal with Embeds
    console.log('Creating embed');
    const separated_embeds: EmbedBuilder[] = [];
    const embed = new EmbedBuilder();
    for (const k of Object.keys(character)) {
        const key = k as keyof Character;
        const value = character[key];
        if (value && value.length <= RegisterCommand.FIELD_VALUE_LIMIT) {
            switch (key) {
                case 'NAME': {
                    embed.setTitle(value);
                    break;
                }
                case 'ALIGNMENT':
                    embed.addFields({
                        name: formalise(k),
                        value: formalise(value)
                    });
                    break;
                default:
                    embed.addFields({
                        name: formalise(k),
                        value: capitalize(value)
                    });
                    break;
            }
        }
        else if (value) {
            if (value.length <= RegisterCommand.DESCRIPTION_LIMIT) {
                const newEmbed = new EmbedBuilder();
                newEmbed.setTitle(formalise(key));
                newEmbed.setDescription(`${capitalize(value)}\n`);
                separated_embeds.push(newEmbed);
            }
            else {
                const split = value.match(new RegExp(`.{1,${RegisterCommand.DESCRIPTION_LIMIT}}`, 'g'));
                if (split === null) continue;
                split.forEach((s, i) => {
                    const newEmbed = new EmbedBuilder();
                    if (i === 0) {
                        newEmbed.setTitle(formalise(key));
                    }
                    newEmbed.setDescription(`${capitalize(s)}\n`);
                    separated_embeds.push(newEmbed);
                })
            }
        }
    }

    // 7. Create Post
    console.log('Creating thread');
    const m: GuildForumThreadMessageCreateOptions = {
        embeds: [embed]
    };
    if (ping) {
        m['content'] = `<@${concerning_user.id}>`;
    }
    const thread = await forum.threads.create({
        name: character['NAME'] || 'character',
        autoArchiveDuration: 1440,
        message: m
    });
    character['thread'] = thread.url;
    separated_embeds.forEach(e => thread.send({ embeds: [e] }));
    if (original_message) {
        // original_message.sort((a,b) => a.createdTimestamp - b.createdTimestamp);
        await thread.send({
            embeds: [
                new EmbedBuilder({
                    title: `original message: ${original_message.url}`,
                    timestamp: original_message.createdTimestamp
                })
            ]
        })
    }
    const thumbnailSearchResult = await updateCharacterPost(thread);
    if (typeof thumbnailSearchResult === 'string') {
        console.log(thumbnailSearchResult);
    }

    // 8. Save to Database
    console.log('Updating database');
    uinfo.characters.push(character);
    await SaveData("User", concerning_user.id, uinfo);

    return thread;
}

export async function updateCharacterPost(threadChannel: ThreadChannel) {
    console.log(`Updating character post in [${threadChannel.name}]`)
    const messages = await threadChannel.messages.fetch();
    const postMessage = messages.last();
    if (threadChannel.archived) {
        await threadChannel.setArchived(false).catch(e => console.error(e));
    }

    if (!postMessage) {
        return "Post not found."
    }

    if (postMessage?.author.id !== bot.user?.id) {
        return "The latest message is not made by me.";
    }

    const embed = messages.find(msg => msg.embeds[0]?.title?.includes('https://'))?.embeds[0];
    const linkTitle = embed?.title;
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
    const story = await getConsecutiveMessages(linkedMessageId, originMessage, originChannel);
    if (!story) {
        return "Failed to fetch the story.";
    }

    // Update the latest post with the image from the story
    const content = story.join('\n');
    const googleMatch = content.match(GOOGLEDOCS_REGEX);
    const discordCdnMatch = content.match(DISCORD_CDN_REGEX);
    const discordMediaMatch2 = content.match(DISCORD_MEDIA_REGEX);
    const images = story.flatMap(msg => Array.from(msg.attachments.values()));
    if (images.length > 0) { // text submission
        const imageEmbed = new EmbedBuilder(postMessage.embeds[0] as EmbedData).setImage(images[0].url);
        await postMessage.edit({ embeds: [imageEmbed] }).catch(e => console.error(e));
    }
    else if (googleMatch) {
        const m2 = googleMatch[1] || null;
        if (!m2) {
            return "Failed to find a Google Doc link.";
        }
        const image_links = await getGoogleDocImage(m2!);
        if (!image_links) {
            return "Failed to fetch images from the Google Doc.";
        }
        const imageEmbed = new EmbedBuilder(postMessage.embeds[0] as EmbedData).setImage(null);
        await postMessage.edit({ embeds: [imageEmbed], files: image_links.map(l => ({ attachment: l, name: 'image.png' }))}).catch(e => console.error(e));
    }
    else if (discordCdnMatch) {
        const imageEmbed = new EmbedBuilder(postMessage.embeds[0] as EmbedData).setImage(discordCdnMatch[0]);
        await postMessage.edit({ embeds: [imageEmbed] }).catch(e => console.error(e));
    }
    else if (discordMediaMatch2) {
        const imageEmbed = new EmbedBuilder(postMessage.embeds[0] as EmbedData).setImage(discordMediaMatch2[0]);
        await postMessage.edit({ embeds: [imageEmbed] }).catch(e => console.error(e));
    }
    else {
        return "Failed to find an image link.";
    }

    // Close the post if it is too old
    const timestamp = embed?.timestamp;
    const time = timestamp ? new Date(timestamp).getTime() : null;
    if (time) {
        const now = new Date().getTime();
        if (!threadChannel.archived && now - time > 24 * HOUR * 30 * 6) {
            console.log(`Post is ${(now - time) / (24 * HOUR)} days old, archiving...`)
            await threadChannel.setArchived(true);
        }
    }

    return null;
}
