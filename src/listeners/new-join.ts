import { ProfileManager } from '@classes/InteractionHandler';
import { Listener } from '@sapphire/framework';
import { Events, GuildMember, Role } from 'discord.js';

// Function to add role to new member
async function addRoleToNewMember(member: GuildMember, roleName: string) {
    try {
        const role: Role | undefined = member.guild.roles.cache.find((r) => r.name.toLowerCase() === roleName.toLowerCase());
        if (role) {
            await member.roles.add(role);
            console.log(`Added role "${roleName}" to ${member.user.tag}`);
        } else {
            console.error(`Role "${roleName}" not found`);
        }
    } catch (error) {
        console.error('Error adding role to new member:', error);
    }
}

export class NewJoinListener extends Listener<typeof Events.GuildMemberAdd> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            once: false,
            event: Events.GuildMemberAdd
        });
    }

    public async run(member: GuildMember) {
        addRoleToNewMember(member, 'making character')
        const guildData = await ProfileManager.GuildData(member.guild.id);
        if (guildData?.welcomeMessage && guildData?.welcomeChannelID) {
            member.guild.channels.fetch(guildData.welcomeChannelID)
                .then((channel) => {
                        if (channel?.isTextBased()) channel.send(guildData.welcomeMessage.replace('@user', `<@${member.id}>`))
                })
        }
    }
}