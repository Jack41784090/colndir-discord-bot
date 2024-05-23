import { ProfileManager } from '@classes/InteractionHandler';
import { Listener } from '@sapphire/framework';
import { Events, GuildMember } from 'discord.js';

export class NewLeaveListener extends Listener<typeof Events.GuildMemberAdd> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            once: false,
            event: Events.GuildMemberRemove
        });
    }

    public async run(member: GuildMember) {
        const guildData = await ProfileManager.GuildData(member.guild.id);
        if (guildData?.leaveMessage && guildData?.leaveChannelID) {
            member.guild.channels.fetch(guildData.leaveChannelID)
                .then((channel) => {
                    if (channel?.isTextBased()) channel.send(guildData.leaveMessage.replace('@user', `<@${member.id}> \`${member.displayName}\` aka \`${member.user.username}\``))
                })
        }
    }
}