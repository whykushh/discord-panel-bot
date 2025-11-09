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

// ---------- Keepalive (for Render/uptime pinger) ----------
const app = express();
app.get('/', (_, res) => res.status(200).send('OK'));
app.listen(PORT, () => console.log(`Keepalive on :${PORT}`));

// ---------- Discord client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const rest = new REST({ version: '10' }).setToken(TOKEN);
const embedDrafts = new Map(); // userId -> EmbedBuilder

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  ensureCommandsShape();
});

// ---------- Keyword triggers ----------
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

// ---------- Interactions ----------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // /panel
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });

      await interaction.reply({
        embeds: [panelEmbed()],
        components: panelRows(),
        ephemeral: true,
      });
      return;
    }

    // Run saved slash commands
    if (interaction.isChatInputCommand() && interaction.commandName !== 'panel') {
      const store = load('commands.json');
      const found = store.slashCommands?.find(
        (c) => c.name === interaction.commandName
      );
      if (found) return interaction.reply({ content: found.response || 'OK' });
      return;
    }

    // ----- BUTTONS -----
    if (interaction.isButton()) {
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });

      const id = interaction.customId;

      if (id === 'create_cmd') {
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('create_cmd_type')
            .setPlaceholder('Choose command type')
            .addOptions(
              {
                label: 'Text (keyword trigger)',
                value: 'text',
                description: 'Reply when a message contains a keyword',
              },
              {
                label: 'Slash command',
                value: 'slash',
                description: 'Create a real /slash command',
              }
            )
        );
        return interaction.reply({
          content: 'What type of command?',
          components: [row],
          ephemeral: true,
        });
      }

      if (id === 'create_embed') {
        const modal = new ModalBuilder()
          .setCustomId('modal_create_embed')
          .setTitle('Create Embed')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('author')
                .setLabel('Author')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('footer')
                .setLabel('Footer')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('color')
                .setLabel('Color (hex like #5865F2)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
            )
          );
        return interaction.showModal(modal);
      }

      if (id === 'list_cmds') {
        const store = load('commands.json');
        const textList =
          store.textCommands?.length
            ? store.textCommands
                .map((c) => `• **${c.keyword}** → “${c.response?.slice(0, 80)}”`)
                .join('\n')
            : '— none —';
        const slashList =
          store.slashCommands?.length
            ? store.slashCommands
                .map((c) => `• **/${c.name}** → “${c.response?.slice(0, 80)}”`)
                .join('\n')
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
      return;
    }

    // ----- SELECT MENUS -----
    if (interaction.isStringSelectMenu()) {
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });

      if (interaction.customId === 'create_cmd_type') {
        const type = interaction.values[0];

        if (type === 'text') {
          const modal = new ModalBuilder()
            .setCustomId('modal_create_text')
            .setTitle('Create Text Command')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('keyword')
                  .setLabel('Keyword (case-insensitive)')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('response')
                  .setLabel('Response message')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true)
              )
            );
          return interaction.showModal(modal);
        }

        if (type === 'slash') {
          const modal = new ModalBuilder()
            .setCustomId('modal_create_slash')
            .setTitle('Create Slash Command')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('name')
                  .setLabel('Slash name (a-z0-9-_ up to 32)')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
              ),
              new ActionRowBuilder().addComponents(
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
      return;
    }

    // ----- CHANNEL SELECT -----
    if (interaction.isChannelSelectMenu()) {
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });

      if (interaction.customId === 'embed_channel_pick') {
        const channelId = interaction.values[0];
        const draft = embedDrafts.get(interaction.user.id);
        if (!draft)
          return interaction.reply({
            content: 'No embed draft found.',
            ephemeral: true,
          });
        try {
          const channel = await client.channels.fetch(channelId);
          await channel.send({ embeds: [draft] });
          embedDrafts.delete(interaction.user.id);
          return interaction.reply({ content: '✅ Embed sent.', ephemeral: true });
        } catch (e) {
          console.error('Send embed error:', e);
          return interaction.reply({
            content: '❌ Failed to send embed.',
            ephemeral: true,
          });
        }
      }
      return;
    }

    // ----- MODALS -----
    if (interaction.isModalSubmit()) {
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });

      if (interaction.customId === 'modal_create_text') {
        const keyword = interaction.fields.getTextInputValue('keyword').trim();
        const response = interaction.fields.getTextInputValue('response').trim();
        const store = load('commands.json');
        store.textCommands.push({ keyword, response });
        save('commands.json', store);
        return interaction.reply({
          content: `✅ Text command created. Trigger: **${keyword}**`,
          ephemeral: true,
        });
      }

      if (interaction.customId === 'modal_create_slash') {
        const name = interaction.fields.getTextInputValue('name').trim().toLowerCase();
        const response = interaction.fields.getTextInputValue('response').trim();
        const store = load('commands.json');
        store.slashCommands.push({ name, response });
        save('commands.json', store);

        // Re-register all slash commands including /panel
        await rest.put(
          Routes.applicationGuildCommands(CLIENT_ID, interaction.guildId),
          { body: buildGuildCommands(store) }
        );

        return interaction.reply({
          content: `✅ Slash command **/${name}** created & registered.`,
          ephemeral: true,
        });
      }

      if (interaction.customId === 'modal_create_embed') {
        const title = interaction.fields.getTextInputValue('title')?.trim();
        const description = interaction.fields.getTextInputValue('description')?.trim();
        const author = interaction.fields.getTextInputValue('author')?.trim();
        const footer = interaction.fields.getTextInputValue('footer')?.trim();
        const color = interaction.fields.getTextInputValue('color')?.trim();

        const eb = new EmbedBuilder();
        if (title) eb.setTitle(title.slice(0, 256));
        if (description) eb.setDescription(description.slice(0, 4096));
        if (author) eb.setAuthor({ name: author });
        if (footer) eb.setFooter({ text: footer });
        if (color && /^#?[0-9a-f]{6}$/i.test(color))
          eb.setColor(parseInt(color.replace('#', ''), 16));

        embedDrafts.set(interaction.user.id, eb);

        const row = new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder()
            .setCustomId('embed_channel_pick')
            .setPlaceholder('Select a channel to send this embed')
            .setChannelTypes(ChannelType.GuildText)
            .setMinValues(1)
            .setMaxValues(1)
        );

        return interaction.reply({
          content: 'Select a channel to send this embed:',
          components: [row],
          ephemeral: true,
        });
      }
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
    if (interaction.isRepliable())
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
  }
});

// Rebuild command list (panel + user-created)
function buildGuildCommands(store) {
  const cmds = [
    { name: 'panel', description: 'Open the owner control panel', type: 1 },
  ];
  for (const cmd of store.slashCommands || [])
    cmds.push({ name: cmd.name, description: 'Custom command', type: 1 });
  return cmds;
}

client.login(TOKEN);
