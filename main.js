const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { makeInMemoryStore } = require('@whiskeysockets/baileys/lib/Store');
const pino = require('pino');
const readline = require('readline');
const PhoneNumber = require('awesome-phonenumber');
const { handleSimSimi } = require('./case');

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

const startBot = async () => {
    const { state, saveCreds } = await useMultiFileAuthState("session");
    
    const ptz = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    if (!ptz.authState.creds.registered) {
        const phoneNumber = await question('Enter Your Phone Number With Your Country Code :\n');
        let code = await ptz.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(`YOUR PAIRING CODE :`, code);
    }

    ptz.ev.on('creds.update', saveCreds);

    ptz.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, mencoba menyambung kembali...', shouldReconnect);
            if (shouldReconnect) {
                startBotz();
            } else {
                console.log('Koneksi terputus permanen, silakan scan ulang atau periksa pairing code.');
            }
        } else if (connection === 'open') {
            console.log('Bot tersambung!');
        }
    });

    ptz.ev.on('messages.upsert', async (m) => {
        const message = m.messages[0];

        if (message.key.remoteJid.endsWith('@g.us')) return;

        if (!message.key.fromMe && message.message) {
            const command = message.message.conversation;

            await handleSimSimi(ptz, message);
        }
    });
};

startBot();