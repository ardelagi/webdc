const express = require('express');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Discord client setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages
    ]
});

// Server configuration
const serverConfig = [
    {
        id: 'CEOKOPAT_ALTER_EGO',
        name: "CEOKOPAT ALTER EGO",
        role: "Owner",
        invite: "https://discord.gg/uhsnuMdx69",
        guildId: null, // Will be populated from invite
        icon: null
    },
    {
        id: 'MOTIONLIFE_ROLEPLAY',
        name: "Motionlife Roleplay",
        role: "Staff Discord",
        invite: "https://discord.gg/motionliferoleplay",
        guildId: null,
        icon: null
    },
    {
        id: 'MOTIONLIFE_WHITELIST',
        name: "Motionlife Whitelist",
        role: "Admin",
        invite: null,
        guildId: process.env.WHITELIST_GUILD_ID, // Set in .env
        private: true,
        icon: null
    },
    {
        id: 'MOTIONLIFE_BADSIDE',
        name: "Motionlife Badside",
        role: "Admin",
        invite: null,
        guildId: process.env.BADSIDE_GUILD_ID, // Set in .env
        private: true,
        icon: null
    },
    {
        id: 'EX_HITMEN',
        name: "Ex Hitmen",
        role: "Owner",
        invite: "https://discord.gg/2mBX4Uzgsr",
        guildId: null,
        icon: null
    }
];

// Cache for server data
let serverDataCache = new Map();
let lastUpdate = new Date();

// Helper function to get guild ID from invite
async function getGuildIdFromInvite(inviteCode) {
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
        const invite = await rest.get(Routes.invite(inviteCode));
        return invite.guild?.id;
    } catch (error) {
        console.error(`Error fetching invite ${inviteCode}:`, error.message);
        return null;
    }
}

