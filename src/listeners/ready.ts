import { Events, Listener } from '@sapphire/framework';
import { ChannelType, ForumChannel, type Client } from 'discord.js';
import bot from '../bot';
import { updateCharacterPost } from '../util/functions';
import { HOUR } from '../util/typedef';

export class ReadyListener extends Listener<typeof Events.ClientReady> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
          once: true,
          event: Events.ClientReady
        });
    }

    private async loreChannelsUpdate() {
        console.log("Updating Lore Channels...")
        const lore_forums = await bot.guilds.fetch()
            .then(async s => {
                const loreChannels = [];
                for (const [_, g] of s) {
                    const guild = await g.fetch()
                    const channels_collection = await guild.channels.fetch().catch(_ => null);
                    if (!channels_collection) continue;
                    const lores = Array
                        .from(channels_collection.values())
                        .filter(c => c && c.type === ChannelType.GuildForum && c.name.toLowerCase() === 'lore') as ForumChannel[];
                    loreChannels.push(...lores)
                }
                return loreChannels;
            })
            .catch(e => {
                console.error(e);
                return null;
            });
    
        if (lore_forums) {
            for (let i = 0; i < lore_forums.length; i++) {
                const forum = lore_forums[i];
                console.log(`|=> Updating for [${forum.guild.name}] (${forum.parent?.name || ''} ${forum.name})`)
                const tags = forum.availableTags;
                const major_tag = tags.find(tag => tag.name.toLowerCase().includes('major'))
                const minor_tag = tags.find(tag => tag.name.toLowerCase().includes('minor'))
                if (!major_tag || !minor_tag) {
                    console.error(`forum ${forum.name} has no major / minor tag`);
                    continue;
                }
                else {
                    console.log(`||=> found major / minor lore`)
                }

                const posts = Array.from((await forum.threads.fetchArchived()).threads.values());
                const new_posts = Array.from((await forum.threads.fetch()).threads.values())
                posts.unshift(... new_posts);
                posts.forEach(p => {
                    if (!p.locked && !p.archived) {
                        p.setLocked(true).catch(e => console.error(e));
                        console.log(`|||=> locked "${p.name}"`)
                    }
                    if (p.appliedTags.includes(major_tag.id)) {
                        p.setArchived(false).catch(e => console.error(e))
                        console.log(`|||=> de-archived "${p.name}"`)
                    }
                    else if (p.appliedTags.includes(minor_tag.id)) {
                        if (!p.archived) p.setArchived(true).catch(e => console.error(e))
                        console.log(`|||=> archived "${p.name}"`)

                    }
                })
            }

            console.log("| Done")
        }
        else {
            console.log("| No lore forums")
        }
    
    }

    private async thumbnailUpdate() {
        bot.channels.fetch('1157542261295427675').then(async c => {
            if (c && c instanceof ForumChannel) {
                const threads = await c.threads.fetch();
                const archived = await c.threads.fetchArchived();
                const all = [...Array.from(threads.threads.values()), ...Array.from(archived.threads.values())];

                for (let i = 0; i < all.length; i++) {
                    const t = all[i]
                    console.log(`Checking thread ${t.name}`);
                    

                    if (t.archived) t.setArchived(false).catch(e => console.error(e));
                    const result = await updateCharacterPost(t);
                    if (result) {
                        console.log(`|=> ${result}`);
                    }
                    else {
                        console.log(`|=> done`);
                    }
                }
            }
        })
    }

    public async run(client: Client) {
        const { username, id } = client.user!;
        this.container.logger.info(`Successfully logged in as ${username} (${id})`);
        
        this.thumbnailUpdate();

        // begin the lore channel auto-org system
        setInterval(async () => {
            this.loreChannelsUpdate();
            this.thumbnailUpdate();
        }, 12 * HOUR)
    }
}