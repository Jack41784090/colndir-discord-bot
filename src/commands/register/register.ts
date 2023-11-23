import { ChatInputCommand, Command } from '@sapphire/framework';
import { CategoryChannel, ChannelType, EmbedBuilder, ForumChannel, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';
import json from '../../data/register.json';
import { GetData, SaveData } from '../../database';
import { capitalize, empty_ud, formalise } from '../../util/functions';
dotenv.config();

// PING: Sends a "followUp" to the server and returning, calculating the difference in timestamp to get an estimate on ping.
export class RegisterCommand extends Command {
    static DESCRIPTION_LIMIT = 4096;
    static FIELD_NAME_LIMIT = 256;
    static FIELD_VALUE_LIMIT = 1024;
    static NORM_CHAR_LIMIT = 2000;

    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) => {
            const s_builder = builder
                .setName(json.command)
                .setDescription(json.description);
            const options = json.options.sort((a, b) => a.required === b.required ? 0 : a.required ? -1 : 1 );
            for (const j_option of options) {
                if (j_option.choices) {
                    s_builder.addStringOption(option => option
                        .setName(`${j_option.name}`.toLowerCase())
                        .setDescription(j_option.description)
                        .setRequired(j_option.required)
                        .setChoices(...(j_option.choices as { name: string, value: string }[])));
                }
                else {
                    s_builder.addStringOption(option => option
                        .setName(j_option.name)
                        .setDescription(j_option.description)
                        .setRequired(j_option.required))
                }
            }
            s_builder.addUserOption(option => option
                .setName('user')
                .setDescription('The user to register')
                .setRequired(false));

            return s_builder;
        });
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();

        // get/create forum
        console.log('Getting/creating forum');
        const channels = await interaction.guild?.channels.fetch();
        if (channels === undefined) return interaction.followUp({ content: 'Error: Could not fetch channels.' });
        const category = channels.find(c => c?.type === ChannelType.GuildCategory && c.name === 'Character RP Category') as CategoryChannel;
        if (category === undefined) return interaction.followUp({ content: 'Error: Could not find "Character RP Category" category.' });
        const forum = channels.find(c => c?.type === ChannelType.GuildForum && c.name === 'character-list') as ForumChannel || await interaction.guild?.channels.create({
            parent: category,
            type: ChannelType.GuildForum,
            name: 'character-list'
        }) as ForumChannel;
        if (forum == undefined) {
            return interaction.followUp({ content: 'Error: Could not find or create "character-list" forum.' });            
        }

        // // members
        // console.log('Fetching members');
        // const members_collection = await interaction.guild?.members.fetch();
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
        const concerning_user = interaction.options.getUser('user') || interaction.user;
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

        // remove old tags

        // create embed
        console.log('Creating embed');
        const separated_embeds: EmbedBuilder[] = [];
        const character: Record<string,string> = {};
        const embed = new EmbedBuilder();
        for (const o of json.options) {
            character[o.name] = interaction.options.getString(o.name) || '';
            const value = interaction.options.getString(o.name);
            if (value && value.length <= RegisterCommand.FIELD_VALUE_LIMIT) {
                switch (o.name) {
                    case 'fullname': {
                        embed.setTitle(value);
                        break;
                    }
                    default:
                        embed.addFields({
                            name: formalise(o.name),
                            value: capitalize(value)
                        });
                        break;
                }
            }
            else if (value) {
                const newEmbed = new EmbedBuilder();
                newEmbed.setTitle(formalise(o.name));
                if (value.length <= RegisterCommand.DESCRIPTION_LIMIT) {
                    newEmbed.setDescription(`${capitalize(value)}\n`);
                    separated_embeds.push(newEmbed);
                }
                else {
                    const split = value.match(new RegExp(`.{1,${RegisterCommand.FIELD_VALUE_LIMIT}}`, 'g'));
                    if (split === null) continue;
                    for (const s of split) {
                        newEmbed.setDescription(`${capitalize(s)}\n`);
                    }
                    separated_embeds.push(newEmbed);
                }
            }
        }

        // create thread
        console.log('Creating thread');
        const thread = await forum.threads.create({
            name: interaction.options.getString('fullname') || 'character',
            autoArchiveDuration: 1440,
            message: {
                content: `${concerning_user}`,
                embeds: [embed]
            },
            appliedTags: [tag.id]
        });
        character['thread'] = `https://discord.com/channels/${interaction.guildId}/${thread.id}`;
        separated_embeds.forEach(e => thread.send({ embeds: [e] }));

        // database
        console.log('Updating database');
        const uinfo = await GetData("User", concerning_user.id) || empty_ud();
        uinfo.characters.push(character);
        await SaveData("User", concerning_user.id, uinfo);

        return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`character created @ ${thread}`)] });
    }
}