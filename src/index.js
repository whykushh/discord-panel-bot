import 'dotenv/config';
import express from 'express';
import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  REST,
  Routes,
  PermissionFlagsBits,
} from 'discord.js';
import { load, save, ensureCommandsShape } from './store.js';
import { isOwner, panelEmbed, panelRows } from './panelFlows.js';

const {
  TOKEN,
  CLIENT_ID,
  OWNER_ID,
  PORT = 3000,
  // optional: you can move these IDs to env vars later if you want
} = process.env;

// ====== ROLE & CHANNEL CONFIG (from your message) ======
const ANNOUNCE_ROLES = ['1427697103429439609', '1425545157025206363', '1431297090398588968'];
const TRIAL_ALLOWED_ROLES = ['1425545157025206363', '1431297090398588968'];
const TRIAL_ROLE_ID = '1425545178810417214';
const STAFF_LOG_CHANNEL_ID = '1435606251944804475';
const AQUA = 0x00ffff;

// ====== Keepalive (Render/UptimeRobot) ======
const app = express();
app.get('/', (_, res) => res.status(200).send('OK'));
app.listen(PORT, () => console.log(`Keepalive on :${PORT}`));

// ====== Discord client ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,   // for keyword triggers
    GatewayIntentBits.MessageContent,  // enable in Dev Portal
  ],
});
const rest = new REST({ version: '10' }).setToken(TOKEN);

// drafts kept per user during flows
const embedDrafts = new Map();   // userId -> EmbedBuilder (announce/embed)
const textDrafts  = new Map();   // userId -> string (announce/text)

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  ensureCommandsShape();
});

// ========= Keyword triggers (from /panel text commands) =========
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (!msg.guild || msg.author.bot) return;
    const store = load('commands.json');
    if (!store?.textCommands?.length) return;
    const content = msg.content.toLowerCase();
    for (const entry of store.textCommands) {
      const kw = (entry.keyword || '').toLowerCase();
      if (kw && content.includes(kw)) {
        await msg.channel.send(entry.response || '');
        break;
      }
    }
  } catch (err) {
    console.error('Text trigger error:', err);
  }
});

