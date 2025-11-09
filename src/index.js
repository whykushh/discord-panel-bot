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
} from 'discord.js';
import { load, save, ensureCommandsShape } from './store.js';
import { isOwner, panelEmbed, panelRows } from './panelFlows.js';

const { TOKEN, CLIENT_ID, OWNER_ID, PORT = 3000 } = process.env;

// ---------- Keepalive (Render/uptime pinger) ----------
const app = express();
app.get('/', (_, res) => res.status(200).send('OK'));
app.listen(PORT, () => console.log(`Keepalive on :${PORT}`));

// ---------- Discord client (intents include messages for keyword triggers) ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,     // needed for messageCreate
    GatewayIntentBits.MessageContent,    // enable in Dev Portal too
  ],
});

// dynamic slash registration
const rest = new REST({ version: '10' }).setToken(TOKEN);

// in-memory draft embeds per user (after modal, before channel pick)
const embedDrafts = new Map(); // userId -> EmbedBuilder

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  ensureCommandsShape(); // make sure data/commands.json has {textCommands, slashCommands}
});

// ---------- Message keyword triggers (Text Command type) ----------
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (!msg.guild || msg.author.bot) return;
    const store = load('commands.json');
    if (!store?.textCommands?.length) return;

    const content = msg.content.toLowerCase();
    for (const entry of store.textCommands) {
      const kw = (entry.keyword || '').toLowerCase();
      if (!kw) continue;
      if (content.includes(kw)) {
        await msg.channel.send(entry.response || '');
        break; // one match per message
      }
    }
  } catch (err) {
    console.error('Text trigger error:', err);
  }
});

