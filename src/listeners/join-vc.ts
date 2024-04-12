import { Events, Listener } from '@sapphire/framework';
import { ChannelType, Colors, EmbedBuilder, GuildChannel, TextChannel, type VoiceState } from 'discord.js';

export class JoinVCListener extends Listener<typeof Events.VoiceStateUpdate> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
          once: false,
          event: Events.VoiceStateUpdate
        });
    }

    public async run(oldState: VoiceState, newState: VoiceState) {
        const guild = oldState.guild;
        const voiceCategory = guild.channels.cache.find(channel => channel.type === ChannelType.GuildCategory && channel.name.toLocaleLowerCase() === 'voice channels') as GuildChannel ||
            await oldState.guild.channels.create({
                type: ChannelType.GuildCategory,
                name: 'Voice Channels',
            });
        const vclogChannels =
            guild.channels.cache.find(channel => channel.type === ChannelType.GuildText && channel.name === 'vc-logs') as TextChannel ||
            await oldState.guild.channels.create({
                type: ChannelType.GuildText,
                name: 'vc-logs',
            });
        
        if (vclogChannels.parentId !== voiceCategory.id) {
            vclogChannels.setParent(voiceCategory.id);
        }

        // user left the vc
        if (newState.channelId === null) {
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: oldState.member?.displayName || 'Unknown User',
                    iconURL: oldState.member?.user.displayAvatarURL()
                })
                .setColor(Colors.Red)
                .setTitle(`left the voice channel.`);
            vclogChannels.send({
                embeds: [embed]
            });
        }
        // user joined the vc
        else if (oldState.channelId === null) {
            const channelLink = `https://discord.com/channels/${guild.id}/${newState.channelId}`
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: newState.member?.displayName || 'Unknown User',
                    iconURL: newState.member?.user.displayAvatarURL()
                })
                .setColor(Colors.Green)
                .setTitle(`joined ${channelLink}`);
            vclogChannels.send({
                embeds: [embed]
            });
        }
        // user moved to another vc
        else if (oldState.channelId !== newState.channelId) {
            const old = `https://discord.com/channels/${guild.id}/${oldState.channelId}`
            const newChannel = `https://discord.com/channels/${guild.id}/${newState.channelId}`
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: newState.member?.displayName || 'Unknown User',
                    iconURL: newState.member?.user.displayAvatarURL()
                })
                .setColor(Colors.Blue)
                .setTitle(`moved from ${old} to ${newChannel}`);
            vclogChannels.send({
                embeds: [embed]
            });
        }
        // user is streaming
        else if (oldState.streaming !== newState.streaming) {
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: newState.member?.displayName || 'Unknown User',
                    iconURL: newState.member?.user.displayAvatarURL()
                })
                .setColor(Colors.Yellow)
                .setTitle(`${newState.streaming ? 'streaming' : 'not streaming'}`);
            vclogChannels.send({
                embeds: [embed]
            });
        }
    }
}