// ========= Interactions =========
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ===== /panel (owner only; unchanged panel UI lives in panelFlows.js) =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });
      await interaction.reply({ embeds: [panelEmbed()], components: panelRows(), ephemeral: true });
      return;
    }

    // ===== /announce (role-gated) =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'announce') {
      if (!hasAnyRole(interaction.member, ANNOUNCE_ROLES))
        return interaction.reply({ content: 'You lack permission for /announce.', ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('announce_type')
          .setPlaceholder('Choose announcement type')
          .addOptions(
            { label: 'Embed', value: 'embed', description: 'Send an embedded announcement' },
            { label: 'Text',  value: 'text',  description: 'Send a plain text announcement' },
          )
      );
      return interaction.reply({ content: 'Pick a type:', components: [row], ephemeral: true });
    }

    // ===== /trial (role-gated) =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'trial') {
      if (!hasAnyRole(interaction.member, TRIAL_ALLOWED_ROLES))
        return interaction.reply({ content: 'You lack permission for /trial.', ephemeral: true });

      const target = interaction.options.getUser('user', true);
      const action = interaction.options.getString('action', true); // 'accept' | 'decline'

      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: 'User not found in this guild.', ephemeral: true });

      // Modify roles
      try {
        if (action === 'accept') {
          await member.roles.add(TRIAL_ROLE_ID);
        } else {
          await member.roles.remove(TRIAL_ROLE_ID);
        }
      } catch (e) {
        console.error('Role edit error:', e);
        // Needs bot to have Manage Roles & correct role position
        return interaction.reply({ content: '❌ Failed to edit roles. Check bot permissions/role position.', ephemeral: true });
      }

      // DM the user with an embed
      const dmEmbed = new EmbedBuilder()
        .setColor(AQUA)
        .setTitle(action === 'accept' ? 'Promotion to Trial Mod' : 'Trial Mod Status Update')
        .setDescription(
          action === 'accept'
            ? 'Congrats! You’ve been promoted to **Trial Moderator**.'
            : 'You’ve been **removed** from the Trial Moderator position.'
        );
      try {
        const dm = await target.createDM();
        await dm.send({ embeds: [dmEmbed] });
      } catch {
        // ignore DM failures
      }

      // Staff log message
      const logChannel = await client.channels.fetch(STAFF_LOG_CHANNEL_ID).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setColor(AQUA)
          .setTitle('Trial Mod Action')
          .addFields(
            { name: 'User', value: `<@${target.id}> (${target.id})`, inline: true },
            { name: 'Action', value: action === 'accept' ? 'Accepted' : 'Declined', inline: true },
            { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
          )
          .setTimestamp(new Date());
        await logChannel.send({ embeds: [logEmbed] });
      }

      return interaction.reply({
        content: `✅ ${action === 'accept' ? 'Promoted' : 'Demoted'} <@${target.id}> ${action === 'accept' ? 'to' : 'from'} Trial Mod.`,
        ephemeral: true,
      });
    }

    // ===== Saved custom slash commands from /panel =====
    if (interaction.isChatInputCommand() && !['panel','announce','trial'].includes(interaction.commandName)) {
      const store = load('commands.json');
      const found = store.slashCommands?.find(c => c.name === interaction.commandName);
      if (found) return interaction.reply({ content: found.response || 'OK' });
      return;
    }

    // ===== BUTTONS / SELECTS / MODALS =====
    if (interaction.isStringSelectMenu()) {
      // announce type pick
      if (interaction.customId === 'announce_type') {
        if (!hasAnyRole(interaction.member, ANNOUNCE_ROLES))
          return interaction.reply({ content: 'You lack permission for /announce.', ephemeral: true });

        const choice = interaction.values[0];
        if (choice === 'embed') {
          const modal = new ModalBuilder()
            .setCustomId('announce_embed_modal')
            .setTitle('Announce: Embed')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('author').setLabel('Author').setStyle(TextInputStyle.Short).setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('footer').setLabel('Footer').setStyle(TextInputStyle.Short).setRequired(false)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('color').setLabel('Color (hex, e.g. #5865F2)').setStyle(TextInputStyle.Short).setRequired(false)
              ),
            );
          return interaction.showModal(modal);
        }

        if (choice === 'text') {
          const modal = new ModalBuilder()
            .setCustomId('announce_text_modal')
            .setTitle('Announce: Text')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('text').setLabel('Message').setStyle(TextInputStyle.Paragraph).setRequired(true)
              )
            );
          return interaction.showModal(modal);
        }
      }
      return;
    }

    if (interaction.isChannelSelectMenu()) {
      // final step for /announce (both text & embed)
      if (interaction.customId === 'announce_channel_pick') {
        if (!hasAnyRole(interaction.member, ANNOUNCE_ROLES))
          return interaction.reply({ content: 'You lack permission for /announce.', ephemeral: true });

        const chId = interaction.values[0];
        const eb = embedDrafts.get(interaction.user.id);
        const txt = textDrafts.get(interaction.user.id);
        if (!eb && !txt) {
          return interaction.reply({ content: 'Nothing to announce. Start again with /announce.', ephemeral: true });
        }
        try {
          const channel = await client.channels.fetch(chId);
          if (!channel || !channel.isTextBased()) throw new Error('Channel invalid');
          if (eb) {
            await channel.send({ embeds: [eb] });
            embedDrafts.delete(interaction.user.id);
          } else if (txt) {
            await channel.send({ content: txt });
            textDrafts.delete(interaction.user.id);
          }
          return interaction.reply({ content: '✅ Announcement posted.', ephemeral: true });
        } catch (e) {
          console.error('Announce send error:', e);
          return interaction.reply({ content: '❌ Failed to post announcement.', ephemeral: true });
        }
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      // /announce → embed form submitted → ask for channel
      if (interaction.customId === 'announce_embed_modal') {
        if (!hasAnyRole(interaction.member, ANNOUNCE_ROLES))
          return interaction.reply({ content: 'You lack permission for /announce.', ephemeral: true });

        const title = interaction.fields.getTextInputValue('title')?.trim();
        const description = interaction.fields.getTextInputValue('description')?.trim();
        const author = interaction.fields.getTextInputValue('author')?.trim();
        const footer = interaction.fields.getTextInputValue('footer')?.trim();
        const color = interaction.fields.getTextInputValue('color')?.trim();

        const eb = new EmbedBuilder();
        if (title) eb.setTitle(title.slice(0, 256));
        if (description) eb.setDescription(description.slice(0, 4096));
        if (author) eb.setAuthor({ name: author.slice(0, 256) });
        if (footer) eb.setFooter({ text: footer.slice(0, 2048) });
        if (color && /^#?[0-9a-f]{6}$/i.test(color)) eb.setColor(parseInt(color.replace('#',''), 16));

        embedDrafts.set(interaction.user.id, eb);

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('announce_channel_pick')
            .setPlaceholder('Select a channel')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setMinValues(1).setMaxValues(1)
        );
        return interaction.reply({ content: 'Select a channel to post the embed:', components: [row], ephemeral: true });
      }

      // /announce → text form submitted → ask for channel
      if (interaction.customId === 'announce_text_modal') {
        if (!hasAnyRole(interaction.member, ANNOUNCE_ROLES))
          return interaction.reply({ content: 'You lack permission for /announce.', ephemeral: true });

        const text = interaction.fields.getTextInputValue('text')?.trim();
        if (!text) return interaction.reply({ content: 'Message is required.', ephemeral: true });
        textDrafts.set(interaction.user.id, text);

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('announce_channel_pick')
            .setPlaceholder('Select a channel')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setMinValues(1).setMaxValues(1)
        );
        return interaction.reply({ content: 'Select a channel to post the message:', components: [row], ephemeral: true });
      }

      // ===== /panel modals and others (existing flows) are handled in your current code =====
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
    if (interaction.isRepliable())
      try { await interaction.reply({ content: 'Something went wrong.', ephemeral: true }); } catch {}
  }
});

// ===== Helper: has any role =====
function hasAnyRole(member, roleIds = []) {
  if (!member || !member.roles) return false;
  return roleIds.some((rid) => member.roles.cache.has(rid));
}

// ===== Rebuild command list for dynamic slash commands created via /panel =====
function buildGuildCommands(store) {
  const cmds = [
    { name: 'panel',    description: 'Open the owner control panel', type: 1 },
    { name: 'announce', description: 'Create an announcement (embed or text)', type: 1 },
    {
      name: 'trial',
      description: 'Accept or decline a trial moderator',
      type: 1,
      options: [
        { name: 'user',   description: 'Target user', type: 6, required: true },
        {
          name: 'action', description: 'Action', type: 3, required: true,
          choices: [{ name: 'accept', value: 'accept' }, { name: 'decline', value: 'decline' }]
        },
      ],
    },
  ];
  for (const cmd of (store.slashCommands || [])) {
    // avoid name collisions with built-ins
    if (['panel','announce','trial'].includes(cmd.name)) continue;
    cmds.push({ name: cmd.name, description: 'Custom command', type: 1 });
  }
  return cmds;
}

// Expose for reuse by /panel flows that register new slash commands
export async function reregisterGuildCommandsFor(guildId) {
  const store = load('commands.json');
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: buildGuildCommands(store) });
}

client.login(TOKEN);
