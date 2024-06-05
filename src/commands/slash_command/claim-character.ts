import { ProfileManager } from "@classes/InteractionHandler";
import { CombatCharacter, ProfileInteractionType, ProfileType, UserData } from "@ctypes";
import { GetCombatCharacter, getErrorMessage, getGreenflagEmbed } from "@functions";
import { ChatInputCommand, Command } from "@sapphire/framework";
import { PermissionFlagsBits } from "discord.js";

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
        const data = await GetCombatCharacter(name, { authorise: user }) as CombatCharacter;
        if (!data) {
            return interaction.followUp(getErrorMessage(`Character ${name} not found`));
        }
        
        if (data.authorised.includes(user.id) || data.authorised.includes('all')) {
            const event = await ProfileManager.Register(ProfileType.User, user.id, ProfileInteractionType.Default);
            if (event instanceof Error) {
                return interaction.followUp(getErrorMessage(event.message));
            }

            const ud = event.profile.data as UserData;
            ud.combatCharacters.push(name);
            return interaction.followUp({ embeds: [getGreenflagEmbed(`Character ${name} claimed by ${user.username}`)] });
        }
    }
}