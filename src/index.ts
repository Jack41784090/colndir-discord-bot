import bot from '@bot';
import { ApplicationCommandRegistries, RegisterBehavior } from "@sapphire/framework";
import * as http from 'http';

// require('dotenv').config();

ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(RegisterBehavior.BulkOverwrite);

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Just for testing purposes\n');
});
    
server.listen(process.env.CLOUDRUN_PORT, () => {
    console.log('Server running at http://localhost:' + process.env.CLOUDRUN_PORT + '/');
    console.log(`bot.id: ${bot.id}`)
    console.log(`TOKEN: ${process.env.TOKEN}`)
    bot.login(process.env.TOKEN)
        .then(() => {
            console.log('Bot is ready');
        })
        .catch((error) => {
            console.error('Error while logging in', error);
        });
});
