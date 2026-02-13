const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Store for handling messages
const store = makeInMemoryStore({ 
  logger: pino().child({ level: 'silent', stream: 'store' }) 
});

// Bot configuration
const config = {
  botName: 'PROSPEREZ',
  ownerName: 'Not Set!',
  prefix: '.',
  mode: 'Public',
  version: '1.8.8',
  plugins: 331
};

// Start bot function
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: Browsers.ubuntu('Chrome'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return { conversation: 'Hello' };
    }
  });

  store?.bind(sock.ev);

  // Connection update handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting:', shouldReconnect);
      
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('✅ Prosperez Bot v1.8.8 Connected Successfully!');
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Bot Name: ${config.botName}`);
      console.log(`Version: ${config.version}`);
      console.log(`Plugins: ${config.plugins}`);
      console.log(`Mode: ${config.mode}`);
      console.log(`Prefix: ${config.prefix}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    }
  });

  // Credentials update handler
  sock.ev.on('creds.update', saveCreds);

  // Message handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    try {
      if (type !== 'notify') return;
      
      const msg = messages[0];
      if (!msg.message) return;
      
      const messageContent = msg.message.conversation || 
                            msg.message.extendedTextMessage?.text || 
                            msg.message.imageMessage?.caption || 
                            msg.message.videoMessage?.caption || '';
      
      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      
      // Check if message starts with prefix
      if (!messageContent.startsWith(config.prefix)) return;
      
      const args = messageContent.slice(config.prefix.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();
      
      console.log(`Command received: ${command} from ${from}`);
      
      // Menu command
      if (command === 'menu' || command === 'help') {
        const startTime = Date.now();
        const menuText = generateMenu();
        const responseTime = (Date.now() - startTime).toFixed(4);
        
        const infoText = `┏▣ ◈ *PROSPEREZ* ◈
┃ *ᴏᴡɴᴇʀ* : ${config.ownerName}
┃ *ᴘʀᴇғɪx* : [ ${config.prefix} ]
┃ *ʜᴏsᴛ* : Render
┃ *ᴘʟᴜɢɪɴs* : ${config.plugins}
┃ *ᴍᴏᴅᴇ* : ${config.mode}
┃ *ᴠᴇʀsɪᴏɴ* : ${config.version}
┃ *sᴘᴇᴇᴅ* : ${responseTime} ms
┃ *ᴜsᴀɢᴇ* : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB of ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB
┃ *ʀᴀᴍ:* [████░░░░░░] ${Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)}%
┗▣\n\n${menuText}`;
        
        await sock.sendMessage(from, { text: infoText });
      }
      
      // Ping command
      if (command === 'ping' || command === 'ping2') {
        const startTime = Date.now();
        await sock.sendMessage(from, { text: '🏓 Pinging...' });
        const responseTime = (Date.now() - startTime).toFixed(4);
        await sock.sendMessage(from, { text: `⚡ Response Time: ${responseTime} ms` });
      }
      
      // Runtime command
      if (command === 'runtime') {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        await sock.sendMessage(from, { 
          text: `⏰ *Runtime*\n${hours}h ${minutes}m ${seconds}s` 
        });
      }
      
      // Bot status command
      if (command === 'botstatus') {
        const statusText = `┏▣ ◈ *BOT STATUS* ◈
┃ *Status* : Online ✅
┃ *Version* : ${config.version}
┃ *Platform* : Render
┃ *Uptime* : ${Math.floor(process.uptime() / 60)} minutes
┃ *Memory* : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
┗▣`;
        await sock.sendMessage(from, { text: statusText });
      }
      
      // Owner command
      if (command === 'owner') {
        await sock.sendMessage(from, { 
          text: `👤 *Owner*: ${config.ownerName}\n\n_Contact the owner for support_` 
        });
      }
      
      // Repo command
      if (command === 'repo') {
        await sock.sendMessage(from, { 
          text: `🔗 *Prosperez Bot Repository*\n\nVersion: ${config.version}\nDeveloped for WhatsApp automation` 
        });
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  return sock;
}

// Generate menu function
function generateMenu() {
  return `┏▣ ◈ *AI MENU* ◈
│➽ analyze
│➽ blackbox
│➽ code
│➽ dalle
│➽ deepseek
│➽ doppleai
│➽ gemini
│➽ generate
│➽ gpt
│➽ gpt2
│➽ imagen
│➽ imagine
│➽ llama
│➽ metaai
│➽ mistral
│➽ programming
│➽ recipe
│➽ story
│➽ summarize
│➽ teach
│➽ translate2
┗▣ 

┏▣ ◈ *AUDIO MENU* ◈
│➽ bass
│➽ blown
│➽ deep
│➽ earrape
│➽ reverse
│➽ robot
│➽ tomp3
│➽ toptt
│➽ volaudio
┗▣ 

┏▣ ◈ *DOWNLOAD MENU* ◈
│➽ apk
│➽ download
│➽ facebook
│➽ gdrive
│➽ gitclone
│➽ image
│➽ instagram
│➽ itunes
│➽ mediafire
│➽ pin
│➽ savestatus
│➽ song
│➽ song2
│➽ telesticker
│➽ tiktok
│➽ tiktokaudio
│➽ twitter
│➽ video
│➽ videodoc
│➽ xvideos
┗▣ 

┏▣ ◈ *EPHOTO360 MENU* ◈
│➽ 1917style
│➽ advancedglow
│➽ blackpinklogo
│➽ blackpinkstyle
│➽ cartoonstyle
│➽ deletingtext
│➽ dragonball
│➽ effectclouds
│➽ flag3dtext
│➽ flagtext
│➽ freecreate
│➽ galaxystyle
│➽ galaxywallpaper
│➽ glitchtext
│➽ glowingtext
│➽ gradienttext
│➽ graffiti
│➽ incandescent
│➽ lighteffects
│➽ logomaker
│➽ luxurygold
│➽ makingneon
│➽ matrix
│➽ multicoloredneon
│➽ neonglitch
│➽ papercutstyle
│➽ pixelglitch
│➽ royaltext
│➽ sand
│➽ summerbeach
│➽ topography
│➽ typography
│➽ watercolortext
│➽ writetext
┗▣ 

┏▣ ◈ *FUN MENU* ◈
│➽ fact
│➽ jokes
│➽ memes
│➽ quotes
│➽ trivia
│➽ truthdetector
│➽ xxqc
┗▣ 

┏▣ ◈ *GAMES MENU* ◈
│➽ dare
│➽ truth
│➽ truthordare
┗▣ 

┏▣ ◈ *GROUP MENU* ◈
│➽ add
│➽ addcode
│➽ allow
│➽ announcements
│➽ antibadword
│➽ antibot
│➽ antidemote
│➽ antiforeign
│➽ antigroupmention
│➽ antilink
│➽ antilinkgc
│➽ antisticker
│➽ antitag
│➽ antitagadmin
│➽ approve
│➽ approveall
│➽ cancelkick
│➽ close
│➽ closetime
│➽ delallowed
│➽ delcode
│➽ delppgroup
│➽ demote
│➽ disapproveall
│➽ editsettings
│➽ getgrouppp
│➽ hidetag
│➽ invite
│➽ kick
│➽ kickall
│➽ kickinactive
│➽ link
│➽ listactive
│➽ listallowed
│➽ listcode
│➽ listinactive
│➽ listrequests
│➽ mediatag
│➽ open
│➽ opentime
│➽ poll
│➽ promote
│➽ reject
│➽ resetlink
│➽ setdesc
│➽ setgroupname
│➽ setppgroup
│➽ tag
│➽ tagadmin
│➽ tagall
│➽ tosgroup
│➽ totalmembers
│➽ userid
│➽ vcf
│➽ welcome
┗▣ 

┏▣ ◈ *IMAGE MENU* ◈
│➽ remini
│➽ wallpaper
┗▣ 

┏▣ ◈ *OTHER MENU* ◈
│➽ botstatus
│➽ pair
│➽ ping
│➽ ping2
│➽ repo
│➽ runtime
│➽ time
┗▣ 

┏▣ ◈ *OWNER MENU* ◈
│➽ autosavestatus
│➽ aza
│➽ block
│➽ delete
│➽ deljunk
│➽ delstickercmd
│➽ disk
│➽ dlvo
│➽ gcaddprivacy
│➽ groupid
│➽ hostip
│➽ join
│➽ lastseen
│➽ leave
│➽ listbadword
│➽ listblocked
│➽ listignorelist
│➽ listsudo
│➽ modestatus
│➽ online
│➽ owner
│➽ ppprivacy
│➽ react
│➽ readreceipts
│➽ resetaza
│➽ restart
│➽ setaza
│➽ setbio
│➽ setprofilepic
│➽ setstickercmd
│➽ tostatus
│➽ toviewonce
│➽ unblock
│➽ unblockall
│➽ update
│➽ vv2
│➽ warn
┗▣ 

┏▣ ◈ *RELIGION MENU* ◈
│➽ bible
│➽ quran
┗▣ 

┏▣ ◈ *SEARCH MENU* ◈
│➽ define
│➽ define2
│➽ imdb
│➽ lyrics
│➽ shazam
│➽ weather
│➽ yts
┗▣ 

┏▣ ◈ *SETTINGS MENU* ◈
│➽ addbadword
│➽ addcountrycode
│➽ addignorelist
│➽ addsudo
│➽ alwaysonline
│➽ antibug
│➽ anticall
│➽ antidelete
│➽ antideletestatus
│➽ antiedit
│➽ antiviewonce
│➽ autobio
│➽ autoblock
│➽ autoreact
│➽ autoreactstatus
│➽ autoread
│➽ autorecord
│➽ autorecordtyping
│➽ autotype
│➽ autoviewstatus
│➽ chatbot
│➽ delanticallmsg
│➽ delcountrycode
│➽ deletebadword
│➽ delgoodbye
│➽ delignorelist
│➽ delsudo
│➽ delwelcome
│➽ getsettings
│➽ listcountrycode
│➽ listwarn
│➽ mode
│➽ resetsetting
│➽ resetwarn
│➽ setanticallmsg
│➽ setbotname
│➽ setcontextlink
│➽ setfont
│➽ setgoodbye
│➽ setmenu
│➽ setmenuimage
│➽ setownername
│➽ setownernumber
│➽ setprefix
│➽ setstatusemoji
│➽ setstickerauthor
│➽ setstickerpackname
│➽ settimezone
│➽ setwarn
│➽ setwatermark
│➽ setwelcome
│➽ showanticallmsg
│➽ showgoodbye
│➽ showwelcome
│➽ testanticallmsg
│➽ testgoodbye
│➽ testwelcome
┗▣ 

┏▣ ◈ *SPORTS MENU* ◈
│➽ bundesligamatches
│➽ bundesligascorers
│➽ bundesligastandings
│➽ bundesligaupcoming
│➽ clmatches
│➽ clscorers
│➽ clstandings
│➽ clupcoming
│➽ eflmatches
│➽ eflscorers
│➽ eflstandings
│➽ eflupcoming
│➽ elmatches
│➽ elscorers
│➽ elstandings
│➽ elupcoming
│➽ eplmatches
│➽ eplscorers
│➽ eplstandings
│➽ eplupcoming
│➽ laligamatches
│➽ laligascorers
│➽ laligastandings
│➽ laligaupcoming
│➽ ligue1matches
│➽ ligue1scorers
│➽ ligue1standings
│➽ ligue1upcoming
│➽ serieamatches
│➽ serieascorers
│➽ serieastandings
│➽ serieaupcoming
│➽ wcmatches
│➽ wcscorers
│➽ wcstandings
│➽ wcupcoming
│➽ wrestlingevents
│➽ wwenews
│➽ wweschedule
┗▣ 

┏▣ ◈ *SUPPORT MENU* ◈
│➽ feedback
│➽ helpers
┗▣ 

┏▣ ◈ *TOOLS MENU* ◈
│➽ browse
│➽ calculate
│➽ device
│➽ emojimix
│➽ fancy
│➽ filtervcf
│➽ fliptext
│➽ genpass
│➽ getabout
│➽ getpp
│➽ gsmarena
│➽ obfuscate
│➽ qrcode
│➽ runeval
│➽ say
│➽ ssweb
│➽ sswebpc
│➽ sswebtab
│➽ sticker
│➽ take
│➽ texttopdf
│➽ tinyurl
│➽ toimage
│➽ tourl
│➽ vcc
┗▣ 

┏▣ ◈ *TRANSLATE MENU* ◈
│➽ translate
┗▣ 

┏▣ ◈ *VIDEO MENU* ◈
│➽ toaudio
│➽ tovideo
│➽ volvideo
┗▣`;
}

// Start the bot
startBot().catch(err => console.error('Failed to start bot:', err));

// Handle process termination
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});
