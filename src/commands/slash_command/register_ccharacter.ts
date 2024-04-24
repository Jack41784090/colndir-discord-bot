import { Character } from '@ctypes';
import characterExampleJSON from '@data/characters.json';
import { SaveData } from '@functions';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export class RegisterCCharCommand extends Command {
    cc_keys: Array<Exclude<keyof Character, 'authorised'>>;
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            requiredUserPermissions: [PermissionFlagsBits.Administrator]
        });
        this.cc_keys = Object.keys(characterExampleJSON.Azaera).filter(k => k !== 'authorised') as Array<Exclude<keyof Character, 'authorised'>>;
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) => {
            const s_builder = builder
                .setName("register-combat-character")
                .setDescription("Register a combat character");
            for (const s of this.cc_keys) {
                if (typeof characterExampleJSON.Azaera[s] === 'string') {
                    s_builder.addStringOption(option => option
                        .setName(s.toLowerCase())
                        .setDescription(`The ${s} of the character`)
                        .setRequired(true));
                }
                else if (typeof characterExampleJSON.Azaera[s] === 'number') {
                    s_builder.addIntegerOption(option => option
                        .setName(s.toLowerCase())
                        .setDescription(`The ${s} of the character`)
                        .setRequired(true));
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

        const charMap = new Map<string, string | number | string[]>();
        const user = interaction.options.getUser('user');
        for (const c of this.cc_keys) {
            charMap.set(c, interaction.options.get(c.toLowerCase())?.value as string | number | string[]);
        }
        charMap.set('authorised', user?.id ? [ user.id ] : [ "all" ]);
        await SaveData('Combat Character', charMap.get('name') as string, Object.fromEntries(charMap.entries()));
        return interaction.followUp({ embeds: [new EmbedBuilder().setTitle(`character created `)] });
    }
}