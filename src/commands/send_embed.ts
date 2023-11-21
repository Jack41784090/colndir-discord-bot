import { ChatInputCommand, Command } from '@sapphire/framework'
import { DiscordAPIError, EmbedBuilder, EmbedData } from 'discord.js'

// PING: Sends a "followUp" to the server and returning, calculating the difference in timestamp to get an estimate on ping.
const exampleEmbed: EmbedData = {
    title: 'Some title',
    description: 'Some description here',
    url: 'https://discord.js.org',
    timestamp: '2021-09-30T18:00:00.000Z',
    color: 0x00ffff,
    footer: {
        text: 'Some footer text here',
        iconURL: 'https://i.imgur.com/wSTFkRM.png',
    },
    image: {
        url: 'https://i.imgur.com/wSTFkRM.png',
    },
    thumbnail: {
        url: 'https://i.imgur.com/wSTFkRM.png',
    },
    provider: {
        name: 'Some provider name',
        url: 'https://discord.js.org',
    },
    author: {
        name: 'Some author name',
        url: 'https://discord.js.org',
        iconURL: 'https://i.imgur.com/wSTFkRM.png',
    },
    fields: [],
}
export class SendEmbedCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options})
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) => {
            const b = builder
                .setName('send-embed')
                .setDescription('Ping bot to see if it is alive')
            for (const propertyName in exampleEmbed) {
                if (exampleEmbed.hasOwnProperty(propertyName)) {
                    if (exampleEmbed[propertyName as keyof EmbedData] instanceof Object) {
                        for (const [key, value] of Object.entries(exampleEmbed[propertyName as keyof EmbedData] as Record<string, string>)) {
                            b.addStringOption(option => option
                                .setName(`${propertyName}-${key}`.toLowerCase())
                                .setDescription(`The ${key} of the ${propertyName} of the embed`).setRequired(false))
                        }
                    }
                    else {
                        if (propertyName === 'color') {
                            b.addIntegerOption(option => option
                                .setName(propertyName)
                                .setDescription(`The ${propertyName} of the embed`).setRequired(false))
                            continue
                        }
                        b.addStringOption(option => option
                            .setName(propertyName)
                            .setDescription(`The ${propertyName} of the embed`).setRequired(false)) 
                    }
                }
            }
            return b
        })
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply()

        const reformed: EmbedData = {};
        for (const propertyName in exampleEmbed) {
            if (Object.prototype.hasOwnProperty.call(exampleEmbed, propertyName)) {
                if (exampleEmbed[propertyName as keyof EmbedData] instanceof Object) {
                    for (const [key, value] of Object.entries(exampleEmbed[propertyName as keyof EmbedData] as Record<string, string>)) {
                        const subProperty = `${propertyName}-${key}`.toLowerCase();
                        const subPropertyValue = interaction.options.getString(subProperty);
                        if (subPropertyValue) {
                            if (!reformed[propertyName as keyof EmbedData]) {
                                reformed[propertyName as keyof EmbedData] = {} as unknown as undefined;
                            }
                            (reformed[propertyName as keyof EmbedData] as Record<string, string>)[key] = subPropertyValue
                        }
                    }
                }
                else {
                    const propertyValue = propertyName === 'color' ? interaction.options.getInteger(propertyName) : interaction.options.getString(propertyName);
                    if (propertyValue) {
                        reformed[propertyName as keyof EmbedData] = propertyValue as unknown as undefined;
                        if (propertyName === 'description') {
                            reformed.description = reformed.description?.replace(/\\n/g, '\n')
                        }
                    }
                }
            }
        }
        
        const embed = new EmbedBuilder(reformed)
        await interaction.deleteReply();
        interaction.channel?.send({ embeds: [embed] })
            .catch((error) => {
                if (error instanceof DiscordAPIError) {
                    return interaction.followUp({ content: `Discord API Error: \`${error.message}\``, ephemeral: true })
                }
                else if (error instanceof Error) {
                    return interaction.followUp({ content: `Error: \`${error.message}\``, ephemeral: true })
                }
                else if (error instanceof Object) {
                    return interaction.followUp({ content: `Object: \`${JSON.stringify(error)}\``, ephemeral: true })
                }
                else {
                    return interaction.followUp({ content: `Unknown Error: \`${error}\``, ephemeral: true })
                }
            })
    }
}