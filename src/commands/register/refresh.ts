import { ChatInputCommand, Command } from '@sapphire/framework';
import { CategoryChannel, ChannelType, EmbedBuilder, ForumChannel, PermissionFlagsBits } from 'discord.js';
import { GetData, SaveData } from '../../util/database';
import { Character } from '../../util/typedef';

export class RefreshCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) => builder
            .setName('refresh')
            .setDescription('Refreshes the character list'));
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
        if (forum == undefined) return interaction.followUp({ content: 'Error: Could not find or create "character-list" forum.' });   

        // members
        console.log('Fetching members');
        const members_collection = await interaction.guild?.members.fetch();
        if (members_collection === undefined) return interaction.followUp({ content: 'Error: Could not fetch members.' });
        const members = Array.from(members_collection.values()).filter(m => !m.user.bot);
        
        // remove old tags
        console.log('Removing old tags');
        const removed_tags = forum.availableTags.filter(t => !members.some(m => m.user.username === t.name));
        const filtered_tags = forum.availableTags.filter(t => members.some(m => m.user.username === t.name));
        await forum.setAvailableTags(filtered_tags);

        // retagging old posts
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

        // refresh caller's characters
        console.log('Refreshing caller\'s characters');
        const ud = await GetData('User', interaction.user.id);
        if (ud == null) return interaction.followUp({ content: 'You have no characters.' });
        const threads = await forum.threads.fetch();
        const refreshed_characters = ud['characters'].filter((c: Character) => {
            if (c['thread'] == undefined) return false;
            const thread_id = c['thread'].split('/').pop();
            return thread_id && threads.threads.has(thread_id);
        });
        const removed_characters = ud['characters'].filter((c: Character) => !refreshed_characters.includes(c));
        if (removed_characters.length > 0) await SaveData('User', interaction.user.id, { characters: refreshed_characters });

        return interaction.followUp({ embeds: [
            new EmbedBuilder()
                .setTitle('Refreshed character list')
                .setDescription(`Removed ${removed_tags.length} tags (${removed_tags.map(t => t.name).join(', ') || 'none removed'}).\nRemoved ${removed_characters.length} characters (${removed_characters.map((c: Character) => c.NAME).join(', ') || 'none removed'}).`)
        ] });
    }
}