// Function to fetch server data
async function fetchServerData() {
    console.log('🔄 Fetching server data...');
    const serverData = [];
    
    for (const serverInfo of serverConfig) {
        try {
            let guildId = serverInfo.guildId;
            
            // Get guild ID from invite if not set
            if (!guildId && serverInfo.invite) {
                const inviteCode = serverInfo.invite.split('/').pop();
                guildId = await getGuildIdFromInvite(inviteCode);
            }
            
            if (guildId) {
                const guild = client.guilds.cache.get(guildId);
                
                if (guild) {
                    // Fetch members if not cached
                    if (!guild.members.cache.size) {
                        await guild.members.fetch({ limit: 1000 });
                    }
                    
                    const members = guild.members.cache;
                    const channels = guild.channels.cache;
                    const onlineMembers = members.filter(member => 
                        member.presence?.status === 'online' || 
                        member.presence?.status === 'idle' || 
                        member.presence?.status === 'dnd'
                    ).size;
                    
                    const serverData_item = {
                        id: serverInfo.id,
                        name: serverInfo.name,
                        role: serverInfo.role,
                        invite: serverInfo.invite,
                        private: serverInfo.private || false,
                        icon: guild.iconURL({ dynamic: true, size: 256 }),
                        memberCount: guild.memberCount,
                        channelCount: channels.size,
                        onlineCount: onlineMembers,
                        boostLevel: guild.premiumTier,
                        boostCount: guild.premiumSubscriptionCount || 0,
                        createdAt: guild.createdTimestamp,
                        features: guild.features,
                        lastFetched: new Date().toISOString()
                    };
                    
                    serverData.push(serverData_item);
                    serverDataCache.set(serverInfo.id, serverData_item);
                    
                } else {
                    console.warn(`❌ Guild not found for ${serverInfo.name}`);
                    // Use cached data if available
                    const cachedData = serverDataCache.get(serverInfo.id);
                    if (cachedData) {
                        serverData.push(cachedData);
                    } else {
                        serverData.push({
                            id: serverInfo.id,
                            name: serverInfo.name,
                            role: serverInfo.role,
                            invite: serverInfo.invite,
                            private: serverInfo.private || false,
                            error: 'Guild not accessible',
                            lastFetched: new Date().toISOString()
                        });
                    }
                }
            } else if (serverInfo.private) {
                // Handle private servers
                serverData.push({
                    id: serverInfo.id,
                    name: serverInfo.name,
                    role: serverInfo.role,
                    invite: null,
                    private: true,
                    memberCount: 'Private',
                    channelCount: 'Private',
                    onlineCount: 'Private',
                    lastFetched: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error(`❌ Error fetching data for ${serverInfo.name}:`, error.message);
            
            // Use cached data if available
            const cachedData = serverDataCache.get(serverInfo.id);
            if (cachedData) {
                serverData.push({ ...cachedData, error: error.message });
            } else {
                serverData.push({
                    id: serverInfo.id,
                    name: serverInfo.name,
                    role: serverInfo.role,
                    invite: serverInfo.invite,
                    error: error.message,
                    lastFetched: new Date().toISOString()
                });
            }
        }
    }
    
    lastUpdate = new Date();
    console.log(`✅ Server data updated at ${lastUpdate.toISOString()}`);
    return serverData;
}

// API Routes
app.get('/api/servers', async (req, res) => {
    try {
        const serverData = await fetchServerData();
        res.json({
            success: true,
            data: serverData,
            lastUpdate: lastUpdate.toISOString(),
            totalServers: serverData.length
        });
    } catch (error) {
        console.error('❌ Error in /api/servers:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: Array.from(serverDataCache.values())
        });
    }
});

app.get('/api/servers/:serverId', async (req, res) => {
    try {
        const { serverId } = req.params;
        const serverInfo = serverConfig.find(s => s.id === serverId);
        
        if (!serverInfo) {
            return res.status(404).json({
                success: false,
                error: 'Server not found'
            });
        }
        
        // Fetch single server data
        const serverData = await fetchServerData();
        const server = serverData.find(s => s.id === serverId);
        
        if (!server) {
            return res.status(404).json({
                success: false,
                error: 'Server data not available'
            });
        }
        
        res.json({
            success: true,
            data: server,
            lastUpdate: lastUpdate.toISOString()
        });
        
    } catch (error) {
        console.error(`❌ Error fetching server ${req.params.serverId}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const serverData = await fetchServerData();
        const stats = {
            totalServers: serverData.length,
            totalMembers: 0,
            totalOnline: 0,
            totalChannels: 0,
            publicServers: 0,
            privateServers: 0
        };
        
        serverData.forEach(server => {
            if (server.memberCount && server.memberCount !== 'Private') {
                stats.totalMembers += server.memberCount;
            }
            if (server.onlineCount && server.onlineCount !== 'Private') {
                stats.totalOnline += server.onlineCount;
            }
            if (server.channelCount && server.channelCount !== 'Private') {
                stats.totalChannels += server.channelCount;
            }
            
            if (server.private) {
                stats.privateServers++;
            } else {
                stats.publicServers++;
            }
        });
        
        res.json({
            success: true,
            data: stats,
            lastUpdate: lastUpdate.toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in /api/stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const botStatus = client.readyAt ? 'connected' : 'disconnected';
    res.json({
        success: true,
        status: 'healthy',
        botStatus,
        uptime: process.uptime(),
        lastUpdate: lastUpdate.toISOString(),
        cachedServers: serverDataCache.size
    });
});

// Serve main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Discord bot events
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`🔗 Connected to ${client.guilds.cache.size} guilds`);
    
    // Initial data fetch
    await fetchServerData();
    
    // Set up periodic updates (every 5 minutes)
    setInterval(async () => {
        try {
            await fetchServerData();
        } catch (error) {
            console.error('❌ Error in periodic update:', error);
        }
    }, 5 * 60 * 1000); // 5 minutes
});

client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

client.on('warn', warning => {
    console.warn('⚠️ Discord client warning:', warning);
});

client.on('guildMemberAdd', async (member) => {
    console.log(`👋 New member joined ${member.guild.name}: ${member.user.tag}`);
    // Refresh data for this guild
    await fetchServerData();
});

client.on('guildMemberRemove', async (member) => {
    console.log(`👋 Member left ${member.guild.name}: ${member.user.tag}`);
    // Refresh data for this guild
    await fetchServerData();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Start server
async function startServer() {
    try {
        // Login Discord bot first
        await client.login(process.env.DISCORD_BOT_TOKEN);
        
        // Start Express server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📊 API endpoints:`);
            console.log(`   GET /api/servers - Get all server data`);
            console.log(`   GET /api/servers/:id - Get specific server data`);
            console.log(`   GET /api/stats - Get global statistics`);
            console.log(`   GET /api/health - Health check`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();