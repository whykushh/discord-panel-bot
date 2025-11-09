import 'dotenv/config';
import express from 'express';
import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { load } from './store.js';
import { isOwner, panelEmbed, panelRows } from './panelFlows.js';

const { TOKEN, OWNER_ID, PORT = 3000 } = process.env;

// === Keepalive for Render ===
const app = express();
app.get('/', (_, res) => res.status(200).send('OK'));
app.listen(PORT, () => console.log(`Keepalive on :${PORT}`));

// === Discord client ===
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once(Events.ClientReady, (c) => console.log(`✅ Logged in as ${c.user.tag}`));

// === Interaction handler ===
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Slash command: /panel
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });

      await interaction.reply({
        embeds: [panelEmbed()],
        components: panelRows(),
        ephemeral: true
      });
      return;
    }

    // Slash command: /cmd run
    if (interaction.isChatInputCommand() && interaction.commandName === 'cmd') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'run') {
        const store = load('commands.json');
        const name = interaction.options.getString('name');
        const found = store.commands.find((c) => c.name === name);
        if (!found)
          return interaction.reply({ content: 'Command not found.', ephemeral: true });

        if (found.type === 'text')
          return interaction.reply({ content: found.payload });

        if (found.type === 'embed') {
          const eStore = load('embeds.json');
          const eb = eStore.embeds.find((e) => e.key === found.payload);
          if (!eb)
            return interaction.reply({
              content: 'Embed not found for this command.',
              ephemeral: true
            });
          return interaction.reply({
            embeds: [new EmbedBuilder(eb.embed)],
            components: eb.components?.length
              ? eb.components.map((r) => ({ ...r }))
              : []
          });
        }
      }
      return;
    }

    // === Button clicks ===
    if (interaction.isButton()) {
      if (!isOwner(interaction, OWNER_ID))
        return interaction.reply({ content: 'Owner only.', ephemeral: true });

      const id = interaction.customId;
      if (id === 'make_embed')
        return interaction.reply({
          content: '🛠 Embed builder coming soon!',
          ephemeral: true
        });

      if (id === 'create_command')
        return interaction.reply({
          content: '🧩 Command creator coming soon!',
          ephemeral: true
        });

      if (id === 'list_commands') {
        const store = load('commands.json');
        const list =
          store.commands.map((c) => `• **${c.name}** — ${c.type}`).join('\n') ||
          'No commands yet.';
        return interaction.reply({ content: list, ephemeral: true });
      }

      // If button not recognized
      return interaction.reply({
        content: `Clicked unknown button: ${id}`,
        ephemeral: true
      });
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
    if (interaction.isRepliable())
      await interaction.reply({ content: 'Something went wrong.', ephemeral: true });
  }
});

client.login(TOKEN);
