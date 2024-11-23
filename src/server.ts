import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import socketIoServer from './socket-io.server'
import quickStackService from './server/services/qs.service'
import { CommandExecutorUtils } from './server/utils/command-executor.utils'
import dataAccess from './server/adapter/db.client'
import { FancyConsoleUtils } from './server/utils/fancy-console.utils'
import { Constants } from './server/utils/constants'

// Source: https://nextjs.org/docs/app/building-your-application/configuring/custom-server


const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

console.log(`NODE_ENV=${process.env.NODE_ENV}`);
if (process.env.NODE_ENV === 'production') {
    console.log(`KUBERNETES_SERVICE_HOST=${process.env.KUBERNETES_SERVICE_HOST}`);
    console.log(`KUBERNETES_SERVICE_PORT=${process.env.KUBERNETES_SERVICE_PORT}`);
}

async function setupQuickStack() {
    console.log('Setting up QuickStack...');
    await quickStackService.initializeQuickStack();
}

async function initializeNextJs() {

    FancyConsoleUtils.printQuickStack();
    if (process.env.NODE_ENV === 'production') {
        // update database
        console.log('Running db migration...');
        await CommandExecutorUtils.runCommand('npx prisma migrate deploy');

        if (process.env.K3S_JOIN_TOKEN && process.env.K3S_JOIN_TOKEN.trim()) {
            console.log('Saving K3S_JOIN_TOKEN to database...');
            await dataAccess.client.parameter.upsert({
                where: {
                    name: Constants.K3S_JOIN_TOKEN
                },
                create: {
                    name: Constants.K3S_JOIN_TOKEN,
                    value: process.env.K3S_JOIN_TOKEN
                },
                update: {
                    value: process.env.K3S_JOIN_TOKEN
                }
            });
        }
    }

    const app = next({ dev })
    const handle = app.getRequestHandler()

    app.prepare().then(() => {

        const server = createServer((req, res) => {
            const parsedUrl = parse(req.url!, true)
            handle(req, res, parsedUrl)
        });

        socketIoServer.initialize(server);
        server.listen(port)

        console.log(
            `> Server listening at http://localhost:${port} as ${dev ? 'development' : process.env.NODE_ENV
            }`
        )
    });
}


if (process.env.NODE_ENV === 'production' && process.env.START_MODE === 'setup') {
    setupQuickStack();
} else {
    initializeNextJs();
}

