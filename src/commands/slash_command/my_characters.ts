import { ProfileManager } from '@classes/InteractionHandler';
import { GuildData, ProfileInteractionType, ProfileType, UserData } from '@ctypes';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder } from 'discord.js';

export class MyCharactersCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('mycharacter')
                .setDescription('List my characters.')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply(); // async command. Requires a defer in reply in case async takes too long.

        const guildDataAccessEvent = await ProfileManager.Register(ProfileType.Guild, interaction.guildId!, ProfileInteractionType.Default);
        const userDataAccessEvent = await ProfileManager.Register(ProfileType.User, interaction.user.id, ProfileInteractionType.Default);
        if (userDataAccessEvent instanceof Error || guildDataAccessEvent instanceof Error) {
            const gdError = guildDataAccessEvent instanceof Error ? guildDataAccessEvent.message : undefined;
            const udError = userDataAccessEvent instanceof Error ? userDataAccessEvent.message : undefined;
            return interaction.followUp({ content: `Error: ${gdError} ${udError}` });
        }

        const gd = guildDataAccessEvent.profile.data as GuildData;
        const ud = userDataAccessEvent.profile.data as UserData;
        const guildCharacters = gd.registeredCharacters;
        const userInGuildCharacters = guildCharacters.filter(c => ud.characters.includes(c.NAME));
        const embed = new EmbedBuilder({
            author: {
                name: interaction.user.username,
                icon_url: interaction.user.avatarURL() || undefined
            },
            title: interaction.user.username + ' Characters',
            description: `${userInGuildCharacters.map((c, i) => `${i + 1}. [${c.NAME}](${c.thread})`).join('\n')}`
        });

        return interaction.editReply({ embeds: [embed] });
    }
}