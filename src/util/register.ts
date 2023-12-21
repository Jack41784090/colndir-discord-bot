import { CategoryChannel, ChannelType, EmbedBuilder, ForumChannel, Guild, Message, User } from 'discord.js';
import { RegisterCommand } from '../commands/register';
import { GetData, SaveData } from './database';
import { capitalize, empty_ud, formalise } from './functions';
import { Character } from './typedef';

export async function register(guild: Guild, concerning_user: User, character: Character, original_message?: Message) {
    const uinfo = await GetData("User", concerning_user.id) || empty_ud();
    const chars: Character[] = uinfo['characters'];
    let c: Character | undefined;
    if (chars && (c = chars.find(c => c.NAME === character.NAME))) {
        return 'Error: Character is already registered under: ' + c['thread'];
    }

    // get/create forum
    console.log('Getting/creating forum');
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

    // // members
    // console.log('Fetching members');
    // const members_collection = await guild.members.fetch();
    // if (members_collection === undefined) return interaction.followUp({ content: 'Error: Could not fetch members.' });
    // const members = Array.from(members_collection.values()).filter(m => !m.user.bot);

    // // cannot use other servers' emojis
    // // emoji for tag
    // console.log('Fetching emojis');
    // const emoji_server = await bot.guilds.fetch(process.env.EMOJI_SERVER_ID!);
    // // const emoji_server = interaction.guild!;
    // const emojis = await emoji_server.emojis.fetch();
    // if (emojis === undefined) return interaction.followUp({ content: 'Error: Could not fetch emojis.' });
    // const emoji_map = new Map<string, GuildEmoji>();
    // for (const m of members) {
    //     const link = `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`;
    //     const emoji = emojis.find(e => e.name === m.user.id) ||
    //         await emoji_server.emojis.create({
    //             attachment: link,
    //             name: m.user.id
    //         });
    //     emoji_map.set(m.user.id, emoji);
    // }
        
    // tagging
    console.log('Tagging');
    let tag = forum.availableTags.find(t => t.name === concerning_user.username);
    if (tag === undefined) {
        await forum.setAvailableTags([...forum.availableTags.concat([{
            name: concerning_user.username,
            id: concerning_user.id,
            emoji: null,
            moderated: false
        }])])
        tag = forum.availableTags[forum.availableTags.length - 1];
    }

    // // retagging old posts
    // console.log('Retagging old posts');
    // const fetched = await forum.threads.fetch();
    // for (const t of Array.from(fetched.threads.values())) {
    //     const message = await t.messages.fetch();
    //     if (message === undefined) continue;
    //     const tagged_user = message.last()?.mentions.users.first();
    //     if (tagged_user === undefined) continue;
    //     const tag = forum.availableTags.find(t => t.name === tagged_user.username);
    //     if (tag === undefined) continue;
    //     await t.setAppliedTags([tag.id]);
    // }

    // create embed
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

    // create thread
    console.log('Creating thread');
    const thread = await forum.threads.create({
        name: character['NAME'] || 'character',
        autoArchiveDuration: 1440,
        message: {
            content: `${concerning_user}`,
            embeds: [embed]
        },
        appliedTags: [tag.id]
    });
    character['thread'] = thread.url;
    separated_embeds.forEach(e => thread.send({ embeds: [e] }));
    if (original_message) {
        // original_message.sort((a,b) => a.createdTimestamp - b.createdTimestamp);
        thread.send({
            embeds: [
                new EmbedBuilder({
                    title: `original message: ${original_message.url}`,
                    timestamp: original_message.createdTimestamp
                })
            ]
        })
    }

    // database
    console.log('Updating database');
    uinfo.characters.push(character);
    await SaveData("User", concerning_user.id, uinfo);

    return thread;
}