import ytdl from '@distube/ytdl-core';
import { ChatInputCommand, Command } from '@sapphire/framework';
import { buffer } from 'stream/consumers';

export class FetchVideoCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {...options});
    }

    public override async registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('fetch-youtube-video')
                .setDescription('Fetch a YouTube video by ID')
                .addStringOption((option) =>
                    option
                        .setName('id')
                        .setDescription('The ID of the YouTube video')
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('name')
                        .setDescription('The name of the file')
                        .setRequired(false)
                )
                .addStringOption((option) =>
                    option
                        .setName('format')
                        .setDescription('The format of the file')
                        .setRequired(false)
                        .addChoices({
                            name: 'mp3', value: '.mp3'
                        }, {
                            name: 'mp4', value: '.mp4'
                        })));
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply(); 

        const videoId = ytdl.getVideoID(interaction.options.getString('id')!);
        const videoName = interaction.options.getString('name') || 'Music';
        const videoFormat = interaction.options.getString('format') || '.mp3';
        const videoInfo = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            filter: videoFormat === '.mp3' ? 'audioonly' : 'audioandvideo',
            quality: 'highest',
        })

        if (videoInfo === null || videoInfo instanceof Error) {
            if (videoInfo) console.error(videoInfo);
            return interaction.editReply('Failed to fetch video\n' + videoInfo?.message);
        }
        else {
            return await interaction.channel?.send({
                files: [ { attachment: await buffer(videoInfo), name: videoName + videoFormat } ],
            })
                .then(() => interaction.deleteReply())
                .catch(e => {
                    console.error(e);
                    interaction.editReply('Failed to send video\n' + e.message);
                })
        }
    }
}