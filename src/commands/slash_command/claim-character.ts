import { Character } from "@ctypes";
import { GetData, GetUserData, SaveUserData, getErrorEmbed } from "@functions";
import { ChatInputCommand, Command } from "@sapphire/framework";
import { EmbedBuilder, PermissionFlagsBits } from "discord.js";

export class ClaimCharacterCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) => {
            return builder
                .setName("claim-character")
                .setDescription("Claim a character")
                .addStringOption(option => option
                    .setName('name')
                    .setDescription('The name of the character')
                    .setRequired(true))
        });
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply();

        const name = interaction.options.getString('name')!;
        const user = interaction.user!;
        const data = await GetData('Combat Character', name) as Character;
        if (!data) {
            return interaction.followUp({ embeds: [getErrorEmbed(`Character ${name} not found`)] });
        }
        
        if (data.authorised.includes(user.id) || data.authorised.includes('all')) {
            const ud = await GetUserData(user.id);
            ud.combatCharacters.push(name);
            await SaveUserData(ud)
            return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`Character ${name} claimed by ${user.username}`)] });
        }
    }
}