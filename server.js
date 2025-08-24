// Enhanced server.js with analytics, real-time updates, and health scoring
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

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
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent
    ]
});

// Enhanced server configuration with profile info
const ownerProfile = {
    discordId: "your_discord_id",
    username: "ardelagi",
    displayName: "Ardelagi",
    avatar: null, // Will be populated when bot starts
    status: "Managing multiple Discord communities",
    joinedDiscord: "2018-03-15", // Adjust to your actual join date
    badges: ["Server Owner", "Community Manager", "Bot Developer"],
    socialLinks: {
        github: "https://github.com/ardelagi",
        website: "https://ardelagi.web.id",
        twitter: null // Add if you have one
    }
};

const serverConfig = [
    {
        id: 'CEOKOPAT_ALTER_EGO',
        name: "CEOKOPAT ALTER EGO",
        role: "Owner",
        invite: "https://discord.gg/uhsnuMdx69",
        guildId: null,
        icon: null,
        category: "Community",
        language: "Indonesian",
        description: "Main community server with active members"
    },
    {
        id: 'MOTIONLIFE_ROLEPLAY',
        name: "Motionlife Roleplay",
        role: "Staff Discord",
        invite: "https://discord.gg/motionliferoleplay",
        guildId: null,
        icon: null,
        category: "Gaming",
        language: "Indonesian", 
        description: "Roleplay gaming community server"
    },
    {
        id: 'MOTIONLIFE_WHITELIST',
        name: "Motionlife Whitelist",
        role: "Admin",
        invite: null,
        guildId: process.env.WHITELIST_GUILD_ID,
        private: true,
        icon: null,
        category: "Private",
        language: "Indonesian",
        description: "Private whitelist management server"
    },
    {
        id: 'MOTIONLIFE_BADSIDE',
        name: "Motionlife Badside",
        role: "Admin",
        invite: null,
        guildId: process.env.BADSIDE_GUILD_ID,
        private: true,
        icon: null,
        category: "Private",
        language: "Indonesian",
        description: "Private administrative server"
    },
    {
        id: 'EX_HITMEN',
        name: "Ex Hitmen",
        role: "Owner",
        invite: "https://discord.gg/2mBX4Uzgsr",
        guildId: null,
        icon: null,
        category: "Gaming",
        language: "Indonesian",
        description: "Gaming community focused on competitive play"
    }
];

// Data storage
let serverDataCache = new Map();
let analyticsData = new Map();
let activityTracker = new Map();
let voiceTracker = new Map();
let lastUpdate = new Date();

// Analytics data structure
function initializeAnalytics(serverId) {
    if (!analyticsData.has(serverId)) {
        analyticsData.set(serverId, {
            memberGrowth: [],
            dailyActivity: [],
            peakHours: new Array(24).fill(0),
            weeklyStats: [],
            healthHistory: []
        });
    }
}

// Activity tracking structure
function initializeActivityTracker(serverId) {
    if (!activityTracker.has(serverId)) {
        activityTracker.set(serverId, {
            totalMessages: 0,
            activeUsers: new Set(),
            channelActivity: new Map(),
            lastReset: new Date()
        });
    }
}

// Voice tracking structure
function initializeVoiceTracker(serverId) {
    if (!voiceTracker.has(serverId)) {
        voiceTracker.set(serverId, {
            activeChannels: new Map(),
            totalVoiceTime: 0,
            peakVoiceUsers: 0,
            voiceEvents: []
        });
    }
}

// Server Health Score Algorithm
function calculateHealthScore(serverData, analytics, activity, voice) {
    const scores = {
        growth: 0,      // Member growth rate
        activity: 0,    // Message activity
        engagement: 0,  // Voice + text engagement
        retention: 0    // Member retention
    };

    // Growth Score (0-100)
    if (analytics && analytics.memberGrowth.length > 1) {
        const recent = analytics.memberGrowth.slice(-7); // Last 7 days
        const growthRate = recent.reduce((acc, curr, idx) => {
            if (idx === 0) return acc;
            return acc + (curr.count - recent[idx-1].count);
        }, 0);
        scores.growth = Math.min(100, Math.max(0, 50 + (growthRate / serverData.memberCount) * 1000));
    } else {
        scores.growth = 50; // Default score
    }

    // Activity Score (0-100)
    if (activity) {
        const messagesPerMember = activity.totalMessages / serverData.memberCount;
        scores.activity = Math.min(100, messagesPerMember * 20);
    }

    // Engagement Score (0-100)
    const onlineRatio = serverData.onlineCount / serverData.memberCount;
    const voiceRatio = voice ? voice.activeChannels.size / serverData.channelCount : 0;
    scores.engagement = (onlineRatio * 60 + voiceRatio * 40) * 100;

    // Retention Score (0-100) - simplified calculation
    scores.retention = Math.min(100, (serverData.memberCount / (serverData.memberCount * 1.1)) * 100);

    // Overall Health Score (weighted average)
    const weights = { growth: 0.25, activity: 0.3, engagement: 0.3, retention: 0.15 };
    const overallScore = Object.keys(scores).reduce((total, key) => {
        return total + (scores[key] * weights[key]);
    }, 0);

    return {
        overall: Math.round(overallScore),
        breakdown: {
            growth: Math.round(scores.growth),
            activity: Math.round(scores.activity),
            engagement: Math.round(scores.engagement),
            retention: Math.round(scores.retention)
        }
    };
}

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

