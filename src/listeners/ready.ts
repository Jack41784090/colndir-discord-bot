import { HOUR } from '@constants';
import { cosineSimilarity, extractDiscordLinks, fetchContent, getAllChannelThreads, getPostMessage, TestFunction, textToVector, updateCharacterPost } from '@functions';
import { Events, Listener } from '@sapphire/framework';
import { ChannelType, ForumChannel, Message, TextChannel, ThreadChannel, type Client } from 'discord.js';
import bot from '../bot';

export class ReadyListener extends Listener<typeof Events.ClientReady> {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
          once: true,
          event: Events.ClientReady
        });
    }

    private async loreChannelsUpdate() {
        console.log("Updating Lore Channels...")
        const loreForums = await bot.guilds.fetch()
            .catch(e => {
                console.error(e);
                return null;
            });
        if (!loreForums) return;
        
        // 1. Get all lore channels in all servers
        const loreChannels = [];
        for (const [_, g] of loreForums) {
            const guild = await g.fetch()
            const channels_collection = await guild.channels.fetch().catch(_ => null);
            if (!channels_collection) continue;
            const lores = Array
                .from(channels_collection.values())
                .filter(c => c &&
                    c.type === ChannelType.GuildForum &&
                    c.parent &&
                    c.availableTags.filter(t => t.name.toLowerCase() === ('major lore') || t.name.toLowerCase() === ('minor lore')).length === 2
                ) as ForumChannel[];
            loreChannels.push(...lores)
        }
        
        // 2. Update all lore channels
        for (const [i, forum] of loreChannels.entries()) {
            console.log(`|=> Updating for [${forum.guild.name}] (${forum.parent?.name || ''} ${forum.name})`)
            
            // 2.1 Get major / minor tags
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

            // 2.2 Get all posts
            const posts = await getAllChannelThreads(forum);
            for (let j = 0; j < posts.length; j++) {
                const p = posts[j];
                await this.updateLinks(p as ThreadChannel)
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
            }
        }

        console.log("| Done")
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
                    
                    await t.setArchived(false)
                        .then(t => updateCharacterPost(t))
                        .catch(e => console.error(e));
                }
            }
        })
    }

    private findrelevantPost_cache: Record<string, [ThreadChannel, number][]> = {};
    private async findRelevantPost(content: string, posts: ThreadChannel[]) {
        console.log(`Finding relevant post for ${content.substring(0, 10)+'...'}`)
        const allPostsLev: [ThreadChannel, number][] = []
        if (this.findrelevantPost_cache[content]) {
            console.log(`|=> Found in cache`)
            allPostsLev.push(...this.findrelevantPost_cache[content]);
        }
        else {
            for (const post of posts) {
                if (post.name === content) return post;
                const postContent = await getPostMessage(post).then(m => m?.content);
                if (!postContent) continue;
                allPostsLev.push([post, cosineSimilarity(textToVector(content), textToVector(postContent))]);
            }
        }
        this.findrelevantPost_cache[content] = allPostsLev;
        const min = allPostsLev.reduce((a, b) => a[1] > b[1] ? a : b)
        return min[1] > 0.9 ? min[0] : null;
    }

    private updateLinks_postsCache: Record<string, ThreadChannel[]> = {};
    private async updateLinks(post: ThreadChannel) {
        console.log(`Updating links for ${post.name}...`)
        
        // 1. Get all messages
        const messages = Array.from((await post.messages.fetch()).values());
        for (const postMessage of messages) {

            // 2. Extract all links
            const links = extractDiscordLinks(postMessage.content);
            for (const l of links) {

                // 3. Fetch content
                const x = await fetchContent(l);
                if (x && x instanceof Message) { // If referencing message
                    const outsideMessage = x;
                    if ((outsideMessage.channel as TextChannel)?.guild.id === post.guild.id) continue; // Skip if reference is local

                    console.log(`|=> ${post.name} refers to ${outsideMessage.content.substring(0, 10)+'...'} in ${(outsideMessage.channel as TextChannel).guild.name}`)
                    const cacheID = post.parentId || post.guild.id;
                    const relevantPost =
                        this.updateLinks_postsCache[cacheID]||
                        (this.updateLinks_postsCache[cacheID] = await getAllChannelThreads(post.parent as ForumChannel));
                    if (!relevantPost || relevantPost.length < 0) {
                        console.log(`||=> No relevant posts found for ${post.name} in ${post.guild.name}`, cacheID)
                        continue;
                    }

                    const otherPost = await this.findRelevantPost(outsideMessage.content, relevantPost);
                    if (otherPost) {
                        console.log(`||=> Found relevant post ${otherPost.name}`)
                        await post.setArchived(false)
                        await post.setLocked(false)
                        postMessage.edit({
                            content: postMessage.content.replace(l, otherPost.url),
                        }).catch(e => console.error(e));
                    }
                    else {
                        console.error(`||=> Cannot find a good match for ${outsideMessage.content.substring(0, 10)+'...'}`)
                    }
                }
                else if (x) {
                    // const outsideChannel = x as TextChannel;
                    // if (outsideChannel.isTextBased()) {
                    //     console.log(`|=> ${post.name} refers to channel: ${outsideChannel.name} in ${outsideChannel.guild.name}`)
                    //     const cacheID = post.parentId || post.guild.id;
                    //     const otherPosts = this.updateLinks_postsCache[cacheID] || await fetchForumPosts(post.parent as ForumChannel);
                    //     if (otherPosts && otherPosts?.length > 0) {
                    //         this.updateLinks_postsCache[cacheID] = otherPosts;
                    //     }
                    // }
                }
                else {
                    console.error(`|=> ${post.name} refers to content that doesn't exist`)
                }
            }
        }
        delete this.updateLinks_postsCache[post.id];
    }

    public async run(client: Client) {
        const { username, id } = client.user!;
        this.container.logger.info(`Successfully logged in as ${username} (${id})`);
        const commands = await client.application?.commands.fetch();
        this.container.logger.info(`Slash commands: ${commands?.map(c => c.name).join(', ') || 'None'}`);
        TestFunction();
        // this.loreChannelsUpdate();

        setInterval(async () => {
            await this.loreChannelsUpdate();
            await this.thumbnailUpdate();
        }, 12 * HOUR)
    }
}