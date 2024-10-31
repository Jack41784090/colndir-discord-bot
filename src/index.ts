import bot from '@bot';
import { ApplicationCommandRegistries, RegisterBehavior } from "@sapphire/framework";
import * as http from 'http';

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);
bot.login(process.env.TOKEN)

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Just for testing purposes\n');
});
    
server.listen(process.env.CLOUDRUN_PORT, () => {
    console.log('Hello world listening on port', process.env.CLOUDRUN_PORT);
});
