import { ChatInputCommand, Command } from '@sapphire/framework';
import { CategoryChannel, ChannelType, EmbedBuilder, ForumChannel } from 'discord.js';
import json from '../data/register.json';
import { capitalize, formalise } from '../util/functions';

// PING: Sends a "followUp" to the server and returning, calculating the difference in timestamp to get an estimate on ping.
export class RegisterCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
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

        // tagging
        console.log('Tagging');
        const members = await interaction.guild?.members.cache;
        if (members === undefined) return interaction.followUp({ content: 'Error: Could not fetch members.' });
        await forum.setAvailableTags(Array.from(members.values()).map(m => ({ name: m.user.username })));
        const tag = forum.availableTags.find(t => t.name === interaction.user.username);
        if (tag === undefined) return interaction.followUp({ content: 'Error: Could not find tag.' });

        // create embed
        console.log('Creating embed');
        const embed = new EmbedBuilder();
        for (const o of json.options) {
            console.log(o.name);
            const value = interaction.options.getString(o.name);
            if (value) {
                console.log(`||=> ${value}`);
                switch (o.name) {
                    case 'fullname': {
                        embed.setTitle(value);
                        break;
                    }
                    default:
                        embed.setDescription((embed.data.description || '') + `\`${formalise(o.name)}\`: ${capitalize(value)}\n`);
                        break;
                }
            }
        }

        // create thread
        console.log('Creating thread');
        const thread = await forum.threads.create({
            name: embed.data.title || 'Character',
            autoArchiveDuration: 1440,
            message: {
                embeds: [embed]
            },
            appliedTags: [tag.id]
        });

        return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`character created @ ${thread}`)] });
    }
}