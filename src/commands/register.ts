import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import json from '../data/register.json';
import { register } from '../util/register';
import { Character } from '../util/typedef';

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
                        .setName(`${j_option.name}`.toLowerCase())
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

        const character: Record<string, string> = {};
        for (const o of json.options) {
            const key = o.name.toUpperCase();
            const o_key = key.toLowerCase();
            character[key] = interaction.options.getString(o_key)!;
        }
        
        const concerning_user = interaction.options.getUser('user') || interaction.user;
        const thread = await register(interaction.guild!, concerning_user, character as Character);

        return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`character created @ ${thread}`)] });
    }
}