import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  EmbedBuilder,
  ChannelType
} from 'discord.js';

const CONFIG = {
  token: 'DISCORD_BOT_TOKEN',
  presenceName: 'Anti Spam • made by gabjeksuper',
  presenceStatus: 'dnd',
  timeoutMs: 24 * 60 * 60 * 1000,
  logChannelId: '',
  antiSpamChannelId: '',
  enablePublicLog: false,
  antiSpamRoleId: '',
  allowedRoleIds: [],
  exemptCategories: [],
  exemptChannels: [],
  deleteDuplicatesWindowMs: 10 * 60 * 1000,
  detectionRegex: /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite|steamcommunity\.com|store\.steampowered\.com|steamcommunit(?:y|ry)\.com|steemcommunity\.com|steeamcommunity\.com|steeamcommunnity\.com|steamwcommunnity\.com|steancommunitry\.com)/i
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

const spamBuffer = new Map();

async function flushSpamBuffer(userId) {
  const data = spamBuffer.get(userId);
  if (!data) return;
  const { messages } = data;
  if (!messages.length) return;

  const user = messages[0]?.member?.user ?? messages[0]?.author;
  const channels = [...new Set(messages.map(m => m.channel?.id))].filter(Boolean).map(id => `<#${id}>`).join(', ') || 'N/A';

  let contentList = messages.map((m, i) => `${i + 1}) ${m.content || '(no content)'}`).join('\n');
  const chunkSize = 1024;
  const chunks = [];
  for (let i = 0; i < contentList.length; i += chunkSize) {
    chunks.push(contentList.slice(i, i + chunkSize));
  }

  const base = new EmbedBuilder()
    .setColor('#ff9c00')
    .setTitle('Timeout applied to a potential spammer')
    .setThumbnail('https://media.discordapp.net/attachments/1270040898742521866/1406203680041992353/215656733.png?ex=68a19cbb&is=68a04b3b&hm=8212c4ea80532fde93626cdce94d3f8924bb76621abe237577a11db24e85dc41&=&format=webp&quality=lossless')
    .setFooter({ text: '• Anti spam' })
    .addFields(
      { name: 'User', value: user ? `${user.tag ?? user.username} | ${user.id}` : 'Unknown' },
      { name: 'Channels', value: channels || 'N/A' },
    );

  const logChannel = CONFIG.logChannelId ? client.channels.cache.get(CONFIG.logChannelId) : null;
  if (logChannel) {
    try {
      if (chunks[0]) base.addFields({ name: 'Content 1', value: chunks[0] });
      await logChannel.send({ embeds: [base] });
      for (let i = 1; i < chunks.length; i++) {
        const e = new EmbedBuilder()
          .setColor('#ff9c00')
          .setThumbnail('https://media.discordapp.net/attachments/1270040898742521866/1406203680041992353/215656733.png?ex=68a19cbb&is=68a04b3b&hm=8212c4ea80532fde93626cdce94d3f8924bb76621abe237577a11db24e85dc41&=&format=webp&quality=lossless')
          .setFooter({ text: '• Anti spam' })
          .addFields({ name: `Content ${i + 1}`, value: chunks[i] });
        await logChannel.send({ embeds: [e] });
      }
    } catch (err) {
      console.error('[log] send failed:', err?.message);
    }
  }

  spamBuffer.delete(userId);
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: CONFIG.presenceName, type: ActivityType.Playing }],
    status: CONFIG.presenceStatus
  });
});

client.on('messageCreate', async (message) => {
  try {
    if (!message?.guild) return;
    if (message.author?.bot) return;

    const inExemptChannel = CONFIG.exemptChannels.includes(message.channel?.id);
    const parentId = message.channel?.parentId ?? null;
    const inExemptCategory = parentId && CONFIG.exemptCategories.includes(parentId);
    if (inExemptChannel || inExemptCategory) return;

    let member = message.member;
    if (!member) {
      try { member = await message.guild.members.fetch(message.author.id); } catch {}
    }
    if (!member) return;

    const hasAllowedRole = CONFIG.allowedRoleIds.some(rid => member.roles.cache.has(rid));
    if (hasAllowedRole) return;

    const content = (message.content || '').toLowerCase();
    if (!CONFIG.detectionRegex.test(content)) return;

    try { await message.delete().catch(() => {}); } catch {}

    try { await member.timeout(CONFIG.timeoutMs, 'Detected suspicious link'); } catch {}

    if (CONFIG.antiSpamRoleId) {
      try { await member.roles.add(CONFIG.antiSpamRoleId).catch(() => {}); } catch {}
    }

    const uid = message.author.id;
    if (!spamBuffer.has(uid)) spamBuffer.set(uid, { messages: [], timer: null });
    const buf = spamBuffer.get(uid);
    buf.messages.push({ content: message.content, channel: message.channel, member });
    if (!buf.timer) {
      buf.timer = setTimeout(() => { flushSpamBuffer(uid); }, 3000);
    }

    if (CONFIG.enablePublicLog && CONFIG.antiSpamChannelId) {
      const ch = client.channels.cache.get(CONFIG.antiSpamChannelId);
      if (ch) {
        const e = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('Anti-Spam System')
          .setDescription(`Assigned <@&${CONFIG.antiSpamRoleId}> to <@${uid}> for attempted spam.`)
          .setFooter({ text: '• Powered by gabjeksuper' });
        try { await ch.send({ embeds: [e] }); } catch (err) { console.error('[public-log] send failed:', err?.message); }
      }
    }

    await deleteIdenticalMessagesAcrossGuild(message, member, content);
  } catch (err) {
    console.error('[messageCreate] error:', err?.message);
  }
});

async function deleteIdenticalMessagesAcrossGuild(triggerMsg, member, contentLower) {
  const cutoff = Date.now() - CONFIG.deleteDuplicatesWindowMs;
  const guild = triggerMsg.guild;
  if (!guild) return;

  const channels = guild.channels.cache.filter(c => {
    const isText =
      c?.type === ChannelType.GuildText ||
      c?.type === ChannelType.GuildAnnouncement ||
      c?.isTextBased?.();
    if (!isText) return false;
    if (CONFIG.exemptChannels.includes(c.id)) return false;
    const catId = c.parentId ?? null;
    if (catId && CONFIG.exemptCategories.includes(catId)) return false;
    return true;
  });

  for (const [, ch] of channels) {
    try {
      const msgs = await ch.messages?.fetch({ limit: 100 }).catch(() => null);
      if (!msgs) continue;
      for (const [, m] of msgs) {
        if (!m?.author || m.author.bot) continue;
        if (m.author.id !== member.id) continue;
        const ts = m.createdTimestamp ?? 0;
        if (ts < cutoff) continue;
        const same = (m.content || '').toLowerCase() === contentLower;
        if (!same) continue;
        if (m.id === triggerMsg.id) continue;
        try { await m.delete().catch(() => {}); } catch {}
      }
    } catch (err) {
      console.error(`[sweep] channel ${ch?.id} failed:`, err?.message);
    }
  }
}

process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException',  (e) => console.error('[uncaughtException]', e?.message));

const tok = String(CONFIG.token || '').trim();
if (!tok || tok === 'DISCORD_BOT_TOKEN') {
  console.error('No token provided');
  process.exit(1);
}
client.login(tok).catch(err => {
  console.error('[login] failed:', err?.message || err);
  process.exit(1);
});
