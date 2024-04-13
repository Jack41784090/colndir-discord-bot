import { Events, Listener } from '@sapphire/framework';
import { type Client } from 'discord.js';
import { loreChannelsUpdate } from '../util/functions';

export class ReadyListener extends Listener<typeof Events.ClientReady> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
          once: true,
          event: Events.ClientReady
        });
    }

    public run(client: Client) {
        const { username, id } = client.user!;
        this.container.logger.info(`Successfully logged in as ${username} (${id})`);
        loreChannelsUpdate();

        // begin the lore channel auto-org system
        const hour = 1000 * 60 * 60;
        setInterval(async () => {
            loreChannelsUpdate();
        }, 12 * hour)
    }
}