// Enhanced server data fetching
async function fetchServerData() {
    console.log('🔄 Fetching enhanced server data...');
    const serverData = [];
    
    for (const serverInfo of serverConfig) {
        try {
            let guildId = serverInfo.guildId;
            
            if (!guildId && serverInfo.invite) {
                const inviteCode = serverInfo.invite.split('/').pop();
                guildId = await getGuildIdFromInvite(inviteCode);
            }
            
            if (guildId) {
                const guild = client.guilds.cache.get(guildId);
                
                if (guild) {
                    // Initialize tracking
                    initializeAnalytics(serverInfo.id);
                    initializeActivityTracker(serverInfo.id);
                    initializeVoiceTracker(serverInfo.id);
                    
                    // Fetch members if not cached
                    if (!guild.members.cache.size) {
                        await guild.members.fetch({ limit: 1000 }).catch(console.error);
                    }
                    
                    const members = guild.members.cache;
                    const channels = guild.channels.cache;
                    
                    // Calculate online members
                    const onlineMembers = members.filter(member => 
                        member.presence?.status === 'online' || 
                        member.presence?.status === 'idle' || 
                        member.presence?.status === 'dnd'
                    ).size;
                    
                    // Voice channel analysis
                    const voiceChannels = channels.filter(channel => channel.type === 2); // Voice channels
                    const activeVoiceChannels = voiceChannels.filter(channel => 
                        channel.members && channel.members.size > 0
                    );
                    
                    let totalVoiceMembers = 0;
                    const voiceData = [];
                    
                    activeVoiceChannels.forEach(channel => {
                        const voiceMembers = channel.members.size;
                        totalVoiceMembers += voiceMembers;
                        voiceData.push({
                            channelName: channel.name,
                            memberCount: voiceMembers,
                            members: channel.members.map(member => member.user.username)
                        });
                    });
                    
                    // Update voice tracker
                    const voiceTrack = voiceTracker.get(serverInfo.id);
                    voiceTrack.activeChannels.clear();
                    activeVoiceChannels.forEach(channel => {
                        voiceTrack.activeChannels.set(channel.id, {
                            name: channel.name,
                            memberCount: channel.members.size,
                            members: Array.from(channel.members.values())
                        });
                    });
                    voiceTrack.peakVoiceUsers = Math.max(voiceTrack.peakVoiceUsers, totalVoiceMembers);
                    
                    // Get analytics data
                    const analytics = analyticsData.get(serverInfo.id);
                    const activity = activityTracker.get(serverInfo.id);
                    
                    // Update analytics
                    analytics.memberGrowth.push({
                        date: new Date().toISOString(),
                        count: guild.memberCount
                    });
                    
                    // Keep only last 30 days of growth data
                    if (analytics.memberGrowth.length > 30) {
                        analytics.memberGrowth = analytics.memberGrowth.slice(-30);
                    }
                    
                    // Calculate health score
                    const healthScore = calculateHealthScore(
                        { memberCount: guild.memberCount, onlineCount: onlineMembers, channelCount: channels.size },
                        analytics,
                        activity,
                        voiceTrack
                    );
                    
                    // Update health history
                    analytics.healthHistory.push({
                        date: new Date().toISOString(),
                        score: healthScore.overall
                    });
                    
                    if (analytics.healthHistory.length > 168) { // Keep 7 days of hourly data
                        analytics.healthHistory = analytics.healthHistory.slice(-168);
                    }
                    
                    const serverDataItem = {
                        id: serverInfo.id,
                        name: serverInfo.name,
                        role: serverInfo.role,
                        invite: serverInfo.invite,
                        private: serverInfo.private || false,
                        category: serverInfo.category,
                        language: serverInfo.language,
                        description: serverInfo.description,
                        icon: guild.iconURL({ dynamic: true, size: 256 }),
                        memberCount: guild.memberCount,
                        channelCount: channels.size,
                        onlineCount: onlineMembers,
                        voiceChannels: voiceChannels.size,
                        activeVoiceChannels: activeVoiceChannels.size,
                        totalVoiceMembers,
                        voiceData,
                        boostLevel: guild.premiumTier,
                        boostCount: guild.premiumSubscriptionCount || 0,
                        createdAt: guild.createdTimestamp,
                        features: guild.features,
                        healthScore,
                        analytics: {
                            memberGrowth: analytics.memberGrowth.slice(-7), // Last 7 days
                            healthTrend: analytics.healthHistory.slice(-24) // Last 24 hours
                        },
                        lastFetched: new Date().toISOString()
                    };
                    
                    serverData.push(serverDataItem);
                    serverDataCache.set(serverInfo.id, serverDataItem);
                    
                    // Emit real-time update
                    io.emit('serverUpdate', {
                        serverId: serverInfo.id,
                        data: serverDataItem
                    });
                    
                } else {
                    console.warn(`❌ Guild not found for ${serverInfo.name}`);
                    const cachedData = serverDataCache.get(serverInfo.id);
                    if (cachedData) {
                        serverData.push(cachedData);
                    }
                }
            } else if (serverInfo.private) {
                serverData.push({
                    id: serverInfo.id,
                    name: serverInfo.name,
                    role: serverInfo.role,
                    invite: null,
                    private: true,
                    category: serverInfo.category,
                    language: serverInfo.language,
                    description: serverInfo.description,
                    memberCount: 'Private',
                    channelCount: 'Private',
                    onlineCount: 'Private',
                    voiceData: [],
                    healthScore: { overall: 0, breakdown: {} },
                    lastFetched: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error(`❌ Error fetching data for ${serverInfo.name}:`, error.message);
            const cachedData = serverDataCache.get(serverInfo.id);
            if (cachedData) {
                serverData.push({ ...cachedData, error: error.message });
            }
        }
    }
    
    lastUpdate = new Date();
    console.log(`✅ Enhanced server data updated at ${lastUpdate.toISOString()}`);
    
    // Emit global stats update
    io.emit('globalStatsUpdate', {
        totalServers: serverData.length,
        totalMembers: serverData.reduce((sum, server) => 
            typeof server.memberCount === 'number' ? sum + server.memberCount : sum, 0),
        totalOnline: serverData.reduce((sum, server) => 
            typeof server.onlineCount === 'number' ? sum + server.onlineCount : sum, 0),
        lastUpdate: lastUpdate.toISOString()
    });
    
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

// Enhanced analytics endpoint
app.get('/api/analytics/:serverId?', async (req, res) => {
    try {
        const { serverId } = req.params;
        
        if (serverId) {
            const analytics = analyticsData.get(serverId);
            const activity = activityTracker.get(serverId);
            const voice = voiceTracker.get(serverId);
            
            if (!analytics) {
                return res.status(404).json({
                    success: false,
                    error: 'Server analytics not found'
                });
            }
            
            res.json({
                success: true,
                data: {
                    serverId,
                    memberGrowth: analytics.memberGrowth,
                    healthHistory: analytics.healthHistory,
                    activity: activity ? {
                        totalMessages: activity.totalMessages,
                        activeUsers: activity.activeUsers.size,
                        channelsActive: activity.channelActivity.size
                    } : null,
                    voice: voice ? {
                        activeChannels: voice.activeChannels.size,
                        totalVoiceMembers: Array.from(voice.activeChannels.values())
                            .reduce((sum, channel) => sum + channel.memberCount, 0),
                        peakVoiceUsers: voice.peakVoiceUsers
                    } : null
                }
            });
        } else {
            // Global analytics
            const globalAnalytics = {
                totalServers: serverDataCache.size,
                totalMembers: 0,
                totalOnline: 0,
                averageHealth: 0,
                serverBreakdown: []
            };
            
            Array.from(serverDataCache.values()).forEach(server => {
                if (typeof server.memberCount === 'number') {
                    globalAnalytics.totalMembers += server.memberCount;
                }
                if (typeof server.onlineCount === 'number') {
                    globalAnalytics.totalOnline += server.onlineCount;
                }
                if (server.healthScore?.overall) {
                    globalAnalytics.averageHealth += server.healthScore.overall;
                }
                
                globalAnalytics.serverBreakdown.push({
                    id: server.id,
                    name: server.name,
                    members: server.memberCount,
                    health: server.healthScore?.overall || 0
                });
            });
            
            globalAnalytics.averageHealth = Math.round(
                globalAnalytics.averageHealth / globalAnalytics.serverBreakdown.length
            );
            
            res.json({
                success: true,
                data: globalAnalytics
            });
        }
        
    } catch (error) {
        console.error('❌ Error in /api/analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Voice activity endpoint
app.get('/api/voice/:serverId?', async (req, res) => {
    try {
        const { serverId } = req.params;
        
        if (serverId) {
            const voice = voiceTracker.get(serverId);
            if (!voice) {
                return res.status(404).json({
                    success: false,
                    error: 'Voice data not found'
                });
            }
            
            res.json({
                success: true,
                data: {
                    serverId,
                    activeChannels: Array.from(voice.activeChannels.entries()).map(([id, data]) => ({
                        channelId: id,
                        name: data.name,
                        memberCount: data.memberCount,
                        members: data.members.map(member => ({
                            id: member.id,
                            username: member.user.username,
                            avatar: member.user.displayAvatarURL()
                        }))
                    })),
                    totalVoiceMembers: Array.from(voice.activeChannels.values())
                        .reduce((sum, channel) => sum + channel.memberCount, 0),
                    peakVoiceUsers: voice.peakVoiceUsers
                }
            });
        } else {
            // Global voice stats
            let totalActiveChannels = 0;
            let totalVoiceMembers = 0;
            
            voiceTracker.forEach(voice => {
                totalActiveChannels += voice.activeChannels.size;
                totalVoiceMembers += Array.from(voice.activeChannels.values())
                    .reduce((sum, channel) => sum + channel.memberCount, 0);
            });
            
            res.json({
                success: true,
                data: {
                    totalActiveChannels,
                    totalVoiceMembers,
                    serverBreakdown: Array.from(voiceTracker.entries()).map(([serverId, voice]) => ({
                        serverId,
                        activeChannels: voice.activeChannels.size,
                        voiceMembers: Array.from(voice.activeChannels.values())
                            .reduce((sum, channel) => sum + channel.memberCount, 0)
                    }))
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Error in /api/voice:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Profile endpoint
app.get('/api/profile', async (req, res) => {
    try {
        // Get user from Discord if available
        let userProfile = { ...ownerProfile };
        
        if (client.user) {
            userProfile.avatar = client.user.displayAvatarURL({ dynamic: true, size: 256 });
            userProfile.botTag = client.user.tag;
        }
        
        // Add server management stats
        const serverData = Array.from(serverDataCache.values());
        const managementStats = {
            totalServersManaged: serverData.length,
            totalMembersManaged: serverData.reduce((sum, server) => 
                typeof server.memberCount === 'number' ? sum + server.memberCount : sum, 0),
            rolesBreakdown: {
                owner: serverData.filter(s => s.role === 'Owner').length,
                admin: serverData.filter(s => s.role === 'Admin').length,
                staff: serverData.filter(s => s.role.includes('Staff')).length
            },
            averageHealthScore: Math.round(
                serverData.reduce((sum, server) => sum + (server.healthScore?.overall || 0), 0) / serverData.length
            )
        };
        
        res.json({
            success: true,
            data: {
                profile: userProfile,
                stats: managementStats,
                achievements: [
                    'Managing 5+ Discord servers',
                    'Total community of 6000+ members',
                    'Multi-language community support',
                    'Real-time monitoring system'
                ]
            }
        });
        
    } catch (error) {
        console.error('❌ Error in /api/profile:', error);
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
        cachedServers: serverDataCache.size,
        realTimeConnections: io.sockets.sockets.size
    });
});

// Serve main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`👤 User connected: ${socket.id}`);
    
    // Send current server data on connection
    socket.emit('initialData', {
        servers: Array.from(serverDataCache.values()),
        lastUpdate: lastUpdate.toISOString()
    });
    
    // Handle client requests for specific server analytics
    socket.on('requestAnalytics', (serverId) => {
        const analytics = analyticsData.get(serverId);
        if (analytics) {
            socket.emit('analyticsData', { serverId, data: analytics });
        }
    });
    
    // Handle voice data requests
    socket.on('requestVoiceData', (serverId) => {
        const voice = voiceTracker.get(serverId);
        if (voice) {
            socket.emit('voiceData', { 
                serverId, 
                data: {
                    activeChannels: voice.activeChannels.size,
                    totalMembers: Array.from(voice.activeChannels.values())
                        .reduce((sum, channel) => sum + channel.memberCount, 0)
                }
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log(`👤 User disconnected: ${socket.id}`);
    });
});

// Discord bot events
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`🔗 Connected to ${client.guilds.cache.size} guilds`);
    
    // Update owner profile with bot info
    ownerProfile.avatar = client.user.displayAvatarURL({ dynamic: true, size: 256 });
    ownerProfile.botTag = client.user.tag;
    
    // Initial data fetch
    await fetchServerData();
    
    // Set up periodic updates (every 2 minutes for real-time feel)
    setInterval(async () => {
        try {
            await fetchServerData();
        } catch (error) {
            console.error('❌ Error in periodic update:', error);
        }
    }, 2 * 60 * 1000); // 2 minutes
});

// Enhanced event tracking
client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    
    const serverId = serverConfig.find(s => s.guildId === message.guild?.id)?.id;
    if (serverId) {
        const activity = activityTracker.get(serverId);
        if (activity) {
            activity.totalMessages++;
            activity.activeUsers.add(message.author.id);
            
            if (!activity.channelActivity.has(message.channel.id)) {
                activity.channelActivity.set(message.channel.id, 0);
            }
            activity.channelActivity.set(message.channel.id, 
                activity.channelActivity.get(message.channel.id) + 1);
            
            // Emit real-time activity update
            io.emit('activityUpdate', {
                serverId,
                totalMessages: activity.totalMessages,
                activeUsers: activity.activeUsers.size
            });
        }
    }
});

// Voice state tracking
client.on('voiceStateUpdate', (oldState, newState) => {
    const serverId = serverConfig.find(s => s.guildId === newState.guild?.id)?.id;
    if (!serverId) return;
    
    const voice = voiceTracker.get(serverId);
    if (!voice) return;
    
    // Track voice events
    voice.voiceEvents.push({
        userId: newState.member.id,
        username: newState.member.user.username,
        action: !oldState.channel && newState.channel ? 'join' : 
                oldState.channel && !newState.channel ? 'leave' : 'move',
        channel: newState.channel?.name || oldState.channel?.name,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 voice events
    if (voice.voiceEvents.length > 100) {
        voice.voiceEvents = voice.voiceEvents.slice(-100);
    }
    
    // Emit voice update
    io.emit('voiceUpdate', {
        serverId,
        event: voice.voiceEvents[voice.voiceEvents.length - 1]
    });
});

client.on('guildMemberAdd', async (member) => {
    console.log(`👋 New member joined ${member.guild.name}: ${member.user.tag}`);
    
    const serverId = serverConfig.find(s => s.guildId === member.guild.id)?.id;
    if (serverId) {
        // Update analytics
        const analytics = analyticsData.get(serverId);
        if (analytics) {
            analytics.memberGrowth.push({
                date: new Date().toISOString(),
                count: member.guild.memberCount,
                event: 'member_join'
            });
        }
        
        // Emit real-time update
        io.emit('memberUpdate', {
            serverId,
            type: 'join',
            member: {
                username: member.user.username,
                avatar: member.user.displayAvatarURL()
            },
            newCount: member.guild.memberCount
        });
    }
    
    await fetchServerData();
});

client.on('guildMemberRemove', async (member) => {
    console.log(`👋 Member left ${member.guild.name}: ${member.user.tag}`);
    
    const serverId = serverConfig.find(s => s.guildId === member.guild.id)?.id;
    if (serverId) {
        const analytics = analyticsData.get(serverId);
        if (analytics) {
            analytics.memberGrowth.push({
                date: new Date().toISOString(),
                count: member.guild.memberCount,
                event: 'member_leave'
            });
        }
        
        io.emit('memberUpdate', {
            serverId,
            type: 'leave',
            member: {
                username: member.user.username,
                avatar: member.user.displayAvatarURL()
            },
            newCount: member.guild.memberCount
        });
    }
    
    await fetchServerData();
});

client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    client.destroy();
    server.close();
    process.exit(0);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
async function startServer() {
    try {
        await client.login(process.env.DISCORD_BOT_TOKEN);
        
        server.listen(PORT, () => {
            console.log(`🚀 Enhanced server running on http://localhost:${PORT}`);
            console.log(`📊 API endpoints:`);
            console.log(`   GET /api/servers - Get all server data with health scores`);
            console.log(`   GET /api/analytics/:serverId? - Get analytics data`);
            console.log(`   GET /api/voice/:serverId? - Get voice activity data`);
            console.log(`   GET /api/profile - Get owner profile and stats`);
            console.log(`   GET /api/health - Health check with real-time connections`);
            console.log(`🔌 WebSocket events: serverUpdate, globalStatsUpdate, activityUpdate, voiceUpdate, memberUpdate`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();