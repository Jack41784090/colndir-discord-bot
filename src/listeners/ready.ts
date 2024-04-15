import { Events, Listener } from '@sapphire/framework';
import { ForumChannel, type Client } from 'discord.js';
import bot from '../bot';
import { findThumbnail, loreChannelsUpdate } from '../util/functions';

export class ReadyListener extends Listener<typeof Events.ClientReady> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
          once: true,
          event: Events.ClientReady
        });
    }

    public async run(client: Client) {
        const { username, id } = client.user!;
        this.container.logger.info(`Successfully logged in as ${username} (${id})`);
        
        await loreChannelsUpdate();
        await bot.channels.fetch('1157542261295427675').then(async c => {
            if (c && c instanceof ForumChannel) {
                const threads = await c.threads.fetch();
                const archived = await c.threads.fetchArchived();
                const all = [...Array.from(threads.threads.values()), ...Array.from(archived.threads.values())];

                for (let i = 0; i < all.length; i++) {
                    const t = all[i]
                    console.log(`Checking thread ${t.name}`);
                    if (t.archived) t.setArchived(false).catch(e => console.error(e));
                    const result = await findThumbnail(t);
                    if (result) {
                        console.log(`|=> ${result}`);
                    }
                    else {
                        console.log(`|=> done`);
                    }
                }
            }
        })

        // begin the lore channel auto-org system
        const hour = 1000 * 60 * 60;
        setInterval(async () => {
            loreChannelsUpdate();
        }, 12 * hour)
    }
}