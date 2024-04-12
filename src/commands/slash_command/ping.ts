import { ChatInputCommand, Command } from '@sapphire/framework';
import { EmbedBuilder, Message } from 'discord.js';

// PING: Sends a "followUp" to the server and returning, calculating the difference in timestamp to get an estimate on ping.
export class PingCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('ping')
                .setDescription('Ping bot to see if it is alive')
        );
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply(); // async command. Requires a defer in reply in case async takes too long.

        const embed = new EmbedBuilder({
            author: Object.assign(interaction.user, { name: interaction.user.username, icon_url: interaction.user.avatarURL() || undefined }),
            footer: { text: "Sending ping..." }
        })
        const msg = await interaction.followUp({ embeds: [embed] });

        const ping = Math.round(this.container.client.ws.ping);
        const diff = msg instanceof Message ?
            `Round trip took: ${msg.createdTimestamp - interaction.createdTimestamp}ms. Heartbeat: ${ping}ms.` :
            "I can't you how long it took because Discord gave me something else other than Message...? This error message probably doesn't mean anything to you but whatever.";

        embed.setFooter({ text: `Pong 🏓! (${diff})` });
        return interaction.editReply({ embeds: [embed] });
    }
}