// ---------- Interactions ----------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ===== Slash: /panel =====
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
      if (!isOwner(interaction, OWNER_ID)) {
        return interaction.reply({ content: 'Owner only.', ephemeral: true });
      }
      await interaction.reply({
        embeds: [panelEmbed()],
        components: panelRows(),
        ephemeral: true,
      });
      return;
    }

    // ===== Dynamic Slash Commands (created via panel) =====
    if (interaction.isChatInputCommand() && interaction.commandName !== 'panel') {
      // respond if it's one of our saved slash commands
      const store = load('commands.json');
      const found = store.slashCommands?.find(c => c.name === interaction.commandName);
      if (found) {
        return interaction.reply({ content: found.response || 'OK' });
      }
      // else ignore; could be other commands you register elsewhere
      return;
    }

    // ===== Buttons =====
    if (interaction.isButton()) {
      if (!isOwner(interaction, OWNER_ID)) {
        await interaction.reply({ content: 'Owner only.', ephemeral: true });
        return;
      }
      const id = interaction.customId;

      // 1) Create command → selection (text/slash)
      if (id === 'create_cmd') {
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('create_cmd_type')
            .setPlaceholder('Choose command type')
            .addOptions(
              { label: 'Text (keyword trigger)', value: 'text', description: 'Reply when a message contains a keyword' },
              { label: 'Slash command', value: 'slash', description: 'Create a real /slash command' },
            )
        );
        return interaction.reply({ content: 'What type of command?', components: [row], ephemeral: true });
      }

      // 2) Create embed → open modal
      if (id === 'create_embed') {
        const modal = new ModalBuilder()
          .setCustomId('modal_create_embed')
          .setTitle('Create Embed')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('author')
                .setLabel('Author (name)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('footer')
                .setLabel('Footer')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color (hex like #5865F2)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            )
          );
        return interaction.showModal(modal);
      }

      // 3) List commands
      if (id === 'list_cmds') {
        const store = load('commands.json');
        const textList = store.textCommands?.length
          ? store.textCommands.map(c => `• **${c.keyword}** → "${c.response?.slice(0, 80)}"`).join('\n')
          : '— none —';
        const slashList = store.slashCommands?.length
          ? store.slashCommands.map(c => `• **/${c.name}** → "${c.response?.slice(0, 80)}"`).join('\n')
          : '— none —';
        const eb = new EmbedBuilder()
          .setTitle('Saved Commands')
          .addFields(
            { name: 'Text (keyword) commands', value: textList },
            { name: 'Slash commands', value: slashList }
          )
          .setColor(0x5865f2);
        return interaction.reply({ embeds: [eb], ephemeral: true });
      }

      return; // unknown button ignored safely
    }

    // ===== Select menus =====
    if (interaction.isStringSelectMenu()) {
      if (!isOwner(interaction, OWNER_ID)) {
        await interaction.reply({ content: 'Owner only.', ephemeral: true });
        return;
      }

      // After "Create command" button: choose type → show proper modal
      if (interaction.customId === 'create_cmd_type') {
        const choice = interaction.values[0]; // 'text' | 'slash'

        if (choice === 'text') {
          const modal = new ModalBuilder()
            .setCustomId('modal_create_text_cmd')
            .setTitle('Create Text Command (keyword trigger)')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('keyword')
                  .setLabel('Keyword (case-insensitive, matched in message)')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('response')
                  .setLabel('Response text')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true)
              )
            );
          return interaction.showModal(modal);
        }

        if (choice === 'slash') {
          const modal = new ModalBuilder()
            .setCustomId('modal_create_slash_cmd')
            .setTitle('Create Slash Command')
            .addComponents(
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('name')
                  .setLabel('Slash name (a-z0-9-_ up to 32)')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                  .setCustomId('response')
                  .setLabel('Response text')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true)
              )
            );
          return interaction.showModal(modal);
        }
      }

      // Channel picker after embed modal (we’ll use ChannelSelectMenu instead of StringSelect for channels)
      return;
    }

    if (interaction.isChannelSelectMenu()) {
      if (!isOwner(interaction, OWNER_ID)) {
        await interaction.reply({ content: 'Owner only.', ephemeral: true });
        return;
      }
      if (interaction.customId === 'embed_channel_pick') {
        const chId = interaction.values[0];
        const draft = embedDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({ content: 'No embed draft found.', ephemeral: true });
        }
        try {
          const channel = await client.channels.fetch(chId);
          await channel.send({ embeds: [draft] });
          embedDrafts.delete(interaction.user.id);
          return interaction.reply({ content: '✅ Embed sent.', ephemeral: true });
        } catch (e) {
          console.error('Send embed error:', e);
          return interaction.reply({ content: '❌ Failed to send embed.', ephemeral: true });
        }
      }
      return;
    }

    // ===== Modals =====
    if (interaction.isModalSubmit()) {
      if (!isOwner(interaction, OWNER_ID)) {
        await interaction.reply({ content: 'Owner only.', ephemeral: true });
        return;
      }

      // Create Text (keyword) Command
      if (interaction.customId === 'modal_create_text_cmd') {
        const keyword = interaction.fields.getTextInputValue('keyword').trim();
        const response = interaction.fields.getTextInputValue('response').trim();

        if (!keyword || !response) {
          return interaction.reply({ content: 'Keyword and response are required.', ephemeral: true });
        }

        const store = load('commands.json');
        store.textCommands = store.textCommands || [];
        store.textCommands.push({ keyword, response });
        save('commands.json', store);

        return interaction.reply({ content: `✅ Text command created. Trigger: **${keyword}**`, ephemeral: true });
      }

      // Create Slash Command
      if (interaction.customId === 'modal_create_slash_cmd') {
        const name = interaction.fields.getTextInputValue('name').trim().toLowerCase();
        const response = interaction.fields.getTextInputValue('response').trim();

        if (!/^[-a-z0-9_]{1,32}$/.test(name)) {
          return interaction.reply({ content: 'Invalid name. Use a-z, 0-9, -, _ (max 32).', ephemeral: true });
        }

        const store = load('commands.json');
        store.slashCommands = store.slashCommands || [];
        if (store.slashCommands.find(c => c.name === name)) {
          return interaction.reply({ content: 'A slash command with that name already exists.', ephemeral: true });
        }
        store.slashCommands.push({ name, response });
        save('commands.json', store);

        // Register command to the current guild immediately
        try {
          await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, interaction.guildId),
            {
              body: [
                // keep existing registered commands PLUS the new one
                // easiest approach: fetch current, append, but Discord overwrites the whole set.
                // So we rebuild: /panel + all saved slashCommands
                ...buildGuildCommandsPayload(store),
              ],
            }
          );
        } catch (e) {
          console.error('Slash register error:', e);
          return interaction.reply({ content: '✅ Saved, but failed to register slash. Try again later.', ephemeral: true });
        }

        return interaction.reply({ content: `✅ Slash command **/${name}** created & registered.`, ephemeral: true });
      }

      // Create Embed → then show channel picker
      if (interaction.customId === 'modal_create_embed') {
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
        if (color && /^#?[0-9a-f]{6}$/i.test(color)) eb.setColor(parseInt(color.replace('#', ''), 16));

        // Save draft and present channel picker
        embedDrafts.set(interaction.user.id, eb);

        const row = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('embed_channel_pick')
            .setPlaceholder('Select a channel to send this embed')
            .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setMinValues(1)
            .setMaxValues(1)
        );

        return interaction.reply({ content: 'Select a channel to send this embed:', components: [row], ephemeral: true });
      }
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
    if (interaction.isRepliable()) {
      try { await interaction.reply({ content: 'Something went wrong.', ephemeral: true }); } catch {}
    }
  }
});

// Build the full command set for the guild: always include /panel + saved slashCommands
function buildGuildCommandsPayload(store) {
  const payload = [
    {
      name: 'panel',
      description: 'Open the owner control panel',
      type: 1, // CHAT_INPUT
    },
  ];
  for (const cmd of (store.slashCommands || [])) {
    payload.push({
      name: cmd.name,
      description: 'Custom command',
      type: 1,
    });
  }
  return payload;
}

client.login(TOKEN);
